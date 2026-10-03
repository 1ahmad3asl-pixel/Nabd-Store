const fs = require("fs");
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { parsePhoneNumberFromString, getCountries, getCountryCallingCode } = require("libphonenumber-js");

const {
  getNemerProducts,
  createNemerOrder,
  checkNemerOrders,
  getNemerProfile
} = require("./api");

const {
  query,
  withTransaction,
  initDb,
  getSetting,
  setSetting,
  createSession,
  getSession,
  deleteSession,
  createCustomerSession,
  getCustomerSession,
  deleteCustomerSession,
  cleanupSessions
} = require("./db");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const PROFIT_RATE = Number(process.env.PROFIT_RATE || 10);
const NUMBER_PROFIT_RATE = Number(process.env.NUMBER_PROFIT_RATE || 10);
const STORE_NAME = process.env.STORE_NAME || "Nabd-Store";
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_SESSION_SECRET = String(
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString("hex")
);

const adminSettings = {
  profit_rate: PROFIT_RATE,
  number_profit_rate: NUMBER_PROFIT_RATE,
  store_name: STORE_NAME,
  currency: process.env.CURRENCY || "USD",
  currency_decimals: 3,
  font_family: "Amasis MT Pro",
  dhikr_items: ["سبحان اللّٰه","الحمد للّٰه","لا إله إلا اللّٰه","اللّٰه أكبر"]
};

const adminLoginAttempts = new Map();
const customerLoginAttempts = new Map();
const orderRateLimits = new Map();
const googleOAuthStates = new Map();
const customerEmailVerificationRateLimits = new Map();
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "https://nabd-store.onrender.com").replace(/\/$/, "");
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || "").trim();

app.use(express.json({ limit: "8mb" }));

function requireSameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.headers.origin;
  if (!origin) return res.status(403).json({ status: "ERROR", message: "مصدر الطلب غير معروف." });

  try {
    const originUrl = new URL(origin);
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const host = forwardedHost || String(req.headers.host || "").split(",")[0].trim();
    if (!host || originUrl.host !== host || !["http:", "https:"].includes(originUrl.protocol)) {
      return res.status(403).json({ status: "ERROR", message: "مصدر الطلب غير مسموح." });
    }
  } catch {
    return res.status(403).json({ status: "ERROR", message: "مصدر الطلب غير صالح." });
  }

  next();
}

app.use(requireSameOrigin);

function securityHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://accounts.google.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://accounts.google.com https://openidconnect.googleapis.com https://nemer-card.com; font-src 'self' data:;");
}

app.use((req, res, next) => {
  securityHeaders(res);
  next();
});

async function getLiraScopeRate() {
  const url = "https://lirascope.syria-cloud.sy/api/v1/rates/latest?currencies=USD&lang=ar";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("LiraScope HTTP " + response.status);
    }
    const data = await response.json();
    const market = Array.isArray(data.marketRates)
      ? data.marketRates.find(rate => String(rate.currency).toUpperCase() === "USD")
      : null;
    const buy = Number(market?.buy);
    if (!Number.isFinite(buy) || buy <= 0) {
      throw new Error("LiraScope لم يُرجع سعر شراء صالح للدولار.");
    }
    const updatedRate = buy + 10;
    return {
      source: "LiraScope",
      currency: "USD",
      sourceType: "market",
      rateType: "buy",
      buy,
      added: 10,
      rate: updatedRate,
      timestampUtc: market?.timestampUtc || data.timestampUtc || null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function clientIp(req) {
  return String(req.ip || req.socket.remoteAddress || "").trim();
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function hashEmailVerificationValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function sendCustomerVerificationEmail(email, code) {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    const error = new Error("خدمة البريد غير مهيأة. أضف RESEND_API_KEY و EMAIL_FROM في إعدادات Render.");
    error.statusCode = 503;
    throw error;
  }
  const subject = "رمز التحقق من البريد الإلكتروني - Nabd-Store";
  const html = '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#222"><h2 style="margin:0 0 14px">Nabd-Store</h2><p>رمز التحقق من بريدك الإلكتروني هو:</p><div style="font-size:30px;font-weight:800;letter-spacing:8px;margin:18px 0;padding:14px 18px;background:#f5f5f5;border-radius:12px;text-align:center">' + String(code) + '</div><p>صلاحية الرمز 10 دقائق. إذا لم تطلب إنشاء حساب، يمكنك تجاهل هذه الرسالة.</p></div>';
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json","Accept":"application/json"},
    body: JSON.stringify({from:EMAIL_FROM,to:[email],subject,text:"رمز التحقق من بريدك الإلكتروني في Nabd-Store هو: "+code+". صلاحية الرمز 10 دقائق.",html})
  });
  if (!response.ok) {
    let message="تعذر إرسال رمز التحقق إلى البريد الإلكتروني.";
    try { const data=await response.json(); if(data?.message) message=String(data.message); } catch {}
    const error=new Error(message); error.statusCode=502; throw error;
  }
}

