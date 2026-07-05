"use strict";

const express = require("express");
const ctrl = require("../../controllers/faq.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const {
  createFaqSchema,
  updateFaqSchema,
  reorderFaqSchema,
} = require("../../validators/content.validators");

const router = express.Router();

router.use(requireAuth);

router.get("/", ctrl.list);
router.post("/", validate(createFaqSchema), ctrl.create);
router.patch("/reorder", validate(reorderFaqSchema), ctrl.reorder); // before /:id
router.patch("/:id", validate(updateFaqSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
