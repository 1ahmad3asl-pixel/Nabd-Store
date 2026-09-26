const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { parsePhoneNumberFromString } = require("libphonenumber-js");

const {
  getNemerProducts,
  createNemerOrder,
  checkNemerOrders,
  getNemerProfile
} = require("./api");

const {
  query,
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
  currency: process.env.CURRENCY || "USD"
};

const adminLoginAttempts = new Map();
const customerLoginAttempts = new Map();
const googleOAuthStates = new Map();
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "https://nabd-store-1.onrender.com").replace(/\\/$/, "");

app.use(express.json({ limit: "1mb" }));

function requireSameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.headers.origin;
  if (!origin) return next();

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
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0].trim();
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
  adminSettings.currency = await getSetting(
    "currency",
    process.env.CURRENCY || "USD"
  );
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
    country: parsed.country ? (new Intl.DisplayNames(["ar"], {type:"region"}).of(parsed.country) || parsed.country) : ""
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
      if (req.path === "/admin" || req.path === "/admin/index.html") {
        return res.redirect("/admin/login.html");
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
    (process.env.NODE_ENV === "production" ? "; Secure" : "")
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
  customer.customer_id = String(customer.customer_number);
  customer.customer_number = Number(customer.customer_number);
  customer.profile_complete = true;
  res.json({ status: "OK", customer });
});

app.get("/api/customer/auth/me", requireCustomer, async (req, res) => {
  const result = await query(
    "SELECT customer_id,customer_number,name,email,phone,phone_country,balance,orders_count,discount,created_at FROM customers WHERE customer_id=$1",
    [req.customer.customer_id]
  );
  if (!result.rows[0]) {
    return res.status(401).json({ status: "ERROR", message: "الحساب غير موجود." });
  }
  const customer = result.rows[0];
  customer.customer_id = String(customer.customer_number);
  customer.customer_number = Number(customer.customer_number);
  res.json({ status: "OK", customer });
});

app.get("/api/customer/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(503).send("تسجيل الدخول عبر Google غير مهيأ بعد.");
  const state = crypto.randomBytes(24).toString("hex");
  googleOAuthStates.set(state, Date.now() + 10 * 60 * 1000);
  const redirectUri = googleRedirectUri();
  const params = new URLSearchParams({client_id:GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:"code",scope:"openid email profile",state,access_type:"online",prompt:"select_account"});
  res.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
});

app.get("/api/customer/google/callback", async (req, res) => {
  const state = String(req.query.state || "");
  const expires = googleOAuthStates.get(state);
  googleOAuthStates.delete(state);
  if (!expires || expires < Date.now() || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(400).send("جلسة Google غير صالحة أو تسجيل الدخول غير مهيأ.");
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
    res.setHeader("Set-Cookie","nabd_customer_session="+token+"; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000"+(process.env.NODE_ENV==="production"?"; Secure":""));
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
    total_sales: Number(Number(row.sales).toFixed(4)),
    total_profit: Number(Number(row.profit).toFixed(4)),
    api_balance: Number(apiBalance.toFixed(4)),
    recent_orders: recent.rows,
    settings: adminSettings
  });
});

app.get("/api/admin/customers", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const result = search
    ? await query(
        "SELECT customer_id,name,email,balance,orders_count,discount,active,created_at,updated_at FROM customers WHERE customer_id ILIKE $1 OR name ILIKE $1 OR email ILIKE $1 ORDER BY created_at DESC",
        [`%${search}%`]
      )
    : await query(
        "SELECT customer_id,name,email,balance,orders_count,discount,active,created_at,updated_at FROM customers ORDER BY created_at DESC"
      );
  res.json({ status: "OK", customers: result.rows });
});

