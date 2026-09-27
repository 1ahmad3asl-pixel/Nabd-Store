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
const STORE_NAME = process.env.STORE_NAME || "Nabd-Store";
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_SESSION_SECRET = String(
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString("hex")
);

const adminSettings = {
  profit_rate: PROFIT_RATE,
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
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "https://nabd-store-1.onrender.com").replace(/\/$/, "");
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || "").trim();

app.use(express.json({ limit: "1mb" }));

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

function clientIp(req) {
  return String(req.ip || req.socket.remoteAddress || "").trim();
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
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

/* =========================
   CUSTOMER AUTH
========================= */

app.post("/api/customer/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

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
  const result = await query(
    "SELECT id,order_id,product_id,product_name,price,discount,status,created_at FROM orders WHERE customer_id=$1 ORDER BY created_at DESC",
    [req.customer.customer_id]
  );
  res.json({ status: "OK", orders: result.rows });
});

/* =========================
   ADMIN API
========================= */

app.use("/api/admin", requireAdmin);

app.get("/api/admin/dashboard", async (req, res) => {
  let apiBalance = 0;
  try {
    const profile = await getNemerProfile();
    apiBalance = Number(
      profile?.balance ?? profile?.data?.balance ?? profile?.wallet ?? 0
    );
  } catch (error) {
    console.error("Admin profile error:", error.message);
  }

  await loadSettings();
  const stats = await query(`
    SELECT
      (SELECT COUNT(*) FROM customers) AS customers,
      (SELECT COUNT(*) FROM orders) AS orders,
      COALESCE((SELECT SUM(price) FROM orders),0) AS sales,
      COALESCE((SELECT SUM(profit) FROM orders),0) AS profit
  `);
  const recent = await query(
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 8"
  );
  const row = stats.rows[0];

  res.json({
    status: "OK",
    total_customers: Number(row.customers),
    total_orders: Number(row.orders),
    total_sales: Number(Number(row.sales).toFixed(12)),
    total_profit: Number(Number(row.profit).toFixed(12)),
    api_balance: Number(apiBalance.toFixed(12)),
    recent_orders: recent.rows,
    settings: adminSettings
  });
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
  const result = await query("SELECT * FROM orders ORDER BY created_at DESC");
  res.json({ status: "OK", orders: result.rows });
});

app.get("/api/admin/products", async (req, res) => {
  try {
    await loadSettings();
    const products = await getNemerProducts();
    const result = Array.isArray(products)
      ? products.map(product => {
          const apiPrice = normalizeNemerPrice(product.price);
          const salePrice = apiPrice === null
            ? null
            : ceilPrice(
                apiPrice * (1 + Number(adminSettings.profit_rate || 0) / 100),
                getPriceDecimalPlaces(product.price)
              );
          return {
            ...product,
            api_price: apiPrice,
            price: salePrice,
            category: product.category_name || ""
          };
        })
      : [];
    res.json({ status: "OK", products: result });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "تعذر تحميل المنتجات."
    });
  }
});

app.get("/api/store-settings", async (req, res) => {
  await loadSettings();
  res.json({ status: "OK", dhikr_items: adminSettings.dhikr_items });
});

app.get("/api/admin/settings", async (req, res) => {
  await loadSettings();
  res.json({ status: "OK", settings: adminSettings });
});

app.put("/api/admin/settings", async (req, res) => {
  if (req.body?.profit_rate !== undefined) {
    const profit = Number(req.body.profit_rate);
    if (!Number.isFinite(profit) || profit < 0 || profit > 100) {
      return res.status(400).json({ status: "ERROR", message: "نسبة الربح يجب أن تكون بين 0 و100." });
    }
    adminSettings.profit_rate = profit;
    await setSetting("profit_rate", profit);
  }

  if (req.body?.store_name !== undefined) {
    const storeName = String(req.body.store_name).trim();
    if (storeName.length > 80) return res.status(400).json({ status: "ERROR", message: "اسم المتجر طويل جدًا." });
    adminSettings.store_name = storeName || STORE_NAME;
    await setSetting("store_name", adminSettings.store_name);
  }

  if (req.body?.currency !== undefined) {
    const currency = String(req.body.currency).trim().toUpperCase();
    if (!["USD","EUR","TRY","SAR","AED"].includes(currency)) {
      return res.status(400).json({ status: "ERROR", message: "العملة المحددة غير مدعومة." });
    }
    adminSettings.currency = currency;
    await setSetting("currency", adminSettings.currency);
  }

  if (req.body?.currency_decimals !== undefined) {
    const decimals = Number(req.body.currency_decimals);
    if (![2,3].includes(decimals)) {
      return res.status(400).json({ status: "ERROR", message: "عدد الخانات العشرية يجب أن يكون 2 أو 3." });
    }
    adminSettings.currency_decimals = decimals;
    await setSetting("currency_decimals", decimals);
  }

  if (req.body?.font_family !== undefined) {
    const font = String(req.body.font_family).trim();
    if (!["Dubai Medium","Tahoma","Arial"].includes(font)) {
      return res.status(400).json({ status: "ERROR", message: "الخط المحدد غير مدعوم." });
    }
    adminSettings.font_family = font;
    await setSetting("font_family", font);
  }

  if (req.body?.dhikr_items !== undefined) {
    if (!Array.isArray(req.body.dhikr_items)) {
      return res.status(400).json({ status: "ERROR", message: "قائمة الأذكار غير صالحة." });
    }
    const items = req.body.dhikr_items
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 12);
    if (!items.length || items.some(item => item.length > 80)) {
      return res.status(400).json({ status: "ERROR", message: "أدخل ذكرًا واحدًا على الأقل، وبحد أقصى 80 حرفًا لكل ذكر." });
    }
    adminSettings.dhikr_items = items;
    await setSetting("dhikr_items", JSON.stringify(items));
  }

  res.json({ status: "OK", settings: adminSettings });
});

