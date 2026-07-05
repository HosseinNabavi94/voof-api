"use strict";

/**
 * Migrates the storefront's static catalog (lib/products.ts) into MongoDB.
 * Idempotent: upserts categories and products by their natural keys
 * (category name, product slug). Existing docs are NOT deleted.
 *   npm run seed:migrate
 */

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { slugify, generateSku } = require("../utils/helpers");
const { categories, products } = require("./data/products.data");

async function upsertCategories() {
  const map = new Map(); // name -> _id
  for (const c of categories) {
    const slug = slugify(c.name);
    // eslint-disable-next-line no-await-in-loop
    const doc = await Category.findOneAndUpdate(
      { slug },
      { $set: { name: c.name, order: c.order, isActive: true }, $setOnInsert: { slug } },
      { new: true, upsert: true }
    );
    map.set(c.name, doc._id);
    console.log(`[migrate] category ready: ${c.name} (${slug})`);
  }
  return map;
}

async function upsertProducts(categoryMap) {
  let created = 0;
  let updated = 0;
  for (const p of products) {
    const categoryId = categoryMap.get(p.categoryName);
    if (!categoryId) {
      console.warn(`[migrate] skip ${p.slug}: unknown category ${p.categoryName}`);
      // eslint-disable-next-line no-continue
      continue;
    }

    const existing = await Product.findOne({ slug: p.slug }); // eslint-disable-line no-await-in-loop
    const payload = {
      name: p.name,
      price: p.price,
      category: categoryId,
      image: p.image,
      hoverImage: p.hoverImage,
      description: p.description,
      longDescription: p.longDescription,
      materials: p.materials,
      care: p.care,
      details: p.details,
      madeIn: p.madeIn,
      sizes: p.sizes,
      colors: p.colors,
      status: "published",
    };

    if (existing) {
      Object.assign(existing, payload);
      await existing.save(); // eslint-disable-line no-await-in-loop
      updated += 1;
      console.log(`[migrate] updated product: ${p.slug}`);
    } else {
      await Product.create({ ...payload, slug: p.slug, sku: generateSku() }); // eslint-disable-line no-await-in-loop
      created += 1;
      console.log(`[migrate] created product: ${p.slug}`);
    }
  }
  return { created, updated };
}

(async () => {
  await connectDB();
  try {
    const categoryMap = await upsertCategories();
    const { created, updated } = await upsertProducts(categoryMap);

    const [catCount, prodCount] = await Promise.all([
      Category.countDocuments(),
      Product.countDocuments(),
    ]);
    console.log("\n[migrate] summary");
    console.log(`  products created: ${created}, updated: ${updated}`);
    console.log(`  totals -> categories: ${catCount}, products: ${prodCount}`);
    console.log("[migrate] done.");
  } catch (err) {
    console.error("[migrate] failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
