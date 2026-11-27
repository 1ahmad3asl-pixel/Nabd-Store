"use strict";

function normalizeCategoryName(value) {
  return String(value == null ? "" : value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[•~°"'“”‘’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyProduct(product, config) {
  if (!product || product.id == null || String(product.id).trim() === "") {
    return { status: "invalid", reason: "missing_product_id" };
  }
  const id = String(product.id);
  const parentId = Number(product.parent_id || 0);
  const categoryName = normalizeCategoryName(product.category_name);
  const parentRule = config.parentIdRules && config.parentIdRules[String(parentId)];

  if (parentId !== 0 && parentRule) {
    if (categoryName !== normalizeCategoryName(parentRule.expectedCategoryName)) {
      return { status: "review", reason: "parent_category_conflict", productId: id, parentId };
    }
    return { status: "classified", productId: id, section: parentRule.section, group: parentRule.group, gameKey: parentRule.gameKey || null, title: parentRule.title || parentRule.expectedCategoryName, sortRule: parentRule.sortRule || "source", source: "parent_id" };
  }

  if (parentId !== 0) {
    return { status: "review", reason: "unknown_parent_id", productId: id, parentId };
  }

  const override = config.productIdOverrides && config.productIdOverrides[id];
  if (override) {
    if (override.expectedCategoryName && categoryName !== normalizeCategoryName(override.expectedCategoryName)) {
      return { status: "review", reason: "product_override_category_conflict", productId: id };
    }
    return { status: "classified", productId: id, section: override.section, group: override.group, gameKey: override.gameKey || null, title: override.title || override.group, sortRule: override.sortRule || (config.sortRules && config.sortRules[override.group]) || "source", source: "product_id_override", reason: override.reason };
  }

  const exactRule = config.categoryNameRules && config.categoryNameRules[categoryName];
  if (exactRule) {
    return { status: "classified", productId: id, section: exactRule.section, group: exactRule.group, gameKey: exactRule.gameKey || null, title: exactRule.title || exactRule.group, sortRule: exactRule.sortRule || "source", source: "category_name" };
  }

  return { status: "unclassified", productId: id, reason: "no_exact_rule" };
}

function classifyCatalog(products, config) {
  const results = [];
  const seen = new Set();
  const duplicateIds = [];
  const memberships = new Map();

  for (const product of Array.isArray(products) ? products : []) {
    const id = product && product.id != null ? String(product.id) : "";
    if (id && seen.has(id)) {
      duplicateIds.push(id);
      continue;
    }
    if (id) seen.add(id);
    const result = classifyProduct(product, config);
    results.push(result);
    if (result.status === "classified") {
      const current = memberships.get(id) || [];
      current.push(result.section + ":" + result.group);
      memberships.set(id, current);
    }
  }

  const overlaps = Array.from(memberships.entries())
    .filter(([, groups]) => new Set(groups).size > 1)
    .map(([productId, groups]) => ({ productId, groups }));

  return {
    results,
    duplicateIds,
    overlaps,
    summary: results.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      if (item.status === "classified") acc.bySection[item.section] = (acc.bySection[item.section] || 0) + 1;
      return acc;
    }, { classified: 0, review: 0, unclassified: 0, invalid: 0, bySection: {} })
  };
}

function sortClassifiedProducts(products, sortRule) {
  const indexed = (Array.isArray(products) ? products : []).map((product, index) => ({ product, index }));
  if (sortRule === "price_asc") {
    indexed.sort((a, b) => {
      const pa = Number(a.product && a.product.price);
      const pb = Number(b.product && b.product.price);
      const av = Number.isFinite(pa) ? pa : Number.POSITIVE_INFINITY;
      const bv = Number.isFinite(pb) ? pb : Number.POSITIVE_INFINITY;
      return av - bv || a.index - b.index || String(a.product.id).localeCompare(String(b.product.id));
    });
  }
  return indexed.map(item => item.product);
}

const NemerProductClassifier = { normalizeCategoryName, classifyProduct, classifyCatalog, sortClassifiedProducts };

if (typeof module !== "undefined" && module.exports) module.exports = NemerProductClassifier;
if (typeof window !== "undefined") window.NemerProductClassifier = NemerProductClassifier;
