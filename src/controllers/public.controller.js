"use strict";

const ApiError = require("../utils/ApiError");
const { asyncHandler, ok } = require("../utils/helpers");
const Product = require("../models/Product");
const Category = require("../models/Category");

// Only published products are ever exposed to the storefront.
const PUBLIC_FILTER = { status: "published" };

const listProducts = asyncHandler(async (req, res) => {
  const filter = { ...PUBLIC_FILTER };

  // Optional filter by category name (storefront uses Persian names) or slug.
  if (req.query.category) {
    const cat = await Category.findOne({
      $or: [{ name: req.query.category }, { slug: req.query.category }],
    });
    if (!cat) return ok(res, []); // unknown category -> empty list
    filter.category = cat._id;
  }
  if (req.query.featured === "true") filter.featured = true;
  if (req.query.isNewArrival === "true") filter.isNewArrival = true;

  const products = await Product.find(filter)
    .populate("category", "name slug")
    .sort({ order: 1, createdAt: -1 });

  return ok(res, products.map((p) => p.toStorefrontJSON()));
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, ...PUBLIC_FILTER })
    .populate("category", "name slug");
  if (!product) throw ApiError.notFound("Product not found");
  return ok(res, product.toStorefrontJSON());
});

const getRelated = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "4", 10), 12);
  const current = await Product.findOne({ slug: req.params.slug, ...PUBLIC_FILTER });
  if (!current) {
    const fallback = await Product.find(PUBLIC_FILTER)
      .populate("category", "name slug")
      .limit(limit);
    return ok(res, fallback.map((p) => p.toStorefrontJSON()));
  }

  // Same category first, then fill from others — mirrors the original logic.
  const sameCategory = await Product.find({
    ...PUBLIC_FILTER,
    category: current.category,
    _id: { $ne: current._id },
  }).populate("category", "name slug");

  let results = [...sameCategory];
  if (results.length < limit) {
    const others = await Product.find({
      ...PUBLIC_FILTER,
      category: { $ne: current.category },
      _id: { $ne: current._id },
    })
      .populate("category", "name slug")
      .limit(limit - results.length);
    results = results.concat(others);
  }

  return ok(res, results.slice(0, limit).map((p) => p.toStorefrontJSON()));
});

const listCategories = asyncHandler(async (req, res) => {
  const cats = await Category.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  // Storefront currently expects an array of Persian name strings.
  return ok(res, cats.map((c) => c.name));
});

module.exports = { listProducts, getProduct, getRelated, listCategories };
