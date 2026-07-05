"use strict";

/**
 * Discount engine — all validation and redemption logic, backend-only,
 * ready to be called by the future storefront checkout.
 *
 * validate({ code, customerEmail, items, subtotal })
 *   -> { valid, code, discountAmount, applicableSubtotal, reasons[] }
 * redeem({ code, customerEmail, customerId?, orderId, orderNumber?, items, subtotal })
 *   -> usage record (or throws ApiError)
 *
 * items: [{ productId, quantity, price }] — price is the unit price in تومان.
 * Scoped discounts compute on the APPLICABLE subtotal (matching items only).
 */

const ApiError = require("../utils/ApiError");
const { Discount, DiscountUsage } = require("../models/Discount");
const Product = require("../models/Product");
const Order = require("../models/Order");

/* ------------------------------------------------------------------ */

async function applicableSubtotalFor(discount, items, subtotal) {
  const scopedProducts = (discount.products || []).map(String);
  const scopedCategories = (discount.categories || []).map(String);
  if (!scopedProducts.length && !scopedCategories.length) {
    return subtotal; // unscoped: whole cart
  }
  if (!items || !items.length) return 0;

  // Resolve item categories in one query.
  const ids = items.map((i) => i.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: ids } }).select("category");
  const catByProduct = new Map(products.map((p) => [String(p._id), String(p.category)]));

  let sum = 0;
  for (const it of items) {
    const pid = String(it.productId || "");
    const matchesProduct = scopedProducts.includes(pid);
    const matchesCategory = scopedCategories.includes(catByProduct.get(pid) || "");
    if (matchesProduct || matchesCategory) {
      sum += (Number(it.price) || 0) * (Number(it.quantity) || 0);
    }
  }
  return sum;
}

function computeAmount(discount, applicableSubtotal) {
  let amount;
  if (discount.kind === "percent") {
    amount = Math.floor((applicableSubtotal * discount.value) / 100);
  } else {
    amount = Math.min(discount.value, applicableSubtotal);
  }
  if (discount.maxDiscountCap != null) {
    amount = Math.min(amount, discount.maxDiscountCap);
  }
  return Math.max(0, amount);
}

/* ------------------------------------------------------------------ */

async function validate({ code, customerEmail, items = [], subtotal = 0 }) {
  const reasons = [];
  const normalized = String(code || "").toUpperCase().trim();
  const email = String(customerEmail || "").toLowerCase().trim();

  const discount = await Discount.findOne({ code: normalized });
  if (!discount) {
    return { valid: false, code: normalized, discountAmount: 0, reasons: ["کد تخفیف معتبر نیست."] };
  }

  const now = new Date();
  if (discount.status !== "active") reasons.push("این کد غیرفعال است.");
  if (discount.startsAt && now < discount.startsAt) reasons.push("زمان استفاده از این کد هنوز شروع نشده است.");
  if (discount.expiresAt && now > discount.expiresAt) reasons.push("این کد منقضی شده است.");
  if (discount.maxUses != null && discount.usedCount >= discount.maxUses) {
    reasons.push("ظرفیت استفاده از این کد تکمیل شده است.");
  }

  if (email) {
    if (discount.maxUsesPerCustomer != null) {
      const used = await DiscountUsage.countDocuments({
        discountId: discount._id,
        customerEmail: email,
      });
      if (used >= discount.maxUsesPerCustomer) {
        reasons.push("سقف استفاده شما از این کد پر شده است.");
      }
    }
    if (discount.firstPurchaseOnly) {
      const prior = await Order.countDocuments({
        "customerSnapshot.email": email,
        status: { $nin: ["cancelled"] },
      });
      if (prior > 0) reasons.push("این کد فقط برای اولین خرید معتبر است.");
    }
  } else if (discount.maxUsesPerCustomer != null || discount.firstPurchaseOnly) {
    reasons.push("این کد به ایمیل مشتری نیاز دارد.");
  }

  const applicable = await applicableSubtotalFor(discount, items, subtotal);
  const scoped = (discount.products || []).length || (discount.categories || []).length;
  if (scoped && applicable <= 0) {
    reasons.push("این کد شامل اقلام انتخاب‌شده نمی‌شود.");
  }
  if (discount.minPurchase != null && applicable < discount.minPurchase) {
    reasons.push(
      `حداقل مبلغ خرید برای این کد ${discount.minPurchase.toLocaleString("fa-IR")} تومان است.`
    );
  }

  const discountAmount = reasons.length ? 0 : computeAmount(discount, applicable);
  if (!reasons.length && discountAmount <= 0) {
    reasons.push("مبلغی برای تخفیف قابل‌اعمال نیست.");
  }

  return {
    valid: reasons.length === 0,
    code: normalized,
    kind: discount.kind,
    value: discount.value,
    applicableSubtotal: applicable,
    discountAmount: reasons.length ? 0 : discountAmount,
    reasons,
  };
}

/* ------------------------------------------------------------------ */

async function redeem({ code, customerEmail, customerId = null, orderId, orderNumber = "", items = [], subtotal = 0 }) {
  if (!orderId) throw ApiError.badRequest("orderId is required for redemption", "ORDER_REQUIRED");

  const result = await validate({ code, customerEmail, items, subtotal });
  if (!result.valid) {
    throw ApiError.badRequest(result.reasons.join(" "), "DISCOUNT_INVALID", { reasons: result.reasons });
  }

  const discount = await Discount.findOne({ code: result.code });

  // Atomic capacity claim: increments only while below maxUses, so
  // concurrent redemptions can never exceed the limit.
  const claim = await Discount.findOneAndUpdate(
    {
      _id: discount._id,
      ...(discount.maxUses != null ? { usedCount: { $lt: discount.maxUses } } : {}),
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
  if (!claim) {
    throw ApiError.conflict("ظرفیت استفاده از این کد تکمیل شده است.", "EXHAUSTED");
  }

  try {
    const usage = await DiscountUsage.create({
      discountId: discount._id,
      code: discount.code,
      customerId,
      customerEmail: String(customerEmail || "").toLowerCase(),
      orderId,
      orderNumber,
      amount: result.discountAmount,
    });
    return { usage, discountAmount: result.discountAmount };
  } catch (err) {
    // Roll the claim back on failure; the unique (discountId, orderId)
    // index turns duplicate redemption attempts into a clean 409.
    await Discount.updateOne({ _id: discount._id }, { $inc: { usedCount: -1 } });
    if (err && err.code === 11000) {
      throw ApiError.conflict("این کد قبلاً برای این سفارش استفاده شده است.", "ALREADY_REDEEMED");
    }
    throw err;
  }
}

module.exports = { validate, redeem, computeAmount, applicableSubtotalFor };
