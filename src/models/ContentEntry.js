"use strict";

const { mongoose } = require("../config/db");

/**
 * One document per (pageSlug, key) slot. Approved requirement H:
 * admins edit `draftValue`; POST /content/:pageSlug/publish copies
 * draft -> published for the whole page; the public API reads ONLY
 * `publishedValue`.
 */
const contentEntrySchema = new mongoose.Schema(
  {
    pageSlug: { type: String, required: true, index: true },
    key: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "textarea", "richtext", "image", "list"],
      required: true,
    },
    draftValue: { type: mongoose.Schema.Types.Mixed, default: "" },
    publishedValue: { type: mongoose.Schema.Types.Mixed, default: "" },
    updatedByEmail: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

contentEntrySchema.index({ pageSlug: 1, key: 1 }, { unique: true });

/** Draft differs from published? (Mixed-safe comparison.) */
contentEntrySchema.methods.isDirty = function isDirty() {
  return JSON.stringify(this.draftValue) !== JSON.stringify(this.publishedValue);
};

module.exports = mongoose.model("ContentEntry", contentEntrySchema);
