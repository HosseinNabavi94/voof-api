"use strict";

/**
 * Upload parsing middleware. Multer is an implementation detail confined to
 * this file — controllers receive plain { buffer, originalname, mimetype }
 * objects on req.files and hand them to the storage service.
 */

const multer = require("multer");
const ApiError = require("../utils/ApiError");

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(
        ApiError.badRequest(
          "Only JPEG, PNG, and WebP images are allowed",
          "INVALID_FILE_TYPE"
        )
      );
    }
    cb(null, true);
  },
});

/** Accepts up to MAX_FILES images under the "images" field. */
function parseImages(req, res, next) {
  parser.array("images", MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("Each image must be 5MB or smaller", "FILE_TOO_LARGE"));
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(ApiError.badRequest(`At most ${MAX_FILES} images per upload`, "TOO_MANY_FILES"));
    }
    return next(ApiError.badRequest("Upload failed", "UPLOAD_ERROR"));
  });
}

module.exports = { parseImages, ALLOWED_MIME, MAX_FILE_SIZE, MAX_FILES };
