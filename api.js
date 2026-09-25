const NEMER_API_BASE = "https://nemer-card.com/api";

async function nemerRequest(endpoint, options = {}) {
    const response = await fetch(
        NEMER_API_BASE + endpoint,
        {
            method: options.method || "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                ...(options.headers || {})
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
            "Nemer Card API request failed."
        );
    }

    return data;
}

async function getNemerProducts() {
    return await nemerRequest("/products");
}

async function getNemerBalance() {
    return await nemerRequest("/balance");
}

async function createNemerOrder(productId, params) {
    return await nemerRequest("/orders", {
        method: "POST",
        body: {
            product_id: productId,
            params: params
        }
    });
}

module.exports = {
    getNemerProducts,
    getNemerBalance,
    createNemerOrder
};
