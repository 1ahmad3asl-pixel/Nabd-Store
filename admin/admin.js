const ADMIN_API = {
    base: "/api/admin",

    async request(endpoint, options = {}) {
        const response = await fetch(this.base + endpoint, {
            credentials: "same-origin",
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

    resetCustomerPassword(customerId) {
        return this.request("/customers/" + encodeURIComponent(customerId) + "/reset-password", {
            method: "POST",
            body: JSON.stringify({})
        });
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

    sendCustomerNotification(customerId, title, message) {
        return this.request(
            "/customers/" + encodeURIComponent(customerId) + "/notifications",
            {
                method: "POST",
                body: JSON.stringify({ title, message })
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

    customerWallet(customerId) {
        return this.request("/customers/" + encodeURIComponent(customerId) + "/wallet");
    },

    updateCustomerWallet(customerId, action, amount, note) {
        return this.request("/customers/" + encodeURIComponent(customerId) + "/wallet", {
            method: "POST",
            body: JSON.stringify({ action, amount: Number(amount), note: String(note || "") })
        });
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
    allCustomers: null,
    orders: [],
    products: [],
    settings: {
        profit_rate: 10,
        store_name: "Nabd-Store",
        currency: "USD",
        currency_decimals: 3,
        font_family: "Dubai Medium"
    }
};

document.addEventListener("DOMContentLoaded", async function () {

    try {
        const response = await fetch("/api/admin/auth/me", { headers: { "Accept": "application/json" } });
        if (!response.ok) {
            window.location.href = "login.html";
            return;
        }
    } catch (error) {
        window.location.href = "login.html";
        return;
    }

    initializeAdminNavigation();
    initializeAdminMenu();
initializeDashboard();
    initializeCustomers();
    initializeOrders();
    initializeProducts();
    initializeSettings();
    initializeNotifications();
    initializeLogout();
initializeAppearanceSettings();

    loadAdminDashboard();
    loadCustomers();

    // حدّث الإحصائيات الرئيسية فقط. لا تعِد تحميل العملاء تلقائيًا حتى لا تُلغى نتائج البحث.
    setInterval(function () {
        loadAdminDashboard();
    }, 15000);

});

function initializeAdminNavigation() {
    // تنقل موحد عبر delegation حتى تبقى أزرار القائمة مستجيبة دائمًا.
    document.addEventListener("click", function (event) {
        const button = event.target.closest(".admin-nav-item, .admin-tab, [data-section-link]");
        if (!button) return;

        const section =
            button.getAttribute("data-section") ||
            button.getAttribute("data-section-link");

        if (section) {
            event.preventDefault();
            if (section === "dashboard") {
                // الصفحة الرئيسية تعيد تحميل لوحة الإدارة كاملة لتحديث بياناتها من جديد.
                window.location.reload();
                return;
            }
            showAdminSection(section);
        }
    });
}

function showAdminSection(section) {
    if (section === "announcementSettings") {
        section = "settings";
        setTimeout(function () {
            const tab = document.querySelector('.settings-tab[data-settings-panel="dhikrSettingsPanel"]');
            if (tab) tab.click();
        }, 0);
    }


    document
        .querySelectorAll(".admin-section")
        .forEach(function (item) {

            item.classList.remove("active");

        });

    document
        .querySelectorAll(".admin-nav-item, .admin-tab")
        .forEach(function (item) {

            item.classList.remove("active");

        });

    const sectionElement =
        document.getElementById(section + "Section");

    if (sectionElement) {
        sectionElement.classList.add("active");
    }

    document
        .querySelectorAll(`.admin-nav-item[data-section="${section}"], .admin-tab[data-section="${section}"]`)
        .forEach(function (item) {
            item.classList.add("active");
        });

    const sidebar =
        document.getElementById("adminTabs");

    // القائمة تُفتح وتُغلق عبر class "open" فقط.


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

function initializeAdminTheme() {
    const toggle = document.getElementById("themeToggle");
    const saved = localStorage.getItem("nabd-admin-theme") || "dark";
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
    updateAdminThemeButton();
    if (toggle) toggle.addEventListener("click", function () {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        localStorage.setItem("nabd-admin-theme", next);
        updateAdminThemeButton();
        setText("adminThemeStatus", next === "dark" ? "ليلي" : "نهاري");
    });
}
function updateAdminThemeButton() {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;
    const dark = document.documentElement.dataset.theme !== "light";
    toggle.innerHTML = dark ? "<span>☀️</span><span>الوضع النهاري</span>" : "<span>🌙</span><span>الوضع الليلي</span>";
    toggle.title = dark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي";
    setText("adminThemeStatus", dark ? "ليلي" : "نهاري");
}
function initializeAdminMenu() {
    const button = document.getElementById("menuButton");
    const sidebar = document.getElementById("adminTabs");
    const overlay = document.getElementById("adminMenuOverlay");
    const closeButton = document.getElementById("closeMenuButton");

    if (!button || !sidebar) return;

    function setMenu(open) {
        sidebar.classList.toggle("open", open);
        if (overlay) overlay.classList.toggle("open", open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
        button.textContent = open ? "×" : "☰";
    }

    button.addEventListener("click", function () {
        setMenu(!sidebar.classList.contains("open"));
    });

    if (closeButton) closeButton.addEventListener("click", () => setMenu(false));
    if (overlay) overlay.addEventListener("click", () => setMenu(false));

    sidebar.addEventListener("click", function(event) {
        const item = event.target.closest(".admin-nav-item");
        if (item) setMenu(false);
    });
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
    setText("totalCustomers", "…");
    setText("customersTotalCount", "…");
    setText("totalOrders", "…");
    setText("totalCustomerBalance", "…");
    setText("totalSales", "…");
    setText("totalProfit", "…");
    setText("apiBalance", "…");

    try {
        const data = await ADMIN_API.dashboard();
        updateDashboard(data);
    } catch (error) {
        console.error("Admin dashboard load failed:", error);
        setText("totalCustomers", "—");
        setText("customersTotalCount", "—");
        setText("totalOrders", "—");
        setText("totalCustomerBalance", "—");
        setText("totalSales", "—");
        setText("totalProfit", "—");
        setText("apiBalance", "—");
        showAdminToast(error?.message || "تعذر تحميل بيانات لوحة التحكم.");
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
        "customersTotalCount",
        data.total_customers ??
        data.customers_count ??
        0
    );

    setText(
        "totalOrders",
        data.total_successful_orders ??
        data.successful_orders_count ??
        0
    );

    setText(
        "totalCustomerBalance",
        formatAdminPrice(data.total_customer_balance ?? 0)
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
        formatNemerBalance(
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

    if (refresh) {
        refresh.addEventListener("click", function () {
            refresh.disabled = true;
            refresh.textContent = "⏳ جارٍ تحديث البيانات...";
            loadCustomers(searchInput ? searchInput.value.trim() : "", true).finally(function () {
                refresh.disabled = false;
                refresh.textContent = "تحديث البيانات";
            });
        });
    }


    if (searchButton) {

        searchButton.addEventListener(
            "click",
            function () {

                loadCustomers(searchInput ? searchInput.value.trim() : "", false);

            }
        );

    }

    if (searchInput) {
        let searchTimer;

        // فلترة فورية من القائمة المحمّلة، دون انتظار طلب شبكة لكل حرف.
        searchInput.addEventListener("input", function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                loadCustomers(searchInput.value.trim(), false);
            }, 100);
        });

        searchInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                clearTimeout(searchTimer);
                loadCustomers(searchInput.value.trim(), false);
            }
        });
    }

}

function normalizeCustomerSearch(value) {
    return String(value ?? "")
        .trim()
        .toLocaleLowerCase()
        .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
        .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
        .replace(/\s/g, "").replace(/[\u200e\u200f-]/g, "");
}

async function loadCustomers(search = "", forceReload = true) {
    try {
        // نحمّل القائمة الكاملة عند الدخول/التحديث، ثم نفلتر حصريًا باستخدام ID المعروض في الجدول.
        if (forceReload || !Array.isArray(adminState.allCustomers)) {
            const data = await ADMIN_API.customers("");
            adminState.allCustomers = Array.isArray(data)
                ? data
                : data.customers || data.data || [];
        }

        const normalizedSearch = normalizeCustomerSearch(search);
        const customers = !normalizedSearch
            ? adminState.allCustomers.slice()
            : adminState.allCustomers.filter(function (customer) {
                const customerId = customer.customer_number ?? customer.number ?? customer.customer_id ?? customer.id ?? "";
                return normalizeCustomerSearch(customerId).includes(normalizedSearch);
            });

        adminState.customers = customers;
        // لا تغيّر إحصائية العملاء العامة بنتائج البحث؛ الإحصائيات الرئيسية تأتي من /dashboard.
        renderCustomers(customers);
    } catch (error) {
        console.error(error);
        showAdminToast("تعذر تحميل العملاء.");
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

            const internalId =
                customer.customer_id ??
                customer.id ??
                "";
            const id =
                customer.customer_number ??
                customer.number ??
                internalId;

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

                    <td class="customer-settings-cell">
                        <button
                            class="customer-settings-icon"
                            type="button"
                            data-customer-id="${escapeAdminHtml(String(internalId))}"
                            data-customer-name="${escapeAdminHtml(String(name))}"
                            data-action="customer-settings"
                            aria-label="إعدادات العميل ${escapeAdminHtml(String(name))}"
                            title="إعدادات العميل"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"></path>
                                <path d="m19.4 13.5 1.1.9-1.1 1.9-1.4-.5a7.8 7.8 0 0 1-1.7 1l-.2 1.5h-2.2l-.4-1.4a7.7 7.7 0 0 1-2 0l-.8 1.2-1.9-1.1.5-1.4a7.8 7.8 0 0 1-1-1.7l-1.5-.2v-2.2l1.4-.4a7.7 7.7 0 0 1 0-2l-1.2-.8 1.1-1.9 1.4.5a7.8 7.8 0 0 1 1.7-1l.2-1.5h2.2l.4 1.4a7.7 7.7 0 0 1 2 0l.8-1.2 1.9 1.1-.5 1.4a7.8 7.8 0 0 1 1 1.7l1.5.2v2.2l-1.4.4"></path>
                            </svg>
                        </button>
                    </td>

                    <td>
                        <strong>
                            ${escapeAdminHtml(String(id))}
                        </strong>
                    </td>

                    <td>
                        <div class="customer-table-user">
                            <span class="customer-table-avatar">${customer.avatar_url ? '<img src="'+escapeAdminHtml(String(customer.avatar_url))+'" alt="صورة العميل">' : '👤'}</span>
                            <span>${escapeAdminHtml(String(name))}</span>
                        </div>
                    </td>

                    <td>
                        ${formatAdminPrice(balance)}
                    </td>

                    <td>
                        ${escapeAdminHtml(String(orders))}
                    </td>

                    <td>
                        ${escapeAdminHtml(String(customer.customer_level ?? customer.level ?? customer.tier ?? "عميل — فضي"))}
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

                </tr>
            `;

        }).join("");

    table
        .querySelectorAll(
            '[data-action="info"]'
        )
        .forEach(function (button) {
            button.addEventListener("click", function () {
                openCustomerInfo(button.getAttribute("data-customer-id"));
            });
        });

    table
        .querySelectorAll(
            '[data-action="wallet"]'
        )
        .forEach(function (button) {
            button.addEventListener("click", function () {
                openCustomerWallet(button.getAttribute("data-customer-id"));
            });
        });

    table.querySelectorAll('[data-action="customer-settings"]').forEach(function(button) {
        button.addEventListener("click", function() {
            openCustomerSettings(
                button.getAttribute("data-customer-id"),
                button.getAttribute("data-customer-name") || "عميل"
            );
        });
    });

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

async function openCustomerSettings(customerId, customerName) {
    document.getElementById("customerSettingsDialog")?.remove();
    const html =
        "<div id='customerSettingsDialog' class='customer-info-dialog customer-settings-page' role='dialog' aria-modal='true' aria-labelledby='customerSettingsTitle'>" +
        "<div class='customer-info-card customer-settings-dialog-card'>" +
        "<div class='customer-settings-page-header'><div><span>إدارة العملاء</span><h2 id='customerSettingsTitle'>إعدادات العميل</h2><p id='customerSettingsSubtitle' class='customer-settings-customer-name'></p></div><button class='customer-settings-close' id='closeCustomerSettings' type='button' aria-label='إغلاق'>×</button></div>" +
        "<div id='customerSettingsLoading' class='customer-settings-placeholder'>جارٍ تحميل بيانات العميل...</div>" +
        "<div id='customerSettingsContent' hidden>" +
        "<div class='customer-settings-summary'><div class='customer-settings-balance-card'><span>الرصيد الحالي</span><strong id='settingsCustomerBalance'>—</strong></div><div class='customer-level-card customer-level-default' id='settingsCustomerLevelCard'><strong id='settingsCustomerLevel'>عميل</strong></div></div>" +
        "<section class='customer-settings-section'><h3>إدارة الرصيد</h3><form id='customerBalanceForm' class='customer-settings-form'>" +
        "<label for='customerBalanceAction'>نوع العملية</label><select id='customerBalanceAction'><option value='credit'>إضافة رصيد</option><option value='debit'>خصم رصيد</option></select>" +
        "<label for='customerBalanceAmount'>المبلغ</label><input id='customerBalanceAmount' type='number' min='0.001' max='1000000' step='0.001' required placeholder='أدخل المبلغ'>" +
        "<label for='customerBalanceNote'>ملاحظة (اختياري)</label><input id='customerBalanceNote' type='text' maxlength='500' placeholder='سبب الإضافة أو الخصم'>" +
        "<button id='saveCustomerBalance' class='customer-settings-action' type='submit'>تنفيذ العملية</button></form></section>" +
        "<section class='customer-settings-section'><h3>تعديل خصم العميل</h3><form id='customerDiscountForm' class='customer-settings-form'><label for='customerDiscountValue'>نسبة الخصم (%)</label><input id='customerDiscountValue' type='number' min='0' max='100' step='0.01' required><button id='saveCustomerDiscount' class='customer-settings-action' type='submit'>حفظ الخصم</button></form></section>" +
        "<section class='customer-settings-section'><h3>إرسال إشعار للعميل</h3><form id='customerNotificationForm' class='customer-settings-form'><label for='customerNotificationTitle'>عنوان الإشعار</label><input id='customerNotificationTitle' type='text' maxlength='150' required placeholder='اكتب عنوان الإشعار'><label for='customerNotificationMessage'>نص الإشعار</label><textarea id='customerNotificationMessage' rows='4' maxlength='10000' required placeholder='اكتب نص الإشعار'></textarea><button id='sendCustomerNotification' class='customer-settings-action' type='submit'>إرسال الإشعار لهذا العميل</button></form></section>" +
        "<section class='customer-settings-section'><h3>معلومات العميل</h3><div class='customer-settings-info-grid'>" +
        "<div><span>رقم الهاتف</span><strong id='settingsCustomerPhone'>—</strong></div><div><span>البريد الإلكتروني</span><strong id='settingsCustomerEmail' dir='auto'>—</strong></div>" +
        "<div class='customer-password-reset'><span>كلمة السر</span><strong>لا يمكن عرض كلمة السر القديمة</strong><small>يمكن إنشاء كلمة مرور جديدة عند الحاجة. ستتوقف كلمة المرور الحالية عن العمل.</small><button id='resetCustomerPassword' class='customer-settings-action' type='button'>إنشاء كلمة مرور جديدة</button><div id='customerNewPasswordResult' hidden><label for='customerNewPassword'>كلمة المرور الجديدة — احفظها الآن</label><input id='customerNewPassword' type='text' readonly autocomplete='off' dir='ltr'><button id='copyCustomerNewPassword' class='customer-settings-action' type='button'>نسخ كلمة المرور</button></div></div>" +
        "<div><span>عدد الطلبات</span><strong id='settingsCustomerOrders'>—</strong></div><div><span>الرصيد المدفوع</span><strong id='settingsCustomerPaid'>—</strong></div><div><span>تاريخ التسجيل</span><strong id='settingsCustomerCreated'>—</strong></div>" +
        "</div></section></div></div></div>";
    document.body.insertAdjacentHTML("beforeend", html);
    const dialog = document.getElementById("customerSettingsDialog");
    const close = function(){ dialog?.remove(); };
    document.getElementById("closeCustomerSettings").addEventListener("click", close);
    dialog.addEventListener("click", function(event){ if(event.target === dialog) close(); });
    try {
        const response = await ADMIN_API.customer(customerId);
        const customer = response.customer || {};
        const displayId = customer.customer_number ?? customer.customer_id ?? customerId;
        const displayName = customer.name ?? customer.username ?? customerName ?? "عميل";
        setText("customerSettingsSubtitle", String(displayName) + " · ID " + String(displayId));
        const value = (input) => input === null || input === undefined || String(input).trim() === "" ? "غير مضاف" : String(input);
        setText("settingsCustomerBalance", formatAdminPrice(customer.balance ?? 0));
        setText("settingsCustomerPhone", [customer.phone_country, customer.phone].filter(Boolean).join(" ") || "غير مضاف");
        setText("settingsCustomerEmail", value(customer.email));
        setText("settingsCustomerOrders", customer.orders_count ?? 0);
        setText("settingsCustomerPaid", formatAdminPrice(customer.paid_balance ?? 0));
        const customerLevel = String(customer.customer_level ?? customer.level ?? customer.tier ?? "عميل").trim() || "عميل";
        const levelCard = document.getElementById("settingsCustomerLevelCard");
        setText("settingsCustomerLevel", customerLevel);
        if (levelCard) {
            const normalizedLevel = customerLevel.toLocaleLowerCase("ar");
            const levelStyle = /فضي|silver/.test(normalizedLevel) ? "silver"
                : /ذهبي|gold/.test(normalizedLevel) ? "gold"
                : /بنفسجي|purple|violet/.test(normalizedLevel) ? "purple"
                : /أزرق|ازرق|blue/.test(normalizedLevel) ? "blue"
                : /أحمر|احمر|red/.test(normalizedLevel) ? "red"
                : "default";
            levelCard.className = "customer-level-card customer-level-" + levelStyle;
        }
        setText("settingsCustomerCreated", customer.created_at ? new Date(customer.created_at).toLocaleString("ar") : "غير متوفر");
        setValue("customerDiscountValue", Number(customer.discount ?? customer.discount_percent ?? 0));
        document.getElementById("customerSettingsLoading").hidden = true;
        document.getElementById("customerSettingsContent").hidden = false;

        document.getElementById("customerBalanceForm").addEventListener("submit", async function(event) {
            event.preventDefault();
            const action = getValue("customerBalanceAction");
            const amount = Number(getValue("customerBalanceAmount"));
            const note = getValue("customerBalanceNote");
            if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return showAdminToast("أدخل مبلغًا أكبر من صفر ولا يتجاوز 1,000,000.");
            const button = document.getElementById("saveCustomerBalance");
            button.disabled = true;
            try {
                const result = await ADMIN_API.updateCustomerWallet(customerId, action, amount, note);
                const wallet = result.wallet || result.customer || {};
                setText("settingsCustomerBalance", formatAdminPrice(wallet.balance ?? (Number(customer.balance || 0) + (action === "credit" ? amount : -amount))));
                customer.balance = wallet.balance ?? (Number(customer.balance || 0) + (action === "credit" ? amount : -amount));
                setValue("customerBalanceAmount", "");
                setValue("customerBalanceNote", "");
                showAdminToast(action === "credit" ? "تمت إضافة الرصيد بنجاح." : "تم خصم الرصيد بنجاح.");
                loadCustomers(getValue("customerSearch"), true);
            } catch(error) {
                showAdminToast(error.message || "تعذر تحديث رصيد العميل.");
            } finally {
                button.disabled = false;
            }
        });

        document.getElementById("resetCustomerPassword").addEventListener("click", async function() {
            if (!window.confirm("سيتم إلغاء كلمة المرور الحالية وإنشاء كلمة جديدة لهذا العميل. هل تريد المتابعة؟")) return;
            const button = document.getElementById("resetCustomerPassword");
            button.disabled = true;
            try {
                const result = await ADMIN_API.resetCustomerPassword(customerId);
                const password = String(result.temporary_password || "");
                if (!password) throw new Error("لم تصل كلمة المرور الجديدة من الخادم.");
                const output = document.getElementById("customerNewPassword");
                const resultPanel = document.getElementById("customerNewPasswordResult");
                output.value = password;
                resultPanel.hidden = false;
                button.textContent = "إنشاء كلمة مرور أخرى";
                showAdminToast("تم إنشاء كلمة مرور جديدة. انسخها وشاركها مع العميل بأمان.");
            } catch(error) {
                showAdminToast(error.message || "تعذر إنشاء كلمة مرور جديدة.");
            } finally {
                button.disabled = false;
            }
        });

        document.getElementById("copyCustomerNewPassword").addEventListener("click", async function() {
            const output = document.getElementById("customerNewPassword");
            try {
                await navigator.clipboard.writeText(output.value);
                showAdminToast("تم نسخ كلمة المرور.");
            } catch(error) {
                output.focus();
                output.select();
                showAdminToast("تعذر النسخ التلقائي. حدّد كلمة المرور وانسخها يدويًا.");
            }
        });

        document.getElementById("customerDiscountForm").addEventListener("submit", async function(event) {
            event.preventDefault();
            const discount = Number(getValue("customerDiscountValue"));
            if (!Number.isFinite(discount) || discount < 0 || discount > 100) return showAdminToast("يجب أن تكون نسبة الخصم بين 0 و100.");
            const button = document.getElementById("saveCustomerDiscount");
            button.disabled = true;
            try {
                const result = await ADMIN_API.updateCustomerDiscount(customerId, discount);
                customer.discount = result.customer?.discount ?? discount;
                setValue("customerDiscountValue", Number(customer.discount));
                showAdminToast("تم حفظ خصم العميل.");
                loadCustomers(getValue("customerSearch"), true);
            } catch(error) {
                showAdminToast(error.message || "تعذر حفظ خصم العميل.");
            } finally {
                button.disabled = false;
            }
        });

        document.getElementById("customerNotificationForm").addEventListener("submit", async function(event) {
            event.preventDefault();
            const title = getValue("customerNotificationTitle").trim();
            const message = getValue("customerNotificationMessage").trim();
            if (!title || !message) return showAdminToast("أدخل عنوان الإشعار ونصه.");
            const button = document.getElementById("sendCustomerNotification");
            if (!window.confirm("سيتم إرسال هذا الإشعار إلى هذا العميل فقط. هل تريد المتابعة؟")) return;
            button.disabled = true;
            try {
                await ADMIN_API.sendCustomerNotification(customerId, title, message);
                setValue("customerNotificationTitle", "");
                setValue("customerNotificationMessage", "");
                showAdminToast("تم إرسال الإشعار إلى هذا العميل.");
            } catch(error) {
                showAdminToast(error.message || "تعذر إرسال الإشعار.");
            } finally {
                button.disabled = false;
            }
        });
    } catch(error) {
        const loading = document.getElementById("customerSettingsLoading");
        if (loading) loading.textContent = error.message || "تعذر تحميل بيانات العميل.";
    }
}

async function openCustomerInfo(customerId) {
    try {
        const data = await ADMIN_API.customer(customerId);
        const customer = data.customer || {};
        const phone = String(customer.phone || "").trim() || "غير مضاف";
        const country = String(customer.phone_country || "").trim() || "غير محددة";
        const email = String(customer.email || "").trim() || "غير مضاف";
        const name = String(customer.name || "عميل");
        const number = customer.customer_number ?? customer.customer_id ?? customerId;
        const created = customer.created_at ? new Date(customer.created_at).toLocaleString("ar") : "غير متوفر";
        const avatar = customer.avatar_url ? '<img src="'+escapeAdminHtml(String(customer.avatar_url))+'" alt="صورة العميل" class="customer-info-avatar">' : '<span class="customer-info-avatar placeholder">👤</span>';
        const html = "<div id='customerInfoDialog' class='customer-info-dialog'><div class='customer-info-card'><div class='card-heading'><div class='customer-info-title'><div>" + avatar + "</div><div><span>بيانات العميل</span><h2>" + escapeAdminHtml(name) + "</h2></div></div><button class='small-button' id='closeCustomerInfo'>إغلاق</button></div><div class='customer-info-grid'>" +
            "<div><span>رقم العميل</span><strong>" + escapeAdminHtml(String(number)) + "</strong></div>" +
            "<div><span>رقم الهاتف</span><strong dir='ltr'>" + escapeAdminHtml(phone) + "</strong></div>" +
            "<div><span>الدولة</span><strong>" + escapeAdminHtml(country) + "</strong></div>" +
            "<div><span>البريد الإلكتروني</span><strong dir='ltr'>" + escapeAdminHtml(email) + "</strong></div>" +
            "<div><span>الرصيد</span><strong>" + formatAdminPrice(customer.balance || 0) + "</strong></div>" +
            "<div><span>عدد الطلبات</span><strong>" + escapeAdminHtml(String(customer.orders_count ?? 0)) + "</strong></div>" +
            "<div><span>الخصم</span><strong>" + Number(customer.discount || 0).toFixed(3) + "%</strong></div>" +
            "<div><span>تاريخ التسجيل</span><strong>" + escapeAdminHtml(created) + "</strong></div></div></div></div>";
        document.body.insertAdjacentHTML("beforeend", html);
        document.getElementById("closeCustomerInfo").onclick = function(){ document.getElementById("customerInfoDialog")?.remove(); };
    } catch (error) { showAdminToast(error.message || "تعذر تحميل معلومات العميل."); }
}
async function openCustomerWallet(customerId) {
    try {
        const data = await ADMIN_API.customerWallet(customerId);
        const wallet = data.wallet || {};
        const transactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];
        const typeMap = {admin_credit:"إضافة رصيد للعميل",admin_debit:"خصم رصيد من العميل",purchase:"شراء",refund:"استرداد",reversal:"عكس عملية"};
        const rows = transactions.length ? transactions.map(function(item) {
            const amount = Number(item.amount || 0);
            return "<tr><td>" + escapeAdminHtml(typeMap[item.type] || item.type || "-") + "</td><td>" +
                escapeAdminHtml((amount >= 0 ? "+" : "") + formatAdminPrice(amount)) + "</td><td>" +
                escapeAdminHtml(formatAdminPrice(item.balance_after || 0)) + "</td><td>" +
                escapeAdminHtml(item.note || "-") + "</td><td>" + escapeAdminHtml(item.created_at || "-") + "</td></tr>";
        }).join("") : "<tr><td colspan='5'>لا توجد حركات مالية لهذا العميل.</td></tr>";

        const html =
            "<div id='walletDialog' style='position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px'>" +
            "<div class='admin-card' style='width:min(100%,900px);max-height:90vh;overflow:auto'>" +
            "<div class='card-heading'><div><h2>محفظة العميل</h2><p style='margin:6px 0'>" +
            escapeAdminHtml(wallet.name || "عميل") + " · ID " + escapeAdminHtml(String(wallet.customer_number || customerId)) +
            "</p></div><button class='small-button' id='closeWalletDialog'>إغلاق</button></div>" +
            "<div class='statistics-grid' style='margin:15px 0'><div class='stat-card'><div class='stat-icon'>💰</div><div><span>الرصيد الحالي</span><strong>" +
            formatAdminPrice(wallet.balance || 0) + "</strong></div></div></div>" +
            "<div style='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px'>" +
            "<button class='primary-button' id='walletAdd'>➕ إضافة رصيد</button><button class='small-button' id='walletSubtract'>➖ خصم رصيد</button></div>" +
            "<div class='table-wrapper'><table><thead><tr><th>العملية</th><th>المبلغ</th><th>الرصيد بعد</th><th>السبب</th><th>التاريخ</th></tr></thead><tbody>" +
            rows + "</tbody></table></div></div></div>";

        document.body.insertAdjacentHTML("beforeend", html);
        document.getElementById("closeWalletDialog").onclick = function(){ document.getElementById("walletDialog")?.remove(); };

        async function changeWallet(action) {
            const amount = prompt(action === "credit" ? "أدخل مبلغ الإضافة بالدولار:" : "أدخل مبلغ الخصم بالدولار:", "0.000");
            if (amount === null) return;
            const value = Number(amount);
            if (!Number.isFinite(value) || value <= 0) { showAdminToast("أدخل مبلغًا صحيحًا أكبر من صفر."); return; }
            const note = prompt("سبب العملية (اختياري):", action === "credit" ? "إضافة رصيد من الإدارة" : "خصم رصيد من الإدارة");
            if (note === null) return;
            try {
                await ADMIN_API.updateCustomerWallet(customerId, action, value, note);
                showAdminToast(action === "credit" ? "تمت إضافة الرصيد بنجاح." : "تم خصم الرصيد بنجاح.");
                document.getElementById("walletDialog")?.remove();
                await loadCustomers();
                await openCustomerWallet(customerId);
                await loadTransactions();
            } catch (error) { showAdminToast(error.message || "تعذر تعديل الرصيد."); }
        }
        document.getElementById("walletAdd").onclick = function(){ changeWallet("credit"); };
        document.getElementById("walletSubtract").onclick = function(){ changeWallet("debit"); };
    } catch (error) {
        console.error(error);
        showAdminToast(error.message || "تعذر تحميل محفظة العميل.");
    }
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
        refresh.addEventListener("click", function () {
            refresh.disabled = true;
            refresh.textContent = "⏳ جارٍ تحديث البيانات...";
            loadOrders().finally(function () {
                refresh.disabled = false;
                refresh.textContent = "تحديث البيانات";
            });
        });
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

        updateOrderSummary(orders, data.order_summary || null);
        renderOrders(orders);

    } catch (error) {

        console.error(error);

        showAdminToast(
            "تعذر تحميل الطلبات."
        );

    }

}

function updateOrderSummary(orders, summary) {
    const totalEl = document.getElementById("ordersTotalCount");
    const failedEl = document.getElementById("ordersFailedCount");
    const successfulEl = document.getElementById("ordersSuccessfulCount");
    const failedStatuses = ["failed", "rejected", "cancelled", "canceled", "error"];
    const successfulStatuses = ["success", "successful", "completed", "complete", "done", "delivered", "ok", "نجاح", "ناجح", "ناجحة"];
    const total = summary && Number.isFinite(Number(summary.total))
        ? Number(summary.total)
        : orders.length;
    const failed = summary && Number.isFinite(Number(summary.failed))
        ? Number(summary.failed)
        : orders.filter(function(order) {
            return failedStatuses.includes(String(order.status || "").toLowerCase());
        }).length;
    const successful = summary && Number.isFinite(Number(summary.successful))
        ? Number(summary.successful)
        : orders.filter(function(order) {
            return successfulStatuses.includes(String(order.status || "").toLowerCase());
        }).length;
    if (totalEl) totalEl.textContent = String(total);
    if (failedEl) failedEl.textContent = String(failed);
    if (successfulEl) successfulEl.textContent = String(successful);
}
function normalizeOrderSearch(value) {
    return String(value ?? "")
        .trim()
        .toLocaleLowerCase()
        .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
        .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
        .replace(/\s/g, "")
        .replace(/[\u200e\u200f-]/g, "");
}

function filterOrders() {
    const searchInput = document.getElementById("orderSearch");
    const statusSelect = document.getElementById("orderStatusFilter");
    const search = normalizeOrderSearch(searchInput ? searchInput.value : "");
    const status = statusSelect ? statusSelect.value : "all";
    const failedStatuses = ["failed", "rejected", "cancelled", "canceled", "error"];
    const successfulStatuses = ["success", "successful", "completed", "complete", "done", "delivered", "ok", "نجاح", "ناجح", "ناجحة"];

    const filtered = (Array.isArray(adminState.orders) ? adminState.orders : []).filter(function(order) {
        const orderId = order.order_id ?? order.order_number ?? "";
        const customerNumber = order.customer_number ?? order.customerNumber ?? "";
        const matchesSearch = !search ||
            normalizeOrderSearch(orderId).includes(search) ||
            normalizeOrderSearch(customerNumber).includes(search);

        const orderStatus = String(order.status || "").trim().toLowerCase();
        const matchesStatus = status === "all" ||
            (status === "failed"
                ? failedStatuses.includes(orderStatus)
                : status === "successful"
                    ? successfulStatuses.includes(orderStatus)
                    : false);

        return matchesSearch && matchesStatus;
    });

    renderOrders(filtered);
}

function renderOrderCustomerFields(orderParams) {
    if (!orderParams) return "-";
    let params = orderParams;
    if (typeof params === "string") {
        try { params = JSON.parse(params); } catch { return escapeAdminHtml(params); }
    }
    if (!params || typeof params !== "object" || Array.isArray(params)) return "-";
    const entries = Object.entries(params).filter(function(entry) {
        return String(entry[0] || "").trim() && String(entry[1] ?? "").trim();
    });
    if (!entries.length) return "-";
    return entries.map(function(entry) {
        return '<div class="order-field-item"><strong>' +
            escapeAdminHtml(String(entry[0])) + ':</strong> <span>' +
            escapeAdminHtml(String(entry[1])) + '</span></div>';
    }).join("");
}

function renderOrders(orders) {
    const table = document.getElementById("ordersTable");
    if (!table) return;
    if (!orders.length) {
        table.innerHTML = '<tr><td colspan="10">لا توجد طلبات.</td></tr>';
        return;
    }
    table.innerHTML = orders.map(function(order) {
        const status = String(order.status || "pending").toLowerCase();
        return `
            <tr>
                <td>${escapeAdminHtml(String(order.order_id ?? order.order_number ?? "-"))}</td>
                <td>${escapeAdminHtml(String(order.customer_name ?? "-"))}</td>
                <td>${escapeAdminHtml(String(order.customer_number ?? "-"))}</td>
                <td class="order-customer-fields">${renderOrderCustomerFields(order.order_params)}</td>
                <td>${escapeAdminHtml(String(order.product_name ?? order.product ?? "-"))}</td>
                <td>${formatAdminPrice(order.api_price ?? order.cost ?? 0)}</td>
                <td>${formatAdminPrice(order.price ?? order.amount ?? 0)}</td>
                <td>${Number(order.discount ?? 0).toFixed(2)}%</td>
                <td>${getStatusHtml(status)}</td>
                <td>${escapeAdminHtml(String(order.created_at ?? "-"))}</td>
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
                                    order.order_id ??
                                    order.order_number ??
                                    "-"
                                )
                            )}
                        </td>

                        <td>
                            ${escapeAdminHtml(
                                String(
                                    order.customer_number ??
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
                    product.api_price ??
                    product.cost ??
                    product.price ??
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

function initializeAppearanceSettings() {
    const toggle=document.getElementById("adminThemeToggle");
    const headerLogout=document.getElementById("logoutButtonHeader");
    const saved=localStorage.getItem("nabd-admin-theme")||"dark";
    document.documentElement.dataset.theme=saved==="light"?"light":"dark";
    if(toggle){
        toggle.textContent=saved==="light"?"🌙":"☀️";
        toggle.addEventListener("click",function(){
            const next=document.documentElement.dataset.theme==="dark"?"light":"dark";
            document.documentElement.dataset.theme=next;
            localStorage.setItem("nabd-admin-theme",next);
            toggle.textContent=next==="light"?"🌙":"☀️";
        });
    }
    if(headerLogout) headerLogout.addEventListener("click",performAdminLogout);
    const saveAppearance=document.getElementById("saveAppearanceSettings");
    if(saveAppearance) saveAppearance.addEventListener("click",async function(){
        try{
            const font=getValue("adminFont")||"Dubai Medium";
            await ADMIN_API.updateSettings({font_family:font});
            adminState.settings.font_family=font;
            applyAdminFont();
            showAdminToast("تم حفظ المظهر والخط.");
        }catch(error){showAdminToast(error.message||"تعذر حفظ المظهر.");}
    });

    document.querySelectorAll(".settings-tab").forEach(tab=>{
        tab.addEventListener("click",()=>{
            document.querySelectorAll(".settings-tab").forEach(item=>item.classList.remove("active"));
            document.querySelectorAll(".settings-panel").forEach(panel=>panel.classList.remove("active"));
            tab.classList.add("active");
            const panel=document.getElementById(tab.dataset.settingsPanel);
            if(panel) panel.classList.add("active");
        });
    });
}

function initializeAdminTheme(){
    const saved=localStorage.getItem("nabd-admin-theme")||"dark";
    document.documentElement.dataset.theme=saved==="light"?"light":"dark";
}

async function performAdminLogout(){
    try{await ADMIN_API.logout();}catch(error){console.error(error);}
    window.location.href="login.html";
}

function initializeSettings() {

    const saveProfit =
        document.getElementById(
            "saveProfitRate"
        );

    const saveStore = document.getElementById("saveStoreSettings");
    const saveAppearance = document.getElementById("saveAppearanceSettings");

    if (saveProfit) {

        saveProfit.addEventListener(
            "click",
            saveProfitSettings
        );

    }

    if (saveStore) {
        saveStore.addEventListener("click", saveStoreSettings);
    }

    const saveDhikr = document.getElementById("saveDhikrSettings");
    const dhikrInput = document.getElementById("dhikrItems");
    if (saveDhikr) {
        saveDhikr.addEventListener("click", saveDhikrSettings);
    }
    if (dhikrInput) {
        dhikrInput.addEventListener("keydown", function(event) {
            if (event.key !== "Enter") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const start = dhikrInput.selectionStart ?? dhikrInput.value.length;
            const end = dhikrInput.selectionEnd ?? start;
            dhikrInput.setRangeText("\n", start, end, "end");
            dhikrInput.dispatchEvent(new Event("input", {bubbles:true}));
        });
    }

    document.querySelectorAll(".settings-tab").forEach(function(tab){
        tab.addEventListener("click",function(){
            const panel=tab.getAttribute("data-settings-panel");
            document.querySelectorAll(".settings-tab").forEach(function(item){item.classList.remove("active");});
            document.querySelectorAll(".settings-panel").forEach(function(item){item.classList.remove("active");});
            tab.classList.add("active");
            const target=document.getElementById(panel);
            if(target) target.classList.add("active");
        });
    });

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
    setValue("numberProfitRate", Number(adminState.settings.number_profit_rate ?? 10));

    setValue(
        "storeName",
        adminState.settings.store_name ??
        "Nabd-Store"
    );

    setValue("storeCurrency", adminState.settings.currency ?? "USD");
    setValue("currencyDecimals", Number(adminState.settings.currency_decimals ?? 3));
    setValue("adminFont", adminState.settings.font_family ?? "Dubai Medium");
    setValue("dhikrItems", Array.isArray(adminState.settings.dhikr_items) ? adminState.settings.dhikr_items.join("\n") : "سبحان اللّٰه\nالحمد للّٰه\nلا إله إلا اللّٰه\nاللّٰه أكبر");
    applyAdminFont(adminState.settings.font_family ?? "Dubai Medium");
    setText("adminFontPreview", adminState.settings.font_family ?? "Dubai Medium");
    setText("adminDecimalsPreview", (Number(adminState.settings.currency_decimals ?? 3) === 2 ? "2 خانتان عشريتان" : "3 خانات عشرية"));

    setText(
        "profitRatePreview",
        profit + "%"
    );

    setText("productProfitRate", profit + "%");
    setText("adminFontPreview", adminState.settings.font_family ?? "Dubai Medium");
    const currency = String(adminState.settings.currency || "USD");
    const currencyNames = {USD:"USD ($)",EUR:"EUR (€)",TRY:"TRY (₺)",SAR:"SAR",AED:"AED"};
    setText("adminCurrencyPreview", currencyNames[currency] || currency);

}

function applyAdminFont(font) {
    const allowed = ["Dubai Medium"];
    const selected = allowed.includes(String(font)) ? String(font) : "Dubai Medium";
    document.documentElement.style.setProperty("--admin-font", '"' + selected + '", Tahoma, Arial, sans-serif');
}

async function saveDhikrSettings() {
    const input = document.getElementById("dhikrItems");
    if (!input) return;
    const items = input.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    if (!items.length) {
        showAdminToast("أدخل ذكرًا واحدًا على الأقل.");
        return;
    }
    if (items.length > 12) {
        showAdminToast("يمكن إضافة 12 عبارة كحد أقصى.");
        return;
    }
    if (items.some(item => item.length > 80)) {
        showAdminToast("كل عبارة يجب ألا تتجاوز 80 حرفًا.");
        return;
    }
    try {
        const data = await ADMIN_API.updateSettings({dhikr_items: items});
        adminState.settings = {...adminState.settings, ...(data.settings || {}), dhikr_items: items};
        updateSettingsUI();
        showAdminToast("تم حفظ شريط الإعلانات.");
    } catch (error) {
        console.error(error);
        showAdminToast(error.message || "تعذر حفظ شريط الأذكار.");
    }
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

        const numberProfit = Number(document.getElementById("numberProfitRate")?.value ?? 10);
        if (Number.isNaN(numberProfit) || numberProfit < 0 || numberProfit > 100) {
            showAdminToast("أدخل نسبة ربح الأرقام بين 0 و100.");
            return;
        }

        await ADMIN_API.updateSettings({
            profit_rate: profit,
            number_profit_rate: numberProfit,
            currency_decimals: Number(document.getElementById("currencyDecimals")?.value || 3)
        });

        adminState.settings.profit_rate =
            profit;
        adminState.settings.number_profit_rate = numberProfit;

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

            currency: currency ? currency.value : "USD",
            currency_decimals: Number(document.getElementById("currencyDecimals")?.value || 3),
            font_family: document.getElementById("adminFont")?.value || "Dubai Medium"

        });

        adminState.settings = {
            ...adminState.settings,
            store_name: name ? name.value.trim() : adminState.settings.store_name,
            currency: currency ? currency.value : "USD",
            currency_decimals: Number(document.getElementById("currencyDecimals")?.value || 3),
            font_family: document.getElementById("adminFont")?.value || "Dubai Medium"
        };
        updateSettingsUI();

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

            try {

                const confirmed = window.confirm("سيتم إرسال هذا الإشعار إلى جميع العملاء. هل تريد المتابعة؟");
                if (!confirmed) return;

                button.disabled = true;
                button.textContent = "جارٍ الإرسال...";

                await ADMIN_API.sendNotification({
                    target: "all",
                    customer_id: null,
                    title: title,
                    message: message
                });

                setValue("notificationTitle", "");
                setValue("notificationMessage", "");

                const successNotice = document.getElementById("generalNotificationSuccess");
                if (successNotice) successNotice.hidden = false;

            } catch (error) {

                console.error(error);

                showAdminToast(
                    error.message ||
                    "تعذر إرسال الإشعار."
                );

            } finally {
                const successNotice = document.getElementById("generalNotificationSuccess");
                if (!successNotice || successNotice.hidden) {
                    button.disabled = false;
                    button.textContent = "إرسال الإشعار";
                }
            }

        }
    );

    const closeSuccessButton = document.getElementById("closeGeneralNotificationSuccess");
    if (closeSuccessButton) {
        closeSuccessButton.addEventListener("click", function () {
            const successNotice = document.getElementById("generalNotificationSuccess");
            if (successNotice) successNotice.hidden = true;
            button.disabled = false;
            button.textContent = "إرسال الإشعار";
        });
    }

}

function initializeLogout() {

    const buttons = [
        document.getElementById("logoutButton"),
        document.getElementById("logoutButtonHeader")
    ].filter(Boolean);

    if (!buttons.length) return;

    buttons.forEach(function(button){
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
    });

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

        renderTransactions(transactions);

        const budget = data.budget || {};
        const setWalletStat = function(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = formatAdminPrice(value);
        };
        setWalletStat("walletCustomerBalance", budget.customer_balance ?? 0);
        setWalletStat("totalDeposits", budget.sales ?? 0);
        setWalletStat("totalWithdrawals", budget.customer_outflows ?? 0);
        setWalletStat("budgetNet", budget.net_profit ?? 0);

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
                        <strong class="${Number(item.amount || 0) >= 0 ? "status-success" : "status-danger"}">
                            ${Number(item.amount || 0) >= 0 ? "+" : ""}${formatAdminPrice(item.amount ?? 0)}
                        </strong>
                    </td>

                    <td>
                        ${escapeAdminHtml(({
                            admin_credit:"إضافة رصيد للعميل",
                            admin_debit:"خصم رصيد من العميل",
                            purchase:"شراء",
                            refund:"استرداد",
                            reversal:"عكس عملية"
                        })[item.type] || String(item.type || "-"))}
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

function formatNemerBalance(value) {
    const number = Number(value);
    return "$" + (Number.isFinite(number) ? number : 0).toFixed(3);
}

function formatAdminPrice(value) {
    const number = Number(value) || 0;
    const configured = Number(adminState.settings.currency_decimals);
    const decimals = Number.isInteger(configured) && configured >= 0 && configured <= 6
        ? configured
        : 3;
    const currency = String(adminState.settings.currency || "USD");
    const symbols = {USD:"$",EUR:"€",TRY:"₺",SAR:"﷼",AED:"د.إ"};
    return (symbols[currency] || currency + " ") + number.toFixed(decimals);
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
