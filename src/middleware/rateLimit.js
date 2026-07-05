"use strict";

const rateLimit = require("express-rate-limit");

// Tight limit on login to slow brute-force attempts.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    meta: null,
    error: { code: "RATE_LIMITED", message: "Too many attempts. Try again shortly." },
  },
});

// General limiter for unauthenticated public writes (contact/order in later phases).
const publicWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, publicWriteLimiter };
