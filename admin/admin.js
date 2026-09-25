const ADMIN_API = {
    base: "/api/admin",

    async request(endpoint, options = {}) {
        const response = await fetch(this.base + endpoint, {
            ...options,
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

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

    dashboard() {
        return this.request("/dashboard");
    },

    customers(search = "") {
        const query = search
            ? "?search=" + encodeURIComponent(search)
            : "";

        return this.request("/customers" + query);
    },

    customer(customerId) {
        return this.request(
            "/customers/" + encodeURIComponent(customerId)
        );
    },

    updateCustomerDiscount(customerId, discount) {
        return this.request(
            "/customers/" +
            encodeURIComponent(customerId) +
            "/discount",
            {
                method: "PUT",
                body: JSON.stringify({
                    discount: Number(discount)
                })
            }
        );
    },

    orders() {
        return this.request("/orders");
    },

    products() {
        return this.request("/products");
    },

    settings() {
        return this.request("/settings");
    },

    updateSettings(settings) {
        return this.request("/settings", {
            method: "PUT",
            body: JSON.stringify(settings)
        });
    },

    transactions() {
        return this.request("/transactions");
    },

    sendNotification(data) {
        return this.request("/notifications", {
            method: "POST",
            body: JSON.stringify(data)
        });
    },

    logout() {
        return this.request("/logout", {
            method: "POST"
        });
    }
};

const adminState = {
    customers: [],
    orders: [],
    products: [],
    settings: {
        profit_rate: 10,
        store_name: "متجر النبض الرقمي",
        currency: "USD"
    }
};

document.addEventListener("DOMContentLoaded", function () {

    initializeAdminNavigation();
    initializeAdminMenu();
    initializeDashboard();
    initializeCustomers();
    initializeOrders();
    initializeProducts();
    initializeSettings();
    initializeNotifications();
    initializeLogout();

    loadAdminDashboard();

});

function initializeAdminNavigation() {

    document
        .querySelectorAll(".admin-nav-item")
        .forEach(function (button) {

            button.addEventListener("click", function () {

                const section =
                    button.getAttribute("data-section");

                showAdminSection(section);

            });

        });

    document
        .querySelectorAll("[data-section-link]")
        .forEach(function (button) {

            button.addEventListener("click", function () {

                showAdminSection(
                    button.getAttribute("data-section-link")
                );

            });

        });

}

function showAdminSection(section) {

    document
        .querySelectorAll(".admin-section")
        .forEach(function (item) {

            item.classList.remove("active");

        });

    document
        .querySelectorAll(".admin-nav-item")
        .forEach(function (item) {

            item.classList.remove("active");

        });

    const sectionElement =
        document.getElementById(section + "Section");

    if (sectionElement) {
        sectionElement.classList.add("active");
    }

    const navigationButton =
        document.querySelector(
            `.admin-nav-item[data-section="${section}"]`
        );

    if (navigationButton) {
        navigationButton.classList.add("active");
    }

    const sidebar =
        document.getElementById("sidebar");

    if (sidebar) {
        sidebar.classList.remove("active");
    }

    if (section === "customers") {
        loadCustomers();
    }

    if (section === "orders") {
        loadOrders();
    }

    if (section === "products") {
        loadAdminProducts();
    }

    if (section === "wallet") {
        loadTransactions();
    }

}

function initializeAdminMenu() {

    const button =
        document.getElementById("menuButton");

    const sidebar =
        document.getElementById("sidebar");

    if (button && sidebar) {

        button.addEventListener("click", function () {

            sidebar.classList.toggle("active");

        });

    }

}

function initializeDashboard() {

    const refresh =
        document.getElementById("refreshDashboard");

    if (refresh) {

        refresh.addEventListener(
            "click",
            loadAdminDashboard
        );

    }

}

async function loadAdminDashboard() {

    try {

        const data =
            await ADMIN_API.dashboard();

        updateDashboard(data);

    } catch (error) {

        console.error(error);

        showAdminToast(
            "تعذر تحميل بيانات لوحة التحكم."
        );

    }

}

function updateDashboard(data) {

    if (!data) return;

    setText(
        "totalCustomers",
        data.total_customers ??
        data.customers_count ??
        0
    );

    setText(
        "totalOrders",
        data.total_orders ??
        data.orders_count ??
        0
    );

    setText(
        "totalSales",
        formatAdminPrice(
            data.total_sales ??
            data.sales ??
            0
        )
    );

    setText(
        "totalProfit",
        formatAdminPrice(
            data.total_profit ??
            data.profit ??
            0
        )
    );

    setText(
        "apiBalance",
        formatAdminPrice(
            data.api_balance ??
            data.balance ??
            0
        )
    );

    if (Array.isArray(data.recent_orders)) {
        adminState.orders =
            data.recent_orders;

        renderRecentOrders(
            data.recent_orders
        );
    }

    if (data.settings) {
        adminState.settings = {
            ...adminState.settings,
            ...data.settings
        };

        updateSettingsUI();
    }

}

function initializeCustomers() {

    const searchButton =
        document.getElementById("searchCustomers");

    const searchInput =
        document.getElementById("customerSearch");

    const refresh =
        document.getElementById("refreshCustomers");

    if (searchButton) {

        searchButton.addEventListener(
            "click",
            function () {

                loadCustomers(
                    searchInput
                        ? searchInput.value.trim()
                        : ""
                );

            }
        );

    }

    if (searchInput) {

        searchInput.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    loadCustomers(
                        searchInput.value.trim()
                    );

                }

            }
        );

    }

    if (refresh) {

        refresh.addEventListener(
            "click",
            function () {

                loadCustomers();

            }
        );

    }

}

