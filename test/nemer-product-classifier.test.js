"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const realConfig = require("../config/nemer-category-map.json");
const realCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "nemer-products.json"), "utf8")).products;
const { classifyProduct, classifyCatalog, sortClassifiedProducts } = require("../lib/nemer-product-classifier");

const config = {
  parentIdRules: {
    "4232": { section: "balance", group: "syriatel-s1", expectedCategoryName: "وحداتسرياتيلs1 ~", sortRule: "price_asc" },
    "3966": { section: "games", group: "parent-3966", title: "Clash of clans •", expectedCategoryName: "Clash of clans •", sortRule: "source" }
  },
  categoryNameRules: {},
  productIdOverrides: {
    "3418": { section: "boost", group: "facebook", title: "فيسبوك" }
  },
  sortRules: { facebook: "source" }
};

test("known parent_id and exact category name classify", () => {
  const result = classifyProduct({ id: 1, parent_id: 4232, category_name: "وحداتسرياتيلs1 ~" }, config);
  assert.equal(result.status, "classified");
  assert.equal(result.section, "balance");
});

test("known parent_id with conflicting category is sent to review", () => {
  const result = classifyProduct({ id: 2, parent_id: 4232, category_name: "وحدات MTN" }, config);
  assert.equal(result.status, "review");
  assert.equal(result.reason, "parent_category_conflict");
});

test("unknown non-zero parent_id is not guessed", () => {
  const result = classifyProduct({ id: 3, parent_id: 98765, category_name: "Instagram" }, config);
  assert.equal(result.status, "review");
  assert.equal(result.reason, "unknown_parent_id");
});

test("parent_id zero needs exact name or documented product override", () => {
  assert.equal(classifyProduct({ id: 4, parent_id: 0, category_name: "مشاهدات ومشتركين" }, config).status, "unclassified");
  assert.equal(classifyProduct({ id: 3418, parent_id: 0, category_name: "متابعين فيسبوك" }, config).section, "boost");
});

test("generic words do not classify Shahid or WhatsApp numbers as boost", () => {
  for (const product of [
    { id: 5, parent_id: 0, category_name: "اشتراك شاهد مشترك" },
    { id: 6, parent_id: 2071, category_name: "ارقام وتساب مباشر S2" }
  ]) assert.notEqual(classifyProduct(product, config).section, "boost");
});

test("ambiguous game names are not guessed by text", () => {
  for (const name of ["Hero Clash", "Clash of Plants"]) {
    assert.equal(classifyProduct({ id: name, parent_id: 0, category_name: name }, config).status, "unclassified");
  }
});

test("catalog detects duplicate IDs and keeps a product in one group", () => {
  const result = classifyCatalog([
    { id: 3418, parent_id: 0, category_name: "متابعين فيسبوك" },
    { id: 3418, parent_id: 0, category_name: "متابعين فيسبوك" }
  ], config);
  assert.deepEqual(result.duplicateIds, ["3418"]);
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.overlaps, []);
});

test("price sorting is ascending and stable", () => {
  const products = [{ id: 3, price: 2 }, { id: 1, price: 1 }, { id: 2, price: 1 }];
  assert.deepEqual(sortClassifiedProducts(products, "price_asc").map(p => p.id), [1, 2, 3]);
});

test("approved app-credit and digital-card parent groups stay separate", () => {
  const app = classifyProduct({ id: 3192001, parent_id: 3192, category_name: 'شاميت - Chamet "' }, realConfig);
  const card = classifyProduct({ id: 3214001, parent_id: 3214, category_name: 'ITUNES - USA "' }, realConfig);
  assert.equal(app.section, "apps");
  assert.equal(card.section, "cards");
  assert.notEqual(app.group, card.group);
});

