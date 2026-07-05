"use strict";

/**
 * Dashboard aggregation — one payload for the executive dashboard, computed
 * with parallel MongoDB aggregations over existing collections. No new
 * collections, no duplicated business logic: everything is derived.
 */

const { asyncHandler, ok } = require("../utils/helpers");
const ApiError = require("../utils/ApiError");
const { resolveAssetUrl } = require("../utils/assets");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Tree = require("../models/Tree");
const ContentEntry = require("../models/ContentEntry");
const { Discount, DiscountUsage } = require("../models/Discount");

const LOW_STOCK_THRESHOLD = 5;

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}
function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const PAID = { paymentStatus: "paid" };

/* ------------------------------------------------------------------ */
/* Sales series (interactive chart)                                    */
/* ------------------------------------------------------------------ */

async function salesSeries(granularity) {
  let since;
  let format;
  if (granularity === "monthly") {
    since = startOfMonth(-11);
    format = "%Y-%m";
  } else if (granularity === "weekly") {
    since = daysAgo(7 * 12);
    format = "%G-W%V"; // ISO week
  } else {
    since = daysAgo(29);
    since.setHours(0, 0, 0, 0);
    format = "%Y-%m-%d";
  }

  const rows = await Order.aggregate([
    { $match: { ...PAID, createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format, date: "$createdAt" } },
        total: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ label: r._id, total: r.total, count: r.count }));
}

const sales = asyncHandler(async (req, res) => {
  const g = ["daily", "weekly", "monthly"].includes(req.query.granularity)
    ? req.query.granularity
    : "daily";
  return ok(res, { granularity: g, series: await salesSeries(g) });
});

/* ------------------------------------------------------------------ */
/* Main payload                                                        */
/* ------------------------------------------------------------------ */

