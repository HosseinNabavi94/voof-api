"use strict";

const jwt = require("jsonwebtoken");
const env = require("../config/env");

const tokens = {
  signAccess(user) {
    return jwt.sign(
      { sub: String(user._id), role: user.role, email: user.email },
      env.jwt.accessSecret,
      { expiresIn: env.jwt.accessTtl }
    );
  },

  signRefresh(user) {
    return jwt.sign(
      { sub: String(user._id), tv: user.tokenVersion },
      env.jwt.refreshSecret,
      { expiresIn: env.jwt.refreshTtl }
    );
  },

  verifyAccess(token) {
    return jwt.verify(token, env.jwt.accessSecret);
  },

  verifyRefresh(token) {
    return jwt.verify(token, env.jwt.refreshSecret);
  },
};

module.exports = tokens;
