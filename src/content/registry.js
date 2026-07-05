"use strict";

/**
 * Content slot registry — the schema-of-record for the CMS.
 *
 * Each page declares its editable slots (key, Persian label, type, default).
 * - The admin renders its editors FROM this registry (no hardcoded forms).
 * - PUT /content/:pageSlug validates every incoming key/type against it.
 * - The seed populates initial values from `default` (verbatim current
 *   storefront text, so day-one content is complete).
 * - Adding a new editable area later = adding a slot here (+ a seed run).
 *
 * Slot types: text | textarea | richtext | image | list
 *  - image values are RELATIVE media keys (resolved to URLs at the API
 *    boundary, same as products). Existing storefront static paths are
 *    valid defaults and pass through unresolved.
 *  - list values are arrays of strings.
 *
 * Every page automatically receives the standard SEO section (approved G).
 */

const SEO_SECTION = {
  id: "seo",
  label: "سئو (SEO)",
  slots: [
    { key: "seo.title", label: "عنوان سئو (Title)", type: "text", default: "" },
    { key: "seo.metaDescription", label: "توضیح متا (Meta Description)", type: "textarea", default: "" },
    { key: "seo.ogTitle", label: "عنوان اوپن‌گراف (OG Title)", type: "text", default: "" },
    { key: "seo.ogDescription", label: "توضیح اوپن‌گراف (OG Description)", type: "textarea", default: "" },
    { key: "seo.ogImage", label: "تصویر اوپن‌گراف (OG Image)", type: "image", default: "" },
    { key: "seo.canonicalUrl", label: "آدرس Canonical (اختیاری)", type: "text", default: "" },
  ],
};

