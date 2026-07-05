"use strict";

const QRCode = require("qrcode");
const ApiError = require("../utils/ApiError");
const { asyncHandler, ok, randomToken } = require("../utils/helpers");
const env = require("../config/env");
const Tree = require("../models/Tree");
const { Discount } = require("../models/Discount");

/* ------------------------------------------------------------------ */
/* Gift policy — issued automatically on transition to `planted`.      */
/* ------------------------------------------------------------------ */

const GIFT = {
  kind: "percent",
  value: 10, // 10%
  days: 90, // validity window
  maxUses: 1,
  maxUsesPerCustomer: 1,
};

async function uniqueGiftCode() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const code = `TREE-${randomToken(6)}`;
    // eslint-disable-next-line no-await-in-loop
    const clash = await Discount.findOne({ code });
    if (!clash) return code;
  }
}

/**
 * Issues the gift discount for a planted tree (idempotent). Creates the
 * Phase 7 Discount, stamps it on the tree, and mirrors it onto the Phase 4
 * customer profile + timeline when a customer record exists. Best-effort by
 * design: a gift failure must never block the planting workflow.
 */
async function issueGift(tree, actorEmail) {
  if (tree.giftDiscount && tree.giftDiscount.code) return null; // already issued
  const email = tree.customerSnapshot.email;
  if (!email) return null; // no recipient

  const code = await uniqueGiftCode();
  const expiresAt = new Date(Date.now() + GIFT.days * 24 * 60 * 60 * 1000);

  const discount = await Discount.create({
    code,
    description: `هدیه کاشت درخت — گواهی ${tree.certificateNumber}`,
    kind: GIFT.kind,
    value: GIFT.value,
    status: "active",
    expiresAt,
    maxUses: GIFT.maxUses,
    maxUsesPerCustomer: GIFT.maxUsesPerCustomer,
    createdByEmail: actorEmail || "system",
  });

  tree.giftDiscount = { discountId: discount._id, code, issuedAt: new Date() };
  tree.pushEvent({
    type: "gift",
    detail: `کد هدیه ${code} (${GIFT.value}٪، اعتبار ${GIFT.days} روز) صادر شد`,
    byEmail: actorEmail || "",
  });

  // Mirror onto the customer profile (Phase 4) — best-effort.
  try {
    // eslint-disable-next-line global-require
    const Customer = require("../models/Customer");
    const customer =
      (tree.customerId && (await Customer.findById(tree.customerId))) ||
      (await Customer.findOne({ email }));
    if (customer) {
      customer.discountCodes.push({
        code,
        kind: GIFT.kind,
        value: GIFT.value,
        expiresAt,
        status: "active",
        assignedBy: "voof-environment",
        at: new Date(),
      });
      customer.pushEvent({
        type: "discount",
        detail: `هدیه کاشت درخت: کد ${code} (گواهی ${tree.certificateNumber})`,
      });
      await customer.save();
    }
  } catch (_) {
    /* mirroring is optional */
  }

  return code;
}

/* ------------------------------------------------------------------ */
/* List / map / detail                                                 */
/* ------------------------------------------------------------------ */

function yearRange(year) {
  return {
    $gte: new Date(Date.UTC(year, 0, 1)),
    $lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

function buildFilter(q) {
  const filter = {};
  if (q.q) {
    const rx = { $regex: q.q, $options: "i" };
    filter.$or = [
      { certificateNumber: rx },
      { name: rx },
      { species: rx },
      { region: rx },
      { "customerSnapshot.name": rx },
      { "customerSnapshot.email": rx },
    ];
  }
  if (q.status) filter.status = q.status;
  if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;
  if (q.region) filter.region = { $regex: q.region, $options: "i" };
  if (q.species) filter.species = { $regex: q.species, $options: "i" };
  if (q.year) filter.plantingDate = yearRange(q.year);
  return filter;
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, sort } = req.query;
  const filter = buildFilter(req.query);

  const [items, total] = await Promise.all([
    Tree.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Tree.countDocuments(filter),
  ]);

  return ok(
    res,
    items.map((t) => t.toListJSON()),
    { page, limit, total, pages: Math.ceil(total / limit) }
  );
});

const mapMarkers = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);
  filter["location.lat"] = { $ne: null };
  filter["location.lng"] = { $ne: null };
  const items = await Tree.find(filter).limit(2000);

  // Distinct filter options for the UI.
  const [regions, species] = await Promise.all([
    Tree.distinct("region"),
    Tree.distinct("species"),
  ]);

  return ok(res, {
    markers: items.map((t) => t.toMarkerJSON()),
    regions,
    species,
  });
});