function escapeHtmlEmail(value) {
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

async function sendBalanceDepositEmail({amount, customer, imageData, imageMime, imageName}) {
  const receiver = String(process.env.TRANSFER_RECEIVER_EMAIL || "").trim();
  if (!RESEND_API_KEY || !EMAIL_FROM || !receiver) {
    const error = new Error("خدمة استقبال الحوالات غير مهيأة على الخادم.");
    error.statusCode = 503;
    throw error;
  }
  const safeAmount = Number(amount).toFixed(2);
  const subject = "طلب إيداع رصيد - شام كاش دولار - " + safeAmount + "$";
  const text =
    "طلب إيداع رصيد عبر شام كاش دولار\n\n" +
    "المبلغ: $" + safeAmount + "\n" +
    "اسم العميل: " + String(customer.name || "") + "\n" +
    "ID العميل: " + String(customer.customer_number || "") + "\n" +
    "رقم الهاتف: " + String(customer.phone || "") + "\n" +
    "بريد العميل: " + String(customer.email || "") + "\n\n" +
    "تم إرفاق صورة الحوالة.";
  const html =
    '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#222">' +
    '<h2 style="margin:0 0 16px">طلب إيداع رصيد — شام كاش دولار</h2>' +
    '<p><strong>المبلغ:</strong> $' + safeAmount + '</p>' +
    '<p><strong>اسم العميل:</strong> ' + escapeHtmlEmail(customer.name || "") + '</p>' +
    '<p><strong>ID العميل:</strong> ' + escapeHtmlEmail(customer.customer_number || "") + '</p>' +
    '<p><strong>رقم الهاتف:</strong> ' + escapeHtmlEmail(customer.phone || "") + '</p>' +
    '<p><strong>بريد العميل:</strong> ' + escapeHtmlEmail(customer.email || "") + '</p>' +
    '<p>صورة الحوالة مرفقة مع الرسالة.</p></div>';
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json","Accept":"application/json"},
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [receiver],
      subject,
      text,
      html,
      attachments: [{ filename: imageName, content: imageData.split(",").pop() }]
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch {}

  // لا نعتبر الطلب ناجحًا إلا إذا قبلته Resend فعليًا وأعاد معرف الرسالة.
  if (!response.ok || !data?.id) {
    const message = String(data?.message || "تعذر إرسال طلب الإيداع إلى البريد.");
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  console.log("Sham Cash balance deposit email accepted by Resend:", data.id);
  return { id: String(data.id), statusCode: response.status };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split(":");
  if (parts.length !== 2) return false;
  const actual = crypto.scryptSync(String(password), parts[0], 64).toString("hex");
  return actual.length === parts[1].length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(parts[1]));
}

function cookieValue(req, name) {
  return req.headers.cookie?.split(";")
    .map(v => v.trim())
    .find(v => v.startsWith(name + "="))
    ?.split("=")
    .slice(1)
    .join("=") || null;
}

async function loadSettings() {
  adminSettings.profit_rate = Number(await getSetting("profit_rate", PROFIT_RATE));
  adminSettings.number_profit_rate = Number(await getSetting("number_profit_rate", NUMBER_PROFIT_RATE));
  adminSettings.store_name = await getSetting("store_name", STORE_NAME);
  adminSettings.currency = await getSetting("currency", process.env.CURRENCY || "USD");
  adminSettings.currency_decimals = Number(await getSetting("currency_decimals", 3));
  if (![2,3].includes(adminSettings.currency_decimals)) adminSettings.currency_decimals = 3;
  adminSettings.font_family = await getSetting("font_family", "Amasis MT Pro");
  if (!["Amasis MT Pro","Tahoma","Arial"].includes(adminSettings.font_family)) adminSettings.font_family = "Amasis MT Pro";
  const savedDhikr = await getSetting("dhikr_items", adminSettings.dhikr_items);
  try {
    const parsedDhikr = typeof savedDhikr === "string" ? JSON.parse(savedDhikr) : savedDhikr;
    adminSettings.dhikr_items = Array.isArray(parsedDhikr) && parsedDhikr.length
      ? parsedDhikr.map(item => String(item || "").trim()).filter(Boolean).slice(0, 12)
      : ["سبحان اللّٰه","الحمد للّٰه","لا إله إلا اللّٰه","اللّٰه أكبر"];
  } catch {
    adminSettings.dhikr_items = ["سبحان اللّٰه","الحمد للّٰه","لا إله إلا اللّٰه","اللّٰه أكبر"];
  }
}

function isNumberProduct(product) {
  const text = String(product?.category_name || "") + " " + String(product?.name || "");
  return /\b(numbers?|number|whatsapp|facebook|gmail|icloud|instagram|imo)\b|أرقام|رقم|واتساب|فيسبوك|جيميل|ايكلاود|آي كلاود|انستغرام|إنستغرام|ايمو/i.test(text);
}

function getProductProfitRate(product) {
  return isNumberProduct(product)
    ? Number(adminSettings.number_profit_rate || 0)
    : Number(adminSettings.profit_rate || 0);
}

function adminToken() {
  return crypto.createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(crypto.randomUUID() + ":" + Date.now())
    .digest("hex");
}

async function adminAuth(req) {
  const token = cookieValue(req, "nabd_admin_session");
  if (!token) return null;
  const session = await getSession(token);
  return session ? { token, session } : null;
}

function googleRedirectUri() {
  return PUBLIC_BASE_URL + "/api/customer/google/callback";
}

function parseCustomerPhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return { phone: "", country: "" };
  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed || !parsed.isValid()) return null;
  return {
    phone: parsed.number,
    country: parsed.country ? (new Intl.DisplayNames(["ar"], {type:"region"}).of(parsed.country) || parsed.country) : "",
    country_code: parsed.country || ""
  };
}

