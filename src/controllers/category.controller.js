"use strict";

const ApiError = require("../utils/ApiError");
const { asyncHandler, ok, slugify } = require("../utils/helpers");
const Category = require("../models/Category");
const Product = require("../models/Product");

const list = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;
  const filter = {};
  if (q) filter.name = { $regex: q, $options: "i" };

  const [items, total] = await Promise.all([
    Category.find(filter)
      .sort({ order: 1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  return ok(
    res,
    items.map((c) => c.toPublicJSON()),
    { page, limit, total, pages: Math.ceil(total / limit) }
  );
});

const getOne = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw ApiError.notFound("Category not found");
  return ok(res, cat.toPublicJSON());
});

const create = asyncHandler(async (req, res) => {
  const data = req.body;
  const slug = slugify(data.slug || data.name);
  const exists = await Category.findOne({ slug });
  if (exists) throw ApiError.conflict("A category with this slug already exists", "SLUG_TAKEN");

  const cat = await Category.create({ ...data, slug });
  return ok(res, cat.toPublicJSON(), null, 201);
});

const update = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw ApiError.notFound("Category not found");

  const data = req.body;
  if (data.slug || data.name) {
    const nextSlug = slugify(data.slug || data.name);
    if (nextSlug !== cat.slug) {
      const clash = await Category.findOne({ slug: nextSlug, _id: { $ne: cat._id } });
      if (clash) throw ApiError.conflict("A category with this slug already exists", "SLUG_TAKEN");
      cat.slug = nextSlug;
    }
  }
  ["name", "description", "order", "isActive"].forEach((k) => {
    if (data[k] !== undefined) cat[k] = data[k];
  });
  await cat.save();
  return ok(res, cat.toPublicJSON());
});

const remove = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw ApiError.notFound("Category not found");

  const inUse = await Product.countDocuments({ category: cat._id });
  if (inUse > 0) {
    throw ApiError.conflict(
      `Cannot delete: ${inUse} product(s) still use this category`,
      "CATEGORY_IN_USE"
    );
  }
  await cat.deleteOne();
  return ok(res, { message: "Category deleted" });
});

module.exports = { list, getOne, create, update, remove };
