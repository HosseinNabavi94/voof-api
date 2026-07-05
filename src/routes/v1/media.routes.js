"use strict";

const express = require("express");
const ctrl = require("../../controllers/media.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { parseImages } = require("../../middleware/upload");
const {
  listQuerySchema,
  updateAssetSchema,
  createFolderSchema,
  renameFolderSchema,
} = require("../../validators/media.validators");

const router = express.Router();

router.use(requireAuth); // the whole media surface is admin-only

// Folders (static paths before /:id).
router.get("/folders", ctrl.listFolders);
router.post("/folders", validate(createFolderSchema), ctrl.createFolder);
router.patch("/folders/:id", validate(renameFolderSchema), ctrl.renameFolder);
router.delete("/folders/:id", ctrl.removeFolder);

// Sync pre-existing disk files into the catalog (idempotent).
router.post("/sync", ctrl.sync);

// Upload (Phase 2 contract, extended response; optional ?folder=<id>).
router.post("/upload", parseImages, ctrl.upload);

// Library.
router.get("/", validate(listQuerySchema, "query"), ctrl.list);
router.get("/:id", ctrl.getOne);
router.patch("/:id", validate(updateAssetSchema), ctrl.updateAsset);
router.delete("/:id", ctrl.removeAsset);

// Legacy delete-by-key (kept for the shared uploader component).
router.delete("/", ctrl.removeByKey);

module.exports = router;