async function customerAuth(req) {
  const token = cookieValue(req, "nabd_customer_session");
  if (!token) return null;
  const session = await getCustomerSession(token);
  return session ? { token, session } : null;
}

async function requireAdmin(req, res, next) {
  securityHeaders(res);
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(503).json({
      status: "ERROR",
      message: "بيانات مالك لوحة الإدارة غير مهيأة على الخادم."
    });
  }
  try {
    const auth = await adminAuth(req);
    if (!auth) {
      if (req.path === "/admin" || req.path === "/admin/index.html" || req.path === "/Aledaraa19" || req.path === "/Aledaraa19/" || req.path === "/Aledaraa19/index.html") {
        return res.redirect("/Aledaraa19/login.html");
      }
      return res.status(401).json({
        status: "ERROR",
        message: "تسجيل الدخول إلى لوحة الإدارة مطلوب."
      });
    }
    next();
  } catch {
    res.status(401).json({ status: "ERROR", message: "جلسة الإدارة غير صالحة." });
  }
}

async function requireCustomer(req, res, next) {
  try {
    const auth = await customerAuth(req);
    if (!auth) {
      return res.status(401).json({
        status: "ERROR",
        message: "يجب تسجيل الدخول بحساب العميل."
      });
    }
    req.customer = auth.session;
    req.customerSessionToken = auth.token;
    next();
  } catch {
    res.status(401).json({ status: "ERROR", message: "جلسة العميل غير صالحة." });
  }
}

/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin/login", async (req, res) => {
  securityHeaders(res);
  const ip = clientIp(req);
  const attempt = adminLoginAttempts.get(ip) || { count: 0, blockedUntil: 0 };

  if (attempt.blockedUntil > Date.now()) {
    return res.status(429).json({
      status: "ERROR",
      message: "محاولات تسجيل الدخول كثيرة. حاول لاحقًا."
    });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(503).json({
      status: "ERROR",
      message: "بيانات مالك الإدارة غير مهيأة على الخادم."
    });
  }

  if (!safeEqual(email, ADMIN_EMAIL) || !safeEqual(password, ADMIN_PASSWORD)) {
    attempt.count += 1;
    if (attempt.count >= 5) {
      attempt.count = 0;
      attempt.blockedUntil = Date.now() + 15 * 60 * 1000;
    }
    adminLoginAttempts.set(ip, attempt);
    return res.status(401).json({
      status: "ERROR",
      message: "البريد الإلكتروني أو كلمة المرور غير صحيحة."
    });
  }

  adminLoginAttempts.delete(ip);
  const token = adminToken();
  await createSession(token, new Date(Date.now() + 24 * 60 * 60 * 1000));

  res.setHeader(
    "Set-Cookie",
    "nabd_admin_session=" + token +
    "; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400" +
    (COOKIE_SECURE ? "; Secure" : "")
  );

  res.json({ status: "OK", admin: { email: ADMIN_EMAIL } });
});

app.get("/api/exchange-rate", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  try {
    const rate = await getLiraScopeRate();
    res.json({ status: "OK", rate });
  } catch (error) {
    console.error("LiraScope rate error:", error);
    res.status(502).json({
      status: "ERROR",
      message: "تعذر الحصول على سعر الصرف الحالي من LiraScope."
    });
  }
});

app.get("/api/admin/auth/me", requireAdmin, (req, res) => {
  res.json({ status: "OK", admin: { email: ADMIN_EMAIL } });
});

app.post("/api/admin/logout", requireAdmin, async (req, res) => {
  const auth = await adminAuth(req);
  if (auth) await deleteSession(auth.token);
  res.setHeader(
    "Set-Cookie",
    "nabd_admin_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" +
    (process.env.NODE_ENV === "production" ? "; Secure" : "")
  );
  res.json({ status: "OK" });
});

const balanceDepositRateLimits = new Map();

/* =========================
   CUSTOMER AUTH
========================= */