async function loadCustomers(search = "") {

    try {

        const data =
            await ADMIN_API.customers(search);

        const customers =
            Array.isArray(data)
                ? data
                : data.customers ||
                  data.data ||
                  [];

        adminState.customers =
            customers;

        renderCustomers(customers);

    } catch (error) {

        console.error(error);

        showAdminToast(
            "تعذر تحميل العملاء."
        );

    }

}

function renderCustomers(customers) {

    const table =
        document.getElementById(
            "customersTable"
        );

    if (!table) return;

    if (!customers.length) {

        table.innerHTML = `
            <tr>
                <td colspan="7">
                    لا توجد بيانات عملاء.
                </td>
            </tr>
        `;

        return;

    }

    table.innerHTML =
        customers.map(function (customer) {

            const id =
                customer.customer_id ??
                customer.id ??
                "";

            const name =
                customer.name ??
                customer.username ??
                "عميل";

            const balance =
                customer.balance ??
                0;

            const orders =
                customer.orders_count ??
                customer.orders ??
                0;

            const discount =
                customer.discount ??
                customer.discount_percent ??
                0;

            const active =
                customer.active !== false &&
                customer.status !== "blocked";

            return `
                <tr>

                    <td>
                        <strong>
                            ${escapeAdminHtml(String(id))}
                        </strong>
                    </td>

                    <td>
                        ${escapeAdminHtml(String(name))}
                    </td>

                    <td>
                        ${formatAdminPrice(balance)}
                    </td>

                    <td>
                        ${escapeAdminHtml(String(orders))}
                    </td>

                    <td>
                        <strong>
                            ${Number(discount).toFixed(2)}%
                        </strong>
                    </td>

                    <td>
                        <span class="status ${
                            active
                                ? "status-success"
                                : "status-danger"
                        }">
                            ${
                                active
                                    ? "نشط"
                                    : "محظور"
                            }
                        </span>
                    </td>

                    <td>
                        <button
                            class="small-button"
                            data-customer-id="${escapeAdminHtml(String(id))}"
                            data-action="discount"
                        >
                            تعديل الخصم
                        </button>
                    </td>

                </tr>
            `;

        }).join("");

    table
        .querySelectorAll(
            '[data-action="discount"]'
        )
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    openDiscountDialog(
                        button.getAttribute(
                            "data-customer-id"
                        )
                    );

                }
            );

        });

}

function openDiscountDialog(customerId) {

    const customer =
        adminState.customers.find(
            function (item) {

                return String(
                    item.customer_id ??
                    item.id
                ) === String(customerId);

            }
        );

    const currentDiscount =
        customer
            ? Number(
                customer.discount ??
                customer.discount_percent ??
                0
            )
            : 0;

    const discount =
        prompt(
            "أدخل نسبة الخصم لهذا العميل (%):",
            currentDiscount
        );

    if (discount === null) return;

    const value =
        Number(discount);

    if (
        Number.isNaN(value) ||
        value < 0 ||
        value > 100
    ) {

        showAdminToast(
            "نسبة الخصم يجب أن تكون بين 0 و100."
        );

        return;

    }

    updateCustomerDiscount(
        customerId,
        value
    );

}

