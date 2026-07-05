"use strict";

const ApiError = require("../utils/ApiError");
const { asyncHandler, ok, slugify, generateSku } = require("../utils/helpers");
const Product = require("../models/Product");
const Category = require("../models/Category");

async function uniqueSlug(base, excludeId = null) {
  let slug = slugify(base);
  let n = 1;
  // Ensure uniqueness by suffixing -2, -3, ... on collision.
  // eslint-disable-next-line no-await-in-loop
  while (true) {
    const clash = await Product.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!clash) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

async function uniqueSku() {
  // eslint-disable-next-line no-await-in-loop
  while (true) {
    const sku = generateSku();
    const clash = await Product.findOne({ sku });
    if (!clash) return sku;
  }
}

const list = asyncHandler(async (req, res) => {
  const { q, category, status, featured, isNewArrival, page, limit, sort } = req.query;
  const filter = {};
  if (q) {
    const rx = { $regex: q, $options: "i" };
    filter.$or = [{ name: rx }, { slug: rx }, { sku: rx }];
  }
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (featured !== undefined) filter.featured = featured;
  if (isNewArrival !== undefined) filter.isNewArrival = isNewArrival;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return ok(
    res,
    items.map((p) => p.toAdminJSON()),
    { page, limit, total, pages: Math.ceil(total / limit) }
  );
});

const getOne = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category", "name slug");
  if (!product) throw ApiError.notFound("Product not found");
  return ok(res, product.toAdminJSON());
});

const create = asyncHandler(async (req, res) => {
  const data = req.body;

  const category = await Category.findById(data.category);
  if (!category) throw ApiError.badRequest("Category does not exist", "INVALID_CATEGORY");

  const slug = await uniqueSlug(data.slug || data.name);
  const sku = await uniqueSku();

  const product = await Product.create({ ...data, slug, sku });
  await product.populate("category", "name slug");
  return ok(res, product.toAdminJSON(), null, 201);
});

const update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found");

  const data = req.body;

  if (data.category) {
    const category = await Category.findById(data.category);
    if (!category) throw ApiError.badRequest("Category does not exist", "INVALID_CATEGORY");
  }

  if (data.slug) {
    product.slug = await uniqueSlug(data.slug, product._id);
  }

  const assignable = [
    "name", "price", "compareAtPrice", "category", "image", "hoverImage",
    "gallery", "description", "longDescription", "materials", "care",
    "details", "madeIn", "sizes", "colors", "stock", "status", "featured",
    "isNewArrival", "order",
  ];
  assignable.forEach((k) => {
    if (data[k] !== undefined) product[k] = data[k];
  });

  await product.save();
  await product.populate("category", "name slug");
  return ok(res, product.toAdminJSON());
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["draft", "published", "archived"].includes(status)) {
    throw ApiError.badRequest("Invalid status", "INVALID_STATUS");
  }
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found");
  product.status = status;
  await product.save();
  await product.populate("category", "name slug");
  return ok(res, product.toAdminJSON());
});

const remove = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found");
  await product.deleteOne();
  return ok(res, { message: "Product deleted" });
});

module.exports = { list, getOne, create, update, updateStatus, remove };
