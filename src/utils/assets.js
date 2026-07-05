"use strict";

/**
 * Asset URL resolution — the single place where relative storage keys become
 * public URLs. The DB only ever stores relative keys ("/uploads/x.webp") or
 * legacy storefront paths ("/hero.jpg"), never absolute URLs.
 *
 * Rules:
 *  - Keys under /uploads/ are resolved against ASSET_BASE_URL (the API's own
 *    origin by default), because the API hosts those files.
 *  - Anything else (legacy storefront /public assets, already-absolute URLs)
 *    passes through unchanged.
 */

const env = require("../config/env");

const UPLOAD_PREFIX = "/uploads/";

function assetBase() {
  return (env.assetBaseUrl || `http://localhost:${env.port}`).replace(/\/+$/, "");
}

function resolveAssetUrl(key) {
  if (!key) return key;
  if (key.startsWith(UPLOAD_PREFIX)) return `${assetBase()}${key}`;
  return key; // legacy storefront path or external/absolute URL
}

function resolveMany(keys) {
  return (keys || []).map(resolveAssetUrl);
}

module.exports = { resolveAssetUrl, resolveMany, UPLOAD_PREFIX };
