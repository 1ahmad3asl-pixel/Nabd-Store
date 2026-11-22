function normalizeNemerPrice(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// السعر المعروض/المحاسب عليه يعتمد على دقة المنتج، بحد أدنى 3 خانات.
// التقريب دائمًا إلى الأعلى حتى لا يتم خصم أقل من السعر النهائي المعتمد.
function getPriceDecimalPlaces(value) {
  const text = String(value ?? "").trim();
  if (!text || !Number.isFinite(Number(value))) return 3;
  const normalized = text.toLowerCase();
  const exponentIndex = normalized.indexOf("e");
  if (exponentIndex >= 0) {
    const coefficient = normalized.slice(0, exponentIndex);
    const exponent = Number(normalized.slice(exponentIndex + 1));
    if (Number.isInteger(exponent)) {
      const dot = coefficient.indexOf(".");
      const coefficientDecimals = dot >= 0 ? coefficient.length - dot - 1 : 0;
      return Math.max(3, Math.min(12, coefficientDecimals - exponent));
    }
  }
  const dot = text.indexOf(".");
  if (dot < 0) return 3;
  const decimals = text.slice(dot + 1).replace(/0+$/, "").length;
  return Math.max(3, Math.min(12, decimals));
}

function getTierDiscount(total) {
  const amount = Number(total || 0);
  if (amount >= 300) return 5;
  if (amount >= 200) return 3;
  if (amount >= 115) return 2;
  if (amount >= 50) return 1;
  return 0;
}

function getEffectiveDiscount(tierDiscount, manualDiscount) {
  return Math.min(100, Math.max(tierDiscount, manualDiscount));
}

function ceilPrice(value, decimals) {
  const amount = Number(value);
  const places = Number.isInteger(decimals) ? Math.max(0, Math.min(12, decimals)) : 3;
  if (!Number.isFinite(amount)) return null;
  const factor = 10 ** places;
  const scaled = amount * factor;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return Math.ceil(scaled - epsilon) / factor;
}

function validateRequestedQuantity(requestedQty) {
  return Number.isInteger(requestedQty) && requestedQty >= 1 && requestedQty <= 5000000000;
}

function validateProductQuantity(requestedQty, product) {
  const productText = String(product?.category_name || "") + " " + String(product?.name || "");
  const isPubgProduct = /pubg|ببجي/i.test(productText);
  const isReflectProduct = /reflect|ريفلكت|رفلكت/i.test(productText);
  const isMtnInvoiceProduct = /mtn/i.test(productText) && /فاتور/i.test(productText);
  if (!isMtnInvoiceProduct && requestedQty > 1000000) {
    return { error: "الكمية غير صالحة." };
  }
  const qty = isPubgProduct ? 1 : requestedQty;
  if (isReflectProduct && (qty < 50 || qty > 5000)) {
    return { error: "كمية Reflect يجب أن تكون من 50 إلى 5,000." };
  }
  if (isMtnInvoiceProduct && (qty < 500 || qty > 5000000000)) {
    return { error: "كمية فواتير MTN يجب أن تكون من 500 إلى 5,000,000,000." };
  }

  const minQty = Number(product?.qty_values?.min);
  const maxQty = Number(product?.qty_values?.max);
  const isJawakerProduct = /jawaker|جواكر/i.test(productText);
  const isFreeFireProduct = /free\s*fire|فري\s*فاير/i.test(productText);
  const isClashOfClansProduct = /clash\s*of\s*clans|كلاش\s*اوف\s*كلانس|كلاش\s*أوف\s*كلانس/i.test(productText);
  const isDragonheirProduct = /dragonheir|silent\s*gods|دراغون\s*هير/i.test(productText);
  const isCloudSongProduct = /cloud\s*song|skywalkers|كلاود\s*سونغ/i.test(productText);
  const isYallaLudoProduct = /yalla\s*ludo|يلا\s*لودو/i.test(productText);
  const isYallaLudoGoldProduct = /yalla\s*ludo\s*gold|يلا\s*لودو\s*غولد|يلا\s*لودو\s*جولد/i.test(productText);
  const isLordsMobileProduct = /lords\s*mobile|لوردز\s*موبايل|لوردس\s*موبايل/i.test(productText);
  const isEightBallPoolProduct = /8\s*ball\s*pool|eight\s*ball\s*pool|ثمانية\s*بول|ثمنية\s*بول/i.test(productText);
  const isGunsOfGloryProduct = /gun\s*of\s*glory|guns\s*of\s*glory|بندقية\s*المجد/i.test(productText);
  const isGangsOfGloryProduct = /gangs\s*of\s*glory|غانغز\s*او?ف\s*غلوري|غانجز\s*أوف\s*غلوري/i.test(productText);
  const isProjectEntropyProduct = /project\s*entropy|بروجكت\s*انتروبي|بروجيكت\s*انتروبي/i.test(productText);
  const isFarlight84Product = /farlight\s*84|farlight84|فارلايت\s*84/i.test(productText);
  const isMarvelRivalsProduct = /marvel\s*rivals|مارفل\s*ريفيلز|مارفل\s*رايفلز|مارفل\s*ريفالز/i.test(productText);
  const isGenshinImpactProduct = /genshin\s*impact|جينشن\s*امباكت|جينشين\s*إمباكت/i.test(productText);
  const isSuperSusProduct = /super\s*sus|سوبر\s*سوس/i.test(productText);
  const isUnifiedPlayerIdProduct = isJawakerProduct || isFreeFireProduct || isClashOfClansProduct || isDragonheirProduct || isCloudSongProduct || isYallaLudoProduct || isYallaLudoGoldProduct || isLordsMobileProduct || isEightBallPoolProduct || isGunsOfGloryProduct || isGangsOfGloryProduct || isProjectEntropyProduct || isFarlight84Product || isMarvelRivalsProduct || isGenshinImpactProduct || isSuperSusProduct;
  const isJawakerS2 = isJawakerProduct && /(?:s\s*2|s2|عداد\s*جواكر\s*s\s*2)/i.test(productText);
  const isJawakerS1Server = isJawakerProduct && /(?:s\s*1|s1|سيرفر\s*s\s*1|سرفر\s*s\s*1|جواكر\s*سيرفر\s*s\s*1)/i.test(productText);
  const isJawakerServerQuantity = isJawakerS1Server || isJawakerS2;

  if (!isPubgProduct) {
    const enforcedMinQty = isJawakerServerQuantity ? 10000 : minQty;
    const enforcedMaxQty = isMtnInvoiceProduct ? 5000000000 : (isJawakerServerQuantity ? 1000000 : maxQty);
    if (Number.isFinite(enforcedMinQty) && qty < enforcedMinQty) {
      return {
        error: isJawakerServerQuantity
          ? "كمية عداد جواكر S1 وS2 يجب أن تكون من 10,000 إلى 1,000,000."
          : "الكمية أقل من الحد الأدنى للمنتج."
      };
    }
    if (Number.isFinite(enforcedMaxQty) && qty > enforcedMaxQty) {
      return {
        error: isJawakerServerQuantity
          ? "كمية عداد جواكر S1 وS2 يجب أن تكون من 10,000 إلى 1,000,000."
          : "الكمية أكبر من الحد الأقصى للمنتج."
      };
    }
  }

  return { qty, isPubgProduct, isUnifiedPlayerIdProduct };
}

module.exports = {
  normalizeNemerPrice,
  getPriceDecimalPlaces,
  getTierDiscount,
  getEffectiveDiscount,
  ceilPrice,
  validateRequestedQuantity,
  validateProductQuantity
};
