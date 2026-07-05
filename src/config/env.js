"use strict";

require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    // Fail fast: a misconfigured secret is worse than a crash on boot.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),

  mongoUri: required("MONGODB_URI"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
    refreshTtl: process.env.REFRESH_TOKEN_TTL || "7d",
  },

  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  cookieSecure: String(process.env.COOKIE_SECURE || "false") === "true",

  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL || "admin@voof.local",
    password: process.env.SEED_ADMIN_PASSWORD || "ChangeMe!2026",
    name: process.env.SEED_ADMIN_NAME || "Voof Admin",
  },

  adminDir: process.env.ADMIN_DIR || "",

  // File storage: which driver the storage service uses ("local" for now;
  // "liara" / "s3" / "cloudinary" later without touching other modules).
  storageDriver: process.env.STORAGE_DRIVER || "local",

  // Base URL prefixed onto managed asset keys (/uploads/...) when the API
  // serializes them. Defaults to the API's own origin.
  assetBaseUrl: process.env.ASSET_BASE_URL || "",
};

env.isProd = env.nodeEnv === "production";

module.exports = env;
