const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeNemerPrice,
  getPriceDecimalPlaces,
  getTierDiscount,
  getEffectiveDiscount,
  ceilPrice,
  validateRequestedQuantity,
  validateProductQuantity
} = require("../lib/store-calculations");

test("normalizes valid Nemer prices and rejects missing, negative, or non-finite values", () => {
  assert.equal(normalizeNemerPrice("12.5"), 12.5);
  assert.equal(normalizeNemerPrice(0), 0);
  assert.equal(normalizeNemerPrice(null), null);
  assert.equal(normalizeNemerPrice("  "), null);
  assert.equal(normalizeNemerPrice(-0.01), null);
  assert.equal(normalizeNemerPrice("Infinity"), null);
  assert.equal(normalizeNemerPrice("not-a-price"), null);
});

test("uses the existing product precision rules, including exponent notation and clamps", () => {
  assert.equal(getPriceDecimalPlaces("1"), 3);
  assert.equal(getPriceDecimalPlaces("1.2300"), 3);
  assert.equal(getPriceDecimalPlaces("1.2345"), 4);
  assert.equal(getPriceDecimalPlaces("1.2e-5"), 6);
  assert.equal(getPriceDecimalPlaces("1e-20"), 12);
  assert.equal(getPriceDecimalPlaces("1e3"), 3);
  assert.equal(getPriceDecimalPlaces("invalid"), 3);
});

test("rounds prices upward with the existing precision and handles invalid inputs", () => {
  assert.equal(ceilPrice(1.23401, 3), 1.235);
  assert.equal(ceilPrice(1.234, 3), 1.234);
  assert.equal(ceilPrice(1.23401, 2), 1.24);
  assert.equal(ceilPrice(-1.23401, 2), -1.23);
  assert.equal(ceilPrice(1.23401, 20), 1.23401);
  assert.equal(ceilPrice("not-a-number", 3), null);
});

test("applies tier discounts at the existing spend thresholds", () => {
  assert.equal(getTierDiscount(0), 0);
  assert.equal(getTierDiscount(49.99), 0);
  assert.equal(getTierDiscount(50), 1);
  assert.equal(getTierDiscount(114.99), 1);
  assert.equal(getTierDiscount(115), 2);
  assert.equal(getTierDiscount(200), 3);
  assert.equal(getTierDiscount(300), 5);
});

test("selects the greater tier or manual discount and preserves the 100 percent cap", () => {
  assert.equal(getEffectiveDiscount(2, 1), 2);
  assert.equal(getEffectiveDiscount(2, 7), 7);
  assert.equal(getEffectiveDiscount(5, 125), 100);
  assert.equal(getEffectiveDiscount(0, -10), 0);
});

test("accepts only integer requested quantities within the existing overall bounds", () => {
  for (const quantity of [1, 1000000, 5000000000]) {
    assert.equal(validateRequestedQuantity(quantity), true);
  }
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 5000000001, "1"]) {
    assert.equal(validateRequestedQuantity(quantity), false);
  }
});

test("validates ordinary product quantity bounds and missing bounds", () => {
  const product = { name: "Credits", qty_values: { min: 2, max: 10 } };
  assert.deepEqual(validateProductQuantity(2, product), {
    qty: 2,
    isPubgProduct: false,
    isUnifiedPlayerIdProduct: false
  });
  assert.equal(validateProductQuantity(10, product).qty, 10);
  assert.equal(validateProductQuantity(1, product).error, "الكمية أقل من الحد الأدنى للمنتج.");
  assert.equal(validateProductQuantity(11, product).error, "الكمية أكبر من الحد الأقصى للمنتج.");
  assert.equal(validateProductQuantity(1, { name: "Credits" }).qty, 1);
  assert.equal(validateProductQuantity(1000001, { name: "Credits" }).error, "الكمية غير صالحة.");
});

test("preserves PUBG single-unit behavior and unified player ID product detection", () => {
  const pubg = validateProductQuantity(5, { name: "PUBG Mobile", qty_values: { min: 2, max: 3 } });
  assert.equal(pubg.qty, 1);
  assert.equal(pubg.isPubgProduct, true);
  assert.equal(pubg.isUnifiedPlayerIdProduct, false);
  assert.equal(validateProductQuantity(1000001, { name: "PUBG" }).error, "الكمية غير صالحة.");

  for (const name of ["Jawaker", "Free Fire", "Clash of Clans", "Genshin Impact", "Super Sus"]) {
    assert.equal(validateProductQuantity(1, { name }).isUnifiedPlayerIdProduct, true, name);
  }
  assert.equal(validateProductQuantity(1, { name: "Netflix" }).isUnifiedPlayerIdProduct, false);
});

test("enforces Reflect and MTN invoice quantity boundaries", () => {
  const reflect = { name: "Reflect" };
  assert.equal(validateProductQuantity(50, reflect).qty, 50);
  assert.equal(validateProductQuantity(5000, reflect).qty, 5000);
  assert.equal(validateProductQuantity(49, reflect).error, "كمية Reflect يجب أن تكون من 50 إلى 5,000.");
  assert.equal(validateProductQuantity(5001, reflect).error, "كمية Reflect يجب أن تكون من 50 إلى 5,000.");

  const mtn = { name: "MTN فاتورة", qty_values: { min: 100, max: 1000 } };
  assert.equal(validateProductQuantity(500, mtn).qty, 500);
  assert.equal(validateProductQuantity(5000000000, mtn).qty, 5000000000);
  assert.equal(validateProductQuantity(499, mtn).error, "كمية فواتير MTN يجب أن تكون من 500 إلى 5,000,000,000.");
  assert.equal(validateProductQuantity(1000001, mtn).qty, 1000001);
});

test("enforces Jawaker S1 and S2 quantity boundaries and provider bounds", () => {
  for (const name of ["Jawaker S1", "عداد جواكر S2"]) {
    assert.equal(validateProductQuantity(10000, { name }).qty, 10000);
    assert.equal(validateProductQuantity(1000000, { name }).qty, 1000000);
    assert.equal(
      validateProductQuantity(9999, { name }).error,
      "كمية عداد جواكر S1 وS2 يجب أن تكون من 10,000 إلى 1,000,000."
    );
    assert.equal(
      validateProductQuantity(1000001, { name }).error,
      "الكمية غير صالحة."
    );
  }
});
