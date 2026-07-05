"use strict";

const path = require("path");
const fs = require("fs/promises");
const imageSize = require("image-size");
const ApiError = require("../utils/ApiError");
const { asyncHandler, ok } = require("../utils/helpers");
const storage = require("../services/storage");
const { resolveAssetUrl, UPLOAD_PREFIX } = require("../utils/assets");
const { MediaAsset, MediaFolder } = require("../models/Media");
const Product = require("../models/Product");
const ContentEntry = require("../models/ContentEntry");

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function probeDimensions(buffer) {
  try {
    const dim = imageSize(buffer);
    return { width: dim.width || null, height: dim.height || null };
  } catch (_) {
    return { width: null, height: null };
  }
}

async function resolveFolderId(folderId) {
  if (!folderId || folderId === "root") return null;
  const folder = await MediaFolder.findById(folderId);
  if (!folder) throw ApiError.badRequest("Folder does not exist", "INVALID_FOLDER");
  return folder._id;
}

/**
 * Where is this key used? Checks products (image/hoverImage/gallery) and
 * content slots (draft AND published sides). Returns human-readable refs.
 */
async function findUsages(key) {
  const usages = [];

  const products = await Product.find({
    $or: [{ image: key }, { hoverImage: key }, { gallery: key }],
  }).select("name slug");
  for (const p of products) usages.push(`محصول: ${p.name}`);

  const entries = await ContentEntry.find({
    type: "image",
    $or: [{ draftValue: key }, { publishedValue: key }],
  }).select("pageSlug key");
  for (const e of entries) usages.push(`محتوا: ${e.pageSlug} → ${e.key}`);

  return usages;
}

/* ------------------------------------------------------------------ */
/* Upload — extends the Phase 2 contract. Response items still carry   */
/* { key, url } (backward compatible with the existing uploader), now  */
/* with full catalog metadata alongside.                               */
/* ------------------------------------------------------------------ */

const upload = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw ApiError.badRequest("No images received", "NO_FILES");

  const folderId = await resolveFolderId(req.query.folder);

  const results = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    const { key } = await storage.upload({
      buffer: f.buffer,
      originalName: f.originalname,
      mimeType: f.mimetype,
    });
    const { width, height } = probeDimensions(f.buffer);
    // eslint-disable-next-line no-await-in-loop
    const asset = await MediaAsset.create({
      key,
      displayName: f.originalname || key.slice(UPLOAD_PREFIX.length + 1),
      originalName: f.originalname || "",
      mimeType: f.mimetype,
      size: f.size,
      width,
      height,
      folder: folderId,
      uploadedByEmail: req.user.email,
    });
    results.push(asset.toAdminJSON());
  }

  return ok(res, results, null, 201);
});

/* ------------------------------------------------------------------ */
/* Library: list / detail                                              */
/* ------------------------------------------------------------------ */

const list = asyncHandler(async (req, res) => {
  const { q, folder, page, limit, sort } = req.query;
  const filter = {};
  if (q) {
    const rx = { $regex: q, $options: "i" };
    filter.$or = [{ displayName: rx }, { originalName: rx }, { alt: rx }, { key: rx }];
  }
  if (folder === "root") filter.folder = null;
  else if (folder) filter.folder = folder;

  const [items, total] = await Promise.all([
    MediaAsset.find(filter)
      .populate("folder", "name")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    MediaAsset.countDocuments(filter),
  ]);

  return ok(
    res,
    items.map((a) => a.toAdminJSON()),
    { page, limit, total, pages: Math.ceil(total / limit) }
  );
});

const getOne = asyncHandler(async (req, res) => {
  const asset = await MediaAsset.findById(req.params.id).populate("folder", "name");
  if (!asset) throw ApiError.notFound("Asset not found");
  const usages = await findUsages(asset.key);
  const json = asset.toAdminJSON();
  json.usages = usages;
  return ok(res, json);
});

/* ------------------------------------------------------------------ */
/* Rename / alt / move                                                 */
/* ------------------------------------------------------------------ */

