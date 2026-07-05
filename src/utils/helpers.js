"use strict";

/** Wrap async route handlers so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Standard success envelope. */
function ok(res, data, meta = undefined, status = 200) {
  return res.status(status).json({ success: true, data, meta, error: null });
}

/**
 * Slugify supporting Unicode (incl. Persian). Keeps letters/numbers, turns
 * whitespace and punctuation into single dashes. Falls back to a random slug
 * when the input reduces to empty.
 */
function slugify(input) {
  const base = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base || `item-${randomToken(6)}`;
}

/** Short uppercase alphanumeric token (no ambiguous chars). */
function randomToken(len = 6) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Product SKU, e.g. VF-7QK3PA. */
function generateSku() {
  return `VF-${randomToken(6)}`;
}

module.exports = { asyncHandler, ok, slugify, randomToken, generateSku };