app.get("/api/customer/me", requireCustomer, async (req, res) => {
  try {
    const result = await query(
      "SELECT customer_id,customer_number,name,email,balance FROM customers WHERE customer_id=$1",
      [req.customer.customer_id]
    );
    if (!result.rows[0]) return res.status(404).json({ status: "ERROR", message: "الحساب غير موجود." });
    const customer = result.rows[0];
    res.json({
      status: "OK",
      customer: {
        customer_id: String(customer.customer_id),
        customer_number: Number(customer.customer_number),
        name: customer.name,
        email: customer.email,
        balance: Number(customer.balance || 0)
      }
    });
  } catch (error) {
    console.error("Customer me error:", error);
    res.status(500).json({ status: "ERROR", message: "تعذر تحميل بيانات الحساب." });
  }
});

app.post("/api/customer/balance-deposit/sham-dollar", requireCustomer, async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const imageData = String(req.body?.image_data || "").trim();
    const imageMime = String(req.body?.image_mime || "").trim().toLowerCase();
    const imageNameRaw = String(req.body?.image_name || "transfer-receipt").trim();
    if (!Number.isFinite(amount) || amount < 1) return res.status(400).json({ status: "ERROR", message: "الحد الأدنى للإيداع هو 1 دولار." });
    if (amount > 100000) return res.status(400).json({ status: "ERROR", message: "المبلغ المدخل كبير جدًا." });
    if (!/^image\/(jpeg|png|webp)$/.test(imageMime)) return res.status(400).json({ status: "ERROR", message: "ارفع صورة بصيغة JPG أو PNG أو WEBP." });
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData)) return res.status(400).json({ status: "ERROR", message: "صورة الحوالة غير صالحة." });
    if (imageData.length > 7 * 1024 * 1024) return res.status(413).json({ status: "ERROR", message: "حجم صورة الحوالة كبير جدًا." });
    const customerResult = await query("SELECT customer_id,customer_number,name,email,phone,balance FROM customers WHERE customer_id=$1 AND active=true",[req.customer.customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(401).json({ status: "ERROR", message: "جلسة العميل غير صالحة." });
    const last = balanceDepositRateLimits.get(String(customer.customer_id)) || 0;
    if (Date.now() - last < 30 * 1000) return res.status(429).json({ status: "ERROR", message: "انتظر قليلًا قبل إرسال طلب إيداع جديد." });
    balanceDepositRateLimits.set(String(customer.customer_id), Date.now());
    const imageName = imageNameRaw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "transfer-receipt";
    await sendBalanceDepositEmail({
      amount,
      customer,
      imageData,
      imageMime,
      imageName: imageName.includes(".") ? imageName : imageName + (imageMime === "image/png" ? ".png" : imageMime === "image/webp" ? ".webp" : ".jpg")
    });
    res.json({ status: "OK", message: "تم إرسال طلب الإيداع بنجاح. ستتم مراجعة الحوالة وإضافة الرصيد من الإدارة." });
  } catch (error) {
    console.error("Sham Cash balance deposit error:", error);
    res.status(error.statusCode || 500).json({ status: "ERROR", message: error.message || "تعذر إرسال طلب الإيداع." });
  }
});



app.post("/api/customer/email/send-code", async (req, res) => {
  try {
    const email=String(req.body?.email||"").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({status:"ERROR",message:"البريد الإلكتروني غير صحيح."});
    const exists=await query("SELECT customer_id FROM customers WHERE LOWER(email)=LOWER($1)",[email]);
    if (exists.rows[0]) return res.status(409).json({status:"ERROR",message:"البريد الإلكتروني مستخدم بالفعل."});
    const now=Date.now(), lastSentAt=customerEmailVerificationRateLimits.get(email)||0;
    if (now-lastSentAt<60000) return res.status(429).json({status:"ERROR",message:"انتظر دقيقة قبل طلب رمز جديد."});
    const code=String(crypto.randomInt(100000,1000000));
    await sendCustomerVerificationEmail(email,code);
    const verificationToken=crypto.randomBytes(32).toString("hex");
    await query("INSERT INTO customer_email_verifications(email,code_hash,verification_token_hash,expires_at,attempts,verified_at,updated_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes',0,NULL,NOW()) ON CONFLICT(email) DO UPDATE SET code_hash=EXCLUDED.code_hash,verification_token_hash=EXCLUDED.verification_token_hash,expires_at=EXCLUDED.expires_at,attempts=0,verified_at=NULL,updated_at=NOW()",[email,hashEmailVerificationValue(code),hashEmailVerificationValue(verificationToken)]);
    customerEmailVerificationRateLimits.set(email,now);
    res.json({status:"OK",message:"تم إرسال رمز التحقق إلى بريدك الإلكتروني."});
  } catch(error) {
    console.error("Customer verification email error:",error);
    res.status(error.statusCode||500).json({status:"ERROR",message:error.message||"تعذر إرسال رمز التحقق."});
  }
});

