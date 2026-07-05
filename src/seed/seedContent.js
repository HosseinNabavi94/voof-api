"use strict";

/**
 * Seeds CMS content from the registry defaults and the original storefront
 * FAQs. Idempotent: only inserts missing (pageSlug, key) pairs / skips FAQ
 * seeding if any FAQ exists. Never overwrites edited values.
 *
 *   npm run seed:content
 */

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const registry = require("../content/registry");
const ContentEntry = require("../models/ContentEntry");
const Faq = require("../models/Faq");

const FAQS = [
  {
    question: "ارسال سفارش چقدر زمان می‌برد؟",
    answer:
      "سفارش‌ها معمولاً ظرف ۲ تا ۵ روز کاری آماده و ارسال می‌شوند. پس از ارسال، کد رهگیری برای پیگیری مرسوله برایتان فرستاده می‌شود.",
  },
  {
    question: "چطور سایز مناسب خود را انتخاب کنم؟",
    answer:
      "در صفحه‌ی هر محصول جدول راهنمای سایز قرار دارد. اگر میان دو سایز مردد بودید، با پشتیبانی ما تماس بگیرید تا شما را راهنمایی کنیم.",
  },
  {
    question: "امکان تعویض یا مرجوع‌کردن کالا وجود دارد؟",
    answer:
      "تا ۷ روز پس از دریافت سفارش می‌توانید کالای استفاده‌نشده را تعویض یا مرجوع کنید. کافی است درخواست خود را از طریق حساب کاربری ثبت کنید.",
  },
  {
    question: "نگهداری و شست‌وشوی محصولات چگونه است؟",
    answer:
      "راهنمای نگهداری هر قطعه روی برچسب داخلی و در صفحه‌ی محصول آمده است. رعایت این نکات عمر و کیفیت لباس را به‌طور چشمگیری افزایش می‌دهد.",
  },
  {
    question: "چه روش‌های پرداختی پشتیبانی می‌شود؟",
    answer: "پرداخت آنلاین از طریق درگاه امن انجام می‌شود.",
  },
  {
    question: "چطور می‌توانم وضعیت سفارشم را پیگیری کنم؟",
    answer: "پس از ارسال سفارش، کد رهگیری برای شما ارسال می‌شود و می‌توانید مرسوله را دنبال کنید.",
  },
];

(async () => {
  await connectDB();
  try {
    // ---- content slots ----
    let inserted = 0;
    let skipped = 0;
    for (const page of registry.PAGES) {
      for (const section of page.sections) {
        for (const slot of section.slots) {
          // eslint-disable-next-line no-await-in-loop
          const exists = await ContentEntry.findOne({ pageSlug: page.slug, key: slot.key });
          if (exists) {
            skipped += 1;
            // eslint-disable-next-line no-continue
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          await ContentEntry.create({
            pageSlug: page.slug,
            key: slot.key,
            type: slot.type,
            draftValue: slot.default,
            publishedValue: slot.default, // seed goes live immediately: it IS the current site text
          });
          inserted += 1;
        }
      }
    }
    console.log(`[seed:content] slots — inserted: ${inserted}, already present: ${skipped}`);

    // ---- faqs ----
    const faqCount = await Faq.countDocuments();
    if (faqCount > 0) {
      console.log(`[seed:content] FAQs already present (${faqCount}) — skipping.`);
    } else {
      for (let i = 0; i < FAQS.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await Faq.create({ ...FAQS[i], order: i, status: "published" });
      }
      console.log(`[seed:content] FAQs inserted: ${FAQS.length}`);
    }

    console.log("[seed:content] done.");
  } catch (err) {
    console.error("[seed:content] failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