app.get("/api/admin/transactions", async (req, res) => {
  const result = await query(
    `SELECT t.*, c.customer_number, c.name AS customer_name
     FROM transactions t
     LEFT JOIN customers c ON c.customer_id=t.customer_id
     ORDER BY t.created_at DESC
     LIMIT 500`
  );
  const totals = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN type='purchase' THEN amount ELSE 0 END),0) AS sales,
       COALESCE(SUM(CASE WHEN type IN ('admin_credit','refund') THEN amount ELSE 0 END),0) AS customer_outflows,
       COALESCE(SUM(CASE WHEN type='admin_debit' THEN amount ELSE 0 END),0) AS admin_inflows,
       COALESCE(SUM(amount),0) AS net_cash,
       COALESCE((SELECT SUM(profit) FROM orders WHERE status NOT IN ('failed','rejected','cancelled','canceled','error')),0) AS net_profit
     FROM transactions`
  );
  res.json({
    status: "OK",
    transactions: result.rows,
    budget: {
      sales: Number(Number(totals.rows[0].sales).toFixed(12)),
      customer_outflows: Number(Number(totals.rows[0].customer_outflows).toFixed(12)),
      admin_inflows: Number(Number(totals.rows[0].admin_inflows).toFixed(12)),
      net_cash: Number(Number(totals.rows[0].net_cash).toFixed(12)),
      net_profit: Number(Number(totals.rows[0].net_profit).toFixed(12))
    }
  });
});

app.get("/api/admin/customers/:id/wallet", async (req, res) => {
  const result = await query(
    `SELECT c.customer_id,c.customer_number,c.name,c.email,c.balance,
            COALESCE(json_agg(t ORDER BY t.created_at DESC) FILTER (WHERE t.id IS NOT NULL),'[]') AS transactions
     FROM customers c
     LEFT JOIN LATERAL (
       SELECT id,amount,type,balance_before,balance_after,reference_type,reference_id,note,created_at
       FROM transactions
       WHERE customer_id=c.customer_id
       ORDER BY created_at DESC
     ) t ON TRUE
     WHERE c.customer_id=$1
     GROUP BY c.customer_id,c.customer_number,c.name,c.email,c.balance`,
    [String(req.params.id)]
  );
  if (!result.rows[0]) {
    return res.status(404).json({status:"ERROR",message:"العميل غير موجود."});
  }
  res.json({status:"OK",wallet:result.rows[0]});
});

app.post("/api/admin/customers/:id/wallet", async (req, res) => {
  const action = String(req.body?.action || "").trim().toLowerCase();
  const amount = Number(req.body?.amount);
  const note = String(req.body?.note || "").trim().slice(0,500);

  if (!["credit","debit"].includes(action)) {
    return res.status(400).json({status:"ERROR",message:"نوع العملية غير صالح."});
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return res.status(400).json({status:"ERROR",message:"المبلغ يجب أن يكون أكبر من صفر."});
  }

  try {
    const result = await withTransaction(async (client) => {
      const customerResult = await client.query(
        "SELECT customer_id,customer_number,name,balance FROM customers WHERE customer_id=$1 FOR UPDATE",
        [String(req.params.id)]
      );
      const customer = customerResult.rows[0];
      if (!customer) {
        const error = new Error("العميل غير موجود.");
        error.statusCode = 404;
        throw error;
      }

      const before = Number(customer.balance || 0);
      const delta = action === "credit" ? amount : -amount;
      const after = before + delta;

      if (after < 0) {
        const error = new Error("لا يمكن خصم مبلغ أكبر من رصيد العميل.");
        error.statusCode = 400;
        throw error;
      }

      await client.query(
        "UPDATE customers SET balance=$1,updated_at=NOW() WHERE customer_id=$2",
        [after.toFixed(12), customer.customer_id]
      );

      const transactionId = "TXN-" + crypto.randomUUID();
      const type = action === "credit" ? "admin_credit" : "admin_debit";
      await client.query(
        `INSERT INTO transactions
          (id,customer_id,amount,type,balance_before,balance_after,reference_type,reference_id,note)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [transactionId,customer.customer_id,delta.toFixed(12),type,before.toFixed(12),after.toFixed(12),"admin",transactionId,note || (action === "credit" ? "إضافة رصيد من الإدارة" : "خصم رصيد من الإدارة")]
      );

      return {customer_id:String(customer.customer_number),customer_number:Number(customer.customer_number),name:customer.name,balance:after,transaction_id:transactionId};
    });

    res.json({status:"OK",wallet:result});
  } catch (error) {
    console.error("Admin wallet error:",error);
    res.status(error.statusCode || 500).json({status:"ERROR",message:error.message || "تعذر تعديل رصيد العميل."});
  }
});

app.post("/api/admin/email-broadcast", async (req, res) => {
  const subject = String(req.body?.subject || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!RESEND_API_KEY || !EMAIL_FROM) return res.status(503).json({status:"ERROR",message:"خدمة البريد غير مهيأة. أضف RESEND_API_KEY و EMAIL_FROM في إعدادات Render."});
  if (!subject || !message || subject.length > 150 || message.length > 10000) return res.status(400).json({status:"ERROR",message:"عنوان أو نص الرسالة غير صالح."});

  const result = await query("SELECT customer_id,name,email FROM customers WHERE email IS NOT NULL AND TRIM(email) <> '' ORDER BY customer_id");
  const recipients = [];
  let skipped = 0;
  for (const row of result.rows) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { skipped++; continue; }
    recipients.push({email,name:String(row.name || "").trim()});
  }

  const escapeHtml = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const htmlMessage = escapeHtml(message).replace(/\r?\n/g,"<br>");
  let sent=0, failed=0;
  const failures=[];
  for (let i=0;i<recipients.length;i+=100) {
    const batch=recipients.slice(i,i+100).map(r=>({from:EMAIL_FROM,to:[r.email],subject,text:message,html:"<div dir=\"rtl\" style=\"font-family:Arial,sans-serif;line-height:1.8\">"+htmlMessage+"</div>"}));
    try {
      const response=await fetch("https://api.resend.com/emails/batch",{method:"POST",headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(batch)});
      if(!response.ok){let details={};try{details=await response.json();}catch{};failed+=batch.length;failures.push(String(details.message||"فشل مزود البريد").slice(0,200));}
      else sent+=batch.length;
    } catch(error){failed+=batch.length;failures.push(String(error.message||"network error").slice(0,200));}
  }
  res.json({status:failed?"PARTIAL":"OK",sent,failed,skipped,total:recipients.length,failures:failures.slice(0,5)});
});

