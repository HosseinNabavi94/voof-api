"use strict";

const express = require("express");
const ctrl = require("../../controllers/content.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { pageSlugSchema, putContentSchema } = require("../../validators/content.validators");

const router = express.Router();

router.use(requireAuth);

router.get("/", ctrl.listPages);
router.get("/:pageSlug", validate(pageSlugSchema, "params"), ctrl.getPage);
router.put("/:pageSlug", validate(pageSlugSchema, "params"), validate(putContentSchema), ctrl.putPage);
router.post("/:pageSlug/publish", validate(pageSlugSchema, "params"), ctrl.publishPage);
router.post("/:pageSlug/discard", validate(pageSlugSchema, "params"), ctrl.discardPage);
router.post("/:pageSlug/reset/:key", validate(pageSlugSchema, "params"), ctrl.resetSlot);

module.exports = router;
