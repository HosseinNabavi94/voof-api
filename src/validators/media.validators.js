"use strict";

const { z } = require("zod");

const listQuerySchema = z.object({
  q: z.string().optional(),
  folder: z.string().optional(), // folder id | "root" | "" (all)
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  sort: z
    .enum(["-createdAt", "createdAt", "displayName", "-displayName", "-size", "size"])
    .optional()
    .default("-createdAt"),
});

const updateAssetSchema = z
  .object({
    displayName: z.string().min(1).max(200).optional(),
    alt: z.string().max(500).optional(),
    // move: folder id or null (root)
    folder: z.union([z.string().min(1), z.null()]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });

const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name required").max(80),
});

const renameFolderSchema = z.object({
  name: z.string().min(1).max(80),
});

module.exports = {
  listQuerySchema,
  updateAssetSchema,
  createFolderSchema,
  renameFolderSchema,
};
