"use strict";

const { z } = require("zod");

const addressSchema = z.object({
  label: z.string().optional().default(""),
  line1: z.string().min(1, "Address line required"),
  line2: z.string().optional().default(""),
  city: z.string().min(1, "City required"),
  province: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

const createCustomerSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional().default(""),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().default(""),
  tags: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  notes: z.string().max(5000).optional().default(""),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const statusSchema = z.object({
  status: z.enum(["active", "inactive", "blocked"]),
  note: z.string().optional().default(""),
});

const tagsSchema = z.object({
  tags: z.array(z.string().min(1).max(40)).max(20),
});

const addressesSchema = z.object({
  addresses: z.array(addressSchema).max(10),
});

const loyaltySchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, "Delta cannot be zero"),
  reason: z.string().min(1, "Reason required").max(300),
});

const treeSchema = z.object({
  species: z.string().min(1, "Species required"),
  region: z.string().optional().default(""),
  certificateCode: z.string().optional().default(""),
  plantedAt: z.string().optional(), // ISO date
  orderId: z.string().optional(),
  note: z.string().optional().default(""),
});

const discountAssignSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Code: letters, digits, - and _ only"),
  kind: z.enum(["percent", "amount"]),
  value: z.number().int().min(1),
  expiresAt: z.string().optional(), // ISO date
}).refine((d) => d.kind !== "percent" || d.value <= 100, {
  message: "Percent value must be 1–100",
  path: ["value"],
});

const discountUpdateSchema = z.object({
  action: z.enum(["revoke", "mark-used"]),
  orderId: z.string().optional(),
});

const notesSchema = z.object({
  notes: z.string().max(5000),
});

const timelineNoteSchema = z.object({
  note: z.string().min(1, "Note text required").max(2000),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["active", "inactive", "blocked"]).optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(15),
  sort: z
    .enum(["-createdAt", "createdAt", "firstName", "-firstName"])
    .optional()
    .default("-createdAt"),
});

module.exports = {
  createCustomerSchema,
  updateProfileSchema,
  statusSchema,
  tagsSchema,
  addressesSchema,
  loyaltySchema,
  treeSchema,
  discountAssignSchema,
  discountUpdateSchema,
  notesSchema,
  timelineNoteSchema,
  listQuerySchema,
};
