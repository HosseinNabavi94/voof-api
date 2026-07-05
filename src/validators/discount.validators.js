"use strict";

const { z } = require("zod");

const CODE_RX = /^[A-Za-z0-9_-]{3,40}$/;

const baseFields = {
  code: z.string().regex(CODE_RX, "Code: letters, digits, - and _ (3–40 chars)").optional(),
  description: z.string().max(500).optional().default(""),
  kind: z.enum(["percent", "amount"]),
  value: z.number().int().min(1),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  startsAt: z.string().nullable().optional(), // ISO or null
  expiresAt: z.string().nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  maxUsesPerCustomer: z.number().int().min(1).nullable().optional(),
  firstPurchaseOnly: z.boolean().optional().default(false),
  minPurchase: z.number().int().min(0).nullable().optional(),
  maxDiscountCap: z.number().int().min(1).nullable().optional(),
  products: z.array(z.string().min(1)).max(200).optional().default([]),
  categories: z.array(z.string().min(1)).max(50).optional().default([]),
};

const refinePercent = (d) => d.kind !== "percent" || d.value <= 100;
const refineDates = (d) =>
  !d.startsAt || !d.expiresAt || new Date(d.startsAt) <= new Date(d.expiresAt);

const createDiscountSchema = z
  .object(baseFields)
  .refine(refinePercent, { message: "Percent value must be 1–100", path: ["value"] })
  .refine(refineDates, { message: "Start date must be before expiry", path: ["expiresAt"] });

const updateDiscountSchema = z
  .object(Object.fromEntries(Object.entries(baseFields).map(([k, v]) => [k, v.optional()])))
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" })
  .refine((d) => d.kind !== "percent" || d.value === undefined || d.value <= 100, {
    message: "Percent value must be 1–100",
    path: ["value"],
  });

const statusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  kind: z.enum(["percent", "amount"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(15),
  sort: z
    .enum(["-createdAt", "createdAt", "code", "-code", "-usedCount", "usedCount", "-expiresAt", "expiresAt"])
    .optional()
    .default("-createdAt"),
});

const validateSchema = z.object({
  code: z.string().min(1),
  customerEmail: z.string().email().optional(),
  subtotal: z.number().int().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        price: z.number().int().min(0),
      })
    )
    .optional()
    .default([]),
});

const redeemSchema = validateSchema.extend({
  customerEmail: z.string().email("Customer email required for redemption"),
  customerId: z.string().optional(),
  orderId: z.string().min(1, "orderId required"),
  orderNumber: z.string().optional().default(""),
});

module.exports = {
  createDiscountSchema,
  updateDiscountSchema,
  statusSchema,
  listQuerySchema,
  validateSchema,
  redeemSchema,
  CODE_RX,
};
