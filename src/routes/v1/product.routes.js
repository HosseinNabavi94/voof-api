"use strict";

const express = require("express");
const ctrl = require("../../controllers/product.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const {
  createProductSchema,
  updateProductSchema,
  listQuerySchema,
} = require("../../validators/product.validators");

const router = express.Router();

router.use(requireAuth); // all product admin routes require auth

router.get("/", validate(listQuerySchema, "query"), ctrl.list);
router.get("/:id", ctrl.getOne);
router.post("/", validate(createProductSchema), ctrl.create);
router.patch("/:id", validate(updateProductSchema), ctrl.update);
router.patch("/:id/status", ctrl.updateStatus);
router.delete("/:id", ctrl.remove);

module.exports = router;