app.post("/api/customer/email/verify-code", async (req, res) => {
  try {
    const email=String(req.body?.email||"").trim().toLowerCase(), code=String(req.body?.code||"").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)||!/^\d{6}$/.test(code)) return res.status(400).json({status:"ERROR",message:"أدخل البريد ورمز التحقق المكوّن من 6 أرقام."});
    const result=await query("SELECT email,code_hash,verification_token_hash,expires_at,attempts,verified_at FROM customer_email_verifications WHERE email=$1",[email]);
    const verification=result.rows[0];
    if (!verification||new Date(verification.expires_at).getTime()<=Date.now()) return res.status(400).json({status:"ERROR",message:"رمز التحقق منتهي أو غير موجود. أرسل رمزًا جديدًا."});
    if (verification.verified_at) return res.status(400).json({status:"ERROR",message:"تم التحقق من هذا البريد مسبقًا. تابع التسجيل."});
    if (Number(verification.attempts||0)>=5) return res.status(429).json({status:"ERROR",message:"تم تجاوز عدد محاولات التحقق. أرسل رمزًا جديدًا."});
    if (!safeEqual(hashEmailVerificationValue(code),verification.code_hash)) {
      await query("UPDATE customer_email_verifications SET attempts=attempts+1,updated_at=NOW() WHERE email=$1",[email]);
      return res.status(400).json({status:"ERROR",message:"رمز التحقق غير صحيح."});
    }
    const verificationToken=crypto.randomBytes(32).toString("hex");
    await query("UPDATE customer_email_verifications SET verification_token_hash=$1,verified_at=NOW(),updated_at=NOW() WHERE email=$2",[hashEmailVerificationValue(verificationToken),email]);
    res.json({status:"OK",verification_token:verificationToken});
  } catch(error) {
    console.error("Customer verification code error:",error);
    res.status(500).json({status:"ERROR",message:"تعذر التحقق من الرمز."});
  }
});

app.post("/api/customer/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const verificationToken = String(req.body?.verification_token || "").trim();

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ status: "ERROR", message: "الاسم غير صالح." });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ status: "ERROR", message: "البريد الإلكتروني غير صحيح." });
    }
    if (password.length < 8 || password.length > 200) {
      return res.status(400).json({
        status: "ERROR",
        message: "كلمة المرور يجب أن تكون بين 8 و200 حرف."
      });
    }

    if (!verificationToken) return res.status(400).json({status:"ERROR",message:"يجب التحقق من البريد الإلكتروني أولًا."});

    const verificationResult=await query("SELECT verification_token_hash,expires_at,verified_at FROM customer_email_verifications WHERE email=$1",[email]);
    const verification=verificationResult.rows[0];
    if (!verification||!verification.verified_at||!verification.verification_token_hash||new Date(verification.expires_at).getTime()<=Date.now()||!safeEqual(hashEmailVerificationValue(verificationToken),verification.verification_token_hash)) {
      return res.status(400).json({status:"ERROR",message:"تحقق من بريدك الإلكتروني قبل إنشاء الحساب."});
    }

    const exists = await query(
      "SELECT customer_id FROM customers WHERE LOWER(email)=LOWER($1)",
      [email]
    );
    if (exists.rows[0]) {
      return res.status(409).json({
        status: "ERROR",
        message: "البريد الإلكتروني مستخدم بالفعل."
      });
    }

    const customerId = "CUS-" + crypto.randomUUID();
    const inserted = await query(
      "INSERT INTO customers(customer_id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING customer_number",
      [customerId, name, email, hashPassword(password)]
    );
    const customerNumber = inserted.rows[0].customer_number;
    await query("DELETE FROM customer_email_verifications WHERE email=$1",[email]);

    const token = crypto.randomBytes(32).toString("hex");
    await createCustomerSession(
      token,
      customerId,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    res.setHeader(
      "Set-Cookie",
      "nabd_customer_session=" + token +
      "; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000" +
      (process.env.NODE_ENV === "production" ? "; Secure" : "")
    );

    res.status(201).json({
      status: "OK",
      customer: { customer_id: String(customerNumber), customer_number: Number(customerNumber), name, email }
    });
  } catch (error) {
    console.error("Customer register error:", error);
    res.status(500).json({ status: "ERROR", message: "تعذر إنشاء الحساب." });
  }
});

app.post("/api/customer/login", async (req, res) => {
  const ip = clientIp(req);
  const attempt = customerLoginAttempts.get(ip) || { count: 0, blockedUntil: 0 };

  if (attempt.blockedUntil > Date.now()) {
    return res.status(429).json({
      status: "ERROR",
      message: "محاولات تسجيل الدخول كثيرة. حاول لاحقًا."
    });
  }

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const result = await query(
      "SELECT customer_id,customer_number,name,email,password_hash,active FROM customers WHERE LOWER(email)=LOWER($1)",
      [email]
    );
    const customer = result.rows[0];

    if (!customer || !customer.active || !verifyPassword(password, customer.password_hash)) {
      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.count = 0;
        attempt.blockedUntil = Date.now() + 15 * 60 * 1000;
      }
      customerLoginAttempts.set(ip, attempt);
      return res.status(401).json({
        status: "ERROR",
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة."
      });
    }

    customerLoginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    await createCustomerSession(
      token,
      customer.customer_id,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    res.setHeader(
      "Set-Cookie",
      "nabd_customer_session=" + token +
      "; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000" +
      (process.env.NODE_ENV === "production" ? "; Secure" : "")
    );

    res.json({
      status: "OK",
      customer: {
        customer_id: String(customer.customer_number),
        customer_number: Number(customer.customer_number),
        name: customer.name,
        email: customer.email
      }
    });
  } catch (error) {
    console.error("Customer login error:", error);
    res.status(500).json({ status: "ERROR", message: "تعذر تسجيل الدخول." });
  }
});