const getOne = asyncHandler(async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");
  return ok(res, tree.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Create / update                                                     */
/* ------------------------------------------------------------------ */

const create = asyncHandler(async (req, res) => {
  const d = req.body;

  const tree = new Tree({
    certificateNumber: await Tree.nextCertificateNumber(),
    name: d.name,
    species: d.species,
    region: d.region,
    customerSnapshot: { name: d.customer.name, email: d.customer.email },
    customerId: d.customerId || null,
    orderId: d.orderId || null,
    plantingDate: d.plantingDate ? new Date(d.plantingDate) : null,
    team: d.team,
    location: d.location || { lat: null, lng: null },
    paymentStatus: d.paymentStatus,
    notes: d.notes,
  });

  // Auto-link to a customer record by email (Phase 4 convention, best-effort).
  if (!tree.customerId && tree.customerSnapshot.email) {
    try {
      // eslint-disable-next-line global-require
      const Customer = require("../models/Customer");
      const customer = await Customer.findOne({ email: tree.customerSnapshot.email });
      if (customer) {
        tree.customerId = customer._id;
        if (!tree.customerSnapshot.name) tree.customerSnapshot.name = customer.fullName();
      }
    } catch (_) {
      /* optional */
    }
  }
  // Denormalize order number when linked.
  if (tree.orderId) {
    try {
      // eslint-disable-next-line global-require
      const Order = require("../models/Order");
      const order = await Order.findById(tree.orderId).select("orderNumber");
      if (order) tree.orderNumber = order.orderNumber;
      else tree.orderId = null;
    } catch (_) {
      tree.orderId = null;
    }
  }

  tree.pushEvent({ type: "created", to: "pending", detail: "ثبت درخواست کاشت", byEmail: req.user.email });
  await tree.save();
  return ok(res, tree.toAdminJSON(), null, 201);
});

const updateDetails = asyncHandler(async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");

  const d = req.body;
  const changes = [];
  if (d.name !== undefined && d.name !== tree.name) { tree.name = d.name; changes.push("نام درخت"); }
  if (d.species !== undefined && d.species !== tree.species) { tree.species = d.species; changes.push("گونه"); }
  if (d.region !== undefined && d.region !== tree.region) { tree.region = d.region; changes.push("منطقه"); }
  if (d.team !== undefined && d.team !== tree.team) { tree.team = d.team; changes.push("تیم کاشت"); }
  if (d.plantingDate !== undefined) {
    tree.plantingDate = d.plantingDate ? new Date(d.plantingDate) : null;
    changes.push("تاریخ کاشت");
  }
  if (d.location !== undefined) {
    tree.location = { lat: d.location.lat, lng: d.location.lng };
    changes.push("مختصات");
  }
  if (d.customer) {
    if (d.customer.name !== undefined) tree.customerSnapshot.name = d.customer.name;
    if (d.customer.email !== undefined) tree.customerSnapshot.email = d.customer.email;
    changes.push("مشتری");
  }
  if (!changes.length) throw ApiError.badRequest("Nothing to update", "NO_CHANGES");

  tree.pushEvent({ type: "details", detail: `به‌روزرسانی: ${changes.join("، ")}`, byEmail: req.user.email });
  await tree.save();
  return ok(res, tree.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Workflow / payment                                                  */
/* ------------------------------------------------------------------ */

const updateStatus = asyncHandler(async (req, res) => {
  const { status: next, note } = req.body;
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");

  if (tree.status === next) throw ApiError.badRequest("Already in this status", "SAME_STATUS");
  if (!tree.canTransitionTo(next)) {
    throw ApiError.badRequest(
      `Cannot go from "${tree.status}" to "${next}"`,
      "ILLEGAL_TRANSITION",
      { allowed: Tree.TRANSITIONS[tree.status] }
    );
  }
  if (next === "scheduled" && !tree.plantingDate) {
    throw ApiError.badRequest("ابتدا تاریخ کاشت را ثبت کنید.", "PLANTING_DATE_REQUIRED");
  }
  if (next === "planted" && (tree.location.lat == null || tree.location.lng == null)) {
    throw ApiError.badRequest("برای ثبت کاشت، مختصات GPS الزامی است.", "LOCATION_REQUIRED");
  }

  const prev = tree.status;
  tree.status = next;
  if (next === "planted" && !tree.plantingDate) tree.plantingDate = new Date();
  tree.pushEvent({ type: "status", from: prev, to: next, detail: note, byEmail: req.user.email });

  // Automatic gift on successful planting (idempotent, best-effort).
  let giftCode = null;
  if (next === "planted") {
    try {
      giftCode = await issueGift(tree, req.user.email);
    } catch (_) {
      /* gift must never block the workflow */
    }
  }

  await tree.save();
  const json = tree.toAdminJSON();
  if (giftCode) json.giftJustIssued = giftCode;
  return ok(res, json);
});

const updatePayment = asyncHandler(async (req, res) => {
  const { paymentStatus: next, note } = req.body;
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");
  if (tree.paymentStatus === next) throw ApiError.badRequest("Already in this status", "SAME_STATUS");

  const prev = tree.paymentStatus;
  tree.paymentStatus = next;
  tree.pushEvent({ type: "payment", from: prev, to: next, detail: note, byEmail: req.user.email });
  await tree.save();
  return ok(res, tree.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Photos / notes / timeline / gift                                    */
/* ------------------------------------------------------------------ */

function assertRelativeKey(value, field) {
  if (value && !value.startsWith("/")) {
    throw ApiError.badRequest(`${field} must be a relative asset key`, "ABSOLUTE_URL_REJECTED");
  }
}

const updatePhotos = asyncHandler(async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");

  const { beforePhoto, afterPhoto, gallery } = req.body;
  const changes = [];
  if (beforePhoto !== undefined) {
    assertRelativeKey(beforePhoto, "beforePhoto");
    tree.beforePhoto = beforePhoto;
    changes.push("عکس قبل از کاشت");
  }
  if (afterPhoto !== undefined) {
    assertRelativeKey(afterPhoto, "afterPhoto");
    tree.afterPhoto = afterPhoto;
    changes.push("عکس بعد از کاشت");
  }
  if (gallery !== undefined) {
    gallery.forEach((k) => assertRelativeKey(k, "gallery"));
    tree.gallery = gallery;
    changes.push(`گالری (${gallery.length})`);
  }

  tree.pushEvent({ type: "photos", detail: changes.join("، "), byEmail: req.user.email });
  await tree.save();
  return ok(res, tree.toAdminJSON());
});

const updateNotes = asyncHandler(async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");
  tree.notes = req.body.notes;
  await tree.save();
  return ok(res, tree.toAdminJSON());
});

const addTimelineNote = asyncHandler(async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");
  tree.pushEvent({ type: "note", detail: req.body.note, byEmail: req.user.email });
  await tree.save();
  return ok(res, tree.toAdminJSON());
});

/** Manual (re)issue — only when automatic issuance couldn't run. */
const issueGiftManually = asyncHandler(async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");
  if (!["planted", "delivered"].includes(tree.status)) {
    throw ApiError.badRequest("هدیه فقط پس از کاشت صادر می‌شود.", "NOT_PLANTED");
  }
  if (tree.giftDiscount && tree.giftDiscount.code) {
    throw ApiError.conflict(`هدیه قبلاً صادر شده است: ${tree.giftDiscount.code}`, "ALREADY_ISSUED");
  }
  if (!tree.customerSnapshot.email) {
    throw ApiError.badRequest("ایمیل مشتری ثبت نشده است.", "NO_CUSTOMER_EMAIL");
  }
  const code = await issueGift(tree, req.user.email);
  await tree.save();
  const json = tree.toAdminJSON();
  json.giftJustIssued = code;
  return ok(res, json);
});

/* ------------------------------------------------------------------ */
/* QR + certificate                                                    */
/* ------------------------------------------------------------------ */

function verificationUrl(tree) {
  const base = (env.assetBaseUrl || `http://localhost:${env.port}`).replace(/\/+$/, "");
  return `${base}/api/v1/public/trees/verify/${tree.certificateNumber}`;
}

const qr = asyncHandler(async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) throw ApiError.notFound("Tree not found");
  const url = verificationUrl(tree);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 220 });
  return ok(res, { url, svg });
});

