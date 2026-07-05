"use strict";

/**
 * DEV-ONLY sample orders seed. Refuses to run when NODE_ENV=production.
 * Creates ~8 realistic Persian orders spread across the whole workflow so
 * every admin screen and transition can be exercised immediately.
 *
 *   npm run seed:orders
 *
 * Idempotent-ish: skips seeding if any sample order (tagged via notes) exists.
 * Requires products to be present (run seed:migrate first).
 */

const mongoose = require("mongoose");
const env = require("../config/env");
const { connectDB } = require("../config/db");
const Order = require("../models/Order");
const Product = require("../models/Product");

const SAMPLE_TAG = "[seed-sample]";

if (env.isProd) {
  console.error("[seed:orders] refused: NODE_ENV=production. This seed is development-only.");
  process.exit(1);
}

const CUSTOMERS = [
  { firstName: "سارا", lastName: "محمدی", email: "sara.mohammadi@example.com", phone: "09121234567" },
  { firstName: "امیر", lastName: "کریمی", email: "amir.karimi@example.com", phone: "09351112233" },
  { firstName: "نگار", lastName: "احمدی", email: "negar.ahmadi@example.com", phone: "09199887766" },
  { firstName: "رضا", lastName: "قاسمی", email: "reza.ghasemi@example.com", phone: "09024445566" },
];

const ADDRESSES = [
  { line1: "خیابان ولیعصر، کوچه بهار، پلاک ۱۲", line2: "واحد ۳", city: "تهران", province: "تهران", postalCode: "1966733851" },
  { line1: "بلوار کشاورز، پلاک ۸", line2: "", city: "ساری", province: "مازندران", postalCode: "4816678543" },
  { line1: "خیابان امام، کوچه گلستان ۴", line2: "طبقه دوم", city: "بابل", province: "مازندران", postalCode: "4714786325" },
  { line1: "خیابان آزادی، پلاک ۲۴", line2: "", city: "مشهد", province: "خراسان رضوی", postalCode: "9183764521" },
];

// [status, paymentStatus, needsShipping, daysAgo]
const SCENARIOS = [
  ["pending", "unpaid", false, 0],
  ["confirmed", "paid", false, 1],
  ["preparing", "paid", false, 2],
  ["packed", "paid", false, 3],
  ["shipped", "paid", true, 5],
  ["delivered", "paid", true, 12],
  ["cancelled", "unpaid", false, 8],
  ["returned", "refunded", true, 20],
];

// Forward path used to build realistic timelines up to a target status.
const PATH = ["pending", "confirmed", "preparing", "packed", "shipped", "delivered"];

function pick(arr, i) {
  return arr[i % arr.length];
}

(async () => {
  await connectDB();
  try {
    const existing = await Order.findOne({ notes: { $regex: SAMPLE_TAG.replace(/[[\]]/g, "\\$&") } });
    if (existing) {
      console.log("[seed:orders] sample orders already present — skipping. (Delete them to reseed.)");
      return;
    }

    const products = await Product.find({}).limit(10);
    if (!products.length) {
      console.error("[seed:orders] no products found. Run `npm run seed:migrate` first.");
      process.exitCode = 1;
      return;
    }

    for (let i = 0; i < SCENARIOS.length; i += 1) {
      const [status, paymentStatus, hasShipping, daysAgo] = SCENARIOS[i];
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const customer = pick(CUSTOMERS, i);
      const address = pick(ADDRESSES, i);

      const p1 = pick(products, i);
      const p2 = pick(products, i + 1);
      const items = [
        {
          productId: p1._id, name: p1.name, slug: p1.slug, price: p1.price,
          quantity: 1, size: p1.sizes[0] ? p1.sizes[0].size : "", color: p1.colors[0] ? p1.colors[0].name : "",
          image: p1.image,
        },
      ];
      if (i % 2 === 0) {
        items.push({
          productId: p2._id, name: p2.name, slug: p2.slug, price: p2.price,
          quantity: 2, size: p2.sizes[1] ? p2.sizes[1].size : "", color: p2.colors[0] ? p2.colors[0].name : "",
          image: p2.image,
        });
      }

      const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
      const shippingCost = 45;
      const total = subtotal + shippingCost;

      const order = new Order({
        orderNumber: await Order.nextOrderNumber(), // eslint-disable-line no-await-in-loop
        customerSnapshot: customer,
        items,
        subtotal,
        shippingCost,
        discount: 0,
        total,
        shippingAddress: address,
        status,
        paymentStatus,
        paymentMethod: "zarinpal",
        paymentRef: paymentStatus !== "unpaid" ? `ZP-${100000 + i}` : "",
        paidAt: paymentStatus !== "unpaid" ? createdAt : null,
        shipping: hasShipping
          ? {
              carrier: i % 2 ? "تیپاکس" : "پست پیشتاز",
              trackingCode: `TRK${900000 + i}`,
              shippedAt: createdAt,
              deliveredAt: ["delivered", "returned"].includes(status) ? new Date(createdAt.getTime() + 3 * 864e5) : null,
            }
          : {},
        notes: `${SAMPLE_TAG} سفارش نمونه برای تست`,
        createdAt,
      });

      // Build a realistic timeline along the forward path.
      order.pushEvent({ type: "created", to: "pending", note: "ثبت سفارش (نمونه)", at: createdAt });
      const targetIdx = PATH.indexOf(["cancelled", "returned"].includes(status) ? (status === "returned" ? "delivered" : "confirmed") : status);
      for (let s = 1; s <= targetIdx; s += 1) {
        order.pushEvent({
          type: "status", from: PATH[s - 1], to: PATH[s],
          at: new Date(createdAt.getTime() + s * 6 * 60 * 60 * 1000),
        });
      }
      if (paymentStatus !== "unpaid") {
        order.pushEvent({ type: "payment", from: "unpaid", to: "paid", at: createdAt });
      }
      if (status === "cancelled") {
        order.pushEvent({ type: "status", from: "confirmed", to: "cancelled", note: "به درخواست مشتری", at: new Date(createdAt.getTime() + 864e5) });
      }
      if (status === "returned") {
        order.pushEvent({ type: "status", from: "delivered", to: "returned", note: "مرجوعی سایز", at: new Date(createdAt.getTime() + 5 * 864e5) });
        order.pushEvent({ type: "payment", from: "paid", to: "refunded", at: new Date(createdAt.getTime() + 6 * 864e5) });
      }

      await order.save(); // eslint-disable-line no-await-in-loop
      console.log(`[seed:orders] ${order.orderNumber} — ${status}/${paymentStatus}`);
    }

    console.log(`\n[seed:orders] done: ${SCENARIOS.length} sample orders created.`);
  } catch (err) {
    console.error("[seed:orders] failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
