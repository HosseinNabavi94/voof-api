"use strict";

const { mongoose } = require("../config/db");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // Persian display name
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** Shape returned to the storefront/admin. */
categorySchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    description: this.description,
    order: this.order,
    isActive: this.isActive,
  };
};

module.exports = mongoose.model("Category", categorySchema);
