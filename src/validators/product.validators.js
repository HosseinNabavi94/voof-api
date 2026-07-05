"use strict";

const { z } = require("zod");

const sizeSchema = z.object({
  size: z.string().min(1),
  available: z.boolean().optional().default(true),
  stock: z.number().int().min(0).optional().default(0),
});

const colorSchema = z.object({
  name: z.string().min(1),
  hex: z.string().min(1),
  available: z.boolean().optional().default(true),
});

const createProductSchema = z.object({
  name: z.string().min(1, "Name required"),
  slug: z.string().min(1).optional(),
  price: z.number().int().min(0, "Price must be >= 0"),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  category: z.string().min(1, "Category id required"),
  image: z.string().min(1, "Primary image required"),
  hoverImage: z.string().optional().default(""),
  gallery: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(""),
  longDescription: z.string().optional().default(""),
  materials: z.array(z.string()).optional().default([]),
  care: z.array(z.string()).optional().default([]),
  details: z.array(z.string()).optional().default([]),
  madeIn: z.string().optional().default(""),
  sizes: z.array(sizeSchema).optional().default([]),
  colors: z.array(colorSchema).optional().default([]),
  stock: z.number().int().min(0).optional().default(0),
  status: z.enum(["draft", "published", "archived"]).optional().default("draft"),
  featured: z.boolean().optional().default(false),
  isNewArrival: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
});

const updateProductSchema = createProductSchema.partial();

// Query-string boolean: "true"/"1" -> true, "false"/"0" -> false.
// (z.coerce.boolean() would treat the string "false" as true.)
const queryBool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const listQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(), // category id
  status: z.enum(["draft", "published", "archived"]).optional(),
  featured: queryBool.optional(),
  isNewArrival: queryBool.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.string().optional().default("-createdAt"),
});

module.exports = { createProductSchema, updateProductSchema, listQuerySchema };
