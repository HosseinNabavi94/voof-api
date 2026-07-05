"use strict";

const express = require("express");
const ctrl = require("../../controllers/discount.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const {
  createDiscountSchema,
  updateDiscountSchema,
  statusSchema,
  listQuerySchema,
  validateSchema,
  redeemSchema,
} = require("../../validators/discount.validators");

const router = express.Router();

router.use(requireAuth); // whole surface admin-only for now; checkout phase
                         // will expose validate/redeem through its own flow.

// Engine (static paths before /:id).
router.post("/validate", validate(validateSchema), ctrl.validateCode);
router.post("/redeem", validate(redeemSchema), ctrl.redeemCode);

router.get("/", validate(listQuerySchema, "query"), ctrl.list);
router.post("/", validate(createDiscountSchema), ctrl.create);
router.get("/:id", ctrl.getOne);
router.patch("/:id", validate(updateDiscountSchema), ctrl.update);
router.patch("/:id/status", validate(statusSchema), ctrl.updateStatus);
router.post("/:id/duplicate", ctrl.duplicate);
router.delete("/:id", ctrl.remove); // guarded: refuses when usages exist

module.exports = router;
