"use strict";

const ApiError = require("../utils/ApiError");
const { asyncHandler, ok } = require("../utils/helpers");
const Faq = require("../models/Faq");

const list = asyncHandler(async (_req, res) => {
  const items = await Faq.find({}).sort({ order: 1, createdAt: 1 });
  return ok(res, items.map((f) => f.toAdminJSON()));
});

const create = asyncHandler(async (req, res) => {
  const last = await Faq.findOne({}).sort({ order: -1 });
  const faq = await Faq.create({
    ...req.body,
    order: last ? last.order + 1 : 0,
    updatedByEmail: req.user.email,
  });
  return ok(res, faq.toAdminJSON(), null, 201);
});

const update = asyncHandler(async (req, res) => {
  const faq = await Faq.findById(req.params.id);
  if (!faq) throw ApiError.notFound("FAQ not found");
  ["question", "answer", "status"].forEach((k) => {
    if (req.body[k] !== undefined) faq[k] = req.body[k];
  });
  faq.updatedByEmail = req.user.email;
  await faq.save();
  return ok(res, faq.toAdminJSON());
});

const reorder = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  const count = await Faq.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) {
    throw ApiError.badRequest("Reorder list must contain valid FAQ ids", "INVALID_IDS");
  }
  await Promise.all(
    ids.map((id, i) => Faq.updateOne({ _id: id }, { $set: { order: i } }))
  );
  const items = await Faq.find({}).sort({ order: 1, createdAt: 1 });
  return ok(res, items.map((f) => f.toAdminJSON()));
});

const remove = asyncHandler(async (req, res) => {
  const faq = await Faq.findById(req.params.id);
  if (!faq) throw ApiError.notFound("FAQ not found");
  await faq.deleteOne();
  return ok(res, { message: "FAQ deleted" });
});

/** Public: published FAQs in display order. */
const publicList = asyncHandler(async (_req, res) => {
  const items = await Faq.find({ status: "published" }).sort({ order: 1, createdAt: 1 });
  return ok(res, items.map((f) => f.toPublicJSON()));
});

module.exports = { list, create, update, reorder, remove, publicList };