const summary = asyncHandler(async (_req, res) => {
  const today = startOfToday();
  const thisMonth = startOfMonth(0);
  const lastMonth = startOfMonth(-1);
  const in7days = daysAgo(-7);
  const now = new Date();

  const [
    todaySales,
    monthRevenue,
    lastMonthRevenue,
    ordersTotal,
    ordersPending,
    ordersUnpaid,
    statusDist,
    customersTotal,
    customersNew30,
    productsTotal,
    productsPublished,
    usageAgg,
    treesTotal,
    treesPending,
    treesPlanted,
    recentOrders,
    recentCustomers,
    recentTrees,
    bestSellers,
    stockAgg,
    topCategories,
    recentContent,
    draftPages,
    expiringDiscounts,
    salesDaily,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { ...PAID, createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...PAID, createdAt: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...PAID, createdAt: { $gte: lastMonth, $lt: thisMonth } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.countDocuments({}),
    Order.countDocuments({ status: "pending" }),
    Order.countDocuments({ paymentStatus: "unpaid", status: { $nin: ["cancelled", "returned"] } }),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Customer.countDocuments({}),
    Customer.countDocuments({ createdAt: { $gte: daysAgo(30) } }),
    Product.countDocuments({}),
    Product.countDocuments({ status: "published" }),
    DiscountUsage.aggregate([
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]),
    Tree.countDocuments({}),
    Tree.countDocuments({ status: "pending" }),
    Tree.countDocuments({ status: { $in: ["planted", "delivered"] } }),
    Order.find({}).sort({ createdAt: -1 }).limit(6),
    Customer.find({}).sort({ createdAt: -1 }).limit(5),
    Tree.find({}).sort({ updatedAt: -1 }).limit(5),
    Order.aggregate([
      { $match: { ...PAID } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          image: { $first: "$items.image" },
          sold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { sold: -1 } },
      { $limit: 5 },
    ]),
    Product.aggregate([
      {
        $project: {
          name: 1,
          image: 1,
          status: 1,
          totalStock: { $sum: "$sizes.stock" },
        },
      },
      {
        $facet: {
          low: [
            { $match: { status: "published", totalStock: { $lte: LOW_STOCK_THRESHOLD } } },
            { $sort: { totalStock: 1 } },
            { $limit: 6 },
          ],
          inventory: [
            {
              $group: {
                _id: null,
                units: { $sum: "$totalStock" },
                outOfStock: { $sum: { $cond: [{ $eq: ["$totalStock", 0] }, 1, 0] } },
              },
            },
          ],
        },
      },
    ]),
    Order.aggregate([
      { $match: { ...PAID } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category._id",
          name: { $first: "$category.name" },
          sold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    ContentEntry.find({}).sort({ updatedAt: -1 }).limit(12).select("pageSlug updatedByEmail updatedAt"),
    ContentEntry.aggregate([
      {
        $group: {
          _id: "$pageSlug",
          dirty: {
            $sum: {
              $cond: [{ $ne: ["$draftValue", "$publishedValue"] }, 1, 0],
            },
          },
        },
      },
      { $match: { dirty: { $gt: 0 } } },
    ]),
    Discount.find({
      status: "active",
      expiresAt: { $gte: now, $lte: in7days },
    })
      .sort({ expiresAt: 1 })
      .limit(5)
      .select("code expiresAt"),
    salesSeries("daily"),
  ]);

  /* ---------- shape helpers ---------- */

  const agg1 = (a, key = "total") => (a.length ? a[0][key] : 0);

  const thisRev = agg1(monthRevenue);
  const lastRev = agg1(lastMonthRevenue);
  const revChangePct =
    lastRev > 0 ? Math.round(((thisRev - lastRev) / lastRev) * 100) : thisRev > 0 ? 100 : 0;

  const stockFacet = stockAgg[0] || { low: [], inventory: [] };
  const inv = stockFacet.inventory[0] || { units: 0, outOfStock: 0 };

  /* ---------- unified activity feed ---------- */

  const activity = [];
  for (const o of recentOrders) {
    const last = o.timeline[o.timeline.length - 1];
    activity.push({
      kind: "order",
      at: last ? last.at : o.createdAt,
      title: `سفارش ${o.orderNumber}`,
      detail: last && last.type === "status" ? Order.STATUS_FA[last.to] || last.to : "ثبت سفارش",
      byEmail: last ? last.byEmail : "",
      link: `/orders/${o._id}`,
    });
  }
  for (const c of recentCustomers) {
    activity.push({
      kind: "customer",
      at: c.createdAt,
      title: c.fullName(),
      detail: "مشتری جدید",
      byEmail: "",
      link: `/customers/${c._id}`,
    });
  }
  for (const t of recentTrees) {
    const last = t.timeline[t.timeline.length - 1];
    activity.push({
      kind: "tree",
      at: last ? last.at : t.createdAt,
      title: t.certificateNumber,
      detail: last && last.type === "status" ? Tree.STATUS_FA[last.to] || last.to : last ? last.detail : "ثبت درخواست",
      byEmail: last ? last.byEmail : "",
      link: `/trees/${t._id}`,
    });
  }
  for (const e of recentContent.slice(0, 4)) {
    activity.push({
      kind: "content",
      at: e.updatedAt,
      title: `محتوا: ${e.pageSlug}`,
      detail: "ویرایش محتوا",
      byEmail: e.updatedByEmail,
      link: `/content/${e.pageSlug}`,
    });
  }
  activity.sort((a, b) => new Date(b.at) - new Date(a.at));

  /* ---------- derived notifications ---------- */

  const notifications = [];
  if (ordersPending > 0)
    notifications.push({ level: "warn", text: `${ordersPending} سفارش در انتظار بررسی`, link: "/orders" });
  if (ordersUnpaid > 0)
    notifications.push({ level: "warn", text: `${ordersUnpaid} سفارش پرداخت‌نشده`, link: "/orders" });
  if (stockFacet.low.length > 0)
    notifications.push({ level: "danger", text: `${stockFacet.low.length} محصول با موجودی کم`, link: "/products" });
  if (treesPending > 0)
    notifications.push({ level: "info", text: `${treesPending} درخواست کاشت در انتظار`, link: "/trees" });
  if (draftPages.length > 0)
    notifications.push({ level: "info", text: `${draftPages.length} صفحه با تغییرات منتشرنشده`, link: "/content" });
  for (const d of expiringDiscounts) {
    notifications.push({
      level: "info",
      text: `کد ${d.code} تا ${new Date(d.expiresAt).toLocaleDateString("fa-IR")} اعتبار دارد`,
      link: "/discounts",
    });
  }

  /* ---------- CMS recent (dedupe by page) ---------- */

  const seenPages = new Set();
  const cmsRecent = [];
  for (const e of recentContent) {
    if (seenPages.has(e.pageSlug)) continue; // eslint-disable-line no-continue
    seenPages.add(e.pageSlug);
    cmsRecent.push({ pageSlug: e.pageSlug, byEmail: e.updatedByEmail, at: e.updatedAt });
    if (cmsRecent.length >= 5) break;
  }

  return ok(res, {
    generatedAt: now,
    kpis: {
      todaySales: agg1(todaySales),
      todayOrders: agg1(todaySales, "count"),
      monthRevenue: thisRev,
      monthOrders: agg1(monthRevenue, "count"),
      lastMonthRevenue: lastRev,
      revChangePct,
      ordersTotal,
      ordersPending,
      customersTotal,
      customersNew30,
      productsTotal,
      productsPublished,
      discountUses: agg1(usageAgg, "count"),
      discountAmount: agg1(usageAgg, "amount"),
      treesTotal,
      treesPending,
      treesPlanted,
      inventoryUnits: inv.units,
      inventoryOutOfStock: inv.outOfStock,
    },
    statusDistribution: statusDist.map((s) => ({
      status: s._id,
      statusFa: Order.STATUS_FA[s._id] || s._id,
      count: s.count,
    })),
    salesDaily,
    recentOrders: recentOrders.map((o) => o.toListJSON()),
    recentCustomers: recentCustomers.map((c) => c.toListJSON()),
    recentTrees: recentTrees.map((t) => t.toListJSON()),
    bestSellers: bestSellers.map((b) => ({
      productId: b._id,
      name: b.name,
      imageUrl: resolveAssetUrl(b.image),
      sold: b.sold,
      revenue: b.revenue,
    })),
    lowStock: stockFacet.low.map((p) => ({
      id: p._id,
      name: p.name,
      imageUrl: resolveAssetUrl(p.image),
      totalStock: p.totalStock,
    })),
    topCategories,
    cmsRecent,
    activity: activity.slice(0, 12),
    notifications,
  });
});

module.exports = { summary, sales };