app.post("/api/admin/notifications", async (req, res) => {
  const { target, customer_id, title, message } = req.body || {};
  const normalizedTarget = String(target || "all").trim().toLowerCase();
  const cleanTitle = String(title || "").trim();
  const cleanMessage = String(message || "").trim();

  if (!["all","customer"].includes(normalizedTarget)) {
    return res.status(400).json({ status: "ERROR", message: "نوع الإشعار غير صالح." });
  }
  if (!cleanTitle || !cleanMessage || cleanTitle.length > 120 || cleanMessage.length > 2000) {
    return res.status(400).json({ status: "ERROR", message: "عنوان أو نص الإشعار غير صالح." });
  }

  let customerId = null;
  if (normalizedTarget === "customer") {
    customerId = String(customer_id || "").trim();
    if (!customerId || customerId.length > 100) {
      return res.status(400).json({ status: "ERROR", message: "معرّف العميل غير صالح." });
    }
    const customerExists = await query("SELECT 1 FROM customers WHERE customer_id=$1 OR CAST(customer_number AS TEXT)=$1 LIMIT 1", [customerId]);
    if (!customerExists.rows[0]) {
      return res.status(404).json({ status: "ERROR", message: "العميل غير موجود." });
    }
  }

  const result = await query(
    "INSERT INTO notifications(target,customer_id,title,message) VALUES($1,$2,$3,$4) RETURNING *",
    [normalizedTarget, customerId, cleanTitle, cleanMessage]
  );
  res.json({ status: "OK", notification: result.rows[0] });
});

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

function ceilPrice(value, decimals) {
  const amount = Number(value);
  const places = Number.isInteger(decimals) ? Math.max(0, Math.min(12, decimals)) : 3;
  if (!Number.isFinite(amount)) return null;
  const factor = 10 ** places;
  const scaled = amount * factor;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return Math.ceil(scaled - epsilon) / factor;
}

