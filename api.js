const NEMER_API_BASE = "https://nemer-card.com";

async function nemerRequest(endpoint, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

    let response;
    try {
        response = await fetch(
            NEMER_API_BASE + endpoint,
            {
                method: options.method || "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "api-token": process.env.NEMER_API_TOKEN
            },
            body: options.body
                ? JSON.stringify(options.body)
                : undefined,
                signal: controller.signal
            }
        );
    } catch (error) {
        if (error && error.name === "AbortError") {
            throw new Error("انتهت مهلة الاتصال بخدمة Nemer Card.");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Nemer Card API request failed"
        );
    }

    return data;
}

let productsCache = null;
let productsCacheAt = 0;
let productsRequest = null;
const PRODUCTS_CACHE_TTL = 60000;

async function getNemerProducts() {
    const now = Date.now();
    if (productsCache && now - productsCacheAt < PRODUCTS_CACHE_TTL) {
        return productsCache;
    }
    if (productsRequest) return productsRequest;

    productsRequest = nemerRequest("/client/api/products").then(response => {

    // Nemer may return the product array directly or wrap it in
    // data/products/results. Normalize it here so every local endpoint
    // receives the same array shape.
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.products)) return response.products;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.data?.products)) return response.data.products;
    if (Array.isArray(response?.data?.results)) return response.data.results;

    const products = Array.isArray(response) ? response
        : Array.isArray(response?.products) ? response.products
        : Array.isArray(response?.data) ? response.data
        : Array.isArray(response?.results) ? response.results
        : Array.isArray(response?.data?.products) ? response.data.products
        : Array.isArray(response?.data?.results) ? response.data.results
        : [];
    productsCache = products;
    productsCacheAt = Date.now();
    return products;
    }).finally(() => {
        productsRequest = null;
    });

    return productsRequest;
}

async function getNemerProfile() {
    return await nemerRequest("/client/api/profile");
}

async function createNemerOrder(productId, params = {}) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
            query.append(key, value);
        }
    }

    const response = await nemerRequest(
        `/client/api/newOrder/${productId}/params?${query.toString()}`
    );

    return response;
}

async function checkNemerOrders(orderIds) {
    const orders = `[${orderIds.join(",")}]`;

    return await nemerRequest(
        `/client/api/check?orders=${encodeURIComponent(orders)}`
    );
}

module.exports = {
    getNemerProducts,
    getNemerProfile,
    createNemerOrder,
    checkNemerOrders
};
