"use strict";

const { mongoose } = require("../config/db");

/**
 * Atomic sequence counters (one doc per key). Used for order numbers:
 * key "orders-2026" -> seq increments per order created in that year.
 */
const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.statics.next = async function next(key) {
  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model("Counter", counterSchema);
