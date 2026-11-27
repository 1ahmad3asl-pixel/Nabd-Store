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
