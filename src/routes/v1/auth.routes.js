"use strict";

const express = require("express");
const ctrl = require("../../controllers/auth.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { loginLimiter } = require("../../middleware/rateLimit");
const { loginSchema, changePasswordSchema } = require("../../validators/auth.validators");

const router = express.Router();

router.post("/login", loginLimiter, validate(loginSchema), ctrl.login);
router.post("/refresh", ctrl.refresh);
router.post("/logout", ctrl.logout);
router.get("/me", requireAuth, ctrl.me);
router.post("/change-password", requireAuth, validate(changePasswordSchema), ctrl.changePassword);

module.exports = router;
