"use strict";

const express = require("express");
const ctrl = require("../../controllers/customer.controller");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const {
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
} = require("../../validators/customer.validators");

const router = express.Router();

router.use(requireAuth); // entire customers surface is admin-only

// Static path before "/:id".
router.post("/import-from-orders", ctrl.importFromOrders);

router.get("/", validate(listQuerySchema, "query"), ctrl.list);
router.post("/", validate(createCustomerSchema), ctrl.create);
router.get("/:id", ctrl.getOne);
router.patch("/:id", validate(updateProfileSchema), ctrl.updateProfile);
router.patch("/:id/status", validate(statusSchema), ctrl.updateStatus);
router.patch("/:id/tags", validate(tagsSchema), ctrl.updateTags);
router.put("/:id/addresses", validate(addressesSchema), ctrl.updateAddresses);
router.post("/:id/loyalty", validate(loyaltySchema), ctrl.adjustLoyalty);
router.post("/:id/trees", validate(treeSchema), ctrl.addTree);
router.delete("/:id/trees/:index", ctrl.removeTree);
router.post("/:id/discounts", validate(discountAssignSchema), ctrl.assignDiscount);
router.patch("/:id/discounts/:code", validate(discountUpdateSchema), ctrl.updateDiscount);
router.patch("/:id/notes", validate(notesSchema), ctrl.updateNotes);
router.post("/:id/timeline", validate(timelineNoteSchema), ctrl.addTimelineNote);

// No DELETE by design: blocked/inactive are the terminal paths.

module.exports = router;
