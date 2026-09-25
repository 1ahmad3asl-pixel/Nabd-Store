const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const {
    getNemerProducts,
    createNemerOrder,
    checkNemerOrders
} = require("./api");

const app = express();

const PORT = process.env.PORT || 3000;
const PROFIT_RATE = Number(process.env.PROFIT_RATE || 10);
const STORE_NAME = process.env.STORE_NAME || "Nabd-Store";

app.use(cors());
app.use(express.json());

/* =========================
   FRONTEND
========================= */

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
