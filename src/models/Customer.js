"use strict";

const { mongoose } = require("../config/db");

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CUSTOMER_STATUSES = ["active", "inactive", "blocked"];

const STATUS_FA = {
  active: "فعال",
  inactive: "غیرفعال",
  blocked: "مسدود",
};

// Suggested tags (free-form values are also allowed).
const SUGGESTED_TAGS = ["VIP", "خریدار وفادار", "ارزش بالا", "عمده‌خر", "همکار"];

const TIMELINE_TYPES = [
  "created", "profile", "address", "status", "tag",
  "loyalty", "tree", "discount", "note", "order",
];

/* ------------------------------------------------------------------ */
/* Sub-schemas                                                         */
/* ------------------------------------------------------------------ */

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" }, // خانه، محل کار…
    line1: { type: String, required: true },
    line2: { type: String, default: "" },
    city: { type: String, required: true },
    province: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const loyaltyEventSchema = new mongoose.Schema(
  {
    delta: { type: Number, required: true }, // + earn / − deduct
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    byEmail: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const treeSchema = new mongoose.Schema(
  {
    species: { type: String, required: true }, // e.g. بلوط بلندمازو، راش
    region: { type: String, default: "" }, // e.g. جنگل هیرکانی، مازندران
    certificateCode: { type: String, default: "" },
    plantedAt: { type: Date, default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const discountCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    kind: { type: String, enum: ["percent", "amount"], required: true },
    value: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: ["active", "used", "revoked"], default: "active" },
    usedAt: { type: Date, default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    assignedBy: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TIMELINE_TYPES, required: true },
    detail: { type: String, default: "" },
    byEmail: { type: String, default: "" }, // empty = system
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/* Customer schema                                                     */
/* ------------------------------------------------------------------ */

const customerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: "", trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, default: "" },

    // Future storefront auth (spec §1.5) — always null until that phase.
    passwordHash: { type: String, default: null, select: false },

    addresses: { type: [addressSchema], default: [] },

    status: {
      type: String,
      enum: CUSTOMER_STATUSES,
      default: "active",
      index: true,
    },

    tags: { type: [String], default: [], index: true },

    loyalty: {
      balance: { type: Number, default: 0, min: 0 },
      history: { type: [loyaltyEventSchema], default: [] },
    },

    trees: { type: [treeSchema], default: [] },

    discountCodes: { type: [discountCodeSchema], default: [] },

    notes: { type: String, default: "" }, // internal — never customer-facing

    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true }
);

customerSchema.index({ createdAt: -1 });

/* ------------------------------------------------------------------ */
/* Statics & methods                                                   */
/* ------------------------------------------------------------------ */

customerSchema.statics.CUSTOMER_STATUSES = CUSTOMER_STATUSES;
customerSchema.statics.STATUS_FA = STATUS_FA;
customerSchema.statics.SUGGESTED_TAGS = SUGGESTED_TAGS;

/** Append an audit event. Every mutating controller action calls this. */
customerSchema.methods.pushEvent = function pushEvent(evt) {
  this.timeline.push({ at: new Date(), ...evt });
};

customerSchema.methods.fullName = function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
};

/** Compact row for list views. */
customerSchema.methods.toListJSON = function toListJSON() {
  return {
    id: this._id,
    name: this.fullName(),
    email: this.email,
    phone: this.phone,
    status: this.status,
    statusFa: STATUS_FA[this.status] || this.status,
    tags: this.tags,
    loyaltyBalance: this.loyalty ? this.loyalty.balance : 0,
    treeCount: this.trees.length,
    createdAt: this.createdAt,
  };
};

/** Full profile for the detail page. */
customerSchema.methods.toAdminJSON = function toAdminJSON() {
  const obj = this.toObject({ virtuals: false });
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  delete obj.passwordHash;
  obj.name = this.fullName();
  obj.statusFa = STATUS_FA[obj.status] || obj.status;
  obj.suggestedTags = SUGGESTED_TAGS;
  return obj;
};

module.exports = mongoose.model("Customer", customerSchema);
