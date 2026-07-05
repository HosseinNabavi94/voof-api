"use strict";

const ApiError = require("../utils/ApiError");
const tokens = require("../utils/tokens");
const AdminUser = require("../models/AdminUser");

/**
 * Requires a valid access token in the Authorization header.
 * Attaches the current admin user to req.user.
 */
async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw ApiError.unauthorized("Missing access token", "NO_TOKEN");
    }

    let payload;
    try {
      payload = tokens.verifyAccess(token);
    } catch (e) {
      throw ApiError.unauthorized("Invalid or expired token", "TOKEN_INVALID");
    }

    const user = await AdminUser.findById(payload.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized("Account not available", "ACCOUNT_INACTIVE");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Coarse role guard, kept minimal for Phase 1. Advanced/granular RBAC is a
 * later phase — for now this only gates the few superadmin-only actions.
 */
function requireRole(...allowed) {
  return (req, _res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return next(ApiError.forbidden("Insufficient role", "ROLE_REQUIRED"));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