app.get("/api/customer/countries", (req, res) => {
  const countries = getCountries().map(country => ({
    country,
    calling_code: "+" + getCountryCallingCode(country),
    flag: country.replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397))
  }));
  countries.sort((a, b) => a.calling_code.localeCompare(b.calling_code) || a.country.localeCompare(b.country));
  res.json({ status: "OK", countries });
});

app.get("/api/customer/phone-country", requireCustomer, (req, res) => {
  const phoneData = parseCustomerPhone(req.query?.phone);
  if (!phoneData) return res.status(400).json({ status: "ERROR", message: "رقم الهاتف غير صحيح." });
  res.json({ status: "OK", country: phoneData.country });
});

app.put("/api/customer/profile", requireCustomer, async (req, res) => {
  const phoneData = parseCustomerPhone(req.body?.phone);
  if (!phoneData) {
    return res.status(400).json({ status: "ERROR", message: "رقم الهاتف غير صحيح. استخدم الرقم بصيغة دولية مثل +963..." });
  }
  const name = String(req.body?.name || "").trim();
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ status: "ERROR", message: "الاسم غير صالح." });
  }
  const result = await query(
    "UPDATE customers SET name=$1,phone=$2,phone_country=$3,updated_at=NOW() WHERE customer_id=$4 RETURNING customer_id,customer_number,name,email,phone,phone_country,balance,orders_count,discount,created_at",
    [name, phoneData.phone, phoneData.country, req.customer.customer_id]
  );
  if (!result.rows[0]) return res.status(404).json({ status: "ERROR", message: "الحساب غير موجود." });
  const customer = result.rows[0];
  const parsedPhone = parseCustomerPhone(customer.phone);
  customer.phone_country_code = parsedPhone?.country_code || "";
  customer.customer_id = String(customer.customer_number);
  customer.customer_number = Number(customer.customer_number);
  customer.profile_complete = true;
  res.json({ status: "OK", customer });
});

app.put("/api/customer/avatar", requireCustomer, async (req, res) => {
  try {
    const avatar = String(req.body?.avatar_url || "").trim();
    if (!avatar) return res.status(400).json({ status: "ERROR", message: "اختر صورة أولًا." });
    if (avatar.length > 500000) return res.status(413).json({ status: "ERROR", message: "حجم الصورة كبير جدًا." });
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(avatar)) {
      return res.status(400).json({ status: "ERROR", message: "صيغة الصورة غير مدعومة." });
    }
    const base64 = avatar.slice(avatar.indexOf(",") + 1);
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > 350000) {
      return res.status(413).json({ status: "ERROR", message: "حجم الصورة كبير جدًا." });
    }
    const result = await query(
      "UPDATE customers SET avatar_url=$1,updated_at=NOW() WHERE customer_id=$2 RETURNING customer_id,customer_number,name,email,phone,phone_country,avatar_url,balance,orders_count,discount,created_at",
      [avatar, req.customer.customer_id]
    );
    if (!result.rows[0]) return res.status(404).json({ status: "ERROR", message: "الحساب غير موجود." });
    const customer = result.rows[0];
    const parsedPhone = parseCustomerPhone(customer.phone);
    customer.phone_country_code = parsedPhone?.country_code || "";
    customer.customer_id = String(customer.customer_number);
    customer.customer_number = Number(customer.customer_number);
    res.json({ status: "OK", customer });
  } catch (error) {
    console.error("Customer avatar error:", error);
    res.status(500).json({ status: "ERROR", message: "تعذر حفظ الصورة الشخصية." });
  }
});

app.delete("/api/customer/avatar", requireCustomer, async (req, res) => {
  try {
    const result = await query(
      "UPDATE customers SET avatar_url=NULL,updated_at=NOW() WHERE customer_id=$1 RETURNING customer_id,customer_number,name,email,phone,phone_country,avatar_url,balance,orders_count,discount,created_at",
      [req.customer.customer_id]
    );
    if (!result.rows[0]) return res.status(404).json({ status: "ERROR", message: "الحساب غير موجود." });
    const customer = result.rows[0];
    customer.customer_id = String(customer.customer_number);
    customer.customer_number = Number(customer.customer_number);
    res.json({ status: "OK", customer });
  } catch (error) {
    console.error("Customer avatar delete error:", error);
    res.status(500).json({ status: "ERROR", message: "تعذر حذف الصورة الشخصية." });
  }
});

