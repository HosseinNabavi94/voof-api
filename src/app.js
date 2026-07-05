"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const env = require("./config/env");
const ApiError = require("./utils/ApiError");
const v1 = require("./routes/v1");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.set("trust proxy", 1);
// crossOriginResourcePolicy relaxed so the storefront/admin (different
// origins) can load images served from /uploads.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan("dev"));

// CORS — allow-list only, credentials on (for the refresh cookie).
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / server-to-server (no origin) and configured origins
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new ApiError(403, "CORS_BLOCKED", `Origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

// Health check.
app.get("/health", (_req, res) =>
  res.json({ success: true, data: { status: "ok", uptime: process.uptime() } })
);

// API v1.
app.use("/api/v1", v1);

// Managed uploads: served by the API only when the active storage driver
// keeps files on local disk. Object-storage drivers serve their own URLs.
const storage = require("./services/storage");
if (storage.canServeLocally()) {
  const { UPLOAD_DIR } = require("./services/storage/localDriver");
  app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
      fallthrough: true,
      immutable: true,
      maxAge: "365d", // filenames are content-unique, safe to cache hard
    })
  );
}

// Optional: serve the admin panel statically at /admin for easy local dev.
if (env.adminDir) {
  const adminPath = path.resolve(__dirname, "..", env.adminDir);
  if (fs.existsSync(adminPath)) {
    app.use("/admin", express.static(adminPath));
    console.log(`[admin] serving panel from ${adminPath} at /admin`);
  } else {
    console.warn(`[admin] ADMIN_DIR set but not found: ${adminPath}`);
  }
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
