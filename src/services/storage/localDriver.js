"use strict";

/**
 * Local-disk storage driver. Writes files to <project>/uploads and returns
 * relative keys ("/uploads/<name>"). The API serves this directory statically
 * (see app.js) because canServeLocally() is true for this driver.
 */

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.resolve(__dirname, "../../../uploads");
const PUBLIC_PREFIX = "/uploads";

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function safeName(originalName, mimeType) {
  const ext =
    EXT_BY_MIME[mimeType] ||
    path.extname(originalName || "").toLowerCase() ||
    ".bin";
  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(6).toString("hex");
  return `${stamp}-${rand}${ext}`;
}

module.exports = {
  async upload({ buffer, originalName, mimeType }) {
    await ensureDir();
    const name = safeName(originalName, mimeType);
    await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
    return { key: `${PUBLIC_PREFIX}/${name}` };
  },

  async delete(key) {
    // Only accept keys under our prefix; resolve and confine to UPLOAD_DIR
    // to prevent path traversal.
    if (!key || !key.startsWith(`${PUBLIC_PREFIX}/`)) return;
    const name = key.slice(PUBLIC_PREFIX.length + 1);
    const target = path.resolve(UPLOAD_DIR, name);
    if (!target.startsWith(UPLOAD_DIR + path.sep)) return;
    try {
      await fs.unlink(target);
    } catch (err) {
      if (err.code !== "ENOENT") throw err; // already gone is fine
    }
  },

  canServeLocally() {
    return true;
  },

  UPLOAD_DIR,
  PUBLIC_PREFIX,
};
