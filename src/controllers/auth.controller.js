"use strict";

const ApiError = require("../utils/ApiError");
const { asyncHandler, ok } = require("../utils/helpers");
const tokens = require("../utils/tokens");
const env = require("../config/env");
const AdminUser = require("../models/AdminUser");

const REFRESH_COOKIE = "voof_rt";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await AdminUser.findOne({ email }).select("+passwordHash");
  // Constant-ish response to avoid leaking which part failed.
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }
  const valid = await user.verifyPassword(password);
  if (!valid) {
    throw ApiError.unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = tokens.signAccess(user);
  const refreshToken = tokens.signRefresh(user);

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return ok(res, { accessToken, user: user.toSafeJSON() });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies ? req.cookies[REFRESH_COOKIE] : null;
  if (!token) throw ApiError.unauthorized("No refresh token", "NO_REFRESH");

  let payload;
  try {
    payload = tokens.verifyRefresh(token);
  } catch (e) {
    throw ApiError.unauthorized("Invalid refresh token", "REFRESH_INVALID");
  }

  const user = await AdminUser.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized("Session expired", "SESSION_EXPIRED");
  }

  // Rotate: issue a fresh refresh cookie alongside the new access token.
  const accessToken = tokens.signAccess(user);
  const newRefresh = tokens.signRefresh(user);
  res.cookie(REFRESH_COOKIE, newRefresh, refreshCookieOptions());

  return ok(res, { accessToken, user: user.toSafeJSON() });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
  return ok(res, { message: "Logged out" });
});

const me = asyncHandler(async (req, res) => {
  return ok(res, { user: req.user.toSafeJSON() });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await AdminUser.findById(req.user._id).select("+passwordHash");
  const valid = await user.verifyPassword(currentPassword);
  if (!valid) {
    throw ApiError.badRequest("Current password is incorrect", "BAD_PASSWORD");
  }
  await user.setPassword(newPassword);
  user.tokenVersion += 1; // invalidate existing refresh tokens
  await user.save();

  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
  return ok(res, { message: "Password updated. Please log in again." });
});

module.exports = { login, refresh, logout, me, changePassword };
