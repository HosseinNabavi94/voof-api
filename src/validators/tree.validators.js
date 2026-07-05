"use strict";

const { z } = require("zod");

const locationSchema = z.object({
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

const createTreeSchema = z.object({
  name: z.string().max(120).optional().default(""),
  species: z.string().min(1, "Species required").max(120),
  region: z.string().min(1, "Region required").max(160),
  customer: z
    .object({
      name: z.string().max(160).optional().default(""),
      email: z.union([z.string().email(), z.literal("")]).optional().default(""),
    })
    .optional()
    .default({ name: "", email: "" }),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  plantingDate: z.string().nullable().optional(),
  team: z.string().max(160).optional().default(""),
  location: locationSchema.optional(),
  paymentStatus: z.enum(["unpaid", "paid", "gifted", "refunded"]).optional().default("unpaid"),
  notes: z.string().max(5000).optional().default(""),
});

const updateDetailsSchema = z
  .object({
    name: z.string().max(120).optional(),
    species: z.string().min(1).max(120).optional(),
    region: z.string().min(1).max(160).optional(),
    plantingDate: z.string().nullable().optional(),
    team: z.string().max(160).optional(),
    location: locationSchema.optional(),
    customer: z
      .object({
        name: z.string().max(160).optional(),
        email: z.union([z.string().email(), z.literal("")]).optional(),
      })
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });

const statusSchema = z.object({
  status: z.enum(["pending", "approved", "scheduled", "planted", "delivered", "cancelled"]),
  note: z.string().max(500).optional().default(""),
});

const paymentSchema = z.object({
  paymentStatus: z.enum(["unpaid", "paid", "gifted", "refunded"]),
  note: z.string().max(500).optional().default(""),
});

const photosSchema = z
  .object({
    beforePhoto: z.string().optional(),
    afterPhoto: z.string().optional(),
    gallery: z.array(z.string()).max(20).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });

const notesSchema = z.object({ notes: z.string().max(5000) });
const timelineNoteSchema = z.object({ note: z.string().min(1).max(2000) });

const listQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["pending", "approved", "scheduled", "planted", "delivered", "cancelled"]).optional(),
  paymentStatus: z.enum(["unpaid", "paid", "gifted", "refunded"]).optional(),
  region: z.string().optional(),
  species: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(15),
  sort: z
    .enum(["-createdAt", "createdAt", "-plantingDate", "plantingDate", "certificateNumber", "-certificateNumber"])
    .optional()
    .default("-createdAt"),
});

const mapQuerySchema = z.object({
  status: z.enum(["pending", "approved", "scheduled", "planted", "delivered", "cancelled"]).optional(),
  region: z.string().optional(),
  species: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

const publicListQuerySchema = z.object({
  region: z.string().optional(),
  species: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

module.exports = {
  createTreeSchema,
  updateDetailsSchema,
  statusSchema,
  paymentSchema,
  photosSchema,
  notesSchema,
  timelineNoteSchema,
  listQuerySchema,
  mapQuerySchema,
  publicListQuerySchema,
};