async function ensureOfficialGameImage(gameKey, appId, label) {
  const existing = await query("SELECT game_key FROM game_images WHERE game_key=$1", [gameKey]);
  if (existing.rows.length) return;
  try {
    const pageUrl = "https://play.google.com/store/apps/details?id=" + appId + "&hl=en&gl=US";
    const requestHeaders = {"Accept":"text/html,application/xhtml+xml","User-Agent":"Mozilla/5.0 (compatible; Nabd-Store official game icon fetcher)"};
    let pageResponse = await fetch(pageUrl, {headers: requestHeaders});
    if (!pageResponse.ok) {
      // بعض الألعاب تكون متاحة على Google Play في مناطق معينة فقط؛
      // جرّب صيغ Google Play الشائعة قبل اعتبار الصورة غير متاحة.
      const fallbackUrls = [
        "https://play.google.com/store/apps/details?id=" + appId + "&hl=en",
        "https://play.google.com/store/apps/details?id=" + appId + "&hl=en_US",
        "https://play.google.com/store/apps/details?id=" + appId + "&hl=en_GB",
        "https://play.google.com/store/apps/details?id=" + appId + "&hl=en&gl=VN",
        "https://play.google.com/store/apps/details?id=" + appId + "&hl=en&gl=SG"
      ];
      for (const fallbackUrl of fallbackUrls) {
        pageResponse = await fetch(fallbackUrl, {headers: requestHeaders});
        if (pageResponse.ok) break;
      }
    }
    if (!pageResponse.ok) throw new Error("Google Play returned " + pageResponse.status);
    const html = await pageResponse.text();
    const metaRe = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
    let imageUrl = "", match;
    while ((match = metaRe.exec(html))) {
      if (String(match[1]).toLowerCase() === "og:image") {
        imageUrl = match[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"');
        break;
      }
    }
    if (!imageUrl) throw new Error("Official Google Play icon URL not found");
    const imageResponse = await fetch(imageUrl, {headers: {"User-Agent":"Mozilla/5.0 (compatible; Nabd-Store official game icon fetcher)"}});
    if (!imageResponse.ok) throw new Error("Official image returned " + imageResponse.status);
    const mimeType = String(imageResponse.headers.get("content-type") || "image/png").split(";")[0];
    if (!mimeType.startsWith("image/")) throw new Error("Invalid official image type");
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    if (imageBuffer.length < 1000 || imageBuffer.length > 5 * 1024 * 1024) throw new Error("Official image size is invalid");
    await query(
      "INSERT INTO game_images(game_key, app_id, image_data, mime_type, source_url) VALUES($1,$2,$3,$4,$5) ON CONFLICT(game_key) DO UPDATE SET app_id=EXCLUDED.app_id, image_data=EXCLUDED.image_data, mime_type=EXCLUDED.mime_type, source_url=EXCLUDED.source_url, updated_at=NOW()",
      [gameKey, appId, imageBuffer, mimeType, imageUrl]
    );
    console.log("Official " + label + " image saved to database.");
  } catch (error) {
    console.warn("Official " + label + " image sync skipped:", error.message);
  }
}

async function ensurePubgOfficialImage() {
  return ensureOfficialGameImage("pubg-mobile", "com.tencent.ig", "PUBG Mobile");
}

async function ensureRobloxOfficialImage() {
  return ensureOfficialGameImage("roblox", "com.roblox.client", "Roblox");
}

async function ensureJawakerOfficialImage() {
  return ensureOfficialGameImage("jawaker", "com.boundless.jawaker", "Jawaker");
}
async function ensureFreeFireOfficialImage() {
  return ensureOfficialGameImage("free-fire", "com.dts.freefireth", "Free Fire");
}
async function ensureClashOfClansOfficialImage() {
  return ensureOfficialGameImage("clash-of-clans", "com.supercell.clashofclans", "Clash of Clans");
}
async function ensureDragonheirOfficialImage() {
  return ensureOfficialGameImage("dragonheir-silent-gods", "com.sgra.dragon", "Dragonheir: Silent Gods");
}
async function ensureCloudSongOfficialImage() {
  return ensureOfficialGameImage("cloud-song", "vng.game.sky.fantasy.song.sea", "Cloud Song: Saga of Skywalkers");
}
async function ensureYallaLudoOfficialImage() {
  return ensureOfficialGameImage("yalla-ludo", "com.yalla.yallagames", "Yalla Ludo");
}
async function ensureLordsMobileOfficialImage() {
  return ensureOfficialGameImage("lords-mobile", "com.igg.android.lordsmobile", "Lords Mobile");
}
async function ensureEightBallPoolOfficialImage() {
  return ensureOfficialGameImage("8-ball-pool", "com.miniclip.eightballpool", "8 Ball Pool");
}
async function ensureGunsOfGloryOfficialImage() {
  return ensureOfficialGameImage("guns-of-glory", "com.diandian.gog", "Guns of Glory");
}
async function ensureGangsOfGloryOfficialImage() {
  return ensureOfficialGameImage("gangs-of-glory", "com.sm.gog.hw.dygame", "Gangs of Glory");
}
async function ensureProjectEntropyOfficialImage() {
  return ensureOfficialGameImage("project-entropy", "com.entropy.global", "Project Entropy");
}
async function ensureFarlight84OfficialImage() {
  return ensureOfficialGameImage("farlight-84", "com.miraclegames.farlight84", "Farlight 84");
}
async function ensureCityOfCrimeGangWarOfficialImage() {
  return ensureOfficialGameImage("city-of-crime-gang-war", "com.fingerfun.coc.gplay", "City of Crime: Gang Wars");
}
async function ensureMarvelRivalsOfficialImage() {
  const gameKey = "marvel-rivals";
  const existing = await query("SELECT game_key FROM game_images WHERE game_key=$1", [gameKey]);
  if (existing.rows.length) return;
  try {
    const imageUrl = "https://www.marvelrivals.com/pc/gw/20241203010721/img/home_284984eb.jpg";
    const imageResponse = await fetch(imageUrl, {headers: {"User-Agent":"Mozilla/5.0 (compatible; Nabd-Store official game image fetcher)"}});
    if (!imageResponse.ok) throw new Error("Official Marvel Rivals image returned " + imageResponse.status);
    const mimeType = String(imageResponse.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!mimeType.startsWith("image/")) throw new Error("Invalid official image type");
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    if (imageBuffer.length < 1000 || imageBuffer.length > 5 * 1024 * 1024) throw new Error("Official image size is invalid");
    await query(
      "INSERT INTO game_images(game_key, app_id, image_data, mime_type, source_url) VALUES($1,$2,$3,$4,$5) ON CONFLICT(game_key) DO UPDATE SET app_id=EXCLUDED.app_id, image_data=EXCLUDED.image_data, mime_type=EXCLUDED.mime_type, source_url=EXCLUDED.source_url, updated_at=NOW()",
      [gameKey, "marvel-rivals-official", imageBuffer, mimeType, imageUrl]
    );
    console.log("Official Marvel Rivals image saved to database.");
  } catch (error) {
    console.warn("Official Marvel Rivals image sync skipped:", error.message);
  }
}

/* =========================
   PUBLIC STORE
========================= */

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", store: STORE_NAME, server: "online" });
});

app.get("/api/store", (req, res) => {
  res.json({
    name: adminSettings.store_name,
    currency: adminSettings.currency,
    profit_rate: Number(adminSettings.profit_rate)
  });
});

