"use strict";

const express = require("express");

const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/products", require("./product.routes"));
router.use("/categories", require("./category.routes"));
router.use("/orders", require("./order.routes"));
router.use("/customers", require("./customer.routes"));
router.use("/content", require("./content.routes"));
router.use("/faq", require("./faq.routes"));
router.use("/discounts", require("./discount.routes"));
router.use("/trees", require("./tree.routes"));
router.use("/dashboard", require("./dashboard.routes"));
router.use("/media", require("./media.routes"));
router.use("/public", require("./public.routes"));

module.exports = router;