app.get("/api/customer/auth/me", requireCustomer, async (req, res) => {
  const result = await query(
    "SELECT customer_id,customer_number,name,email,phone,phone_country,avatar_url,balance,orders_count,discount,created_at FROM customers WHERE customer_id=$1",
    [req.customer.customer_id]
  );
  if (!result.rows[0]) {
    return res.status(401).json({ status: "ERROR", message: "الحساب غير موجود." });
  }
  const customer = result.rows[0];
  const parsedPhone = parseCustomerPhone(customer.phone);
  customer.phone_country_code = parsedPhone?.country_code || "";
  customer.customer_id = String(customer.customer_number);
  customer.customer_number = Number(customer.customer_number);
  res.json({ status: "OK", customer });
});

app.get("/api/customer/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(503).send("تسجيل الدخول عبر Google غير مهيأ بعد.");
  const state = crypto.randomBytes(32).toString("hex");
  googleOAuthStates.set(state, Date.now() + 10 * 60 * 1000);
  res.setHeader("Set-Cookie", "nabd_google_oauth_state=" + state + "; HttpOnly; Path=/api/customer/google; SameSite=Lax; Max-Age=600" + (COOKIE_SECURE ? "; Secure" : ""));
  const redirectUri = googleRedirectUri();
  const params = new URLSearchParams({client_id:GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:"code",scope:"openid email profile",state,access_type:"online",prompt:"select_account"});
  res.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
});

app.get("/api/customer/google/callback", async (req, res) => {
  const state = String(req.query.state || "");
  const expires = googleOAuthStates.get(state);
  const stateCookie = cookieValue(req, "nabd_google_oauth_state");
  googleOAuthStates.delete(state);
  res.setHeader("Set-Cookie", "nabd_google_oauth_state=; HttpOnly; Path=/api/customer/google; SameSite=Lax; Max-Age=0" + (COOKIE_SECURE ? "; Secure" : ""));
  if (!expires || expires < Date.now() || !stateCookie || !safeEqual(state, stateCookie) || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(400).send("جلسة Google غير صالحة أو تسجيل الدخول غير مهيأ.");
  try {
    const redirectUri = googleRedirectUri();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code:String(req.query.code||""),client_id:GOOGLE_CLIENT_ID,client_secret:GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:"authorization_code"})});
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error("تعذر الحصول على رمز Google.");
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+tokens.access_token}});
    const googleUser = await userResponse.json();
    if (!userResponse.ok || !googleUser.email) throw new Error("تعذر قراءة حساب Google.");
    const email = String(googleUser.email).trim().toLowerCase();
    let result = await query("SELECT customer_id,customer_number,name,email,active FROM customers WHERE LOWER(email)=LOWER($1)",[email]);
    let customer = result.rows[0];
    if (customer && !customer.active) return res.status(403).send("هذا الحساب غير فعال.");
    if (!customer) {
      const internalId = "CUS-" + crypto.randomUUID();
      result = await query("INSERT INTO customers(customer_id,name,email,password_hash) VALUES($1,$2,$3,NULL) RETURNING customer_id,customer_number,name,email,active",[internalId,String(googleUser.name||"عميل").slice(0,80),email]);
      customer = result.rows[0];
    }
    const token = crypto.randomBytes(32).toString("hex");
    await createCustomerSession(token, customer.customer_id, new Date(Date.now()+30*24*60*60*1000));
    res.setHeader("Set-Cookie","nabd_customer_session="+token+"; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000"+(COOKIE_SECURE?"; Secure":""));
    res.redirect("/customer-profile.html");
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).send("تعذر تسجيل الدخول عبر Google.");
  }
});

app.post("/api/customer/logout", requireCustomer, async (req, res) => {
  await deleteCustomerSession(req.customerSessionToken);
  res.setHeader(
    "Set-Cookie",
    "nabd_customer_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" +
    (process.env.NODE_ENV === "production" ? "; Secure" : "")
  );
  res.json({ status: "OK" });
});

app.get("/api/customer/orders", requireCustomer, async (req, res) => {
  try {
    const result = await query(
      "SELECT id,order_id,product_id,product_name,api_price,price,discount,status,order_params,nemer_response,created_at FROM orders WHERE customer_id=$1 ORDER BY created_at DESC",
      [req.customer.customer_id]
    );
    res.json({ status: "OK", orders: result.rows });
  } catch (error) {
    console.error("Customer orders error:", error);
    res.status(500).json({ status: "ERROR", message: "تعذر تحميل طلباتك." });
  }
});

/* =========================
   ADMIN API
========================= */

app.use("/api/admin", requireAdmin);

