"use strict";

const express = require("express");
const ctrl = require("../../controllers/dashboard.controller");
const { requireAuth } = require("../../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", ctrl.summary);
router.get("/sales", ctrl.sales); // ?granularity=daily|weekly|monthly

module.exports = router;
