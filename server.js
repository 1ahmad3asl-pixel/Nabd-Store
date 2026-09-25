const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname)));

app.get("/api/products", async function (req, res) {
    try {
        res.json({
            products: [],
            message: "سيتم جلب المنتجات من Nemer Card API بعد إعداد الخادم الآمن."
        });
    } catch (error) {
        res.status(500).json({
            error: "تعذر تحميل المنتجات."
        });
    }
});

app.get("/api/profile", async function (req, res) {
    res.json({
        balance: 0
    });
});

app.get("/api/orders", async function (req, res) {
    res.json({
        orders: []
    });
});

app.post("/api/orders", async function (req, res) {
    try {
        const productId = req.body.product_id;
        const params = req.body.params || {};

        if (!productId) {
            return res.status(400).json({
                error: "معرّف المنتج مطلوب."
            });
        }

        res.json({
            success: false,
            message: "سيتم تفعيل تنفيذ الطلب بعد ربط API بشكل آمن."
        });

    } catch (error) {
        res.status(500).json({
            error: "تعذر تنفيذ الطلب."
        });
    }
});

app.get("/api/admin/dashboard", async function (req, res) {
    res.json({
        total_customers: 0,
        total_orders: 0,
        total_sales: 0,
        total_profit: 0,
        api_balance: 0,
        recent_orders: [],
        settings: {
            profit_rate: 10,
            store_name: "متجر النبض الرقمي",
            currency: "USD"
        }
    });
});

app.get("/api/admin/customers", async function (req, res) {
    res.json({
        customers: []
    });
});

app.get("/api/admin/customers/:id", async function (req, res) {
    res.json({
        customer: null
    });
});

app.put("/api/admin/customers/:id/discount", async function (req, res) {

    const discount = Number(req.body.discount);

    if (
        Number.isNaN(discount) ||
        discount < 0 ||
        discount > 100
    ) {
        return res.status(400).json({
            error: "نسبة الخصم يجب أن تكون بين 0 و100."
        });
    }

    res.json({
        success: true,
        customer_id: req.params.id,
        discount: discount
    });
});

app.get("/api/admin/orders", async function (req, res) {
    res.json({
        orders: []
    });
});

app.get("/api/admin/products", async function (req, res) {
    res.json({
        products: []
    });
});

app.get("/api/admin/transactions", async function (req, res) {
    res.json({
        transactions: []
    });
});

app.get("/api/admin/settings", async function (req, res) {
    res.json({
        profit_rate: 10,
        store_name: "متجر النبض الرقمي",
        currency: "USD"
    });
});

app.put("/api/admin/settings", async function (req, res) {

    const profitRate =
        req.body.profit_rate !== undefined
            ? Number(req.body.profit_rate)
            : 10;

    if (
        Number.isNaN(profitRate) ||
        profitRate < 0 ||
        profitRate > 100
    ) {
        return res.status(400).json({
            error: "نسبة الربح يجب أن تكون بين 0 و100."
        });
    }

    res.json({
        success: true,
        settings: {
            profit_rate: profitRate,
            store_name:
                req.body.store_name ||
                "متجر النبض الرقمي",
            currency:
                req.body.currency ||
                "USD"
        }
    });
});

app.post("/api/admin/notifications", async function (req, res) {

    const {
        target,
        customer_id,
        title,
        message
    } = req.body;

    if (!title || !message) {
        return res.status(400).json({
            error: "عنوان ونص الإشعار مطلوبان."
        });
    }

    res.json({
        success: true,
        target: target || "all",
        customer_id: customer_id || null,
        title: title,
        message: message
    });
});

app.post("/api/admin/logout", async function (req, res) {
    res.json({
        success: true
    });
});

app.get("/api/health", function (req, res) {
    res.json({
        status: "ok",
        store: "متجر النبض الرقمي"
    });
});

app.get("*", function (req, res) {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});

app.listen(PORT, function () {
    console.log(
        `متجر النبض الرقمي يعمل على المنفذ ${PORT}`
    );
});
