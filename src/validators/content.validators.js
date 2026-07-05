"use strict";

const { z } = require("zod");
const { PAGE_SLUGS } = require("../content/registry");

const pageSlugSchema = z.object({
  pageSlug: z.enum(PAGE_SLUGS),
});

// Bulk draft save: { values: { "hero.title": "...", "links.items": [...] } }
// Keys/types are validated against the registry in the controller (the
// registry is the schema-of-record; zod just checks the envelope shape).
const putContentSchema = z.object({
  values: z.record(
    z.string().min(1).max(120),
    z.union([z.string().max(20000), z.array(z.string().max(2000)).max(50)])
  ),
});

const createFaqSchema = z.object({
  question: z.string().min(1, "Question required").max(500),
  answer: z.string().min(1, "Answer required").max(5000),
  status: z.enum(["published", "hidden"]).optional().default("published"),
});

const updateFaqSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).max(5000).optional(),
  status: z.enum(["published", "hidden"]).optional(),
});

const reorderFaqSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

module.exports = {
  pageSlugSchema,
  putContentSchema,
  createFaqSchema,
  updateFaqSchema,
  reorderFaqSchema,
};