test("approved non-game parent groups route to their matching homepage sections", () => {
  const expected = {
    3456: "numbers", 3196: "numbers", 3198: "numbers", 3199: "numbers",
    3201: "numbers", 3204: "numbers", 2071: "numbers", 1514: "numbers",
    1691: "accounts", 1692: "accounts", 1693: "accounts", 1694: "accounts",
    1990: "vip", 1991: "vip", 1992: "vip", 1993: "vip", 3459: "website"
  };
  for (const [parentId, section] of Object.entries(expected)) {
    const product = realCatalog.find(item => Number(item.parent_id) === Number(parentId));
    assert.ok(product, `parent_id ${parentId} exists`);
    assert.equal(classifyProduct(product, realConfig).section, section);
  }
  const ambiguousBan = realCatalog.find(item => Number(item.parent_id) === 2241);
  assert.ok(ambiguousBan);
  assert.equal(classifyProduct(ambiguousBan, realConfig).status, "review");
});

test("VPN, screen and Telegram subscriptions route to their exact homepage sections", () => {
  const expectedParents = {
    3932: "vpn", 3933: "vpn", 3934: "vpn", 3935: "vpn",
    3937: "vpn", 3938: "vpn", 3939: "vpn", 3940: "vpn",
    3401: "screens", 3403: "screens", 3405: "screens", 4235: "telegram"
  };
  for (const [parentId, section] of Object.entries(expectedParents)) {
    const product = realCatalog.find(item => Number(item.parent_id) === Number(parentId));
    assert.ok(product, `parent_id ${parentId} exists`);
    assert.equal(classifyProduct(product, realConfig).section, section);
  }
  for (const id of [2191, 4256, 4257, 4258, 4259, 4260, 4261, 4262, 4263]) {
    const product = realCatalog.find(item => String(item.id) === String(id));
    assert.ok(product, `product ${id} exists`);
    assert.equal(classifyProduct(product, realConfig).section, id === 2191 ? "vpn" : "screens");
  }
});

test("all mapped parent_id rules match the real Nemer snapshot", () => {
  const mappedIds = new Set(Object.keys(realConfig.parentIdRules).map(Number));
  for (const product of realCatalog) {
    if (!mappedIds.has(Number(product.parent_id))) continue;
    const result = classifyProduct(product, realConfig);
    assert.equal(result.status, "classified", `product ${product.id} should match its approved parent_id rule`);
  }
});