app.get("/api/admin/dashboard", async (req, res) => {
  try {
    const [profileResult, statsResult, recentResult] = await Promise.allSettled([
      getNemerProfile(),
      query(`
        SELECT
          (SELECT COUNT(*) FROM customers) AS customers,
          (SELECT COUNT(*) FROM orders) AS orders,
          (SELECT COUNT(*) FROM orders
            WHERE LOWER(COALESCE(status,'')) IN ('failed','rejected','cancelled','canceled','error')
          ) AS failed_orders,
          COALESCE((
            SELECT SUM(price) FROM orders
            WHERE LOWER(COALESCE(status,'')) IN ('success','successful','completed','complete','done','delivered','ok')
          ),0) AS sales,
          COALESCE((
            SELECT SUM(profit) FROM orders
            WHERE LOWER(COALESCE(status,'')) IN ('success','successful','completed','complete','done','delivered','ok')
          ),0) AS profit
      `),
      query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 8")
    ]);

    if (statsResult.status === "rejected") {
      console.error("Admin dashboard database error:", statsResult.reason);
      return res.status(503).json({
        status: "ERROR",
        code: "DATABASE_UNAVAILABLE",
        message: "تعذر الاتصال بقاعدة بيانات المتجر."
      });
    }

    let apiBalance = null;
    if (profileResult.status === "fulfilled") {
      const profile = profileResult.value;
      const rawBalance =
        profile?.balance ??
        profile?.data?.balance ??
        profile?.data?.data?.balance ??
        profile?.wallet?.balance ??
        profile?.data?.wallet?.balance ??
        null;
      const parsedBalance = Number(rawBalance);
      if (Number.isFinite(parsedBalance)) apiBalance = parsedBalance;
    } else {
      console.error("Admin Nemer profile error:", profileResult.reason?.message || profileResult.reason);
    }

    try {
      await loadSettings();
    } catch (settingsError) {
      console.error("Admin settings database error:", settingsError);
      return res.status(503).json({
        status: "ERROR",
        code: "DATABASE_UNAVAILABLE",
        message: "تعذر تحميل إعدادات لوحة الإدارة من قاعدة البيانات."
      });
    }

    const row = statsResult.value.rows[0] || {};
    const recent = recentResult.status === "fulfilled" ? recentResult.value.rows : [];

    res.json({
      status: "OK",
      total_customers: Number(row.customers || 0),
      total_orders: Number(row.orders || 0),
      failed_orders: Number(row.failed_orders || 0),
      total_sales: Number(Number(row.sales || 0).toFixed(12)),
      total_profit: Number(Number(row.profit || 0).toFixed(12)),
      api_balance: apiBalance,
      api_balance_available: apiBalance !== null,
      recent_orders: recent,
      settings: adminSettings
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({
      status: "ERROR",
      code: "ADMIN_DASHBOARD_ERROR",
      message: "تعذر تحميل لوحة الإدارة."
    });
  }
});

app.get("/api/admin/customers", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const result = search
    ? await query(
        "SELECT customer_id,customer_number,name,email,phone,phone_country,avatar_url,balance,orders_count,discount,active,created_at,updated_at FROM customers WHERE customer_id ILIKE $1 OR name ILIKE $1 OR email ILIKE $1 OR CAST(customer_number AS TEXT) ILIKE $1 ORDER BY created_at DESC",
        [`%${search}%`]
      )
    : await query(
        "SELECT customer_id,customer_number,name,email,phone,phone_country,avatar_url,balance,orders_count,discount,active,created_at,updated_at FROM customers ORDER BY created_at DESC"
      );
  res.json({ status: "OK", customers: result.rows });
});

app.get("/api/admin/customers/:id", async (req, res) => {
  const result = await query(
    "SELECT customer_id,customer_number,name,email,phone,phone_country,avatar_url,balance,orders_count,discount,active,created_at,updated_at FROM customers WHERE customer_id=$1",
    [String(req.params.id)]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ status: "ERROR", message: "العميل غير موجود." });
  }
  res.json({ status: "OK", customer: result.rows[0] });
});

app.put("/api/admin/customers/:id/discount", async (req, res) => {
  const discount = Number(req.body?.discount);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    return res.status(400).json({
      status: "ERROR",
      message: "الخصم يجب أن يكون بين 0 و100."
    });
  }
  const result = await query(
    "UPDATE customers SET discount=$1,updated_at=NOW() WHERE customer_id=$2 RETURNING customer_id,name,email,balance,orders_count,discount,active,created_at,updated_at",
    [discount, String(req.params.id)]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ status: "ERROR", message: "العميل غير موجود." });
  }
  res.json({ status: "OK", customer: result.rows[0] });
});

app.get("/api/admin/orders", async (req, res) => {
  const result = await query(
    "SELECT o.*, c.name AS customer_name, c.customer_number FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id ORDER BY o.created_at DESC"
  );
  const summary = await query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status,'')) IN ('failed','rejected','cancelled','canceled','error')
      ) AS failed
    FROM orders
  `);
  res.json({
    status: "OK",
    orders: result.rows,
    order_summary: {
      total: Number(summary.rows[0]?.total || 0),
      failed: Number(summary.rows[0]?.failed || 0)