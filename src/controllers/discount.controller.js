"use strict";

const ApiError = require("../utils/ApiError");
const { asyncHandler, ok, randomToken } = require("../utils/helpers");
const { Discount, DiscountUsage } = require("../models/Discount");
const service = require("../services/discount.service");

/* ------------------------------------------------------------------ */

async function uniqueCode() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const code = `VOOF-${randomToken(6)}`;
    // eslint-disable-next-line no-await-in-loop
    const clash = await Discount.findOne({ code });
    if (!clash) return code;
  }
}

function normalizeDates(body) {
  const out = { ...body };
  ["startsAt", "expiresAt"].forEach((k) => {
    if (out[k] === undefined) return;
    out[k] = out[k] ? new Date(out[k]) : null;
  });
  return out;
}

/* ------------------------------------------------------------------ */

const list = asyncHandler(async (req, res) => {
  const { q, status, kind, page, limit, sort } = req.query;
  const filter = {};
  if (q) {
    const rx = { $regex: q, $options: "i" };
    filter.$or = [{ code: rx }, { description: rx }];
  }
  if (status) filter.status = status;
  if (kind) filter.kind = kind;

  const [items, total] = await Promise.all([
    Discount.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Discount.countDocuments(filter),
  ]);

  return ok(
    res,
    items.map((d) => d.toAdminJSON()),
    { page, limit, total, pages: Math.ceil(total / limit) }
  );
});

const getOne = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id)
    .populate("products", "name")
    .populate("categories", "name");
  if (!discount) throw ApiError.notFound("Discount not found");

  const usages = await DiscountUsage.find({ discountId: discount._id })
    .sort({ at: -1 })
    .limit(200);

  const json = discount.toAdminJSON();
  json.usages = usages.map((u) => u.toAdminJSON());
  json.usageTotalAmount = usages.reduce((s, u) => s + u.amount, 0);
  return ok(res, json);
});

const create = asyncHandler(async (req, res) => {
  const data = normalizeDates(req.body);
  const code = data.code ? data.code.toUpperCase() : await uniqueCode();

  const clash = await Discount.findOne({ code });
  if (clash) throw ApiError.conflict("A discount with this code already exists", "CODE_TAKEN");

  const discount = await Discount.create({
    ...data,
    code,
    createdByEmail: req.user.email,
  });
  return ok(res, discount.toAdminJSON(), null, 201);
});

const update = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  if (!discount) throw ApiError.notFound("Discount not found");

  const data = normalizeDates(req.body);
  if (data.code) {
    const code = data.code.toUpperCase();
    if (code !== discount.code) {
      const used = await DiscountUsage.countDocuments({ discountId: discount._id });
      if (used > 0) {
        throw ApiError.conflict(
          "کدی که سابقه مصرف دارد قابل تغییر نام نیست.",
          "CODE_LOCKED"
        );
      }
      const clash = await Discount.findOne({ code, _id: { $ne: discount._id } });
      if (clash) throw ApiError.conflict("A discount with this code already exists", "CODE_TAKEN");
      discount.code = code;
    }
    delete data.code;
  }

  const assignable = [
    "description", "kind", "value", "status", "startsAt", "expiresAt",
    "maxUses", "maxUsesPerCustomer", "firstPurchaseOnly",
    "minPurchase", "maxDiscountCap", "products", "categories",
  ];
  assignable.forEach((k) => {
    if (data[k] !== undefined) discount[k] = data[k];
  });

  if (discount.kind === "percent" && discount.value > 100) {
    throw ApiError.badRequest("Percent value must be 1–100", "BAD_PERCENT");
  }

  await discount.save();
  return ok(res, discount.toAdminJSON());
});

const updateStatus = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  if (!discount) throw ApiError.notFound("Discount not found");
  if (discount.status === req.body.status) {
    throw ApiError.badRequest("Already in this status", "SAME_STATUS");
  }
  discount.status = req.body.status;
  await discount.save();
  return ok(res, discount.toAdminJSON());
});

const duplicate = asyncHandler(async (req, res) => {
  const src = await Discount.findById(req.params.id);
  if (!src) throw ApiError.notFound("Discount not found");

  const obj = src.toObject();
  delete obj._id;
  delete obj.__v;
  delete obj.createdAt;
  delete obj.updatedAt;

  const copy = await Discount.create({
    ...obj,
    code: await uniqueCode(),
    status: "inactive", // duplicates start inactive on purpose
    usedCount: 0,
    createdByEmail: req.user.email,
  });
  return ok(res, copy.toAdminJSON(), null, 201);
});

const remove = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  if (!discount) throw ApiError.notFound("Discount not found");

  const used = await DiscountUsage.countDocuments({ discountId: discount._id });
  if (used > 0) {
    throw ApiError.conflict(
      `این کد ${used} بار استفاده شده و برای حفظ سوابق مالی قابل حذف نیست — به‌جای حذف، غیرفعالش کنید.`,
      "HAS_USAGES"
    );
  }
  await discount.deleteOne();
  return ok(res, { deleted: discount.code });
});

/* ------------------------------------------------------------------ */
/* Engine endpoints (admin-side now; checkout will call these paths    */
/* internally at the storefront-integration phase).                    */
/* ------------------------------------------------------------------ */

const validateCode = asyncHandler(async (req, res) => {
  const result = await service.validate(req.body);
  return ok(res, result);
});

const redeemCode = asyncHandler(async (req, res) => {
  const { usage, discountAmount } = await service.redeem(req.body);
  return ok(res, { usage: usage.toAdminJSON(), discountAmount }, null, 201);
});

module.exports = {
  list,
  getOne,
  create,
  update,
  updateStatus,
  duplicate,
  remove,
  validateCode,
  redeemCode,
};
