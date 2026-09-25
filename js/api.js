const CONFIG = {
    API_BASE_URL: "/api",
    PROFIT_RATE: 0.10,
    CURRENCY: "USD",
    STORE_NAME: "متجر النبض الرقمي"
};

const API = {
    async request(endpoint, options = {}) {
        const response = await fetch(
            `${CONFIG.API_BASE_URL}${endpoint}`,
            {
                ...options,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                }
            }
        );

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "حدث خطأ أثناء الاتصال بالخادم."
            );
        }

        return data;
    },

    async getProducts() {
        return this.request("/products");
    },

    async getProfile() {
        return this.request("/profile");
    },

    async getOrders() {
        return this.request("/orders");
    },

    async createOrder(productId, params) {
        return this.request("/orders", {
            method: "POST",
            body: JSON.stringify({
                product_id: productId,
                params: params
            })
        });
    },

    async getOrderStatus(orderId) {
        return this.request(
            `/orders/${encodeURIComponent(orderId)}`
        );
    }
};

function calculateSellingPrice(apiPrice, profitRate = CONFIG.PROFIT_RATE) {
    const price = Number(apiPrice) || 0;
    const rate = Number(profitRate) || 0;

    return Number((price * (1 + rate)).toFixed(2));
}

function calculateCustomerPrice(
    apiPrice,
    customerDiscount = 0,
    profitRate = CONFIG.PROFIT_RATE
) {
    const sellingPrice = calculateSellingPrice(
        apiPrice,
        profitRate
    );

    const discount = Number(customerDiscount) || 0;

    const finalPrice =
        sellingPrice * (1 - discount / 100);

    return Number(finalPrice.toFixed(2));
}

async function refreshStoreData() {
    try {
        const profile = await API.getProfile();

        if (profile && profile.balance !== undefined) {
            updateBalance(profile.balance);
        }

        const productsResponse = await API.getProducts();

        const products =
            Array.isArray(productsResponse)
                ? productsResponse
                : productsResponse.products ||
                  productsResponse.data ||
                  [];

        state.products = products.map(function (product) {

            const apiPrice = Number(
                product.price ||
                product.cost ||
                0
            );

            return {
                ...product,
                apiPrice: apiPrice,
                price: calculateSellingPrice(apiPrice),
                available:
                    product.available !== false &&
                    product.available !== 0
            };
        });

        renderProducts();

    } catch (error) {
        console.error(
            "Store API error:",
            error
        );

        showProductsError();
    }
}

async function submitOrder(product, params) {

    if (!product || !product.id) {
        showToast("بيانات المنتج غير صحيحة.");
        return null;
    }

    try {

        const result = await API.createOrder(
            product.id,
            params
        );

        return result;

    } catch (error) {

        console.error(
            "Order error:",
            error
        );

        showToast(
            error.message ||
            "تعذر تنفيذ الطلب."
        );

        return null;
    }
}

window.StoreAPI = API;

window.StoreConfig = CONFIG;

window.calculateSellingPrice =
    calculateSellingPrice;

window.calculateCustomerPrice =
    calculateCustomerPrice;

window.refreshStoreData =
    refreshStoreData;

window.submitOrder =
    submitOrder;