app.get("/api/game-images/:gameKey", async (req, res) => {
  try {
    const key = String(req.params.gameKey || "").trim().toLowerCase();
    const imageMap = {
      "pubg-mobile": ["com.tencent.ig", "PUBG Mobile"],
      "roblox": ["com.roblox.client", "Roblox"],
      "jawaker": ["com.boundless.jawaker", "Jawaker"],
      "free-fire": ["com.dts.freefireth", "Free Fire"],
      "clash-of-clans": ["com.supercell.clashofclans", "Clash of Clans"],
      "dragonheir-silent-gods": ["com.sgra.dragon", "Dragonheir: Silent Gods"],
      "cloud-song": ["vng.game.sky.fantasy.song.sea", "Cloud Song: Saga of Skywalkers"],
      "yalla-ludo": ["com.yalla.yallagames", "Yalla Ludo"],
      "lords-mobile": ["com.igg.android.lordsmobile", "Lords Mobile"],
      "8-ball-pool": ["com.miniclip.eightballpool", "8 Ball Pool"],
      "guns-of-glory": ["com.diandian.gog", "Guns of Glory"],
      "gangs-of-glory": ["com.sm.gog.hw.dygame", "Gangs of Glory"],
      "project-entropy": ["com.entropy.global", "Project Entropy"],
      "farlight-84": ["com.miraclegames.farlight84", "Farlight 84"],
      "marvel-rivals": ["marvel-rivals-official", "Marvel Rivals"],
      "city-of-crime-gang-war": ["com.fingerfun.coc.gplay", "City of Crime: Gang Wars"],
      "genshin-impact": ["com.miHoYo.GenshinImpact", "Genshin Impact"],
      "super-sus": ["com.je.supersus", "Super Sus"],
      "crystal-of-atlan": ["com.hermes.p6gameos", "Crystal of Atlan"],
      "bullet-echo": ["com.zeptolab.bulletecho.google", "Bullet Echo"],
      "stumble-guys": ["com.kitkagames.fallbuddies", "Stumble Guys"],
      "honkai-star-rail": ["com.HoYoverse.hkrpgoversea", "Honkai: Star Rail"],
      "oxide-survival-island": ["com.catsbit.oxidesurvivalisland", "Oxide: Survival Island"],
      "mobile-legends": ["com.mobile.legends", "Mobile Legends: Bang Bang"],
      "whiteout-survival": ["com.gof.global", "Whiteout Survival"],
      "blood-strike": ["com.netease.newspike", "Blood Strike"],
      "acecraft": ["com.vizta.wefly", "ACECRAFT"],
      "age-of-magic": ["com.playkot.ageofmagic", "Age of Magic"],
      "ghost-story-love-destiny": ["com.netease.wxzcglobal", "Ghost Story: Love Destiny"],
      "arena-breakout": ["com.proximabeta.mf.uamo", "Arena Breakout"],
      "ludo-club": ["com.moonfrog.ludo.club", "Ludo Club"],
      "afk-journey": ["com.farlightgames.igame.gp", "AFK Journey"],
      "ballistic-hero-vng": ["com.vnggames.ballistichero", "Ballistic Hero VNG"],
      "haikyu-fly-high": ["com.garena.game.haikyu", "Haikyu Fly High"],
      "arknights-endfield": ["com.hypergryph.endfield", "Arknights: Endfield"],
      "heaven-burns-red": ["com.heavenburnsred.global", "Heaven Burns Red"],
      "rise-of-kingdoms": ["com.lilithgame.roc.gp", "Rise of Kingdoms: Lost Crusade"],
      "top-war": ["com.Topwar.gp", "Top War: Battle Game"],
      "the-ants": ["com.allstarunion.ta", "The Ants: Underground Kingdom"],
      "kingdom-guard": ["com.tap4fun.odin.kingdomguard", "Kingdom Guard: Tower Defense"],
      "astral-guardians": ["com.eyougame.idxj", "Astral Guardians"],
      "cyber-fantasy": ["com.hkfancygame.kog.android", "Cyber Fantasy"],
      "blade-x": ["com.yjmgames.bladex.aos", "Blade X: Odyssey of Heroes"],
      "be-the-king": ["com.szckhd.jwgly.azyw", "Be The King: Judge Destiny"],
      "captain-tsubasa": ["com.dgames.g65002005.google", "CAPTAIN TSUBASA: ACE"],
      "idol-party": ["com.xipu.cwqmx.tg", "Idol Party"],
      "hyper-front": ["com.battlefun.c1game.na", "Hyper Front"],
      "infinite-lagrange": ["com.netease.lagrange", "Infinite Lagrange"],
      "life-makeover-global": ["com.archosaur.seareal.yslzm.gp", "Life Makeover"],
      "dragon-raja-sea": ["com.archosaur.sea.dr.gp", "Dragon Raja SEA"],
      "crossout-mobile": ["com.gaijin.xom", "Crossout Mobile"],
      "stormshot": ["com.funplus.ss", "Stormshot"],
      "onmyoji-arena": ["com.netease.g78na.gb", "Onmyoji Arena"],
      "my-singing-monsters": ["com.bigbluebubble.singingmonsters.full", "My Singing Monsters"],
      "eggy-party": ["com.netease.eggypartyen", "Eggy Party"],
      "devil-may-cry": ["com.nebulajoy.act.dmcpoc", "Devil May Cry: Peak of Combat"],
      "hero-clash": ["com.xgame.eu.gp", "Hero Clash"],
      "division-resurgence": ["com.ubisoft.the.division.mobile.combat.shooting.open.world.rpg", "The Division Resurgence"],
      "nikke": ["com.proximabeta.nikke", "GODDESS OF VICTORY: NIKKE"],
      "age-of-empires-mobile": ["com.proximabeta.aoemobile", "Age of Empires Mobile"],
      "call-of-dragons": ["com.farlightgames.samo.gp", "Call of Dragons"],
      "hatsune-miku-colorful-stage": ["com.sega.ColorfulStage.en", "Hatsune Miku: Colorful Stage"],
      "golden-spatula": ["com.tencent.tmgp.sgame", "Golden Spatula"],
      "blockman-go": ["com.sandboxol.blockymods", "Blockman Go"],
      "growtopia": ["com.rtsoft.growtopia", "Growtopia"],
      "arena-of-valor": ["com.ngame.allstar.eu", "Arena of Valor"],
      "zepeto": ["com.naver.zepeto", "ZEPETO"],
      "king-shot": ["com.fingerfun.kingshot", "King Shot"],
      "clash-of-plants": ["com.waterwish.garden.tales.clash.of.plants", "Garden Tales: Clash of Plants"],
      "journey-renewed": ["com.xiyou.cyhk.gp", "Journey Renewed: Fate Fantasy"],
      "civilization-eras-allies": ["com.t2k.prometheusroa", "Civilization: Eras & Allies"],
      "kuroko-street-rivals": ["com.lmdgame.kuroko.sea", "Kuroko's Basketball: Street Rivals"],
      "cloud-song": ["vng.game.sky.fantasy.song.sea", "Cloud Song: Saga of Skywalkers"],
      "kings-choice-sea": ["com.onemt.and.kc.sea", "King's Choice"],
      "crystalfall": ["com.igg.android.crystalfall", "CrystalFall"],
      "crossout-mobile": ["com.gaijin.xom", "Crossout Mobile"],
      "dragon-raja-sea": ["com.zloong.eu.dragonraja", "Dragon Raja"],
      "dragon-nest-m-sea": ["com.sdg.dragonnest", "Dragon Nest M"],
      "life-makeover-global": ["com.archosaur.sea.lifemakeover", "Life Makeover"],
      "love-nikki": ["com.elex.nikkigp", "Love Nikki-Dress UP Queen"],
      "dragonheir-silent-gods": ["com.s2a.dragonheir", "Dragonheir Lite"],
      "dream-and-lethe-record": ["com.kingsgroup.dreamandlethe", "Dream and Lethe Record"],
      "eggy-party": ["com.netease.partyglobal", "Eggy Party"],
      "echocalypse-scarlet-covenant": ["com.gaea.echocalypse.en", "Echocalypse: Scarlet Covenant"],
      "crossfire-legend": ["com.vnggames.cfl.crossfirelegends", "Crossfire: Legends"],
      "legend-of-the-phoenix": ["com.duige.hzw.multilingual", "Legend of the Phoenix"],
      "legacy-of-discord": ["com.gtarcade.lod", "Legacy of Discord-FuriousWings"],
      "army-dudes": ["com.netease.retrorampage", "Deadly Dudes"]
    };
    const config = imageMap[key];
    if (!config) return res.status(404).end();

    let result = await query("SELECT image_data, mime_type FROM game_images WHERE game_key=$1", [key]);
    if (!result.rows.length) {
      if (key === "marvel-rivals") {
        await ensureMarvelRivalsOfficialImage();
      } else {
        await ensureOfficialGameImage(key, config[0], config[1]);
      }
      result = await query("SELECT image_data, mime_type FROM game_images WHERE game_key=$1", [key]);
    }

    if (!result.rows.length) return res.status(404).end();
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    res.type(result.rows[0].mime_type);
    res.send(result.rows[0].image_data);
  } catch (error) {
    console.error("Game image error:", error);
    res.status(500).end();
  }
});

