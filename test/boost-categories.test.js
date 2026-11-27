const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const boostSource = fs.readFileSync(require.resolve("../js/boost.js"), "utf8");
const appSource = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const homeSource = fs.readFileSync(require.resolve("../pages/index.html"), "utf8");
const imageDir = path.join(__dirname, "..", "public", "images", "رشـق صفحات");
const normalize = value => String(value).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/\s+/g, " ").trim();

test("homepage can open the boost category through its delegated click handler", () => {
  assert.match(boostSource, /window\.openBoost\s*=\s*openBoost/);
  assert.match(homeSource, /boost\.js\?v=20261125-boost12/);
  assert.match(homeSource, /app\.js\?v=20261125-order2/);
  assert.match(homeSource, /boost\.css\?v=20261125-boost1/);
});

test("All configured boost apps use the shared product picker", () => {
  assert.match(boostSource, /ORDER_PICKER_GROUPS=new Set\(\[\"snapchat\",\"kwai\",\"facebook\",\"whatsapp\",\"instagram\",\"telegram\",\"tiktok\",\"youtube\"\]\)/);
  assert.match(boostSource, /image:\"\/public\/images\/رشـق صفحات\/\"\+esc\(g\.image\)/);
  assert.match(boostSource, /renderGameProductPicker\(g\.title,\{title:g\.title,products:list\},\{image:/);
  assert.match(boostSource, /onBack:\(\)=>openBoost\(false\)/);
  assert.match(homeSource, /app\.js\?v=20261125-order2/);
});

test("Facebook uses the shared product picker with its centered app image", () => {
  assert.match(boostSource, /key:\"facebook\",title:\"رشق فيسبوك\",image:\"facebook\.jpg\"/);
  assert.match(boostSource, /ORDER_PICKER_GROUPS=new Set\(\[\"snapchat\",\"kwai\",\"facebook\",\"whatsapp\",\"instagram\",\"telegram\",\"tiktok\",\"youtube\"\]\)/);
  assert.match(boostSource, /renderGameProductPicker\(g\.title,\{title:g\.title,products:list\},\{image:/);
  assert.match(boostSource, /onBack:\(\)=>openBoost\(false\)/);
});

test("WhatsApp uses the shared product picker with its centered app image", () => {
  assert.match(boostSource, /key:\"whatsapp\",title:\"رشق واتساب\",image:\"whatsapp\.jpg\"/);
  assert.match(boostSource, /ORDER_PICKER_GROUPS=new Set\(\[\"snapchat\",\"kwai\",\"facebook\",\"whatsapp\",\"instagram\",\"telegram\",\"tiktok\",\"youtube\"\]\)/);
  assert.match(boostSource, /renderGameProductPicker\(g\.title,\{title:g\.title,products:list\},\{image:/);
  assert.match(boostSource, /onBack:\(\)=>openBoost\(false\)/);
});

test("boost product matching includes WhatsApp reactions and members but excludes number products", () => {
  const filter = boostSource.match(/if\(!\/(.+?)\/i\.test\(t\)\)return false/);
  assert.ok(filter, "boost product filter exists");
  const matchesBoostType = new RegExp(filter[1], "i");

  assert.match(filter[1], /تفاعل/);
  assert.match(filter[1], /اعضاء/);
  assert.equal(matchesBoostType.test("تفاعل منشور وتساب قلب"), true);
  assert.equal(matchesBoostType.test("اعضاء قناة واتساب"), true);
  assert.equal(matchesBoostType.test("ارقام واتساب s1"), false);
});

test("boost product matching includes video share services but excludes generic Kwai products", () => {
  const filter = boostSource.match(/if\(!\/(.+?)\/i\.test\(t\)\)return false/);
  assert.ok(filter, "boost product filter exists");
  const matchesBoostType = new RegExp(filter[1], "i");

  assert.match(filter[1], /مشاركات\|مشاركة/);
  assert.equal(matchesBoostType.test("مشاركات فيديو كواي ثابت"), true);
  assert.equal(matchesBoostType.test("كواي لايف KWAI LIVE"), false);
});

test("Instagram classification includes all six API service names including comments", () => {
  const group = boostSource.match(/\{key:\"instagram\",title:\"[^\"]+\",image:\"[^\"]+\",a:(\[[^\]]+\])\}/);
  const filter = boostSource.match(/if\(!\/(.+?)\/i\.test\(t\)\)return false/);
  assert.ok(group, "Instagram group exists");
  assert.ok(filter, "boost product filter exists");

  const aliases = JSON.parse(group[1]).map(normalize);
  const boostPattern = new RegExp(filter[1], "i");
  const products = [
    "متابعين انستغرام الاسرع عالميًا مع هدية",
    "اعجابات بوست ريلز انستغرام حقيقي الأرخص",
    "مشاهدات ريلز انستغرام مدى الحياة رخيص",
    "مشاهدات قصة انستغرام للجميع الأرخص عالميًا",
    "مشاركة بوست انستغرام مدى الحياة فوري رخيص",
    "تعليقات بوست انستغرام إيجابي رخيص"
  ];

  assert.equal(products.filter(product => {
    const text = normalize(product);
    return boostPattern.test(text) && aliases.some(alias => text.includes(alias));
  }).length, 6);
});

test("Telegram classification includes the six named API products and uses the shared picker", () => {
  const group = boostSource.match(/\{key:\"telegram\",title:\"[^\"]+\",image:\"[^\"]+\",a:(\[[^\]]+\])\}/);
  const filter = boostSource.match(/if\(!\/(.+?)\/i\.test\(t\)\)return false/);
  assert.ok(group, "Telegram group exists");
  assert.ok(filter, "boost product filter exists");

  const aliases = JSON.parse(group[1]).map(normalize);
  const boostPattern = new RegExp(filter[1], "i");
  const products = [
    "مشتركين حسابات محذوفة ضمان عشوائي رخيص",
    "مشاركة منشور تيليجرام مشاهدات الأرخص",
    "تفاعلات تيليجرام حقيقي رخيص",
    "تفاعلات تيليجرام حقيقي رخيص",
    "مشاهدات ل30 بوستات مستقبلية جديدة",
    "مشاهدات ل120 بوستات مستقبلية جديدة"
  ];

  assert.equal(products.filter(product => {
    const text = normalize(product);
    return boostPattern.test(text) && aliases.some(alias => text.includes(alias));
  }).length, 6);
  assert.match(boostSource, /ORDER_PICKER_GROUPS=new Set\(\[\"snapchat\",\"kwai\",\"facebook\",\"whatsapp\",\"instagram\",\"telegram\",\"tiktok\",\"youtube\"\]\)/);
  assert.match(boostSource, /renderGameProductPicker\(g\.title,\{title:g\.title,products:list\},\{image:/);
});

test("TikTok classification includes all four API boost products and uses the shared picker", () => {
  const group = boostSource.match(/\{key:\"tiktok\",title:\"[^\"]+\",image:\"[^\"]+\",a:(\[[^\]]+\])\}/);
  const filter = boostSource.match(/if\(!\/(.+?)\/i\.test\(t\)\)return false/);
  assert.ok(group, "TikTok group exists");
  assert.ok(filter, "boost product filter exists");

  const aliases = JSON.parse(group[1]).map(normalize);
  const boostPattern = new RegExp(filter[1], "i");
  const products = [
    "متابعين تيك توك VIP حقيقي ثبات عالي سريع",
    "اعجابات ومشاهدات فيديو تيك توك VIP حقيقي",
    "مشاهدات فيديو تيك توك محدث سريع",
    "مشاركة فيديو تيك توك اكسبلور ثابت الأرخص"
  ];

  assert.equal(products.filter(product => {
    const text = normalize(product);
    return boostPattern.test(text) && aliases.some(alias => text.includes(alias));
  }).length, 4);
  assert.match(boostSource, /ORDER_PICKER_GROUPS=new Set\(\[\"snapchat\",\"kwai\",\"facebook\",\"whatsapp\",\"instagram\",\"telegram\",\"tiktok\",\"youtube\"\]\)/);
  assert.match(boostSource, /renderGameProductPicker\(g\.title,\{title:g\.title,products:list\},\{image:/);
});

test("YouTube opens the shared picker and shows an empty state without classifying Premium products as boosts", () => {
  assert.match(boostSource, /key:\"youtube\",title:\"رشق يوتيوب\",image:\"youtube\.jpg\"/);
  assert.match(boostSource, /ORDER_PICKER_GROUPS=new Set\(\[\"snapchat\",\"kwai\",\"facebook\",\"whatsapp\",\"instagram\",\"telegram\",\"tiktok\",\"youtube\"\]\)/);
  assert.match(boostSource, /لا توجد منتجات رشق متاحة ليوتيوب حاليًا/);
  assert.match(appSource, /لا توجد منتجات متاحة حاليًا/);

  const filter = boostSource.match(/if\(!\/(.+?)\/i\.test\(t\)\)return false/);
  assert.ok(filter, "boost product filter exists");
  assert.equal(new RegExp(filter[1], "i").test("يوتيوب مميز - 1 شهر"), false);
});

test("Facebook classification includes all nine API service names written with the short alias", () => {
  const facebookGroup = boostSource.match(/\{key:\"facebook\",title:\"[^\"]+\",image:\"[^\"]+\",a:(\[[^\]]+\])\}/);
  const filter = boostSource.match(/if\(!\/(.+?)\/i\.test\(t\)\)return false/);
  assert.ok(facebookGroup, "Facebook group exists");
  assert.ok(filter, "boost product filter exists");

  const aliases = JSON.parse(facebookGroup[1]).map(normalize);
  const boostPattern = new RegExp(filter[1], "i");
  const products = [
    "متابعين صفحة حساب فيسبوك مدى الحياة محدث",
    "متابعون صفحة حساب فيس بوك مدى الحياة",
    "تفاعل منشور فيس لايك",
    "تفاعل منشور فيس أحببته",
    "تفاعل منشور فيس أحزنني",
    "تفاعل منشور فيس أدعمه",
    "تفاعل منشور فيس أغضبني",
    "تفاعل منشور فيس واو",
    "مشاهدات ريلز فيسبوك مدى الحياة الأرخص"
  ];

  assert.equal(products.filter(product => {
    const text = normalize(product);
    return boostPattern.test(text) && aliases.some(alias => text.includes(alias));
  }).length, 9);
});

test("boost platform categories render named image placeholders with valid image signatures", () => {
  const platforms = ["snapchat", "kwai", "facebook", "whatsapp", "instagram", "telegram", "tiktok", "youtube"];

  for (const platform of platforms) {
    assert.match(boostSource, new RegExp(`key:\\"${platform}\\"`));
    assert.ok(boostSource.includes(`image:\"${platform}.jpg\"`), `${platform} category declares its JPG image`);

    const image = fs.readFileSync(path.join(imageDir, `${platform}.jpg`));
    const isJpeg = image[0] === 0xff && image[1] === 0xd8 &&
      image[image.length - 2] === 0xff && image[image.length - 1] === 0xd9;
    const isPng = image.length >= 20 &&
      image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
      image.subarray(-8).equals(Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]));
    assert.ok(isJpeg || isPng, `${platform} placeholder has a valid JPEG or PNG signature`);
  }

  assert.match(boostSource, /src="\/public\/images\/رشـق صفحات\/\s*\x27\+esc\(g\.image\)/);
  assert.match(boostSource, /boost-category-image/);
});
