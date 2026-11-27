const NEMER_API_BASE = "https://nemer-card.com";

async function nemerRequest(endpoint, options = {}) {
    const apiToken = String(process.env.NEMER_API_TOKEN || "").trim();
    if (!apiToken) {
        throw new Error("NEMER_API_TOKEN is missing from the Render environment.");
    }

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
                    "api-token": apiToken
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
        throw new Error("Nemer Card network error: " + (error?.message || "unknown fetch error"));
    } finally {
        clearTimeout(timeout);
    }

    const responseText = await response.text();
    let data = {};
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch {
        data = {};
    }

    if (!response.ok) {
        const apiMessage = data.message || data.error || data.detail || "";
        const apiCode = data.code !== undefined ? " (code " + data.code + ")" : "";
        const safeMessage = String(apiMessage || responseText.slice(0, 240) || response.statusText || "No response details")
            .replace(/\s+/g, " ")
            .split(apiToken).join("[REDACTED]")
            .slice(0, 240);
        throw new Error("Nemer Card API HTTP " + response.status + apiCode + ": " + safeMessage);
    }

    return data;
}

async function getNemerProducts() {
    // الأسعار والمنتجات تُجلب مباشرة من Nemer دائمًا.
    // لا نستخدم Cache هنا حتى لا يتم تنفيذ طلب أو تسعير اعتمادًا على سعر قديم.
    const response = await nemerRequest("/client/api/products");

    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.products)) return response.products;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.data?.products)) return response.data.products;
    if (Array.isArray(response?.data?.results)) return response.data.results;

    return [];
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