app.get("/api/products", async (req, res) => {
  try {
    await loadSettings();
    const products = await getNemerProducts();
    const pricedCount = Array.isArray(products)
      ? products.filter(product => normalizeNemerPrice(product.price) !== null).length
      : 0;
    console.info("Nemer products sync:", JSON.stringify({
      total: Array.isArray(products) ? products.length : 0,
      priced: pricedCount,
      missing_price: Math.max(0, (Array.isArray(products) ? products.length : 0) - pricedCount)
    }));
    const result = Array.isArray(products)
      ? products.map(product => {
          const originalPrice = normalizeNemerPrice(product.price);
          const sellingPrice = originalPrice === null
            ? null
            : ceilPrice(
                originalPrice * (1 + Number(adminSettings.profit_rate || 0) / 100),
                getPriceDecimalPlaces(product.price)
              );
          return {
            id: product.id,
            product_id: product.product_id,
            name: product.name,
            price: sellingPrice,
            original_price: originalPrice,
            available: product.available,
            category_name: product.category_name || "",
            category_img: product.category_img || "",
            parent_id: product.parent_id ?? null,
            params: Array.isArray(product.params) ? product.params : [],
            qty_values: product.qty_values ?? null
          };
        })
      : [];

    res.json({
      status: "OK",
      profit_rate: Number(adminSettings.profit_rate),
      products: result
    });
  } catch (error) {
    console.error("Products error:", error);
    res.status(500).json({
      status: "ERROR",
      message: "تعذر جلب المنتجات من Nemer Card"
    });
  }
});

