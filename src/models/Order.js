"use strict";

const { mongoose } = require("../config/db");
const { resolveAssetUrl } = require("../utils/assets");
const Counter = require("./Counter");

/* ------------------------------------------------------------------ */
/* Workflow definitions — single source of truth for statuses.         */
/* ------------------------------------------------------------------ */

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

// Legal transitions, enforced server-side.
const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"];

const STATUS_FA = {
  pending: "در انتظار بررسی",
  confirmed: "تأییدشده",
  preparing: "در حال آماده‌سازی",
  packed: "بسته‌بندی‌شده",
  shipped: "ارسال‌شده",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
  returned: "مرجوع‌شده",
};

const PAYMENT_FA = {
  unpaid: "پرداخت‌نشده",
  paid: "پرداخت‌شده",
  refunded: "بازپرداخت‌شده",
};

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    name: { type: String, required: true }, // frozen at order time
    slug: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 }, // unit price, تومان
    quantity: { type: Number, required: true, min: 1 },
    size: { type: String, default: "" },
    color: { type: String, default: "" },
    image: { type: String, default: "" }, // relative key; resolved on output
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["created", "status", "payment", "shipping", "note"],
      required: true,
    },
    from: { type: String, default: "" },
    to: { type: String, default: "" },
    note: { type: String, default: "" },
    byEmail: { type: String, default: "" }, // acting admin (empty = system)
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    customerSnapshot: {
      firstName: { type: String, required: true },
      lastName: { type: String, default: "" },
      email: { type: String, required: true, lowercase: true, trim: true, index: true },
      phone: { type: String, default: "" },
    },

    items: {
      type: [itemSchema],
      validate: [(v) => v.length > 0, "Order must contain at least one item"],
    },

    subtotal: { type: Number, required: true, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },

    shippingAddress: {
      line1: { type: String, required: true },
      line2: { type: String, default: "" },
      city: { type: String, required: true },
      province: { type: String, default: "" },
      postalCode: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "unpaid",
      index: true,
    },
    paymentMethod: { type: String, default: "zarinpal" },
    paymentRef: { type: String, default: "" },
    paidAt: { type: Date, default: null },

    shipping: {
      carrier: { type: String, default: "" },
      trackingCode: { type: String, default: "" },
      shippedAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
    },

    notes: { type: String, default: "" }, // internal — never on invoices

    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });

/* ------------------------------------------------------------------ */
/* Statics & methods                                                   */
/* ------------------------------------------------------------------ */

orderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;
orderSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
orderSchema.statics.TRANSITIONS = TRANSITIONS;
orderSchema.statics.STATUS_FA = STATUS_FA;
orderSchema.statics.PAYMENT_FA = PAYMENT_FA;

orderSchema.statics.nextOrderNumber = async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const seq = await Counter.next(`orders-${year}`);
  return `ORD-${year}-${String(seq).padStart(4, "0")}`;
};

orderSchema.methods.canTransitionTo = function canTransitionTo(next) {
  return (TRANSITIONS[this.status] || []).includes(next);
};

orderSchema.methods.pushEvent = function pushEvent(evt) {
  this.timeline.push({ at: new Date(), ...evt });
};

orderSchema.methods.toAdminJSON = function toAdminJSON() {
  const obj = this.toObject({ virtuals: false });
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  obj.items = (obj.items || []).map((it) => ({
    ...it,
    imageUrl: resolveAssetUrl(it.image),
  }));
  obj.statusFa = STATUS_FA[obj.status] || obj.status;
  obj.paymentStatusFa = PAYMENT_FA[obj.paymentStatus] || obj.paymentStatus;
  obj.allowedTransitions = TRANSITIONS[obj.status] || [];
  return obj;
};

/** Compact row for list views. */
orderSchema.methods.toListJSON = function toListJSON() {
  return {
    id: this._id,
    orderNumber: this.orderNumber,
    customerName:
      `${this.customerSnapshot.firstName} ${this.customerSnapshot.lastName}`.trim(),
    customerEmail: this.customerSnapshot.email,
    itemCount: this.items.reduce((n, it) => n + it.quantity, 0),
    total: this.total,
    status: this.status,
    statusFa: STATUS_FA[this.status] || this.status,
    paymentStatus: this.paymentStatus,
    paymentStatusFa: PAYMENT_FA[this.paymentStatus] || this.paymentStatus,
    trackingCode: this.shipping ? this.shipping.trackingCode : "",
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Order", orderSchema);
