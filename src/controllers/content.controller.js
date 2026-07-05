"use strict";

const sanitizeHtml = require("sanitize-html");
const ApiError = require("../utils/ApiError");
const { asyncHandler, ok } = require("../utils/helpers");
const { resolveAssetUrl } = require("../utils/assets");
const registry = require("../content/registry");
const ContentEntry = require("../models/ContentEntry");

/* ------------------------------------------------------------------ */
/* Sanitization — richtext HTML allowlist (stored XSS is impossible    */
/* regardless of client behavior).                                     */
/* ------------------------------------------------------------------ */

const SANITIZE_OPTS = {
  allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "h3", "h4", "ul", "ol", "li", "a", "blockquote"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

function cleanValue(slot, raw) {
  if (slot.type === "list") {
    if (!Array.isArray(raw)) {
      throw ApiError.badRequest(`Slot "${slot.key}" expects a list`, "TYPE_MISMATCH");
    }
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    throw ApiError.badRequest(`Slot "${slot.key}" expects a string`, "TYPE_MISMATCH");
  }
  const str = String(raw);
  if (slot.type === "richtext") return sanitizeHtml(str, SANITIZE_OPTS);
  if (slot.type === "image") {
    const v = str.trim();
    // Relative keys/paths only — URLs are generated at the boundary, never stored.
    if (v && !v.startsWith("/")) {
      throw ApiError.badRequest(
        `Slot "${slot.key}" must be a relative asset path (got a non-relative value)`,
        "ABSOLUTE_URL_REJECTED"
      );
    }
    return v;
  }
  return str.trim();
}

/* ------------------------------------------------------------------ */
/* Admin: pages overview                                               */
/* ------------------------------------------------------------------ */

const listPages = asyncHandler(async (_req, res) => {
  const entries = await ContentEntry.find({});
  const byPage = new Map();
  for (const e of entries) {
    if (!byPage.has(e.pageSlug)) byPage.set(e.pageSlug, []);
    byPage.get(e.pageSlug).push(e);
  }

  const pages = registry.PAGES.map((p) => {
    const list = byPage.get(p.slug) || [];
    const totalSlots = Object.keys(registry.SLOT_INDEX[p.slug]).length;
    const dirty = list.filter((e) => e.isDirty()).length;
    const lastPublishedAt = list.reduce(
      (max, e) => (e.publishedAt && (!max || e.publishedAt > max) ? e.publishedAt : max),
      null
    );
    return {
      slug: p.slug,
      label: p.label,
      totalSlots,
      seeded: list.length,
      dirtySlots: dirty,
      hasDraftChanges: dirty > 0,
      lastPublishedAt,
    };
  });

  return ok(res, pages);
});

/* ------------------------------------------------------------------ */
/* Admin: single page editor feed (registry merged with values)        */
/* ------------------------------------------------------------------ */

const getPage = asyncHandler(async (req, res) => {
  const page = registry.getPage(req.params.pageSlug);
  if (!page) throw ApiError.notFound("Unknown page");

  const entries = await ContentEntry.find({ pageSlug: page.slug });
  const byKey = new Map(entries.map((e) => [e.key, e]));

  const sections = page.sections.map((s) => ({
    id: s.id,
    label: s.label,
    slots: s.slots.map((slot) => {
      const entry = byKey.get(slot.key);
      const draftValue = entry ? entry.draftValue : slot.default;
      const publishedValue = entry ? entry.publishedValue : slot.default;
      return {
        key: slot.key,
        label: slot.label,
        type: slot.type,
        draftValue,
        publishedValue,
        draftPreviewUrl: slot.type === "image" ? resolveAssetUrl(draftValue) : undefined,
        dirty: JSON.stringify(draftValue) !== JSON.stringify(publishedValue),
        default: slot.default,
      };
    }),
  }));

  const dirtySlots = sections.reduce(
    (n, s) => n + s.slots.filter((sl) => sl.dirty).length,
    0
  );

  return ok(res, { slug: page.slug, label: page.label, sections, dirtySlots });
});

/* ------------------------------------------------------------------ */
/* Admin: save drafts (bulk upsert, registry-validated)                */
/* ------------------------------------------------------------------ */

const putPage = asyncHandler(async (req, res) => {
  const page = registry.getPage(req.params.pageSlug);
  if (!page) throw ApiError.notFound("Unknown page");

  const { values } = req.body;
  const keys = Object.keys(values);
  if (!keys.length) throw ApiError.badRequest("No values provided", "EMPTY");

  // Validate every key against the registry BEFORE writing anything.
  const prepared = keys.map((key) => {
    const slot = registry.getSlot(page.slug, key);
    if (!slot) {
      throw ApiError.badRequest(`Unknown slot "${key}" for page "${page.slug}"`, "UNKNOWN_SLOT");
    }
    return { slot, value: cleanValue(slot, values[key]) };
  });

  for (const { slot, value } of prepared) {
    // eslint-disable-next-line no-await-in-loop
    await ContentEntry.findOneAndUpdate(
      { pageSlug: page.slug, key: slot.key },
      {
        $set: { draftValue: value, type: slot.type, updatedByEmail: req.user.email },
        // First save of a slot: published side starts at the seed default,
        // preserving H — nothing goes live until an explicit publish.
        $setOnInsert: { publishedValue: slot.default },
      },
      { upsert: true, new: true }
    );
  }

  return getPage(req, res);
});

/* ------------------------------------------------------------------ */
/* Admin: publish / discard / reset                                    */
/* ------------------------------------------------------------------ */

const publishPage = asyncHandler(async (req, res) => {
  const page = registry.getPage(req.params.pageSlug);
  if (!page) throw ApiError.notFound("Unknown page");

  const entries = await ContentEntry.find({ pageSlug: page.slug });
  const now = new Date();
  let published = 0;
  for (const e of entries) {
    if (e.isDirty()) {
      e.publishedValue = e.draftValue;
      e.publishedAt = now;
      e.updatedByEmail = req.user.email;
      // eslint-disable-next-line no-await-in-loop
      await e.save();
      published += 1;
    }
  }
  if (!published) throw ApiError.badRequest("No draft changes to publish", "NOTHING_TO_PUBLISH");

  return getPage(req, res);
});

const discardPage = asyncHandler(async (req, res) => {
  const page = registry.getPage(req.params.pageSlug);
  if (!page) throw ApiError.notFound("Unknown page");

  const entries = await ContentEntry.find({ pageSlug: page.slug });
  let reverted = 0;
  for (const e of entries) {
    if (e.isDirty()) {
      e.draftValue = e.publishedValue;
      e.updatedByEmail = req.user.email;
      // eslint-disable-next-line no-await-in-loop
      await e.save();
      reverted += 1;
    }
  }
  if (!reverted) throw ApiError.badRequest("No draft changes to discard", "NOTHING_TO_DISCARD");

  return getPage(req, res);
});

const resetSlot = asyncHandler(async (req, res) => {
  const page = registry.getPage(req.params.pageSlug);
  if (!page) throw ApiError.notFound("Unknown page");
  const slot = registry.getSlot(page.slug, req.params.key);
  if (!slot) throw ApiError.notFound("Unknown slot");

  await ContentEntry.findOneAndUpdate(
    { pageSlug: page.slug, key: slot.key },
    {
      $set: { draftValue: slot.default, type: slot.type, updatedByEmail: req.user.email },
      $setOnInsert: { publishedValue: slot.default },
    },
    { upsert: true }
  );

  return getPage(req, res);
});

/* ------------------------------------------------------------------ */
/* Public: published-only content map (requirement H)                  */
/* ------------------------------------------------------------------ */

const publicPage = asyncHandler(async (req, res) => {
  const page = registry.getPage(req.params.pageSlug);
  if (!page) throw ApiError.notFound("Unknown page");

  const entries = await ContentEntry.find({ pageSlug: page.slug });
  const byKey = new Map(entries.map((e) => [e.key, e]));

  const map = {};
  for (const key of Object.keys(registry.SLOT_INDEX[page.slug])) {
    const slot = registry.SLOT_INDEX[page.slug][key];
    const entry = byKey.get(key);
    const value = entry ? entry.publishedValue : slot.default; // published ONLY
    map[key] = slot.type === "image" ? resolveAssetUrl(value) : value;
  }

  return ok(res, map);
});

module.exports = {
  listPages,
  getPage,
  putPage,
  publishPage,
  discardPage,
  resetSlot,
  publicPage,
};