app.post("/api/orders", requireCustomer, async (req, res) => {
  try {
    const productId = String(req.body?.product_id || "").trim();
    const rawParams = req.body?.params && typeof req.body.params === "object" && !Array.isArray(req.body.params)
      ? req.body.params
      : {};
    const requestedQty = Number(req.body?.qty || 1);
    if (!productId || productId.length > 120) return res.status(400).json({status:"ERROR",message:"معرّف المنتج غير صالح."});
    if (!Number.isInteger(requestedQty) || requestedQty < 1 || requestedQty > 1000000) {
      return res.status(400).json({status:"ERROR",message:"الكمية غير صالحة."});
    }

    const now = Date.now();
    const previousOrderAt = orderRateLimits.get(req.customer.customer_id) || 0;
    if (now - previousOrderAt < 2000) {
      return res.status(429).json({status:"ERROR",message:"تم إرسال طلب آخر للتو. انتظر لحظات ثم حاول مجددًا."});
    }
    orderRateLimits.set(req.customer.customer_id, now);

    const products = await getNemerProducts();
    const product = Array.isArray(products) ? products.find(item => String(item.id) === String(productId)) : null;
    if (!product) return res.status(404).json({status:"ERROR",message:"المنتج غير موجود."});
    if (product.available === false || product.available === 0) return res.status(400).json({status:"ERROR",message:"المنتج غير متاح حاليًا."});

    const apiPrice = normalizeNemerPrice(product.price);
    if (apiPrice === null) return res.status(400).json({status:"ERROR",message:"سعر المنتج غير متاح حاليًا من Nemer Card."});

    // ببجي موبايل لا تستخدم حقل كمية: الطلب دائمًا لمنتج واحد.
    const productText = String(product.category_name || "") + " " + String(product.name || "");
    const isPubgProduct = /pubg|ببجي/i.test(productText);
    const qty = isPubgProduct ? 1 : requestedQty;

    const minQty = Number(product.qty_values?.min);
    const maxQty = Number(product.qty_values?.max);
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
      const enforcedMaxQty = isJawakerServerQuantity ? 1000000 : maxQty;
      if (Number.isFinite(enforcedMinQty) && qty < enforcedMinQty) {
        return res.status(400).json({
          status:"ERROR",
          message:isJawakerServerQuantity ? "كمية عداد جواكر S1 وS2 يجب أن تكون من 10,000 إلى 1,000,000." : "الكمية أقل من الحد الأدنى للمنتج."
        });
      }
      if (Number.isFinite(enforcedMaxQty) && qty > enforcedMaxQty) {
        return res.status(400).json({
          status:"ERROR",
          message:isJawakerServerQuantity ? "كمية عداد جواكر S1 وS2 يجب أن تكون من 10,000 إلى 1,000,000." : "الكمية أكبر من الحد الأقصى للمنتج."
        });
      }
    }

    const allowedParamList = Array.isArray(product.params)
      ? product.params.map(value => String(value).trim()).filter(Boolean)
      : null;
    const allowedParams = allowedParamList ? new Set(allowedParamList) : null;

    // الواجهة تعرض "ID اللاعب" للمستخدم، بينما قد يكون اسم
    // الباراميتر الفعلي مختلفًا داخل كتالوج المزود. إذا كان المنتج
    // يملك باراميترًا واحدًا فقط، نربط playerId به تلقائيًا.
    const normalizedRawParams = {...rawParams};
    if (isUnifiedPlayerIdProduct &&
        Object.prototype.hasOwnProperty.call(normalizedRawParams, "playerId") &&
        allowedParamList &&
        !allowedParams.has("playerId") &&
        allowedParamList.length === 1) {
      const value = normalizedRawParams.playerId;
      delete normalizedRawParams.playerId;
      normalizedRawParams[allowedParamList[0]] = value;
    }

    if (isPubgProduct &&
        Object.prototype.hasOwnProperty.call(normalizedRawParams, "playerId") &&
        allowedParamList &&
        !allowedParams.has("playerId") &&
        allowedParamList.length === 1) {
      const value = normalizedRawParams.playerId;
      delete normalizedRawParams.playerId;
      normalizedRawParams[allowedParamList[0]] = value;
    }

    const params = {};
    const entries = Object.entries(normalizedRawParams);
    if (entries.length > 20) return res.status(400).json({status:"ERROR",message:"عدد بيانات الطلب كبير جدًا."});
    for (const [key, value] of entries) {
      if (allowedParams && !allowedParams.has(String(key))) continue;
      const textValue = String(value ?? "").trim();
      if (textValue.length > 500) return res.status(400).json({status:"ERROR",message:"إحدى بيانات الطلب طويلة جدًا."});
      if (textValue) params[String(key)] = textValue;
    }

    // كل المعلومات التي يعلنها كتالوج Nemer كـ params مطلوبة فعليًا،
    // حتى لا يمر الطلب من الواجهة فقط دون البيانات اللازمة للمزود.
    if (allowedParamList && allowedParamList.length) {
      const missingParam = allowedParamList.find(key => !String(params[key] ?? "").trim());
      if (missingParam) {
        return res.status(400).json({
          status:"ERROR",
          message:"يرجى إدخال جميع المعلومات المطلوبة للمنتج."
        });
      }
    }

    await loadSettings();
    const baseSalePrice = apiPrice * (1 + Number(adminSettings.profit_rate || 0) / 100);

    const reservation = await withTransaction(async (client) => {
      const customerResult = await client.query(
        "SELECT customer_id,customer_number,name,balance,discount,active FROM customers WHERE customer_id=$1 FOR UPDATE",
        [req.customer.customer_id]
      );
      const customer = customerResult.rows[0];
      if (!customer || !customer.active) {
        const error = new Error("حساب العميل غير متاح."); error.statusCode = 403; throw error;
      }

      const discount = Math.min(100, Math.max(0, Number(customer.discount || 0)));
      const priceDecimals = getPriceDecimalPlaces(product.price);
      // احسب السعر النهائي كاملًا مع الكمية أولًا، ثم قرّبه للأعلى.
      // نفس totalPrice هو المبلغ الظاهر/المعتمد للخصم من المحفظة.
      const discountedUnitPrice = baseSalePrice * (1 - discount / 100);
      const totalPrice = ceilPrice(discountedUnitPrice * qty, priceDecimals);
      const before = Number(customer.balance || 0);
      if (!Number.isFinite(totalPrice) || totalPrice < 0) {
        const error = new Error("تعذر حساب سعر الطلب."); error.statusCode = 400; throw error;
      }
      if (before < totalPrice) {
        const error = new Error("رصيد المحفظة غير كافٍ لإتمام عملية الشراء."); error.statusCode = 400; throw error;
      }

      const orderUuid = crypto.randomUUID();
      const orderId = "ORD-" + orderUuid;
      const after = before - totalPrice;

      await client.query("UPDATE customers SET balance=$1,updated_at=NOW() WHERE customer_id=$2",[after.toFixed(12),customer.customer_id]);
      await client.query(
        "INSERT INTO orders (id,order_id,customer_id,product_id,product_name,api_price,price,profit,discount,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'processing')",
        [orderId,orderId,customer.customer_id,String(product.id),String(product.name || ""),Number((apiPrice*qty).toFixed(12)),Number(totalPrice.toFixed(12)),Number((totalPrice-apiPrice*qty).toFixed(12)),Number(discount.toFixed(2))]
      );
      const transactionId = "TXN-" + crypto.randomUUID();
      await client.query(
        "INSERT INTO transactions (id,customer_id,amount,type,balance_before,balance_after,reference_type,reference_id,note) VALUES($1,$2,$3,'purchase',$4,$5,'order',$6,$7)",
        [transactionId,customer.customer_id,Number((-totalPrice).toFixed(12)),Number(before.toFixed(12)),Number(after.toFixed(12)),orderId,"خصم تلقائي مقابل شراء "+String(product.name || "منتج")]
      );
      return {customer_id:customer.customer_id,order_id:orderId,order_uuid:orderUuid,total_price:Number(totalPrice.toFixed(12)),before,after};
    });

    let order;
    try {
      order = await createNemerOrder(productId,{...params,qty,order_uuid:reservation.order_uuid});
    } catch (error) {
      await refundWalletAfterFailedOrder(reservation);
      throw error;
    }

    const apiStatus = String(order?.status || "pending").toLowerCase();
    const failed = ["failed","rejected","cancelled","canceled","error"].includes(apiStatus);
    if (failed) await refundWalletAfterFailedOrder(reservation);

    const externalOrderId = String(order?.id ?? order?.order_id ?? reservation.order_uuid);
    await query(
      "UPDATE orders SET order_id=$1,status=$2 WHERE id=$3",
      [externalOrderId, failed ? "failed" : apiStatus, reservation.order_id]
    );
    if (!failed) await query("UPDATE customers SET orders_count=orders_count+1,updated_at=NOW() WHERE customer_id=$1",[reservation.customer_id]);

    res.json({status:failed?"ERROR":"OK",store:STORE_NAME,order,charged:failed?0:reservation.total_price,balance:failed?Number(reservation.before.toFixed(12)):Number(reservation.after.toFixed(12))});
  } catch (error) {
    console.error("Order error:",error);
    res.status(error.statusCode || 500).json({status:"ERROR",message:error.message || "تعذر إنشاء الطلب."});
  }
});

