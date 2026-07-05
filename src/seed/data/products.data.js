"use strict";

/**
 * Seed data migrated 1:1 from the storefront's `lib/products.ts`.
 * `categoryName` maps to a Category document at seed time.
 * All products are seeded as `published` so they appear on the storefront.
 */

const categories = [
  { name: "زنانه", order: 1 },
  { name: "مردانه", order: 2 },
];

const products = [
  {
    slug: "silk-evening-coat",
    name: "پالتو مجلسی ابریشمی",
    price: 2450,
    categoryName: "مردانه",
    image: "/elegant-black-silk-evening-coat-luxury-fashion.jpg",
    hoverImage: "/elegant-black-silk-evening-coat-back-view-luxury.jpg",
    description: "شاهکاری از ظرافت بی‌تکلف",
    longDescription:
      "این پالتو مجلسی که از مرغوب‌ترین ابریشم توت دوخته شده، اوج هنر خیاطی ایتالیایی را به نمایش می‌گذارد. هر قطعه با دست توسط استادکاران ما در فلورانس تکمیل می‌شود تا کیفیتی بی‌نظیر و توجه به جزئیات تضمین شود. سیلوئت روان آن به‌زیبایی روی بدن می‌نشیند و ظاهری بی‌زمان برای خاص‌ترین مناسبت‌ها می‌آفریند.",
    materials: ["۱۰۰٪ ابریشم توت", "آستر ابریشم شارمو", "دکمه‌های صدف مروارید"],
    care: ["فقط خشک‌شویی", "نگهداری روی چوب‌لباسی لایه‌دار", "دور از نور مستقیم آفتاب"],
    sizes: [
      { size: "XS", available: true },
      { size: "S", available: true },
      { size: "M", available: true },
      { size: "L", available: false },
      { size: "XL", available: true },
    ],
    colors: [
      { name: "مشکی", hex: "#0A0A0A", available: true },
      { name: "عاجی", hex: "#F5F5DC", available: true },
      { name: "سرمه‌ای", hex: "#191970", available: false },
    ],
    details: [
      "یقه‌های دست‌دوز",
      "جیب داخلی با حاشیه ابریشمی",
      "یراق‌آلات اختصاصی مزون",
      "برچسب اصالت شماره‌دار",
    ],
    madeIn: "فلورانس، ایتالیا",
  },
  {
    slug: "cashmere-wrap-dress",
    name: "پیراهن رپ کشمیری",
    price: 1890,
    categoryName: "زنانه",
    image: "/cream-cashmere-wrap-dress-elegant-luxury-fashion.jpg",
    hoverImage: "/cream-cashmere-wrap-dress-side-view-luxury.jpg",
    description: "ظرافتی بی‌زحمت در کشمیر ناب",
    longDescription:
      "این پیراهن رپ از کشمیر درجه‌یک مغولستان بافته شده که به‌خاطر نرمی و دوام استثنایی‌اش انتخاب شده است. فرم رپ آن اندام را به‌زیبایی نشان می‌دهد و تناسب سخاوتمندانه‌اش راحتی را بدون چشم‌پوشی از ظرافت تضمین می‌کند. قطعه‌ای ضروری که به‌نرمی از روز تا شب همراه شماست.",
    materials: ["۱۰۰٪ کشمیر درجه‌یک مغولستان", "آستر ترکیب ابریشم", "کمربند خودبند"],
    care: ["خشک‌شویی توصیه می‌شود", "قابل شست‌وشو با دست در آب سرد", "خشک‌کردن به‌صورت تخت"],
    sizes: [
      { size: "XS", available: true },
      { size: "S", available: false },
      { size: "M", available: true },
      { size: "L", available: true },
      { size: "XL", available: true },
    ],
    colors: [
      { name: "کرم", hex: "#FFFDD0", available: true },
      { name: "شتری", hex: "#C19A6B", available: true },
      { name: "طوسی ملانژ", hex: "#808080", available: true },
    ],
    details: ["ساختار دورو", "لبه‌های دست‌پیچ", "بست رپ قابل تنظیم", "برچسب داخلی اختصاصی"],
    madeIn: "فلورانس، ایتالیا",
  },
  {
    slug: "tailored-wool-blazer",
    name: "کت تک پشمی دوخت‌خورده",
    price: 1650,
    categoryName: "مردانه",
    image: "/navy-wool-tailored-blazer-luxury-menswear-fashion.jpg",
    hoverImage: "/navy-wool-tailored-blazer-open-luxury-fashion.jpg",
    description: "بنیان ظرافت امروزی",
    longDescription:
      "این کت تک که از پشم سوپر ۱۵۰ تهیه‌شده از مرغوب‌ترین گوسفندان مرینوس استرالیا بریده شده، تعهد مزون به کیفیت استثنایی را به نمایش می‌گذارد. ساختار نیمه‌لایه‌دار آن افتادگی طبیعی را در عین حفظ فرم ممکن می‌سازد. تکمیل هر کت بیش از ۳۰ ساعت کار دستی نیاز دارد.",
    materials: ["۱۰۰٪ پشم مرینوس سوپر ۱۵۰", "آستر کوپرو بمبرگ", "دکمه‌های شاخی"],
    care: ["فقط خشک‌شویی", "بخار برای تازه‌سازی", "نگهداری همراه با چوب سرو"],
    sizes: [
      { size: "46", available: true },
      { size: "48", available: true },
      { size: "50", available: true },
      { size: "52", available: true },
      { size: "54", available: false },
    ],
    colors: [
      { name: "سرمه‌ای", hex: "#000080", available: true },
      { name: "ذغالی", hex: "#36454F", available: true },
      { name: "مشکی", hex: "#0A0A0A", available: true },
    ],
    details: [
      "ساختار نیمه‌لایه",
      "دکمه‌های کاربردی سرآستین",
      "یقه‌های کوک‌دوزی‌شده",
      "جیب داخلی پاسپورت",
    ],
    madeIn: "فلورانس، ایتالیا",
  },
  {
    slug: "merino-turtleneck",
    name: "یقه‌اسکی مرینوس",
    price: 485,
    categoryName: "زنانه",
    image: "/charcoal-merino-wool-turtleneck-sweater-luxury-min.jpg",
    hoverImage: "/charcoal-merino-turtleneck-detail-texture-luxury.jpg",
    description: "لوکسِ ضروری برای هر فصل",
    longDescription:
      "این یقه‌اسکی که از پشم مرینوس فوق‌نازک با بافت ۱۲ گِیج بافته شده، گرمای استثنایی بدون حجم اضافه ارائه می‌دهد. یقه، سرآستین و لبه‌های ریب‌بافت بافت ظریفی می‌آفرینند و در عین حال زیبایی مینیمال و تمیز را حفظ می‌کنند. قطعه‌ای پایه و جدایی‌ناپذیر برای کمد لباس سنجیده.",
    materials: ["۱۰۰٪ پشم مرینوس فوق‌نازک", "بافت ۱۲ گِیج"],
    care: ["شست‌وشو با دست در آب سرد", "خشک‌کردن تخت", "خشک‌کن نشود"],
    sizes: [
      { size: "XS", available: true },
      { size: "S", available: true },
      { size: "M", available: true },
      { size: "L", available: true },
      { size: "XL", available: false },
    ],
    colors: [
      { name: "ذغالی", hex: "#36454F", available: true },
      { name: "اکرو", hex: "#F5F5DC", available: true },
      { name: "زرشکی", hex: "#722F37", available: true },
      { name: "سبز جنگلی", hex: "#228B22", available: false },
    ],
    details: [
      "ساختار تمام‌فرم",
      "درزهای تقویت‌شده",
      "جزئیات لبه ریب",
      "برچسب داخلی گلدوزی‌شده",
    ],
    madeIn: "فلورانس، ایتالیا",
  },
];

module.exports = { categories, products };
