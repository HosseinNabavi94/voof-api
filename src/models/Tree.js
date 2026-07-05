"use strict";

const { mongoose } = require("../config/db");
const { resolveAssetUrl, resolveMany } = require("../utils/assets");
const Counter = require("./Counter");

/* ------------------------------------------------------------------ */
/* Workflow — single source of truth, mirrored by the admin UI.        */
/* ------------------------------------------------------------------ */

const TREE_STATUSES = ["pending", "approved", "scheduled", "planted", "delivered", "cancelled"];

const TRANSITIONS = {
  pending: ["approved", "cancelled"],
  approved: ["scheduled", "cancelled"],
  scheduled: ["planted", "cancelled"],
  planted: ["delivered"],
  delivered: [],
  cancelled: [],
};

const STATUS_FA = {
  pending: "در انتظار بررسی",
  approved: "تأییدشده",
  scheduled: "زمان‌بندی‌شده",
  planted: "کاشته‌شده",
  delivered: "تحویل گواهی",
  cancelled: "لغوشده",
};

const PAYMENT_STATUSES = ["unpaid", "paid", "gifted", "refunded"];
const PAYMENT_FA = {
  unpaid: "پرداخت‌نشده",
  paid: "پرداخت‌شده",
  gifted: "هدیه",
  refunded: "بازپرداخت‌شده",
};

// Suggested Hircanian species for the admin form (free-form allowed).
const SUGGESTED_SPECIES = ["بلوط بلندمازو", "راش شرقی", "افرا پلت", "ممرز", "توسکا", "شمشاد هیرکانی", "آزاد"];
const SUGGESTED_REGIONS = ["جنگل هیرکانی — مازندران", "جنگل ابر — شاهرود", "جنگل الیمستان", "جنگل دالخانی", "کجور — نوشهر"];

/* ------------------------------------------------------------------ */

const timelineSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["created", "status", "payment", "details", "photos", "gift", "note"],
      required: true,
    },
    from: { type: String, default: "" },
    to: { type: String, default: "" },
    detail: { type: String, default: "" },
    byEmail: { type: String, default: "" }, // empty = system
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const treeSchema = new mongoose.Schema(
  {
    certificateNumber: { type: String, required: true, unique: true, index: true },

    name: { type: String, default: "" }, // personalized tree name
    species: { type: String, required: true, trim: true, index: true },
    region: { type: String, required: true, trim: true, index: true },

    status: { type: String, enum: TREE_STATUSES, default: "pending", index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid", index: true },

    plantingDate: { type: Date, default: null, index: true }, // scheduled/actual
    team: { type: String, default: "" }, // assigned planting team

    location: {
      lat: { type: Number, default: null, min: -90, max: 90 },
      lng: { type: Number, default: null, min: -180, max: 180 },
    },

    // Optional hard links (Phase 4 conventions).
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "", lowercase: true, trim: true, index: true },
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    orderNumber: { type: String, default: "" },

    // Photos — relative media keys (Media Library); resolved on output.
    beforePhoto: { type: String, default: "" },
    afterPhoto: { type: String, default: "" },
    gallery: { type: [String], default: [] },

    // Auto gift discount (Phase 7 engine) issued on planting.
    giftDiscount: {
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: "Discount", default: null },
      code: { type: String, default: "" },
      issuedAt: { type: Date, default: null },
    },

    notes: { type: String, default: "" }, // internal

    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true }
);

treeSchema.index({ createdAt: -1 });
treeSchema.index({ "location.lat": 1, "location.lng": 1 });

/* ------------------------------------------------------------------ */

treeSchema.statics.TREE_STATUSES = TREE_STATUSES;
treeSchema.statics.TRANSITIONS = TRANSITIONS;
treeSchema.statics.STATUS_FA = STATUS_FA;
treeSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
treeSchema.statics.PAYMENT_FA = PAYMENT_FA;
treeSchema.statics.SUGGESTED_SPECIES = SUGGESTED_SPECIES;
treeSchema.statics.SUGGESTED_REGIONS = SUGGESTED_REGIONS;

treeSchema.statics.nextCertificateNumber = async function nextCertificateNumber() {
  const year = new Date().getFullYear();
  const seq = await Counter.next(`trees-${year}`);
  return `VOOF-TREE-${year}-${String(seq).padStart(4, "0")}`;
};

treeSchema.methods.canTransitionTo = function canTransitionTo(next) {
  return (TRANSITIONS[this.status] || []).includes(next);
};

treeSchema.methods.pushEvent = function pushEvent(evt) {
  this.timeline.push({ at: new Date(), ...evt });
};

treeSchema.methods.toListJSON = function toListJSON() {
  return {
    id: this._id,
    certificateNumber: this.certificateNumber,
    name: this.name,
    species: this.species,
    region: this.region,
    status: this.status,
    statusFa: STATUS_FA[this.status] || this.status,
    paymentStatus: this.paymentStatus,
    paymentStatusFa: PAYMENT_FA[this.paymentStatus] || this.paymentStatus,
    customerName: this.customerSnapshot.name,
    customerEmail: this.customerSnapshot.email,
    plantingDate: this.plantingDate,
    hasLocation: this.location.lat != null && this.location.lng != null,
    createdAt: this.createdAt,
  };
};

/** Minimal marker shape for the map view. */
treeSchema.methods.toMarkerJSON = function toMarkerJSON() {
  return {
    id: this._id,
    lat: this.location.lat,
    lng: this.location.lng,
    certificateNumber: this.certificateNumber,
    species: this.species,
    region: this.region,
    status: this.status,
    statusFa: STATUS_FA[this.status] || this.status,
    year: this.plantingDate ? this.plantingDate.getFullYear() : this.createdAt.getFullYear(),
  };
};

treeSchema.methods.toAdminJSON = function toAdminJSON() {
  const obj = this.toObject({ virtuals: false });
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  obj.statusFa = STATUS_FA[obj.status] || obj.status;
  obj.paymentStatusFa = PAYMENT_FA[obj.paymentStatus] || obj.paymentStatus;
  obj.allowedTransitions = TRANSITIONS[obj.status] || [];
  obj.beforePhotoUrl = resolveAssetUrl(obj.beforePhoto);
  obj.afterPhotoUrl = resolveAssetUrl(obj.afterPhoto);
  obj.galleryUrls = resolveMany(obj.gallery);
  obj.suggestedSpecies = SUGGESTED_SPECIES;
  obj.suggestedRegions = SUGGESTED_REGIONS;
  return obj;
};

/** Public certificate/verification shape — no internal notes, no timeline. */
treeSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    certificateNumber: this.certificateNumber,
    name: this.name,
    species: this.species,
    region: this.region,
    status: this.status,
    statusFa: STATUS_FA[this.status] || this.status,
    plantingDate: this.plantingDate,
    customerName: this.customerSnapshot.name, // first name shown on certificates
    afterPhotoUrl: resolveAssetUrl(this.afterPhoto) || null,
    location:
      this.location.lat != null && this.location.lng != null
        ? { lat: this.location.lat, lng: this.location.lng }
        : null,
  };
};

module.exports = mongoose.model("Tree", treeSchema);