async function refundWalletAfterFailedOrder(reservation) {
  await withTransaction(async (client) => {
    const customerResult = await client.query("SELECT balance FROM customers WHERE customer_id=$1 FOR UPDATE",[reservation.customer_id]);
    if (!customerResult.rows[0]) throw new Error("تعذر العثور على حساب العميل لإعادة المبلغ.");
    const before = Number(customerResult.rows[0].balance || 0);
    const after = before + Number(reservation.total_price || 0);
    await client.query("UPDATE customers SET balance=$1,updated_at=NOW() WHERE customer_id=$2",[after.toFixed(12),reservation.customer_id]);
    const transactionId = "TXN-" + crypto.randomUUID();
    await client.query(
      "INSERT INTO transactions (id,customer_id,amount,type,balance_before,balance_after,reference_type,reference_id,note) VALUES($1,$2,$3,'refund',$4,$5,'order',$6,$7)",
      [transactionId,reservation.customer_id,Number(reservation.total_price.toFixed(12)),Number(before.toFixed(12)),Number(after.toFixed(12)),reservation.order_id,"إعادة مبلغ طلب فشل تنفيذه"]
    );
    await client.query("UPDATE orders SET status='failed' WHERE id=$1",[reservation.order_id]);
  });
}

app.get("/api/orders/check", requireCustomer, async (req, res) => {
  try {
    let orderIds = req.query.orders;
    if (!orderIds) {
      return res.status(400).json({ status: "ERROR", message: "يجب إرسال أرقام الطلبات." });
    }
    if (!Array.isArray(orderIds)) {
      orderIds = String(orderIds).split(",").map(id => id.trim()).filter(Boolean);
    }

    const owned = await query(
      "SELECT order_id FROM orders WHERE customer_id=$1 AND order_id = ANY($2::text[])",
      [req.customer.customer_id, orderIds.map(String)]
    );
    const allowed = owned.rows.map(row => String(row.order_id));
    if (!allowed.length) {
      return res.status(404).json({ status: "ERROR", message: "لا توجد طلبات تخص هذا الحساب." });
    }

    const result = await checkNemerOrders(allowed);
    res.json(result);
  } catch (error) {
    console.error("Check orders error:", error);
    res.status(500).json({ status: "ERROR", message: "تعذر التحقق من الطلبات." });
  }
});

/* =========================
   ADMIN ALIAS
========================= */

app.get("/Aledaraa19", requireAdmin, (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

app.get("/Aledaraa19/", requireAdmin, (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

app.get("/Aledaraa19/index.html", requireAdmin, (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

app.get("/Aledaraa19/login.html", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "admin", "login.html"));
});

app.get("/Aledaraa19/admin.css", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.sendFile(path.join(__dirname, "admin", "admin.css"));
});

app.get("/Aledaraa19/admin.js", requireAdmin, (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.sendFile(path.join(__dirname, "admin", "admin.js"));
});

/* =========================
   FRONTEND
========================= */

app.get("/admin", requireAdmin, (req, res) => {
  // لوحة الإدارة يجب أن تصل دائمًا من النسخة الحالية، دون كاش HTML.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

app.get("/admin/index.html", requireAdmin, (req, res) => {
  // نفس السياسة لصفحة الإدارة المباشرة.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    // لوحة الإدارة لا تُخزّن: CSS/JS والصور الخاصة بها يجب أن تتحدث فورًا.
    if (filePath.includes(path.sep + "admin" + path.sep) || /[\\/]admin[\\/]/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return;
    }

    // بقية الملفات الثابتة: 7 أيام، مع تحديث في الخلفية.
    // HTML العام: لا يملك المتصفح كاشه الخاص؛ Service Worker يدير كاش الصفحات لمدة 30 دقيقة.
    if (/\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?|avif)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
    }
  }
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use("/api", (req, res) => {
  res.status(404).json({ status: "ERROR", message: "API endpoint not found" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

initDb()
  .then(async () => {
    await loadSettings();
    await cleanupSessions();
    await ensurePubgOfficialImage();
    await ensureRobloxOfficialImage();
    await ensureJawakerOfficialImage();
    await ensureFreeFireOfficialImage();
    await ensureClashOfClansOfficialImage();
    await ensureDragonheirOfficialImage();
    await ensureCloudSongOfficialImage();
    await ensureYallaLudoOfficialImage();
    await ensureLordsMobileOfficialImage();
    await ensureEightBallPoolOfficialImage();
    await ensureGunsOfGloryOfficialImage();
    await ensureGangsOfGloryOfficialImage();
    await ensureProjectEntropyOfficialImage();
    await ensureFarlight84OfficialImage();
    await ensureMarvelRivalsOfficialImage();
    app.listen(PORT, () => {
      console.log(adminSettings.store_name + " server running on port " + PORT);
    });
  })
  .catch(error => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });