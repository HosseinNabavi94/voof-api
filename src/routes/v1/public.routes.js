"use strict";

const express = require("express");
const ctrl = require("../../controllers/public.controller");

const router = express.Router();

// Unauthenticated, read-only storefront surface.
router.get("/products", ctrl.listProducts);
router.get("/products/:slug", ctrl.getProduct);
router.get("/products/:slug/related", ctrl.getRelated);
router.get("/categories", ctrl.listCategories);

// CMS reads (Phase 5): published content only — drafts are never exposed.
const contentCtrl = require("../../controllers/content.controller");
const faqCtrl = require("../../controllers/faq.controller");
router.get("/content/:pageSlug", contentCtrl.publicPage);
router.get("/faq", faqCtrl.publicList);

// Environmental system reads (Phase 8): planted/delivered trees only.
const treeCtrl = require("../../controllers/tree.controller");
const { publicListQuerySchema } = require("../../validators/tree.validators");
const validateMw = require("../../middleware/validate");
router.get("/trees", validateMw(publicListQuerySchema, "query"), treeCtrl.publicList);
router.get("/trees/verify/:certificateNumber", treeCtrl.publicVerify);

module.exports = router;
