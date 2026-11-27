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
  assert.equal(app.section, "appCredits");
  assert.equal(card.section, "giftCards");
  assert.notEqual(app.group, card.group);
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
  assert.equal(result.section, "appCredits");
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
  assert.match(appSource, /gameKey = classification\.gameKey/);
  assert.match(homeSource, /<script src="\/lib\/nemer-product-classifier\.js[^>]*><\/script><script src="js\/app\.js/);
});
