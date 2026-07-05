"use strict";

/**
 * Storage service — the ONLY module the rest of the app talks to for file
 * storage. Backed by pluggable drivers selected via STORAGE_DRIVER.
 *
 * Driver contract:
 *   upload({ buffer, originalName, mimeType }) -> Promise<{ key: string }>
 *     `key` is a relative asset path (e.g. "/uploads/abc.webp") stored in DB.
 *   delete(key) -> Promise<void>
 *   canServeLocally() -> boolean   (whether the API should mount /uploads)
 *
 * Adding Liara Object Storage / S3 / Cloudinary later = add a driver file
 * and set STORAGE_DRIVER; no changes anywhere else.
 */

const env = require("../../config/env");
const localDriver = require("./localDriver");

const drivers = {
  local: localDriver,
  // liara: require("./liaraDriver"),   // future
  // s3: require("./s3Driver"),         // future
};

const driver = drivers[env.storageDriver];
if (!driver) {
  throw new Error(
    `Unknown STORAGE_DRIVER "${env.storageDriver}". Available: ${Object.keys(drivers).join(", ")}`
  );
}

module.exports = {
  upload: (file) => driver.upload(file),
  delete: (key) => driver.delete(key),
  canServeLocally: () => driver.canServeLocally(),
  driverName: env.storageDriver,
};
