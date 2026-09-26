const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const {
    getNemerProducts,
    createNemerOrder,
    checkNemerOrders,
    getNemerProfile
} = require("./api");

const { query, initDb, getSetting, setSetting, createSession, getSession, deleteSession, cleanupSessions } = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;
const PROFIT_RATE = Number(process.env.PROFIT_RATE || 10);
const STORE_NAME = process.env.STORE_NAME || "Nabd-Store";

app.use(express.json());

/* =========================
   ADMIN AUTHENTICATION
========================= */

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_SESSION_SECRET = String(
    process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString("hex")
);

const adminLoginAttempts = new Map();
const customerLoginAttempts = new Map();

function markAdminSecurityHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
}

function getClientIp(req) {
    return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
        .split(",")[0].trim();
}
const adminSettings = { profit_rate: PROFIT_RATE, store_name: STORE_NAME, currency: process.env.CURRENCY || "USD" };
async function loadSettings() {
    adminSettings.profit_rate = Number(await getSetting("profit_rate", PROFIT_RATE));
    adminSettings.store_name = await getSetting("store_name", STORE_NAME);
    adminSettings.currency = await getSetting("currency", process.env.CURRENCY || "USD");
}

function createAdminSession() {
    const token = crypto
        .createHmac("sha256", ADMIN_SESSION_SECRET)
        .update(crypto.randomUUID() + Date.now())
        .digest("hex");

    return token;
}

async function getAdminSession(req) {
    const token = req.headers.cookie?.split(";").map(item => item.trim())
        .find(item => item.startsWith("nabd_admin_session="))?.split("=").slice(1).join("=");
    if (!token) return null;
    const session = await getSession(token);
    return session ? { token, session } : null;
}

function requireAdmin(req, res, next) {
    markAdminSecurityHeaders(res);
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return res.status(503).json({
            status: "ERROR",
            message: "لم يتم إعداد بيانات مالك لوحة الإدارة بعد."
        });
    }

    getAdminSession(req).then(auth => {
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
    }).catch(() => res.status(401).json({ status: "ERROR", message: "جلسة الإدارة غير صالحة." }));
}

function adminSameSecret(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length &&
        crypto.timingSafeEqual(left, right);
}

