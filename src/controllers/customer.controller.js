"use strict";

const ApiError = require("../utils/ApiError");
const { asyncHandler, ok } = require("../utils/helpers");
const Customer = require("../models/Customer");
const Order = require("../models/Order");

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

const list = asyncHandler(async (req, res) => {
  const { q, status, tag, page, limit, sort } = req.query;
  const filter = {};

  if (q) {
    const rx = { $regex: q, $options: "i" };
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }];
  }
  if (status) filter.status = status;
  if (tag) filter.tags = tag;

  const [items, total] = await Promise.all([
    Customer.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Customer.countDocuments(filter),
  ]);

  return ok(
    res,
    items.map((c) => c.toListJSON()),
    { page, limit, total, pages: Math.ceil(total / limit) }
  );
});

/* ------------------------------------------------------------------ */
/* Detail — profile + computed purchase stats + order history          */
/* ------------------------------------------------------------------ */

const getOne = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");

  // Orders linked by hard reference OR by email (pre-link records).
  const orders = await Order.find({
    $or: [{ customerId: customer._id }, { "customerSnapshot.email": customer.email }],
  }).sort({ createdAt: -1 });

  const paid = orders.filter((o) => o.paymentStatus === "paid");
  const stats = {
    orderCount: orders.length,
    paidOrderCount: paid.length,
    lifetimeTotal: paid.reduce((s, o) => s + o.total, 0),
    averageOrder: paid.length
      ? Math.round(paid.reduce((s, o) => s + o.total, 0) / paid.length)
      : 0,
    firstOrderAt: orders.length ? orders[orders.length - 1].createdAt : null,
    lastOrderAt: orders.length ? orders[0].createdAt : null,
  };

  return ok(res, {
    customer: customer.toAdminJSON(),
    stats,
    orders: orders.map((o) => o.toListJSON()),
  });
});

/* ------------------------------------------------------------------ */
/* Create (manual)                                                     */
/* ------------------------------------------------------------------ */

const create = asyncHandler(async (req, res) => {
  const data = req.body;
  const exists = await Customer.findOne({ email: data.email.toLowerCase() });
  if (exists) throw ApiError.conflict("A customer with this email already exists", "EMAIL_TAKEN");

  const customer = new Customer(data);
  customer.pushEvent({ type: "created", detail: "ایجاد دستی مشتری", byEmail: req.user.email });
  await customer.save();

  // Hard-link any pre-existing orders with this email.
  const linked = await Order.updateMany(
    { "customerSnapshot.email": customer.email, customerId: null },
    { $set: { customerId: customer._id } }
  );
  if (linked.modifiedCount) {
    customer.pushEvent({
      type: "order",
      detail: `${linked.modifiedCount} سفارش قبلی به این مشتری متصل شد`,
    });
    await customer.save();
  }

  return ok(res, customer.toAdminJSON(), null, 201);
});

/* ------------------------------------------------------------------ */
/* Profile update                                                      */
/* ------------------------------------------------------------------ */

const updateProfile = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");

  const data = req.body;
  const changes = [];

  if (data.email && data.email.toLowerCase() !== customer.email) {
    const clash = await Customer.findOne({
      email: data.email.toLowerCase(),
      _id: { $ne: customer._id },
    });
    if (clash) throw ApiError.conflict("Email already in use", "EMAIL_TAKEN");
    changes.push(`ایمیل: ${customer.email} ← ${data.email.toLowerCase()}`);
    customer.email = data.email;
  }
  ["firstName", "lastName", "phone"].forEach((k) => {
    if (data[k] !== undefined && data[k] !== customer[k]) {
      changes.push(`${{ firstName: "نام", lastName: "نام خانوادگی", phone: "تلفن" }[k]} به‌روزرسانی شد`);
      customer[k] = data[k];
    }
  });

  if (!changes.length) throw ApiError.badRequest("Nothing to update", "NO_CHANGES");

  customer.pushEvent({ type: "profile", detail: changes.join("، "), byEmail: req.user.email });
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

