const NEMER_API_BASE = "https://nemer-card.com";

async function nemerRequest(endpoint, options = {}) {
    const response = await fetch(
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
                : undefined
        }
    );

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

async function getNemerProducts() {
    return await nemerRequest("/client/api/products");
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
