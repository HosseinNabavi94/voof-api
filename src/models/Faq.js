"use strict";

const { mongoose } = require("../config/db");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    order: { type: Number, default: 0, index: true },
    status: {
      type: String,
      enum: ["published", "hidden"],
      default: "published",
      index: true,
    },
    updatedByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

faqSchema.methods.toAdminJSON = function toAdminJSON() {
  return {
    id: this._id,
    question: this.question,
    answer: this.answer,
    order: this.order,
    status: this.status,
    updatedAt: this.updatedAt,
  };
};

faqSchema.methods.toPublicJSON = function toPublicJSON() {
  return { question: this.question, answer: this.answer };
};

module.exports = mongoose.model("Faq", faqSchema);
