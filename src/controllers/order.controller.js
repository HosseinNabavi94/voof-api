"use strict";

const ApiError = require("../utils/ApiError");
const { asyncHandler, ok } = require("../utils/helpers");
const Order = require("../models/Order");
const Product = require("../models/Product");

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

const list = asyncHandler(async (req, res) => {
  const { q, status, paymentStatus, from, to, page, limit, sort } = req.query;
  const filter = {};

  if (q) {
    const rx = { $regex: q, $options: "i" };
    filter.$or = [
      { orderNumber: rx },
      { "customerSnapshot.firstName": rx },
      { "customerSnapshot.lastName": rx },
      { "customerSnapshot.email": rx },
      { "customerSnapshot.phone": rx },
      { "shipping.trackingCode": rx },
    ];
  }
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999); // inclusive end date
      filter.createdAt.$lte = end;
    }
  }

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  return ok(
    res,
    items.map((o) => o.toListJSON()),
    { page, limit, total, pages: Math.ceil(total / limit) }
  );
});

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

const getOne = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  return ok(res, order.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Manual creation (approved: assumption A)                            */
/* ------------------------------------------------------------------ */

const create = asyncHandler(async (req, res) => {
  const { customer, shippingAddress, items, shippingCost, discount, paymentMethod, notes } =
    req.body;

  // Resolve items against real products; freeze name/price/image at order time.
  const frozen = [];
  for (const it of items) {
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findById(it.productId);
    if (!product) {
      throw ApiError.badRequest(`Product not found: ${it.productId}`, "INVALID_PRODUCT");
    }
    frozen.push({
      productId: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      quantity: it.quantity,
      size: it.size,
      color: it.color,
      image: product.image, // relative key; resolved on output
    });
  }

  const subtotal = frozen.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const total = Math.max(0, subtotal + shippingCost - discount);

  const order = new Order({
    orderNumber: await Order.nextOrderNumber(),
    customerSnapshot: customer,
    items: frozen,
    subtotal,
    shippingCost,
    discount,
    total,
    shippingAddress,
    paymentMethod,
    notes,
  });
  order.pushEvent({
    type: "created",
    to: "pending",
    note: "ثبت دستی سفارش",
    byEmail: req.user.email,
  });

  // Customer auto-link (Phase 4, additive): if a customer record exists for
  // this email, stamp the hard reference and note it on their timeline.
  // Orders behave identically whether or not a customer record exists.
  try {
    // Lazy require avoids a hard dependency for deployments without Phase 4.
    // eslint-disable-next-line global-require
    const Customer = require("../models/Customer");
    const existing = await Customer.findOne({ email: customer.email.toLowerCase() });
    if (existing) {
      order.customerId = existing._id;
      existing.pushEvent({
        type: "order",
        detail: `سفارش جدید ${order.orderNumber} ثبت شد`,
        byEmail: req.user.email,
      });
      await existing.save();
    }
  } catch (_) {
    /* linking is best-effort; order creation must never fail because of it */
  }

  await order.save();

  return ok(res, order.toAdminJSON(), null, 201);
});

/* ------------------------------------------------------------------ */
/* Status workflow                                                     */
/* ------------------------------------------------------------------ */

const updateStatus = asyncHandler(async (req, res) => {
  const { status: next, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");

  if (order.status === next) {
    throw ApiError.badRequest("Order is already in this status", "SAME_STATUS");
  }
  if (!order.canTransitionTo(next)) {
    throw ApiError.badRequest(
      `Cannot go from "${order.status}" to "${next}"`,
      "ILLEGAL_TRANSITION",
      { allowed: Order.TRANSITIONS[order.status] }
    );
  }
  // Shipping requires logistics info first (enforced, mirrored in UI).
  if (next === "shipped" && !(order.shipping.carrier && order.shipping.trackingCode)) {
    throw ApiError.badRequest(
      "Set carrier and tracking code before marking as shipped",
      "SHIPPING_INFO_REQUIRED"
    );
  }

  const prev = order.status;
  order.status = next;
  if (next === "shipped") order.shipping.shippedAt = new Date();
  if (next === "delivered") order.shipping.deliveredAt = new Date();

  order.pushEvent({ type: "status", from: prev, to: next, note, byEmail: req.user.email });
  await order.save();
  return ok(res, order.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Payment status (separate workflow — approved: assumption E)         */
/* ------------------------------------------------------------------ */

const updatePayment = asyncHandler(async (req, res) => {
  const { paymentStatus: next, paymentRef, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");

  if (order.paymentStatus === next) {
    throw ApiError.badRequest("Payment already in this status", "SAME_STATUS");
  }
  // refunds only make sense after payment
  if (next === "refunded" && order.paymentStatus !== "paid") {
    throw ApiError.badRequest("Only paid orders can be refunded", "NOT_PAID");
  }

  const prev = order.paymentStatus;
  order.paymentStatus = next;
  if (paymentRef !== undefined) order.paymentRef = paymentRef;
  if (next === "paid") order.paidAt = new Date();

  order.pushEvent({ type: "payment", from: prev, to: next, note, byEmail: req.user.email });
  await order.save();
  return ok(res, order.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Shipping info (carrier / tracking)                                  */
/* ------------------------------------------------------------------ */

const updateShipping = asyncHandler(async (req, res) => {
  const { carrier, trackingCode, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");

  const changes = [];
  if (carrier !== undefined && carrier !== order.shipping.carrier) {
    changes.push(`شرکت حمل: ${carrier || "—"}`);
    order.shipping.carrier = carrier;
  }
  if (trackingCode !== undefined && trackingCode !== order.shipping.trackingCode) {
    changes.push(`کد رهگیری: ${trackingCode || "—"}`);
    order.shipping.trackingCode = trackingCode;
  }
  if (!changes.length) {
    throw ApiError.badRequest("Nothing to update", "NO_CHANGES");
  }

  order.pushEvent({
    type: "shipping",
    to: changes.join("، "),
    note,
    byEmail: req.user.email,
  });
  await order.save();
  return ok(res, order.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Internal notes + timeline note events                               */
/* ------------------------------------------------------------------ */

const updateNotes = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  order.notes = req.body.notes;
  await order.save();
  return ok(res, order.toAdminJSON());
});

const addTimelineNote = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  order.pushEvent({ type: "note", note: req.body.note, byEmail: req.user.email });
  await order.save();
  return ok(res, order.toAdminJSON());
});

/* ------------------------------------------------------------------ */
/* Customer purchase history (computed from orders by email)           */
/* ------------------------------------------------------------------ */

const customerHistory = asyncHandler(async (req, res) => {
  const email = req.query.email.toLowerCase();
  const orders = await Order.find({ "customerSnapshot.email": email }).sort({
    createdAt: -1,
  });

  const summary = {
    email,
    orderCount: orders.length,
    lifetimeTotal: orders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + o.total, 0),
    firstOrderAt: orders.length ? orders[orders.length - 1].createdAt : null,
    lastOrderAt: orders.length ? orders[0].createdAt : null,
  };

  return ok(res, { summary, orders: orders.map((o) => o.toListJSON()) });
});

module.exports = {
  list,
  getOne,
  create,
  updateStatus,
  updatePayment,
  updateShipping,
  updateNotes,
  addTimelineNote,
  customerHistory,
};
