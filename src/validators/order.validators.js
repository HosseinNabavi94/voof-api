"use strict";

const { z } = require("zod");

const itemSchema = z.object({
  productId: z.string().min(1, "Product id required"),
  quantity: z.number().int().min(1).max(999),
  size: z.string().optional().default(""),
  color: z.string().optional().default(""),
});

const createOrderSchema = z.object({
  customer: z.object({
    firstName: z.string().min(1, "First name required"),
    lastName: z.string().optional().default(""),
    email: z.string().email("Valid email required"),
    phone: z.string().optional().default(""),
  }),
  shippingAddress: z.object({
    line1: z.string().min(1, "Address required"),
    line2: z.string().optional().default(""),
    city: z.string().min(1, "City required"),
    province: z.string().optional().default(""),
    postalCode: z.string().optional().default(""),
  }),
  items: z.array(itemSchema).min(1, "At least one item"),
  shippingCost: z.number().int().min(0).optional().default(0),
  discount: z.number().int().min(0).optional().default(0),
  paymentMethod: z.string().optional().default("zarinpal"),
  notes: z.string().optional().default(""),
});

const statusSchema = z.object({
  status: z.enum([
    "pending", "confirmed", "preparing", "packed",
    "shipped", "delivered", "cancelled", "returned",
  ]),
  note: z.string().optional().default(""),
});

const paymentSchema = z.object({
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]),
  paymentRef: z.string().optional(),
  note: z.string().optional().default(""),
});

const shippingSchema = z.object({
  carrier: z.string().optional(),
  trackingCode: z.string().optional(),
  note: z.string().optional().default(""),
});

const notesSchema = z.object({
  notes: z.string().max(5000),
});

const timelineNoteSchema = z.object({
  note: z.string().min(1, "Note text required").max(2000),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  status: z
    .enum([
      "pending", "confirmed", "preparing", "packed",
      "shipped", "delivered", "cancelled", "returned",
    ])
    .optional(),
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
  from: z.string().optional(), // ISO date
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(15),
  sort: z
    .enum(["-createdAt", "createdAt", "-total", "total", "orderNumber", "-orderNumber"])
    .optional()
    .default("-createdAt"),
});

const historyQuerySchema = z.object({
  email: z.string().email("Valid email required"),
});

module.exports = {
  createOrderSchema,
  statusSchema,
  paymentSchema,
  shippingSchema,
  notesSchema,
  timelineNoteSchema,
  listQuerySchema,
  historyQuerySchema,
};
