"use strict";

const { mongoose } = require("../config/db");
const { resolveAssetUrl, resolveMany } = require("../utils/assets");

const sizeSchema = new mongoose.Schema(
  {
    size: { type: String, required: true },
    available: { type: Boolean, default: true },
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    hex: { type: String, required: true },
    available: { type: Boolean, default: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    sku: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }, // in تومان (integer)
    compareAtPrice: { type: Number, default: null, min: 0 },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    image: { type: String, required: true },
    hoverImage: { type: String, default: "" },
    gallery: { type: [String], default: [] },

    description: { type: String, default: "" },
    longDescription: { type: String, default: "" },
    materials: { type: [String], default: [] },
    care: { type: [String], default: [] },
    details: { type: [String], default: [] },
    madeIn: { type: String, default: "" },

    sizes: { type: [sizeSchema], default: [] },
    colors: { type: [colorSchema], default: [] },

    stock: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    featured: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/**
 * Public serializer — matches the storefront's existing `Product` interface
 * EXACTLY so client components need no shape changes:
 *   id (=slug), name, price, category (=name string), image, hoverImage,
 *   description, longDescription, materials, care, sizes, colors, details, madeIn.
 * `category` must be populated before calling this.
 */
productSchema.methods.toStorefrontJSON = function toStorefrontJSON() {
  const categoryName =
    this.category && this.category.name ? this.category.name : "";
  return {
    id: this.slug,
    name: this.name,
    price: this.price,
    category: categoryName,
    image: resolveAssetUrl(this.image),
    hoverImage: resolveAssetUrl(this.hoverImage),
    description: this.description,
    longDescription: this.longDescription,
    materials: this.materials,
    care: this.care,
    sizes: this.sizes.map((s) => ({ size: s.size, available: s.available })),
    colors: this.colors.map((c) => ({
      name: c.name,
      hex: c.hex,
      available: c.available,
    })),
    details: this.details,
    madeIn: this.madeIn,
  };
};

/** Full serializer for the admin panel (richer than storefront). */
productSchema.methods.toAdminJSON = function toAdminJSON() {
  const obj = this.toObject({ virtuals: false });
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  // category may be an ObjectId or a populated doc.
  if (obj.category && obj.category._id) {
    obj.category = {
      id: obj.category._id,
      name: obj.category.name,
      slug: obj.category.slug,
    };
  }
  // Raw keys stay in image/hoverImage/gallery (what the form edits & saves);
  // *Url fields are resolved for display previews.
  obj.imageUrl = resolveAssetUrl(obj.image);
  obj.hoverImageUrl = resolveAssetUrl(obj.hoverImage);
  obj.galleryUrls = resolveMany(obj.gallery);
  return obj;
};

module.exports = mongoose.model("Product", productSchema);