const updateStatus = asyncHandler(async (req, res) => {
  const { status: next, note } = req.body;
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");
  if (customer.status === next) throw ApiError.badRequest("Already in this status", "SAME_STATUS");

  const prev = customer.status;
  customer.status = next;
  customer.pushEvent({
    type: "status",
    detail: `${Customer.STATUS_FA[prev]} ← ${Customer.STATUS_FA[next]}${note ? ` — ${note}` : ""}`,
    byEmail: req.user.email,
  });
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

const updateTags = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");

  const next = [...new Set(req.body.tags.map((t) => t.trim()).filter(Boolean))];
  const added = next.filter((t) => !customer.tags.includes(t));
  const removed = customer.tags.filter((t) => !next.includes(t));
  if (!added.length && !removed.length) {
    throw ApiError.badRequest("Nothing to update", "NO_CHANGES");
  }

  customer.tags = next;
  const parts = [];
  if (added.length) parts.push(`افزوده: ${added.join("، ")}`);
  if (removed.length) parts.push(`حذف: ${removed.join("، ")}`);
  customer.pushEvent({ type: "tag", detail: parts.join(" | "), byEmail: req.user.email });
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Addresses (replace-list semantics)                                  */
/* ------------------------------------------------------------------ */

const updateAddresses = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");

  let { addresses } = req.body;
  // Enforce exactly one default when any addresses exist.
  if (addresses.length) {
    const defaults = addresses.filter((a) => a.isDefault);
    if (defaults.length === 0) addresses[0].isDefault = true;
    if (defaults.length > 1) {
      let seen = false;
      addresses = addresses.map((a) => {
        if (a.isDefault && !seen) {
          seen = true;
          return a;
        }
        return { ...a, isDefault: false };
      });
    }
  }

  const before = customer.addresses.length;
  customer.addresses = addresses;
  customer.pushEvent({
    type: "address",
    detail: `آدرس‌ها به‌روزرسانی شد (${before} ← ${addresses.length})`,
    byEmail: req.user.email,
  });
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Loyalty (manual adjustments, audited, floor at zero)                */
/* ------------------------------------------------------------------ */

const adjustLoyalty = asyncHandler(async (req, res) => {
  const { delta, reason } = req.body;
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");

  const next = customer.loyalty.balance + delta;
  if (next < 0) {
    throw ApiError.badRequest(
      `Balance cannot go below zero (current: ${customer.loyalty.balance})`,
      "INSUFFICIENT_POINTS"
    );
  }

  customer.loyalty.balance = next;
  customer.loyalty.history.push({
    delta,
    balanceAfter: next,
    reason,
    byEmail: req.user.email,
    at: new Date(),
  });
  customer.pushEvent({
    type: "loyalty",
    detail: `${delta > 0 ? "+" : ""}${delta} امتیاز — ${reason} (مانده: ${next})`,
    byEmail: req.user.email,
  });
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Hircanian trees                                                     */
/* ------------------------------------------------------------------ */

const addTree = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");

  const t = req.body;
  customer.trees.push({
    species: t.species,
    region: t.region,
    certificateCode: t.certificateCode,
    plantedAt: t.plantedAt ? new Date(t.plantedAt) : null,
    orderId: t.orderId || null,
    note: t.note,
  });
  customer.pushEvent({
    type: "tree",
    detail: `ثبت درخت: ${t.species}${t.region ? ` — ${t.region}` : ""}${t.certificateCode ? ` (${t.certificateCode})` : ""}`,
    byEmail: req.user.email,
  });
  await customer.save();
  return ok(res, customer.toAdminJSON(), null, 201);
});

const removeTree = asyncHandler(async (req, res) => {
  const idx = Number(req.params.index);
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");
  if (Number.isNaN(idx) || idx < 0 || idx >= customer.trees.length) {
    throw ApiError.badRequest("Invalid tree index", "INVALID_INDEX");
  }

  const [removed] = customer.trees.splice(idx, 1);
  customer.pushEvent({
    type: "tree",
    detail: `حذف رکورد درخت: ${removed.species}${removed.certificateCode ? ` (${removed.certificateCode})` : ""}`,
    byEmail: req.user.email,
  });
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Discount codes (records only — redemption engine is a later phase)  */
/* ------------------------------------------------------------------ */

const assignDiscount = asyncHandler(async (req, res) => {
  const { code, kind, value, expiresAt } = req.body;
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");

  const normalized = code.toUpperCase();
  if (customer.discountCodes.some((d) => d.code === normalized)) {
    throw ApiError.conflict("This code is already assigned to the customer", "CODE_EXISTS");
  }

  customer.discountCodes.push({
    code: normalized,
    kind,
    value,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    status: "active",
    assignedBy: req.user.email,
    at: new Date(),
  });
  customer.pushEvent({
    type: "discount",
    detail: `تخصیص کد ${normalized} (${kind === "percent" ? `${value}٪` : `${value} تومان`})`,
    byEmail: req.user.email,
  });
  await customer.save();
  return ok(res, customer.toAdminJSON(), null, 201);
});

const updateDiscount = asyncHandler(async (req, res) => {
  const { action, orderId } = req.body;
  const code = String(req.params.code || "").toUpperCase();
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");

  const entry = customer.discountCodes.find((d) => d.code === code);
  if (!entry) throw ApiError.notFound("Discount code not found on this customer");
  if (entry.status !== "active") {
    throw ApiError.badRequest(`Code is already ${entry.status}`, "NOT_ACTIVE");
  }

  if (action === "revoke") {
    entry.status = "revoked";
    customer.pushEvent({ type: "discount", detail: `ابطال کد ${code}`, byEmail: req.user.email });
  } else {
    entry.status = "used";
    entry.usedAt = new Date();
    if (orderId) entry.orderId = orderId;
    customer.pushEvent({
      type: "discount",
      detail: `مصرف کد ${code}${orderId ? ` (سفارش ${orderId})` : ""}`,
      byEmail: req.user.email,
    });
  }
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Notes & timeline                                                    */
/* ------------------------------------------------------------------ */

const updateNotes = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");
  customer.notes = req.body.notes;
  customer.pushEvent({ type: "note", detail: "یادداشت داخلی به‌روزرسانی شد", byEmail: req.user.email });
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

const addTimelineNote = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Customer not found");
  customer.pushEvent({ type: "note", detail: req.body.note, byEmail: req.user.email });
  await customer.save();
  return ok(res, customer.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Import from orders (approved: assumption A) — idempotent backfill   */
/* ------------------------------------------------------------------ */

const importFromOrders = asyncHandler(async (req, res) => {
  // Distinct customer snapshots across orders.
  const snapshots = await Order.aggregate([
    {
      $group: {
        _id: "$customerSnapshot.email",
        firstName: { $first: "$customerSnapshot.firstName" },
        lastName: { $first: "$customerSnapshot.lastName" },
        phone: { $first: "$customerSnapshot.phone" },
        lastAddress: { $last: "$shippingAddress" },
      },
    },
  ]);

  let created = 0;
  let linkedOrders = 0;

  for (const snap of snapshots) {
    if (!snap._id) continue; // eslint-disable-line no-continue
    // eslint-disable-next-line no-await-in-loop
    let customer = await Customer.findOne({ email: snap._id });
    if (!customer) {
      customer = new Customer({
        firstName: snap.firstName || "—",
        lastName: snap.lastName || "",
        email: snap._id,
        phone: snap.phone || "",
        addresses: snap.lastAddress
          ? [{ label: "از سفارش", ...snap.lastAddress, isDefault: true }]
          : [],
      });
      customer.pushEvent({
        type: "created",
        detail: "ایجاد خودکار از سوابق سفارش‌ها",
        byEmail: req.user.email,
      });
      // eslint-disable-next-line no-await-in-loop
      await customer.save();
      created += 1;
    }
    // eslint-disable-next-line no-await-in-loop
    const upd = await Order.updateMany(
      { "customerSnapshot.email": customer.email, customerId: null },
      { $set: { customerId: customer._id } }
    );
    linkedOrders += upd.modifiedCount;
  }

  return ok(res, { customersCreated: created, ordersLinked: linkedOrders });
});

module.exports = {
  list,
  getOne,
  create,
  updateProfile,
  updateStatus,
  updateTags,
  updateAddresses,
  adjustLoyalty,
  addTree,
  removeTree,
  assignDiscount,
  updateDiscount,
  updateNotes,
  addTimelineNote,
  importFromOrders,
};