app.post("/api/admin/login", async (req, res) => {
    markAdminSecurityHeaders(res);
    const ip = getClientIp(req);
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

    if (!adminSameSecret(email, ADMIN_EMAIL) ||
        !adminSameSecret(password, ADMIN_PASSWORD)) {
        attempt.count += 1;
        if (attempt.count >= 5) {
            attempt.blockedUntil = Date.now() + 15 * 60 * 1000;
            attempt.count = 0;
        }
        adminLoginAttempts.set(ip, attempt);
        return res.status(401).json({
            status: "ERROR",
            message: "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        });
    }

    adminLoginAttempts.delete(ip);
    const token = createAdminSession();
    await createSession(token, new Date(Date.now() + 24 * 60 * 60 * 1000));

    res.setHeader(
        "Set-Cookie",
        "nabd_admin_session=" + token +
        "; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400" +
        (process.env.NODE_ENV === "production" ? "; Secure" : "")
    );

    res.json({
        status: "OK",
        admin: { email: ADMIN_EMAIL }
    });
});

app.get("/api/admin/auth/me", requireAdmin, (req, res) => {
    res.json({
        status: "OK",
        admin: { email: ADMIN_EMAIL }
    });
});

app.post("/api/admin/logout", requireAdmin, async (req, res) => {
    const auth = await getAdminSession(req);
    if (auth) await deleteSession(auth.token);

    res.setHeader(
        "Set-Cookie",
        "nabd_admin_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" +
        (process.env.NODE_ENV === "production" ? "; Secure" : "")
    );

    res.json({ status: "OK" });
});

/* =========================
   ADMIN API
========================= */

app.use("/api/admin", requireAdmin);

app.get("/api/admin/dashboard", async (req, res) => {
    let apiBalance = 0;
    try {
        const profile = await getNemerProfile();
        apiBalance = Number(profile?.balance ?? profile?.data?.balance ?? profile?.wallet ?? 0);
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
    const recent = await query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 8");
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

app.get("/api/admin/products", async (req, res) => {
    try {
        const products = await getNemerProducts();
        const result = Array.isArray(products)
            ? products.map(product => {
                const apiPrice = Number(product.price || 0);
                const salePrice = apiPrice * (
                    1 + Number(adminSettings.profit_rate || 0) / 100
                );
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
            message: "تعذر تحميل المنتجات.",
            error: error.message
        });
    }
});

app.get("/api/admin/settings", async (req, res) => {
    await loadSettings();
    res.json({ status: "OK", settings: adminSettings });
});

app.put("/api/admin/settings", (req, res) => {
    if (req.body?.profit_rate !== undefined) {
        const profit = Number(req.body.profit_rate);
        if (!Number.isFinite(profit) || profit < 0 || profit > 100) {
            return res.status(400).json({
                status: "ERROR",
                message: "نسبة الربح يجب أن تكون بين 0 و100."
            });
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

app.get("/api/admin/customers", async (req, res) => {
    const search = String(req.query.search || "").trim();
    const result = search
        ? await query("SELECT * FROM customers WHERE customer_id ILIKE $1 OR name ILIKE $1 ORDER BY created_at DESC", [`%${search}%`])
        : await query("SELECT * FROM customers ORDER BY created_at DESC");
    res.json({ status: "OK", customers: result.rows });
});
app.get("/api/admin/customers/:id", async (req, res) => {
    const result = await query("SELECT * FROM customers WHERE customer_id=$1", [String(req.params.id)]);
    if (!result.rows[0]) return res.status(404).json({ status: "ERROR", message: "العميل غير موجود." });
    res.json({ status: "OK", customer: result.rows[0] });
});
app.put("/api/admin/customers/:id/discount", async (req, res) => {
    const discount = Number(req.body?.discount);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) return res.status(400).json({ status: "ERROR", message: "الخصم يجب أن يكون بين 0 و100." });
    const result = await query("UPDATE customers SET discount=$1, updated_at=NOW() WHERE customer_id=$2 RETURNING *", [discount, String(req.params.id)]);
    if (!result.rows[0]) return res.status(404).json({ status: "ERROR", message: "العميل غير موجود." });
    res.json({ status: "OK", customer: result.rows[0] });
});

app.get("/api/admin/orders", async (req, res) => {
    const result = await query("SELECT * FROM orders ORDER BY created_app.get("/api/admin/transactions", async (req, res) => {
    const result = await query("SELECT * FROM transactions ORDER BY created_at DESC");
    res.json({ status: "OK", transactions: result.rows });
});

app.post("/api/admin/notifications", (req, res) => {
    const { target, customer_id, title, message } = req.body || {};
    if (!title || !message) {
        return res.status(400).json({
            status: "ERROR",
            message: "عنوان ونص الإشعار مطلوبان."
        });
    }

    const result = await query(
        "INSERT INTO notifications(target, customer_id, title, message) VALUES($1,$2,$3,$4) RETURNING *",
        [target || "all", customer_id || null, String(title), String(message)]
    );
    res.json({ status: "OK", notification: result.rows[0] });
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

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        store: STORE_NAME,
        server: "online"
    });
});

/* =========================
   PRODUCTS
========================= */

app.get("/api/products", async (req, res) => {
    try {
        const products = await getNemerProducts();

        const result = Array.isArray(products)
            ? products.map(product => {
                const originalPrice = Number(product.price || 0);

                const sellingPrice =
                    originalPrice * (1 + Number(adminSettings.profit_rate || 0) / 100);

                return {
                    ...product,
                    original_price: Number(
                        originalPrice.toFixed(4)
                    ),
                    price: Number(
                        sellingPrice.toFixed(4)
                    )
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
            message: "تعذر جلب المنتجات من Nemer Card",
            error: error.message
        });
    }
});

/* =========================
   CREATE ORDER
========================= */

app.post("/api/orders", async (req, res) => {
    try {
        const {
            product_id,
            params = {},
            qty = 1
        } = req.body;

        if (!product_id) {
            return res.status(400).json({
                status: "ERROR",
                message: "product_id مطلوب"
            });
        }

        const products = await getNemerProducts();

        const product = Array.isArray(products)
            ? products.find(
                item => String(item.id) === String(product_id)
            )
            : null;

        if (!product) {
            return res.status(404).json({
                status: "ERROR",
                message: "المنتج غير موجود"
            });
        }

        if (product.available === false) {
            return res.status(400).json({
                status: "ERROR",
                message: "المنتج غير متاح حاليًا"
            });
        }

        const orderParams = {
            ...params,
            qty: Number(qty) || 1,
            order_uuid: crypto.randomUUID()
        };

                const customerAuth = await getCustomerAuth(req);
        if (!customerAuth) {
            return res.status(401).json({ status: "ERROR", message: "يجب تسجيل الدخول قبل الشراء." });
        }

const order = await createNemerOrder(
            product_id,
            orderParams
        );

        const apiPrice = Number(product.price || 0);
        const salePrice = apiPrice * (
            1 + Number(adminSettings.profit_rate || 0) / 100
        );
        const orderRecord = {
            id: order?.id ?? order?.order_id ?? orderParams.order_uuid,
            order_id: order?.id ?? order?.order_id ?? orderParams.order_uuid,
            customer_id: req.body.customer_id || "guest",
            product_id: product.id,
            product_name: product.name || "",
            api_price: Number(apiPrice.toFixed(4)),
            price: Number(salePrice.toFixed(4)),
            profit: Number((salePrice - apiPrice).toFixed(4)),
            discount: 0,
            status: order?.status || "pending",
            created_at: new Date().toISOString()
        };

        await query(`INSERT INTO orders
            (id, order_id, customer_id, product_id, product_name, api_price, price, profit, discount, status)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT(id) DO NOTHING`, [String(orderRecord.id), String(orderRecord.order_id), String(orderRecord.customer_id), String(orderRecord.product_id), String(orderRecord.product_name), orderRecord.api_price, orderRecord.price, orderRecord.profit, orderRecord.discount, String(orderRecord.status)]);
        if (orderRecord.customer_id !== "guest") {
            await query(`INSERT INTO customers(customer_id, orders_count) VALUES($1,1)
                ON CONFLICT(customer_id) DO UPDATE SET orders_count=customers.orders_count+1, updated_at=NOW()`, [String(orderRecord.customer_id)]);
        }

        res.json({
            status: "OK",
            store: STORE_NAME,
            order: order
        });

    } catch (error) {
        console.error("Order error:", error);

        res.status(500).json({
            status: "ERROR",
            message: "تعذر إنشاء الطلب",
            error: error.message
        });
    }
});

/* =========================
   CHECK ORDERS
========================= */

app.get("/api/orders/check", requireCustomer, async (req, res) => {
    try {
        let orders = req.query.orders;

        if (!orders) {
            return res.status(400).json({
                status: "ERROR",
                message: "يجب إرسال أرقام الطلبات"
            });
        }

        if (!Array.isArray(orders)) {
            orders = String(orders)
                .split(",")
                .map(id => id.trim())
                .filter(Boolean);
        }

        if (!orders.length) {
            return res.status(400).json({
                status: "ERROR",
                message: "قائمة الطلبات فارغة"
            });
        }

        const owned = await query(
            "SELECT order_id FROM orders WHERE customer_id=$1 AND order_id = ANY($2::text[])",
            [req.customer.customer_id, orders.map(String)]
        );
        const allowed = owned.rows.map(row => String(row.order_id));
        if (!allowed.length) return res.status(404).json({ status: "ERROR", message: "لا توجد طلبات تخص هذا الحساب." });
        const result = await checkNemerOrders(allowed);

        res.json(result);

    } catch (error) {
        console.error("Check orders error:", error);

        res.status(500).json({
            status: "ERROR",
            message: "تعذر التحقق من الطلبات",
            error: error.message
        });
    }
});

/* =========================
   STORE INFO
========================= */

app.get("/api/store", (req, res) => {
    res.json({
        name: adminSettings.store_name,
        currency: adminSettings.currency,
        profit_rate: Number(adminSettings.profit_rate)
    });
});

/* =========================
   404 API
========================= */

app.use("/api", (req, res) => {
    res.status(404).json({
        status: "ERROR",
        message: "API endpoint not found"
    });
});

/* =========================
   SPA FALLBACK
========================= */

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================
   START SERVER
========================= */

initDb()
    .then(async () => {
        await loadSettings();
        await cleanupSessions();
        app.listen(PORT, () => console.log(adminSettings.store_name + " server running on port " + PORT));
    })
    .catch(error => {
        console.error("Database initialization failed:", error);
        process.exit(1);
    });