const PAGES = [
  /* ---------------------------------------------------------------- */
  {
    slug: "home",
    label: "صفحه اصلی (Hero)",
    sections: [
      {
        id: "hero",
        label: "بخش Hero",
        slots: [
          { key: "hero.seasonLabel", label: "برچسب فصل", type: "text", default: "تابستان / پاییز ۱۴۰۵" },
          { key: "hero.title", label: "عنوان برند", type: "text", default: "ووف" },
          { key: "hero.subtitle", label: "زیرعنوان", type: "text", default: "برای بازگشت شادی" },
          {
            key: "hero.manifesto",
            label: "متن مانیفست",
            type: "textarea",
            default:
              "هر تارِ ووف، عهدی‌ست با ریشه‌های کهنِ این سرزمین.\nتا هنر و صنعت، دوباره هویتِ وطن را بر قامتِ نسل امروز بپوشاند.",
          },
          { key: "hero.ctaLabel", label: "متن دکمه", type: "text", default: "همه محصولات" },
          { key: "hero.image", label: "تصویر Hero", type: "image", default: "/voof-new-hero.webp" },
          { key: "hero.imageAlt", label: "متن جایگزین تصویر", type: "text", default: "مدل مد شیک در لباس تیره" },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "heritage",
    label: "داستان ووف (Heritage)",
    sections: [
      {
        id: "hero",
        label: "بالای صفحه",
        slots: [
          { key: "hero.image", label: "تصویر اصلی", type: "image", default: "/hero-veresk-voof.webp" },
        ],
      },
      {
        id: "s1",
        label: "بخش ۱ — ریشه‌ها",
        slots: [
          { key: "s1.eyebrow", label: "سرنخ", type: "text", default: "روایت بیداری یک سرزمین" },
          { key: "s1.heading", label: "عنوان", type: "text", default: "ریشه‌هایی که خاموش نمی‌شوند" },
          {
            key: "s1.body",
            label: "متن",
            type: "richtext",
            default:
              "<p>ووف فقط یک برند لباس نیست؛ روایتی‌ست از عشق ما به سرزمینی که در رگ‌های ما جریان دارد. روایتی از مردمانی که نمی‌خواهند صدای ریشه‌هایشان در هیاهوی جهان امروز گم شود. ما ووف را خلق کردیم تا یادآوری کنیم فرهنگ، زبان و طبیعت یک سرزمین، تنها بخشی از گذشته نیستند؛ آن‌ها بخشی از زندگی امروز و آینده‌ی ما هستند.</p><p>در روزگاری که بسیاری از زبان‌های بومی و محلی آرام‌آرام به حاشیه رانده می‌شوند، ما تصمیم گرفتیم زبان مازندرانی را نه فقط در کتاب‌ها و خاطره‌ها، بلکه در دل زندگی روزمره زنده نگه داریم. هر واژه‌ی مازنی که بر لباس‌های ووف نقش می‌بندد، حامل بخشی از هویت جمعی ماست؛ هویتی که نسل‌ها با آن خندیده‌اند، عاشق شده‌اند، کار کرده‌اند و زندگی ساخته‌اند. برای ما، زبان تنها مجموعه‌ای از کلمات نیست؛ حافظه‌ی یک ملت است. اگر واژه‌ها خاموش شوند، بخشی از روح یک سرزمین نیز خاموش خواهد شد.</p><p>به همین دلیل، هر لباس ووف فراتر از یک پوشاک است. هر طرح، هر نوشته و هر جزئیات آن تلاشی برای روایت داستانی‌ست که از دل کوهستان‌ها، شالیزارها، دریا و جنگل‌های مازندران برخاسته است. ما می‌خواهیم نسل امروز و فردا، زبان مادری و فرهنگ خود را نه به‌عنوان یادگاری از گذشته، بلکه به‌عنوان بخشی زنده و پویا از زندگی امروز تجربه کنند.</p>",
          },
          { key: "s1.image", label: "تصویر", type: "image", default: "/root-tree-voof.webp" },
          { key: "s1.imageAlt", label: "متن جایگزین تصویر", type: "text", default: "ریشه درخت هیرکانی ووف" },
        ],
      },
      {
        id: "s2",
        label: "بخش ۲ — مسئولیت ما",
        slots: [
          { key: "s2.eyebrow", label: "سرنخ", type: "text", default: "مسئولیت ما" },
          { key: "s2.heading", label: "عنوان", type: "text", default: "حفاظت از جانِ وطن" },
          {
            key: "s2.body",
            label: "متن",
            type: "richtext",
            default:
              "<p>اما عشق به وطن تنها در حفظ زبان خلاصه نمی‌شود. وطن ما درختانش را نیز دارد؛ جنگل‌های باشکوه هیرکانی که میلیون‌ها سال است بر این سرزمین سایه افکنده‌اند و بخشی از هویت طبیعی ما را شکل داده‌اند. جنگل‌هایی که هوایشان را نفس می‌کشیم، باران می‌آورند و ریشه‌های ما را در آغوش خود حفظ کرده‌اند.</p><p>ما باور داریم که هر کسب‌وکاری مسئولیتی فراتر از فروش محصول دارد. به همین دلیل بخشی از مأموریت ووف به حفاظت از طبیعت گره خورده است. به ازای هر ۱۰ لباس فروخته‌شده، یک نهال در جنگل‌های هیرکانی کاشته می‌شود؛ اقدامی کوچک اما معنادار برای بازگرداندن بخشی از آنچه از این سرزمین دریافت کرده‌ایم. وقتی لباسی از ووف انتخاب می‌کنی، تنها یک محصول نمی‌خری؛ تو در حفظ میراث طبیعی سرزمینی سهیم می‌شوی که ریشه‌های همه‌ی ما در خاک آن تنیده شده است.</p>",
          },
          { key: "s2.image", label: "تصویر", type: "image", default: "/badab-soort-voof.webp" },
          { key: "s2.imageAlt", label: "متن جایگزین تصویر", type: "text", default: "باداب سورت" },
        ],
      },
      {
        id: "s3",
        label: "بخش ۳ — اصالت و طراحی",
        slots: [
          { key: "s3.eyebrow", label: "سرنخ", type: "text", default: "اصالت و طراحی" },
          { key: "s3.heading", label: "عنوان", type: "text", default: "پلی میان گذشته و آینده" },
          {
            key: "s3.body",
            label: "متن",
            type: "richtext",
            default:
              "<p>در کنار زبان و طبیعت، اصالت فرهنگی مازندران نیز قلب تپنده‌ی ووف است. ما به زیبایی فرهنگ بومی خود افتخار می‌کنیم؛ فرهنگی که قرن‌ها در موسیقی، پوشش، معماری، قصه‌ها و سبک زندگی مردم این دیار جریان داشته است. با این حال، باور داریم اصالت زمانی زنده می‌ماند که بتواند با امروز گفت‌وگو کند. به همین دلیل تلاش کرده‌ایم میان گذشته و آینده پلی بسازیم؛ پلی که یک سوی آن ریشه‌های عمیق فرهنگ مازندران و سوی دیگر آن طراحی مدرن و سبک زندگی امروزی قرار دارد.</p><p>طراحی‌های ووف از همین نگاه متولد می‌شوند. ما عناصر فرهنگی و هویتی مازندران را با زبانی مینیمال، مدرن و قابل‌پوشیدن بازآفرینی می‌کنیم تا هر لباس بتواند هم نشانی از ریشه‌ها باشد و هم بخشی از زندگی روزمره‌ی انسان امروز. برای ما، لباس تنها پوشش نیست؛ رسانه‌ای‌ست برای روایت داستان‌ها، انتقال احساسات و زنده نگه داشتن آنچه ارزش ماندن دارد.</p>",
          },
          { key: "s3.image", label: "تصویر", type: "image", default: "/veresk-bridge-voof.webp" },
          { key: "s3.imageAlt", label: "متن جایگزین تصویر", type: "text", default: "پل ورسک ووف" },
        ],
      },
      {
        id: "s4",
        label: "بخش ۴ — دعوت ما",
        slots: [
          { key: "s4.eyebrow", label: "سرنخ", type: "text", default: "دعوت ما" },
          { key: "s4.heading", label: "عنوان", type: "text", default: "برای بازگشت" },
          {
            key: "s4.body",
            label: "متن",
            type: "richtext",
            default:
              "<p>ووف حاصل این باور است که فرهنگ باید دیده شود، شنیده شود و زندگی شود. ما می‌خواهیم مردم نه فقط درباره‌ی مازندران بخوانند، بلکه آن را بپوشند، لمس کنند و با خود همراه داشته باشند. می‌خواهیم واژه‌های مازنی دوباره بر زبان‌ها جاری شوند، جنگل‌های هیرکانی دوباره نفسی تازه بکشند و اصالت این سرزمین در قالبی نو، در کنار نسل امروز ادامه پیدا کند.</p><p>راهی که پیش رو داریم را تنها نمی‌توان پیمود. ووف از روز نخست با همراهی کسانی شکل گرفت که به ریشه‌های خود افتخار می‌کنند و باور دارند آینده بدون شناخت گذشته ساخته نمی‌شود. هر خرید، هر همراهی و هر حمایت، بخشی از این حرکت جمعی برای حفظ هویت، فرهنگ و طبیعت ماست.</p><p>ووف دعوتی‌ست برای بازگشت؛ بازگشت به زبان مادری، به ریشه‌های فراموش‌شده، به جنگل‌هایی که خانه‌ی ما هستند و به فرهنگی که هنوز در قلب این سرزمین می‌تپد. ما آمده‌ایم تا یادآوری کنیم که وطن فقط جایی روی نقشه یا حک شده در شناسنامه‌ی ما نیست؛ وطن در واژه‌ها، در درختان و در داستان‌هایی که نسل به نسل منتقل شده‌اند، زندگی می‌کند.</p>",
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "care",
    label: "مراقبت / جنگل هیرکانی",
    sections: [
      {
        id: "hero",
        label: "بالای صفحه",
        slots: [
          { key: "hero.eyebrow", label: "سرنخ", type: "text", default: "مراقبت از وطن، فراتر از یک خرید" },
          { key: "hero.heading", label: "عنوان", type: "text", default: "برای بازگشت نفس‌های هیرکان" },
          {
            key: "hero.manifesto",
            label: "متن مانیفست",
            type: "textarea",
            default:
              "جنگل‌های هیرکانی فقط درختان کهنسال نیستند؛ خاطره‌ی زنده‌ی این سرزمین‌اند. هر شاخه، روایت هزاران سال ایستادگی است و هر برگ، نفسی که هنوز زندگی را در رگ‌های وطن جاری نگه داشته است. ما باور داریم اگر بتوانیم حتی یک نهال به این میراث کهن بازگردانیم، امیدی را به خاک سپرده‌ایم که روزی سایه‌اش بر شانه‌های فرزندان این سرزمین خواهد افتاد. ووف برای همین کنار طبیعت ایستاده است؛ تا هیرکان دوباره نفس بکشد",
          },
          { key: "hero.image", label: "تصویر اصلی", type: "image", default: "/caspianـhyrcanianـforest.webp" },
          { key: "hero.imageAlt", label: "متن جایگزین تصویر", type: "text", default: "جنگل‌های هیرکانی" },
        ],
      },
      {
        id: "story",
        label: "داستان جنگل‌های هیرکانی",
        slots: [
          { key: "story.eyebrow", label: "سرنخ", type: "text", default: "میراث زنده‌ی زمین" },
          { key: "story.heading", label: "عنوان", type: "text", default: "جنگل‌های هیرکانی مازندران" },
          {
            key: "story.body",
            label: "متن",
            type: "richtext",
            default:
              "<p>در شمال ایران، جایی که دریا به کوه می‌رسد، نواری سبز و باستانی کشیده شده است؛ جنگل‌های هیرکانی. این جنگل‌ها بازمانده‌ی روزگارانی هستند که میلیون‌ها سال پیش، پیش از یخبندان‌های بزرگ، بخش وسیعی از زمین را می‌پوشاندند و تا امروز زنده مانده‌اند و حافظه‌ی زنده‌ی سیاره‌ی ما به شمار می‌روند.</p><p>این میراث کهن چنان ارزشمند است که یونسکو آن را در فهرست میراث جهانی ثبت کرده است. هیرکانی خانه‌ی هزاران گونه‌ی گیاهی و جانوری‌ست؛ زیستگاهی که هوا را پاک می‌کند، باران می‌آورد و تعادل زندگی را در این سرزمین نگه می‌دارد. هر درخت آن، فصلی از تاریخ طبیعت است.</p>",
          },
          { key: "story.image", label: "تصویر", type: "image", default: "/koodir_mazandaran_iran.webp" },
          { key: "story.imageAlt", label: "متن جایگزین تصویر", type: "text", default: "ووف جنگل‌های هیرکانی" },
        ],
      },
      {
        id: "threat",
        label: "بخش حفاظت",
        slots: [
          {
            key: "threat.body",
            label: "متن",
            type: "richtext",
            default:
              "<p>اما این گنجینه شکننده است. توسعه‌ی بی‌رویه، قطع درختان و تغییر اقلیم، آرام‌آرام مرزهای این جنگل‌ها را عقب می‌رانند. آنچه میلیون‌ها سال دوام آورده، می‌تواند در یک نسل آسیب ببیند. حفاظت از هیرکانی تنها دفاع از درختان نیست؛ پاسداری از آینده‌ای‌ست که فرزندان ما در آن نفس خواهند کشید.</p>",
          },
          { key: "threat.image", label: "تصویر", type: "image", default: "/BuxusـhyrcanaـPojark.webp" },
        ],
      },
      // The interactive tree map's logic/data remains code (approved F);
      // its surrounding text is covered by the sections above.
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "careers",
    label: "فرصت‌های شغلی",
    sections: [
      {
        id: "hero",
        label: "بالای صفحه",
        slots: [
          { key: "hero.eyebrow", label: "سرنخ", type: "text", default: "به خانواده‌ی ووف بپیوندید" },
          { key: "hero.heading", label: "عنوان", type: "text", default: "فرصت‌های شغلی" },
          {
            key: "hero.intro",
            label: "متن معرفی",
            type: "textarea",
            default:
              "ما در ووف باور داریم که هر اثر ماندگار، حاصل دستان و دل‌هایی‌ست که با عشق کنار هم می‌آفرینند. خانواده‌ی ما در حال رشد است و به دنبال هم‌سفرانی‌ست که اصالت، خلاقیت و عشق به ریشه‌ها را باور دارند.",
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "contact",
    label: "تماس با ما",
    sections: [
      {
        id: "hero",
        label: "بالای صفحه",
        slots: [
          { key: "hero.eyebrow", label: "سرنخ", type: "text", default: "با ما در ارتباط باشید" },
          { key: "hero.heading", label: "عنوان", type: "text", default: "تماس با ما" },
          {
            key: "hero.intro",
            label: "متن معرفی",
            type: "textarea",
            default:
              "هر واژه، هر پیام و هر همراهی برای ما ارزشمند است. اگر سخنی، پرسشی یا تنها سلامی داری، خوشحال می‌شویم صدایت را بشنویم. ووف خانه‌ای‌ست که درش همیشه به روی تو باز است.",
          },
        ],
      },
      {
        id: "info",
        label: "اطلاعات تماس",
        slots: [
          { key: "info.phone", label: "تلفن", type: "text", default: "۰۲۱ ۱۲۳۴ ۵۶۷۸" },
          { key: "info.whatsapp", label: "واتساپ", type: "text", default: "+۹۸ ۹۱۲ ۰۰۰ ۰۰۰۰" },
          { key: "info.address", label: "نشانی", type: "text", default: "مازندران، ایران" },
          { key: "info.instagram", label: "اینستاگرام (لینک)", type: "text", default: "https://instagram.com" },
          { key: "info.telegram", label: "تلگرام (لینک)", type: "text", default: "https://telegram.org" },
          { key: "info.twitter", label: "توییتر / ایکس (لینک)", type: "text", default: "https://twitter.com" },
          { key: "info.youtube", label: "یوتیوب (لینک)", type: "text", default: "https://youtube.com" },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "shipping",
    label: "ارسال و مرجوعی",
    sections: [
      {
        id: "hero",
        label: "بالای صفحه",
        slots: [
          { key: "hero.eyebrow", label: "سرنخ", type: "text", default: "خدمات مشتریان" },
          { key: "hero.heading", label: "عنوان", type: "text", default: "ارسال و مرجوعی" },
          {
            key: "hero.intro",
            label: "متن معرفی",
            type: "textarea",
            default:
              "هر سفارش ووف با دقت بسته‌بندی و با احترام به دستان تو می‌رسد. اگر قطعه‌ای آن‌طور که انتظار داشتی نبود، تا ۱۴ روز فرصت داری آن را تعویض کنی یا وجهت را بازگردانی. آسوده باش؛ ما کنارت هستیم.",
          },
        ],
      },
      {
        id: "tracking",
        label: "پیگیری مرسوله",
        slots: [
          { key: "tracking.heading", label: "عنوان", type: "text", default: "پیگیری مرسوله" },
          {
            key: "tracking.body",
            label: "متن",
            type: "textarea",
            default: "کد رهگیری سفارش خود را در سامانه‌ی پست دنبال کن و از مسیر مرسوله‌ات باخبر شو.",
          },
          { key: "tracking.ctaLabel", label: "متن دکمه", type: "text", default: "پیگیری ارسال سفارش" },
        ],
      },
      {
        id: "returns",
        label: "مرجوعی",
        slots: [
          { key: "returns.heading", label: "عنوان", type: "text", default: "درخواست مرجوعی" },
          {
            key: "returns.policy",
            label: "شرایط مرجوعی",
            type: "richtext",
            default:
              "<p>تا ۱۴ روز پس از دریافت سفارش می‌توانی کالای استفاده‌نشده را همراه با برچسب‌های اصلی تعویض یا مرجوع کنی. کافی‌ست درخواست خود را ثبت کنی تا همکاران ما راهنمایی‌ات کنند.</p>",
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "footer",
    label: "فوتر (سراسری)",
    sections: [
      {
        id: "newsletter",
        label: "خبرنامه",
        slots: [
          { key: "newsletter.heading", label: "عنوان", type: "text", default: "در ارتباط بمانید" },
          {
            key: "newsletter.body",
            label: "متن",
            type: "textarea",
            default: "برای دسترسی اختصاصی به مجموعه‌های جدید و رویدادهای خصوصی عضو شوید.",
          },
          { key: "newsletter.placeholder", label: "Placeholder ایمیل", type: "text", default: "ایمیل خود را وارد کنید" },
          { key: "newsletter.ctaLabel", label: "متن دکمه", type: "text", default: "عضویت" },
        ],
      },
      {
        id: "links",
        label: "ستون مقالات",
        slots: [
          { key: "links.heading", label: "عنوان ستون", type: "text", default: "مقالات" },
          {
            key: "links.items",
            label: "برچسب لینک‌ها (به ترتیب: داستان، فرصت‌ها، تماس، ارسال، نگهداری)",
            type: "list",
            default: ["داستان ووف", "فرصت‌های شغلی", "تماس با ما", "ارسال و مرجوعی", "دستورالعمل‌های نگهداری"],
          },
        ],
      },
      {
        id: "bottom",
        label: "پایین فوتر",
        slots: [
          { key: "bottom.brand", label: "نام برند", type: "text", default: "ووف" },
          { key: "bottom.copyright", label: "متن کپی‌رایت", type: "text", default: "© ۱۴۰۴ . تمامی حقوق برای تیم ووف محفوظ است." },
          { key: "bottom.instagram", label: "اینستاگرام (لینک)", type: "text", default: "https://instagram.com" },
          { key: "bottom.facebook", label: "فیسبوک (لینک)", type: "text", default: "https://facebook.com" },
          { key: "bottom.twitter", label: "توییتر (لینک)", type: "text", default: "https://twitter.com" },
        ],
      },
    ],
  },
];

// Append the standard SEO section to every page (approved requirement G).
for (const page of PAGES) {
  page.sections.push(JSON.parse(JSON.stringify(SEO_SECTION)));
}

const PAGE_SLUGS = PAGES.map((p) => p.slug);

/** Flat map: pageSlug -> { key -> slotDef } for validation & seeding. */
const SLOT_INDEX = {};
for (const page of PAGES) {
  SLOT_INDEX[page.slug] = {};
  for (const section of page.sections) {
    for (const slot of section.slots) {
      SLOT_INDEX[page.slug][slot.key] = slot;
    }
  }
}

function getPage(slug) {
  return PAGES.find((p) => p.slug === slug) || null;
}

function getSlot(slug, key) {
  return (SLOT_INDEX[slug] && SLOT_INDEX[slug][key]) || null;
}

module.exports = { PAGES, PAGE_SLUGS, SLOT_INDEX, getPage, getSlot };