test("real Nemer snapshot has unique product IDs and no invalid records", () => {
  const ids = realCatalog.map(product => String(product.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(realCatalog.every(product => product.id != null && product.category_name));
});

test("exact parentless category names classify future products without fuzzy matching", () => {
  const result = classifyProduct({ id: 999999, parent_id: 0, category_name: "TAKA LIVE" }, realConfig);
  assert.equal(result.status, "classified");
  assert.equal(result.section, "apps");
});

test("product ID override is sent to review if its category name changes", () => {
  const result = classifyProduct({ id: 2382, parent_id: 0, category_name: "منتج مختلف" }, realConfig);
  assert.equal(result.status, "review");
  assert.equal(result.reason, "product_override_category_conflict");
});

test("all documented parentless product overrides match the real Nemer snapshot", () => {
  const byId = new Map(realCatalog.map(product => [String(product.id), product]));
  for (const [id, rule] of Object.entries(realConfig.productIdOverrides)) {
    const product = byId.get(id);
    assert.ok(product, `override ${id} exists in the source snapshot`);
    assert.equal(product.parent_id || 0, 0, `override ${id} is only used for parent_id=0`);
    assert.equal(product.category_name, rule.expectedCategoryName, `override ${id} retains its approved category name`);
    assert.equal(classifyProduct(product, realConfig).status, "classified", `override ${id} should classify`);
  }
});

test("a conflicting product ID override cannot fall through to another exact category", () => {
  const result = classifyProduct({ id: 2382, parent_id: 0, category_name: "TAKA LIVE" }, realConfig);
  assert.equal(result.status, "review");
  assert.equal(result.reason, "product_override_category_conflict");
});

test("every approved game parent rule exposes one canonical game key", () => {
  const gameRules = Object.entries(realConfig.parentIdRules).filter(([, rule]) => rule.section === "games");
  assert.ok(gameRules.length >= 110);
  for (const [parentId, rule] of gameRules) {
    assert.ok(rule.gameKey, `parent_id ${parentId} has a canonical game key`);
    assert.equal(rule.sortRule, "price_asc");
  }
});

test("all eight PUBG source categories are included in the unified games engine", () => {
  const expected = [4254, 4255, 4270, 4272, 4296, 4297, 4298, 4300];
  for (const parentId of expected) {
    const rule = realConfig.parentIdRules[String(parentId)];
    assert.ok(rule, `PUBG parent_id ${parentId} is mapped`);
    assert.equal(rule.section, "games");
    assert.equal(rule.gameKey, "PUBG Mobile");
  }
  const pubgProducts = realCatalog.filter(product => expected.includes(Number(product.parent_id)));
  assert.equal(pubgProducts.length, 93);
  assert.ok(pubgProducts.every(product => classifyProduct(product, realConfig).gameKey === "PUBG Mobile"));
});

test("game UI consumes canonical classifier keys and loads the classifier before app.js", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const homeSource = fs.readFileSync(path.join(__dirname, "..", "pages", "index.html"), "utf8");
  assert.match(appSource, /window\.NemerProductClassifier/);
  assert.match(appSource, /classification\.section !== "games"/);
  assert.match(appSource, /return classification.status === "classified" \? classification.section : "other"/);
  assert.match(appSource, /gameKey = classification\.gameKey/);
  assert.match(homeSource, /<script src="\/lib\/nemer-product-classifier\.js[^>]*><\/script><script src="js\/app\.js/);
});

test("real catalog classification has a stable audited result with no overlaps", () => {
  const report = classifyCatalog(realCatalog, realConfig);
  assert.deepEqual(report.summary, {
      "classified": 2361,
      "review": 1,
      "unclassified": 3,
      "invalid": 0,
      "bySection": {
          "screens": 20,
          "boost": 39,
          "games": 833,
          "balance": 232,
          "apps": 1054,
          "numbers": 49,
          "digital": 44,
          "cards": 26,
          "accounts": 4,
          "software": 7,
          "telegram": 3,
          "vip": 12,
          "vpn": 34,
          "shamcash": 1,
          "website": 1,
          "payments": 2
      }
  });
  assert.deepEqual(report.duplicateIds, []);
  assert.deepEqual(report.overlaps, []);
});

test("ambiguous game parent categories use their explicit canonical game keys", () => {
  const cases = [
    [3277, "Hero Clash"],
    [3321, "Clash of Plants"],
    [3304, "Astral Guardians"],
    [3261, "Yalla Ludo Gold"],
    [3273, "Yalla Ludo Diamonds Codes"],
    [3274, "Yalla Ludo Gold Codes"]
  ];
  for (const [parentId, gameKey] of cases) {
    const product = realCatalog.find(item => Number(item.parent_id) === parentId);
    assert.ok(product, `parent_id ${parentId} exists`);
    assert.equal(classifyProduct(product, realConfig).gameKey, gameKey);
  }
});

test("the 20 supplier categories have a one-to-one homepage counterpart", () => {
  const homeSource = fs.readFileSync(path.join(__dirname, "..", "pages", "index.html"), "utf8");
  const tiles = [...homeSource.matchAll(/<button class="category category-tile" data-category="([^"]+)" data-category-title="([^"]+)"/g)]
    .map(match => ({ key: match[1], title: match[2] }));
  assert.equal(realConfig.sectionTopology.supplierMainCategoryCount, 20);
  assert.equal(realConfig.sectionTopology.storeMainSectionCount, 20);
  assert.equal(realConfig.sectionTopology.storeSections.length, 20);
  assert.equal(realConfig.sectionTopology.supplierToStoreMappings.length, 20);
  assert.equal(tiles.length, 20);
  assert.deepEqual(tiles, realConfig.sectionTopology.storeSections);
  assert.deepEqual(
    tiles.map(tile => tile.title),
    realConfig.sectionTopology.supplierMainCategoryNames
  );
});
