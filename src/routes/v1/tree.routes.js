"use strict";

const express = require("express");
const ctrl = require("../../controllers/tree.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const {
  createTreeSchema,
  updateDetailsSchema,
  statusSchema,
  paymentSchema,
  photosSchema,
  notesSchema,
  timelineNoteSchema,
  listQuerySchema,
  mapQuerySchema,
} = require("../../validators/tree.validators");

const router = express.Router();

router.use(requireAuth); // the whole trees surface is admin-only

// Static paths before "/:id".
router.get("/map", validate(mapQuerySchema, "query"), ctrl.mapMarkers);

router.get("/", validate(listQuerySchema, "query"), ctrl.list);
router.post("/", validate(createTreeSchema), ctrl.create);
router.get("/:id", ctrl.getOne);
router.get("/:id/qr", ctrl.qr);
router.patch("/:id", validate(updateDetailsSchema), ctrl.updateDetails);
router.patch("/:id/status", validate(statusSchema), ctrl.updateStatus);
router.patch("/:id/payment", validate(paymentSchema), ctrl.updatePayment);
router.patch("/:id/photos", validate(photosSchema), ctrl.updatePhotos);
router.patch("/:id/notes", validate(notesSchema), ctrl.updateNotes);
router.post("/:id/timeline", validate(timelineNoteSchema), ctrl.addTimelineNote);
router.post("/:id/gift", ctrl.issueGiftManually);

// No DELETE by design: cancelled is the terminal path; planted trees and
// their certificates are permanent records.

module.exports = router;
