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

const app = express();

const PORT = process.env.PORT || 3000;
const PROFIT_RATE = Number(process.env.PROFIT_RATE || 10);
const STORE_NAME = process.env.STORE_NAME || "Nabd-Store";

app.use(cors());
app.use(express.json());

/* =========================
   ADMIN AUTHENTICATION
========================= */

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_SESSION_SECRET = String(
    process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString("hex")
);

const adminSessions = new Map();
const adminLoginAttempts = new Map();

function markAdminSecurityHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
}

function getClientIp(req) {
    return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
        .split(",")[0].trim();
}
const adminSettings = {
    profit_rate: PROFIT_RATE,
    store_name: STORE_NAME,
    currency: process.env.CURRENCY || "USD"
};
const adminOrders = [];
const adminCustomers = [];
const adminTransactions = [];

function createAdminSession() {
    const token = crypto
        .createHmac("sha256", ADMIN_SESSION_SECRET)
        .update(crypto.randomUUID() + Date.now())
        .digest("hex");

    adminSessions.set(token, {
        createdAt: Date.now()
    });

    return token;
}

function getAdminSession(req) {
    const token = req.headers.cookie
        ?.split(";")
        .map(item => item.trim())
        .find(item => item.startsWith("nabd_admin_session="))
        ?.split("=")
        .slice(1)
        .join("=");

    if (!token || !adminSessions.has(token)) {
        return null;
    }

    return { token, session: adminSessions.get(token) };
}

function requireAdmin(req, res, next) {
    markAdminSecurityHeaders(res);
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return res.status(503).json({
            status: "ERROR",
            message: "لم يتم إعداد بيانات مالك لوحة الإدارة بعد."
        });
    }

    const auth = getAdminSession(req);

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
}

function adminSameSecret(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length &&
        crypto.timingSafeEqual(left, right);
}

app.post("/api/admin/login", (req, res) => {
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

app.post("/api/admin/logout", requireAdmin, (req, res) => {
    const auth = getAdminSession(req);
    if (auth) adminSessions.delete(auth.token);

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
        apiBalance = Number(
            profile?.balance ??
            profile?.data?.balance ??
            profile?.wallet ??
            0
        );
    } catch (error) {
        console.error("Admin profile error:", error.message);
    }

    const totalSales = adminOrders.reduce(
        (sum, order) => sum + Number(order.price || 0), 0
    );
    const totalProfit = adminOrders.reduce(
        (sum, order) => sum + Number(order.profit || 0), 0
    );

    res.json({
        status: "OK",
        total_customers: adminCustomers.length,
        total_orders: adminOrders.length,
        total_sales: Number(totalSales.toFixed(4)),
        total_profit: Number(totalProfit.toFixed(4)),
        api_balance: Number(apiBalance.toFixed(4)),
        recent_orders: adminOrders.slice(-8).reverse(),
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

app.get("/api/admin/settings", (req, res) => {
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
    }

    if (req.body?.store_name !== undefined) {
        adminSettings.store_name = String(req.body.store_name).trim() || STORE_NAME;
    }

    if (req.body?.currency !== undefined) {
        adminSettings.currency = String(req.body.currency).trim() || "USD";
    }

    res.json({ status: "OK", settings: adminSettings });
});

app.get("/api/admin/customers", (req, res) => {
    const search = String(req.query.search || "").toLowerCase();
    const customers = adminCustomers.filter(customer =>
        !search ||
        JSON.stringify(customer).toLowerCase().includes(search)
    );
    res.json({ status: "OK", customers });
});

app.get("/api/admin/customers/:id", (req, res) => {
    const customer = adminCustomers.find(
        item => String(item.customer_id) === String(req.params.id)
    );
    if (!customer) {
        return res.status(404).json({
            status: "ERROR",
            message: "العميل غير موجود."
        });
    }
    res.json({ status: "OK", customer });
});

app.put("/api/admin/customers/:id/discount", (req, res) => {
    const discount = Number(req.body?.discount);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        return res.status(400).json({
            status: "ERROR",
            message: "الخصم يجب أن يكون بين 0 و100."
        });
    }

    const customer = adminCustomers.find(
        item => String(item.customer_id) === String(req.params.id)
    );

    if (!customer) {
        return res.status(404).json({
            status: "ERROR",
            message: "لا يمكن إنشاء عميل من خلال هذا المسار."
        });
    }

    customer.discount = discount;
    res.json({ status: "OK", customer });
});

app.get("/api/admin/orders", (req, res) => {
    res.json({ status: "OK", orders: adminOrders.slice().reverse() });
});

app.get("/api/admin/transactions", (req, res) => {
    res.json({
        status: "OK",
        transactions: adminTransactions.slice().reverse()
    });
});

app.post("/api/admin/notifications", (req, res) => {
    const { target, customer_id, title, message } = req.body || {};
    if (!title || !message) {
        return res.status(400).json({
            status: "ERROR",
            message: "عنوان ونص الإشعار مطلوبان."
        });
    }

    res.json({
        status: "OK",
        notification: {
            target: target || "all",
            customer_id: customer_id || null,
            title: String(title),
            message: String(message),
            created_at: new Date().toISOString()
        }
    });
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
                    originalPrice * (1 + PROFIT_RATE / 100);

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
            profit_rate: PROFIT_RATE,
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

        adminOrders.push(orderRecord);

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

app.get("/api/orders/check", async (req, res) => {
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

        const result = await checkNemerOrders(orders);

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
        name: STORE_NAME,
        currency: process.env.CURRENCY || "USD",
        profit_rate: PROFIT_RATE
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

app.listen(PORT, () => {
    console.log(
        `${STORE_NAME} server running on port ${PORT}`
    );
});