/* ------------------------------------------------------------------ */
/* Public endpoints (future storefront)                                */
/* ------------------------------------------------------------------ */

// Planted/delivered trees only — for the public environmental map.
const publicList = asyncHandler(async (req, res) => {
  const { region, species, year, page, limit } = req.query;
  const filter = { status: { $in: ["planted", "delivered"] } };
  if (region) filter.region = { $regex: region, $options: "i" };
  if (species) filter.species = { $regex: species, $options: "i" };
  if (year) filter.plantingDate = yearRange(year);

  const [items, total] = await Promise.all([
    Tree.find(filter).sort({ plantingDate: -1 }).skip((page - 1) * limit).limit(limit),
    Tree.countDocuments(filter),
  ]);

  return ok(
    res,
    items.map((t) => t.toPublicJSON()),
    { page, limit, total, pages: Math.ceil(total / limit) }
  );
});

// Certificate verification — what the QR code points to.
const publicVerify = asyncHandler(async (req, res) => {
  const tree = await Tree.findOne({ certificateNumber: req.params.certificateNumber });
  if (!tree || !["planted", "delivered"].includes(tree.status)) {
    throw ApiError.notFound("گواهی معتبری با این شماره پیدا نشد.", "CERT_NOT_FOUND");
  }
  return ok(res, tree.toPublicJSON());
});

module.exports = {
  list,
  mapMarkers,
  getOne,
  create,
  updateDetails,
  updateStatus,
  updatePayment,
  updatePhotos,
  updateNotes,
  addTimelineNote,
  issueGiftManually,
  qr,
  publicList,
  publicVerify,
};
