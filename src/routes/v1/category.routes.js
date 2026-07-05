"use strict";

const express = require("express");
const ctrl = require("../../controllers/category.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const {
  createCategorySchema,
  updateCategorySchema,
  listQuerySchema,
} = require("../../validators/category.validators");

const router = express.Router();

router.use(requireAuth); // all category admin routes require auth

router.get("/", validate(listQuerySchema, "query"), ctrl.list);
router.get("/:id", ctrl.getOne);
router.post("/", validate(createCategorySchema), ctrl.create);
router.patch("/:id", validate(updateCategorySchema), ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
