"use strict";

const { mongoose } = require("../config/db");

/* ------------------------------------------------------------------ */
/* Discount — a global coupon with rules. Distinct from the Phase 4    */
/* per-customer record-keeping codes (which remain untouched).         */
/* ------------------------------------------------------------------ */

const discountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, default: "" }, // internal note

    kind: { type: String, enum: ["percent", "amount"], required: true },
    value: { type: Number, required: true, min: 1 }, // percent 1–100 | تومان

    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },

    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },

    maxUses: { type: Number, default: null, min: 1 }, // null = unlimited
    maxUsesPerCustomer: { type: Number, default: null, min: 1 },
    firstPurchaseOnly: { type: Boolean, default: false },

    minPurchase: { type: Number, default: null, min: 0 }, // on applicable subtotal
    maxDiscountCap: { type: Number, default: null, min: 1 }, // cap in تومان

    // Scope: empty arrays = applies to everything.
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    usedCount: { type: Number, default: 0, min: 0 }, // atomic counter

    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

discountSchema.index({ createdAt: -1 });

/** Effective availability right now (status + date window + total limit). */
discountSchema.methods.effectiveState = function effectiveState(now = new Date()) {
  if (this.status !== "active") return "inactive";
  if (this.startsAt && now < this.startsAt) return "scheduled";
  if (this.expiresAt && now > this.expiresAt) return "expired";
  if (this.maxUses != null && this.usedCount >= this.maxUses) return "exhausted";
  return "active";
};

const STATE_FA = {
  active: "فعال",
  inactive: "غیرفعال",
  scheduled: "زمان‌بندی‌شده",
  expired: "منقضی",
  exhausted: "تکمیل ظرفیت",
};

discountSchema.methods.toAdminJSON = function toAdminJSON() {
  const obj = this.toObject({ virtuals: false });
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  const state = this.effectiveState();
  obj.effectiveState = state;
  obj.effectiveStateFa = STATE_FA[state];
  if (Array.isArray(obj.products) && obj.products.length && obj.products[0] && obj.products[0].name) {
    obj.products = obj.products.map((p) => ({ id: p._id, name: p.name }));
  }
  if (Array.isArray(obj.categories) && obj.categories.length && obj.categories[0] && obj.categories[0].name) {
    obj.categories = obj.categories.map((c) => ({ id: c._id, name: c.name }));
  }
  return obj;
};

const Discount = mongoose.model("Discount", discountSchema);

/* ------------------------------------------------------------------ */
/* DiscountUsage — one record per successful redemption.               */
/* Unique (discountId, orderId) makes duplicate redemption per order   */
/* impossible at the database level.                                   */
/* ------------------------------------------------------------------ */

const usageSchema = new mongoose.Schema(
  {
    discountId: { type: mongoose.Schema.Types.ObjectId, ref: "Discount", required: true, index: true },
    code: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerEmail: { type: String, required: true, lowercase: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 }, // discount amount applied
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

usageSchema.index({ discountId: 1, orderId: 1 }, { unique: true });
usageSchema.index({ discountId: 1, customerEmail: 1 });

usageSchema.methods.toAdminJSON = function toAdminJSON() {
  return {
    id: this._id,
    code: this.code,
    customerEmail: this.customerEmail,
    customerId: this.customerId,
    orderId: this.orderId,
    orderNumber: this.orderNumber,
    amount: this.amount,
    at: this.at,
  };
};

const DiscountUsage = mongoose.model("DiscountUsage", usageSchema);

module.exports = { Discount, DiscountUsage, STATE_FA };
