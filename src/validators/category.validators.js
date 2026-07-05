"use strict";

const { z } = require("zod");

const createCategorySchema = z.object({
  name: z.string().min(1, "Name required"),
  slug: z.string().min(1).optional(),
  description: z.string().optional().default(""),
  order: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const updateCategorySchema = createCategorySchema.partial();

const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

module.exports = { createCategorySchema, updateCategorySchema, listQuerySchema };
