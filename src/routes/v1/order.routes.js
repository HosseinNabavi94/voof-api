"use strict";

const express = require("express");
const ctrl = require("../../controllers/order.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const {
  createOrderSchema,
  statusSchema,
  paymentSchema,
  shippingSchema,
  notesSchema,
  timelineNoteSchema,
  listQuerySchema,
  historyQuerySchema,
} = require("../../validators/order.validators");

const router = express.Router();

router.use(requireAuth); // the entire orders surface is admin-only

// NOTE: static path before "/:id" so it isn't captured as an id.
router.get("/customer-history", validate(historyQuerySchema, "query"), ctrl.customerHistory);

router.get("/", validate(listQuerySchema, "query"), ctrl.list);
router.post("/", validate(createOrderSchema), ctrl.create);
router.get("/:id", ctrl.getOne);
router.patch("/:id/status", validate(statusSchema), ctrl.updateStatus);
router.patch("/:id/payment", validate(paymentSchema), ctrl.updatePayment);
router.patch("/:id/shipping", validate(shippingSchema), ctrl.updateShipping);
router.patch("/:id/notes", validate(notesSchema), ctrl.updateNotes);
router.post("/:id/timeline", validate(timelineNoteSchema), ctrl.addTimelineNote);

// No DELETE by design: orders are financial records; "cancelled" is terminal.

module.exports = router;