async function updateCustomerDiscount(
    customerId,
    discount
) {

    try {

        await ADMIN_API.updateCustomerDiscount(
            customerId,
            discount
        );

        showAdminToast(
            "تم تحديث خصم العميل."
        );

        loadCustomers();

    } catch (error) {

        console.error(error);

        showAdminToast(
            error.message ||
            "تعذر تحديث الخصم."
        );

    }

}

function initializeOrders() {

    const refresh =
        document.getElementById("refreshOrders");

    const search =
        document.getElementById("orderSearch");

    const status =
        document.getElementById(
            "orderStatusFilter"
        );

    if (refresh) {

        refresh.addEventListener(
            "click",
            loadOrders
        );

    }

    if (search) {

        search.addEventListener(
            "input",
            function () {

                filterOrders();

            }
        );

    }

    if (status) {

        status.addEventListener(
            "change",
            filterOrders
        );

    }

}

async function loadOrders() {

    try {

        const data =
            await ADMIN_API.orders();

        const orders =
            Array.isArray(data)
                ? data
                : data.orders ||
                  data.data ||
                  [];

        adminState.orders =
            orders;

        renderOrders(orders);

    } catch (error) {

        console.error(error);

        showAdminToast(
            "تعذر تحميل الطلبات."
        );

    }

}