app.get("/api/admin/customers/:id", async (req, res) => {
  const result = await query(
    "SELECT customer_id,name,email,balance,orders_count,discount,active,created_at,updated_at FROM customers WHERE customer_id=$1",
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
          const apiPrice = Number(product.price || 0);
          const salePrice = apiPrice * (1 + Number(adminSettings.profit_rate || 0) / 100);
          return {
            ...product,
            api_price: Number(apiPrice.toFixed(4)),
            price: Number(salePrice.toFixed(4)),
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
    adminSettings.store_name = String(req.body.store_name).trim() || STORE_NAME;
    await setSetting("store_name", adminSettings.store_name);
  }

  if (req.body?.currency !== undefined) {
    adminSettings.currency = String(req.body.currency).trim() || "USD";
    await setSetting("currency", adminSettings.currency);
  }

  res.json({ status: "OK", settings: adminSettings });
});

app.get("/api/admin/transactions", async (req, res) => {
  const result = await query("SELECT * FROM transactions ORDER BY created_at DESC");
  res.json({ status: "OK", transactions: result.rows });
});

app.post("/api/admin/notifications", async (req, res) => {
  const { target, customer_id, title, message } = req.body || {};
  if (!title || !message) {
    return res.status(400).json({
      status: "ERROR",
      message: "عنوان ونص الإشعار مطلوبان."
    });
  }

  const result = await query(
    "INSERT INTO notifications(target,customer_id,title,message) VALUES($1,$2,$3,$4) RETURNING *",
    [target || "all", customer_id || null, String(title), String(message)]
  );
  res.json({ status: "OK", notification: result.rows[0] });
});

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

app.get("/api/products", async (req, res) => {
  try {
    await loadSettings();
    const products = await getNemerProducts();
    const result = Array.isArray(products)
      ? products.map(product => {
          const originalPrice = Number(product.price || 0);
          const sellingPrice = originalPrice * (1 + Number(adminSettings.profit_rate || 0) / 100);
          return {
            ...product,
            original_price: Number(originalPrice.toFixed(4)),
            price: Number(sellingPrice.toFixed(4))
          };
        })
      : products;

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
    const productId = req.body?.product_id;
    const params = req.body?.params && typeof req.body.params === "object"
      ? req.body.params
      : {};
    const qty = Number(req.body?.qty || 1);

    if (!productId) {
      return res.status(400).json({ status: "ERROR", message: "product_id مطلوب." });
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000000) {
      return res.status(400).json({ status: "ERROR", message: "الكمية غير صالحة." });
    }

    const products = await getNemerProducts();
    const product = Array.isArray(products)
      ? products.find(item => String(item.id) === String(productId))
      : null;

    if (!product) {
      return res.status(404).json({ status: "ERROR", message: "المنتج غير موجود." });
    }
    if (product.available === false || product.available === 0) {
      return res.status(400).json({ status: "ERROR", message: "المنتج غير متاح حاليًا." });
    }

    const orderParams = {
      ...params,
      qty,
      order_uuid: crypto.randomUUID()
    };

    const order = await createNemerOrder(productId, orderParams);
    await loadSettings();

    const apiPrice = Number(product.price || 0);
    const salePrice = apiPrice * (1 + Number(adminSettings.profit_rate || 0) / 100);
    const orderId = String(order?.id ?? order?.order_id ?? orderParams.order_uuid);
    const status = String(order?.status || "pending");

    await query(`
      INSERT INTO orders
        (id,order_id,customer_id,product_id,product_name,api_price,price,profit,discount,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(id) DO NOTHING
    `, [
      orderId,
      orderId,
      req.customer.customer_id,
      String(product.id),
      String(product.name || ""),
      Number(apiPrice.toFixed(4)),
      Number(salePrice.toFixed(4)),
      Number((salePrice - apiPrice).toFixed(4)),
      0,
      status
    ]);

    await query(
      `UPDATE customers
       SET orders_count=orders_count+1,updated_at=NOW()
       WHERE customer_id=$1`,
      [req.customer.customer_id]
    );

    res.json({ status: "OK", store: STORE_NAME, order });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({
      status: "ERROR",
      message: "تعذر إنشاء الطلب."
    });
  }
});

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
   FRONTEND
========================= */

app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

app.get("/admin/index.html", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

app.use(express.static(path.join(__dirname)));

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
    app.listen(PORT, () => {
      console.log(adminSettings.store_name + " server running on port " + PORT);
    });
  })
  .catch(error => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