const updateAsset = asyncHandler(async (req, res) => {
  const asset = await MediaAsset.findById(req.params.id);
  if (!asset) throw ApiError.notFound("Asset not found");

  const { displayName, alt, folder } = req.body;
  if (displayName !== undefined) asset.displayName = displayName;
  if (alt !== undefined) asset.alt = alt;
  if (folder !== undefined) asset.folder = await resolveFolderId(folder);

  await asset.save();
  await asset.populate("folder", "name");
  return ok(res, asset.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Delete — refuses while the image is referenced anywhere.            */
/* ------------------------------------------------------------------ */

const removeAsset = asyncHandler(async (req, res) => {
  const asset = await MediaAsset.findById(req.params.id);
  if (!asset) throw ApiError.notFound("Asset not found");

  const usages = await findUsages(asset.key);
  if (usages.length) {
    throw ApiError.conflict(
      `این تصویر در حال استفاده است: ${usages.slice(0, 5).join("، ")}${usages.length > 5 ? " …" : ""}`,
      "ASSET_IN_USE"
    );
  }

  await storage.delete(asset.key);
  await asset.deleteOne();
  return ok(res, { deleted: asset.key });
});

/**
 * Legacy delete-by-key (Phase 2 contract, used by the shared uploader when
 * detaching a managed image). Now also drops the catalog record — but only
 * when the key isn't referenced elsewhere; otherwise it silently detaches
 * without destroying a shared file.
 */
const removeByKey = asyncHandler(async (req, res) => {
  const key = String(req.query.key || "");
  if (!key.startsWith(UPLOAD_PREFIX)) {
    throw ApiError.badRequest("Not a managed asset key", "INVALID_KEY");
  }
  const usages = await findUsages(key);
  if (usages.length) {
    // Referenced elsewhere: keep file + record, report as detached.
    return ok(res, { deleted: null, kept: key, inUse: usages.length });
  }
  await storage.delete(key);
  await MediaAsset.deleteOne({ key });
  return ok(res, { deleted: key });
});

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

const listFolders = asyncHandler(async (_req, res) => {
  const folders = await MediaFolder.find({}).sort({ name: 1 });
  const counts = await MediaAsset.aggregate([
    { $group: { _id: "$folder", n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  return ok(res, {
    rootCount: countMap.get("null") || 0,
    total: await MediaAsset.countDocuments(),
    folders: folders.map((f) => ({
      ...f.toAdminJSON(),
      count: countMap.get(String(f._id)) || 0,
    })),
  });
});

const createFolder = asyncHandler(async (req, res) => {
  const exists = await MediaFolder.findOne({ name: req.body.name.trim() });
  if (exists) throw ApiError.conflict("A folder with this name exists", "FOLDER_EXISTS");
  const folder = await MediaFolder.create({
    name: req.body.name.trim(),
    createdByEmail: req.user.email,
  });
  return ok(res, folder.toAdminJSON(), null, 201);
});

const renameFolder = asyncHandler(async (req, res) => {
  const folder = await MediaFolder.findById(req.params.id);
  if (!folder) throw ApiError.notFound("Folder not found");
  const clash = await MediaFolder.findOne({
    name: req.body.name.trim(),
    _id: { $ne: folder._id },
  });
  if (clash) throw ApiError.conflict("A folder with this name exists", "FOLDER_EXISTS");
  folder.name = req.body.name.trim();
  await folder.save();
  return ok(res, folder.toAdminJSON());
});

const removeFolder = asyncHandler(async (req, res) => {
  const folder = await MediaFolder.findById(req.params.id);
  if (!folder) throw ApiError.notFound("Folder not found");
  const count = await MediaAsset.countDocuments({ folder: folder._id });
  if (count > 0) {
    throw ApiError.conflict(
      `پوشه خالی نیست (${count} فایل). ابتدا فایل‌ها را منتقل یا حذف کنید.`,
      "FOLDER_NOT_EMPTY"
    );
  }
  await folder.deleteOne();
  return ok(res, { deleted: folder.name });
});

/* ------------------------------------------------------------------ */
/* Sync — catalogs pre-Phase-6 files already on disk (idempotent).     */
/* Only meaningful for the local driver.                               */
/* ------------------------------------------------------------------ */

const sync = asyncHandler(async (req, res) => {
  if (!storage.canServeLocally()) {
    throw ApiError.badRequest("Sync is only available for local storage", "NOT_LOCAL");
  }
  // Local-driver internals are intentionally accessed only here.
  // eslint-disable-next-line global-require
  const { UPLOAD_DIR } = require("../services/storage/localDriver");

  let files = [];
  try {
    files = await fs.readdir(UPLOAD_DIR);
  } catch (_) {
    return ok(res, { created: 0, skipped: 0, note: "uploads directory not found" });
  }

  let created = 0;
  let skipped = 0;
  for (const name of files) {
    const key = `${UPLOAD_PREFIX}/${name}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await MediaAsset.findOne({ key });
    if (exists) {
      skipped += 1;
      // eslint-disable-next-line no-continue
      continue;
    }
    const full = path.join(UPLOAD_DIR, name);
    // eslint-disable-next-line no-await-in-loop
    const stat = await fs.stat(full);
    if (!stat.isFile()) continue; // eslint-disable-line no-continue
    let width = null;
    let height = null;
    let mimeType = "";
    try {
      // eslint-disable-next-line no-await-in-loop
      const buf = await fs.readFile(full);
      ({ width, height } = probeDimensions(buf));
      const ext = path.extname(name).toLowerCase();
      mimeType =
        { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext] || "";
    } catch (_) {
      /* keep nulls */
    }
    // eslint-disable-next-line no-await-in-loop
    await MediaAsset.create({
      key,
      displayName: name,
      originalName: name,
      mimeType,
      size: stat.size,
      width,
      height,
      uploadedByEmail: req.user.email,
    });
    created += 1;
  }

  return ok(res, { created, skipped });
});

module.exports = {
  upload,
  list,
  getOne,
  updateAsset,
  removeAsset,
  removeByKey,
  listFolders,
  createFolder,
  renameFolder,
  removeFolder,
  sync,
};