function filterOrders() {

    const searchInput =
        document.getElementById(
            "orderSearch"
        );

    const statusSelect =
        document.getElementById(
            "orderStatusFilter"
        );

    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";

    const status =
        statusSelect
            ? statusSelect.value
            : "all";

    const filtered =
        adminState.orders.filter(
            function (order) {

                const orderText =
                    JSON.stringify(order)
                        .toLowerCase();

                const matchesSearch =
                    !search ||
                    orderText.includes(search);

                const orderStatus =
                    String(
                        order.status ||
                        ""
                    ).toLowerCase();

                const matchesStatus =
                    status === "all" ||
                    orderStatus === status;

                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );

    renderOrders(filtered);

}

function renderOrders(orders) {

    const table =
        document.getElementById(
            "ordersTable"
        );

    if (!table) return;

    if (!orders.length) {

        table.innerHTML = `
            <tr>
                <td colspan="8">
                    لا توجد طلبات.
                </td>
            </tr>
        `;

        return;

    }

    table.innerHTML =
        orders.map(function (order) {

            const status =
                String(
                    order.status ||
                    "pending"
                ).toLowerCase();

            return `
                <tr>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                order.id ??
                                order.order_id ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                order.customer_id ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                order.product_name ??
                                order.product ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${formatAdminPrice(
                            order.api_price ??
                            order.cost ??
                            0
                        )}
                    </td>

                    <td>
                        ${formatAdminPrice(
                            order.price ??
                            order.amount ??
                            0
                        )}
                    </td>

                    <td>
                        ${Number(
                            order.discount ??
                            0
                        ).toFixed(2)}%
                    </td>

                    <td>
                        ${getStatusHtml(status)}
                    </td>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                order.created_at ??
                                "-"
                            )
                        )}
                    </td>

                </tr>
            `;

        }).join("");

}

function renderRecentOrders(orders) {

    const table =
        document.getElementById(
            "recentOrders"
        );

    if (!table) return;

    if (!orders.length) {

        table.innerHTML = `
            <tr>
                <td colspan="5">
                    لا توجد طلبات حاليًا.
                </td>
            </tr>
        `;

        return;

    }

    table.innerHTML =
        orders
            .slice(0, 8)
            .map(function (order) {

                const status =
                    String(
                        order.status ||
                        "pending"
                    ).toLowerCase();

                return `
                    <tr>

                        <td>
                            ${escapeAdminHtml(
                                String(
                                    order.id ??
                                    order.order_id ??
                                    "-"
                                )
                            )}
                        </td>

                        <td>
                            ${escapeAdminHtml(
                                String(
                                    order.customer_id ??
                                    "-"
                                )
                            )}
                        </td>

                        <td>
                            ${escapeAdminHtml(
                                String(
                                    order.product_name ??
                                    order.product ??
                                    "-"
                                )
                            )}
                        </td>

                        <td>
                            ${formatAdminPrice(
                                order.price ??
                                order.amount ??
                                0
                            )}
                        </td>

                        <td>
                            ${getStatusHtml(status)}
                        </td>

                    </tr>
                `;

            })
            .join("");

}

function initializeProducts() {

    const refresh =
        document.getElementById(
            "refreshProducts"
        );

    if (refresh) {

        refresh.addEventListener(
            "click",
            loadAdminProducts
        );

    }

}

async function loadAdminProducts() {

    try {

        const data =
            await ADMIN_API.products();

        const products =
            Array.isArray(data)
                ? data
                : data.products ||
                  data.data ||
                  [];

        adminState.products =
            products;

        renderAdminProducts(products);

        setText(
            "productsLastUpdate",
            new Date().toLocaleString("ar")
        );

    } catch (error) {

        console.error(error);

        showAdminToast(
            "تعذر تحميل المنتجات."
        );

    }

}

function renderAdminProducts(products) {

    const table =
        document.getElementById(
            "productsTable"
        );

    if (!table) return;

    if (!products.length) {

        table.innerHTML = `
            <tr>
                <td colspan="6">
                    لا توجد منتجات.
                </td>
            </tr>
        `;

        return;

    }

    table.innerHTML =
        products.map(function (product) {

            const apiPrice =
                Number(
                    product.price ??
                    product.cost ??
                    0
                );

            const profit =
                Number(
                    adminState.settings.profit_rate ??
                    10
                ) / 100;

            const sellingPrice =
                apiPrice * (1 + profit);

            const available =
                product.available !== false &&
                product.available !== 0;

            return `
                <tr>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                product.id ??
                                product.product_id ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                product.name ??
                                product.title ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                product.category ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${formatAdminPrice(
                            apiPrice
                        )}
                    </td>

                    <td>
                        <strong>
                            ${formatAdminPrice(
                                sellingPrice
                            )}
                        </strong>
                    </td>

                    <td>
                        <span class="status ${
                            available
                                ? "status-success"
                                : "status-danger"
                        }">
                            ${
                                available
                                    ? "متوفر"
                                    : "غير متوفر"
                            }
                        </span>
                    </td>

                </tr>
            `;

        }).join("");

}

function initializeSettings() {

    const saveProfit =
        document.getElementById(
            "saveProfitRate"
        );

    const saveStore =
        document.getElementById(
            "saveStoreSettings"
        );

    if (saveProfit) {

        saveProfit.addEventListener(
            "click",
            saveProfitSettings
        );

    }

    if (saveStore) {

        saveStore.addEventListener(
            "click",
            saveStoreSettings
        );

    }

    loadAdminSettings();

}

async function loadAdminSettings() {

    try {

        const data =
            await ADMIN_API.settings();

        const settings =
            data.settings ||
            data;

        adminState.settings = {
            ...adminState.settings,
            ...settings
        };

        updateSettingsUI();

    } catch (error) {

        console.error(error);

    }

}

function updateSettingsUI() {

    const profit =
        Number(
            adminState.settings.profit_rate ??
            10
        );

    setValue(
        "profitRate",
        profit
    );

    setValue(
        "storeName",
        adminState.settings.store_name ??
        "متجر النبض الرقمي"
    );

    setValue(
        "storeCurrency",
        adminState.settings.currency ??
        "USD"
    );

    setText(
        "profitRatePreview",
        profit + "%"
    );

    setText(
        "productProfitRate",
        profit + "%"
    );

}

async function saveProfitSettings() {

    const input =
        document.getElementById(
            "profitRate"
        );

    if (!input) return;

    const profit =
        Number(input.value);

    if (
        Number.isNaN(profit) ||
        profit < 0 ||
        profit > 100
    ) {

        showAdminToast(
            "أدخل نسبة بين 0 و100."
        );

        return;

    }

    try {

        await ADMIN_API.updateSettings({
            profit_rate: profit
        });

        adminState.settings.profit_rate =
            profit;

        updateSettingsUI();

        showAdminToast(
            "تم حفظ نسبة الربح."
        );

    } catch (error) {

        console.error(error);

        showAdminToast(
            error.message ||
            "تعذر حفظ الإعدادات."
        );

    }

}

async function saveStoreSettings() {

    const name =
        document.getElementById(
            "storeName"
        );

    const currency =
        document.getElementById(
            "storeCurrency"
        );

    try {

        await ADMIN_API.updateSettings({

            store_name:
                name
                    ? name.value.trim()
                    : adminState.settings.store_name,

            currency:
                currency
                    ? currency.value
                    : "USD"

        });

        showAdminToast(
            "تم حفظ إعدادات المتجر."
        );

    } catch (error) {

        console.error(error);

        showAdminToast(
            error.message ||
            "تعذر حفظ الإعدادات."
        );

    }

}

function initializeNotifications() {

    const button =
        document.getElementById(
            "sendNotification"
        );

    if (!button) return;

    button.addEventListener(
        "click",
        async function () {

            const target =
                getValue(
                    "notificationTarget"
                );

            const customerId =
                getValue(
                    "notificationCustomerId"
                );

            const title =
                getValue(
                    "notificationTitle"
                );

            const message =
                getValue(
                    "notificationMessage"
                );

            if (!title || !message) {

                showAdminToast(
                    "أدخل عنوان ونص الإشعار."
                );

                return;

            }

            if (
                target === "customer" &&
                !customerId
            ) {

                showAdminToast(
                    "أدخل Customer ID للعميل."
                );

                return;

            }

            try {

                await ADMIN_API.sendNotification({

                    target: target,

                    customer_id:
                        target === "customer"
                            ? customerId
                            : null,

                    title: title,

                    message: message

                });

                showAdminToast(
                    "تم إرسال الإشعار."
                );

                setValue(
                    "notificationTitle",
                    ""
                );

                setValue(
                    "notificationMessage",
                    ""
                );

            } catch (error) {

                console.error(error);

                showAdminToast(
                    error.message ||
                    "تعذر إرسال الإشعار."
                );

            }

        }
    );

}

function initializeLogout() {

    const button =
        document.getElementById(
            "logoutButton"
        );

    if (!button) return;

    button.addEventListener(
        "click",
        async function () {

            try {

                await ADMIN_API.logout();

            } catch (error) {

                console.error(error);

            }

            window.location.href =
                "../index.html";

        }
    );

}

async function loadTransactions() {

    try {

        const data =
            await ADMIN_API.transactions();

        const transactions =
            Array.isArray(data)
                ? data
                : data.transactions ||
                  data.data ||
                  [];

        renderTransactions(
            transactions
        );

    } catch (error) {

        console.error(error);

        showAdminToast(
            "تعذر تحميل العمليات المالية."
        );

    }

}

function renderTransactions(
    transactions
) {

    const table =
        document.getElementById(
            "transactionsTable"
        );

    if (!table) return;

    if (!transactions.length) {

        table.innerHTML = `
            <tr>
                <td colspan="5">
                    لا توجد عمليات مالية.
                </td>
            </tr>
        `;

        return;

    }

    table.innerHTML =
        transactions.map(function (item) {

            return `
                <tr>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                item.id ??
                                item.transaction_id ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                item.customer_id ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${formatAdminPrice(
                            item.amount ??
                            0
                        )}
                    </td>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                item.type ??
                                "-"
                            )
                        )}
                    </td>

                    <td>
                        ${escapeAdminHtml(
                            String(
                                item.created_at ??
                                "-"
                            )
                        )}
                    </td>

                </tr>
            `;

        }).join("");

}

function getStatusHtml(status) {

    const map = {

        completed: {
            text: "مكتمل",
            className: "status-success"
        },

        success: {
            text: "ناجح",
            className: "status-success"
        },

        processing: {
            text: "قيد المعالجة",
            className: "status-warning"
        },

        pending: {
            text: "قيد الانتظار",
            className: "status-warning"
        },

        rejected: {
            text: "مرفوض",
            className: "status-danger"
        },

        failed: {
            text: "فشل",
            className: "status-danger"
        }

    };

    const item =
        map[status] || {
            text: status || "غير معروف",
            className: "status-neutral"
        };

    return `
        <span class="status ${item.className}">
            ${escapeAdminHtml(item.text)}
        </span>
    `;

}

function formatAdminPrice(value) {

    const number =
        Number(value) || 0;

    return "$" +
        number.toFixed(2);

}

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            String(value);
    }

}

function setValue(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value =
            value;
    }

}

function getValue(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value.trim()
        : "";

}

function escapeAdminHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

window.AdminPanel = {
    state: adminState,
    loadDashboard: loadAdminDashboard,
    loadCustomers: loadCustomers,
    loadOrders: loadOrders,
    loadProducts: loadAdminProducts,
    loadTransactions: loadTransactions,
    loadSettings: loadAdminSettings
};
