const state = {
    products: [],
    selectedCategory: "all",
    balance: 0,
    user: null,
    notifications: 0,
    searchQuery: ""
};

const BACKEND_URL = "https://nabd-store.onrender.com";

const elements = {
    products: document.getElementById("products"),
    balance: document.getElementById("balance"),
    heroBalance: document.getElementById("heroBalance"),
    drawer: document.getElementById("drawer"),
    overlay: document.getElementById("overlay"),
    menuBtn: document.getElementById("menuBtn"),
    closeMenu: document.getElementById("closeMenu"),
    toast: document.getElementById("toast"),
    modal: document.getElementById("modal"),
    modalBody: document.getElementById("modalBody"),
    modalClose: document.getElementById("modalClose"),
    modalOverlay: document.getElementById("modalOverlay"),
    menuUserName: document.getElementById("menuUserName"),
    menuCustomerId: document.getElementById("menuCustomerId"),
    notificationBadge: document.getElementById("notificationBadge")
};


/* =========================
   START
========================= */

document.addEventListener("DOMContentLoaded", function () {

    initializeMenu();
    initializeCategories();
    initializeQuickMenu();
    initializeModal();
    initializeSounds();
    initializeSearch();

    removeAllCategory();

    updateBalance(0);

    loadProducts();
});


/* =========================
   SOUNDS
========================= */

let audioContext = null;

function getAudioContext() {

    if (!audioContext) {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextClass) {
            return null;
        }

        audioContext =
            new AudioContextClass();
    }

    if (audioContext.state === "suspended") {

        audioContext.resume().catch(function () {});

    }

    return audioContext;
}


/*
 * صوت النقر العام
 */

function playClickSound() {

    try {

        const context =
            getAudioContext();

        if (!context) return;

        const oscillator =
            context.createOscillator();

        const gain =
            context.createGain();

        oscillator.type = "sine";

        oscillator.frequency.setValueAtTime(
            600,
            context.currentTime
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            850,
            context.currentTime + 0.055
        );

        gain.gain.setValueAtTime(
            0.0001,
            context.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.045,
            context.currentTime + 0.008
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime + 0.075
        );

        oscillator.connect(gain);

        gain.connect(
            context.destination
        );

        oscillator.start();

        oscillator.stop(
            context.currentTime + 0.085
        );

    } catch (error) {

        console.warn(
            "Click sound unavailable:",
            error
        );
    }
}


/*
 * صوت إضافة الرصيد
 */

function playAddBalanceSound() {

    try {

        const context =
            getAudioContext();

        if (!context) return;

        const oscillator =
            context.createOscillator();

        const gain =
            context.createGain();

        oscillator.type = "sine";

        oscillator.frequency.setValueAtTime(
            520,
            context.currentTime
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            880,
            context.currentTime + 0.12
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            1040,
            context.currentTime + 0.22
        );

        gain.gain.setValueAtTime(
            0.0001,
            context.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.07,
            context.currentTime + 0.02
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime + 0.28
        );

        oscillator.connect(gain);

        gain.connect(
            context.destination
        );

        oscillator.start();

        oscillator.stop(
            context.currentTime + 0.3
        );

    } catch (error) {

        console.warn(
            "Balance sound unavailable:",
            error
        );
    }
}


/*
 * تشغيل صوت النقر على الهاتف والكمبيوتر
 */

function initializeSounds() {

    document.addEventListener(
        "pointerdown",
        function (event) {

            const target =
                event.target.closest(
                    "button, a, .category, .quick-item, .drawer-link, .whatsapp-float, .buy-btn"
                );

            if (!target) return;

            getAudioContext();

            playClickSound();
        },
        {
            passive: true
        }
    );


    /*
     * تهيئة الصوت عند أول تفاعل
     */

    document.addEventListener(
        "touchstart",
        function () {

            getAudioContext();

        },
        {
            once: true,
            passive: true
        }
    );

}


/* =========================
   MENU
========================= */

function initializeMenu() {

    if (elements.menuBtn) {

        elements.menuBtn.addEventListener(
            "click",
            openMenu
        );
    }


    if (elements.closeMenu) {

        elements.closeMenu.addEventListener(
            "click",
            closeMenu
        );
    }


    if (elements.overlay) {

        elements.overlay.addEventListener(
            "click",
            closeMenu
        );
    }


    document
        .querySelectorAll(".drawer-link")
        .forEach(function (link) {

            link.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    const action =
                        link.getAttribute("href");

                    closeMenu();

                    if (action === "#home") {

                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });

                    } else {

                        handleAction(
                            action.replace("#", "")
                        );
                    }

                }
            );

        });

}


function openMenu() {

    if (
        !elements.drawer ||
        !elements.overlay
    ) {
        return;
    }

    elements.drawer.classList.add(
        "active"
    );

    elements.overlay.classList.add(
        "active"
    );

    document.body.style.overflow =
        "hidden";
}


function closeMenu() {

    if (
        !elements.drawer ||
        !elements.overlay
    ) {
        return;
    }

    elements.drawer.classList.remove(
        "active"
    );

    elements.overlay.classList.remove(
        "active"
    );

    document.body.style.overflow =
        "";
}


/* =========================
   REMOVE "ALL"
========================= */

function removeAllCategory() {

    document
        .querySelectorAll(
            '.category[data-category="all"]'
        )
        .forEach(function (element) {

            element.remove();

        });

    state.selectedCategory = "games";

    const firstCategory =
        document.querySelector(
            ".category"
        );

    if (firstCategory) {

        document
            .querySelectorAll(".category")
            .forEach(function (item) {

                item.classList.remove(
                    "active"
                );

            });

        firstCategory.classList.add(
            "active"
        );

        state.selectedCategory =
            firstCategory.getAttribute(
                "data-category"
            ) || "games";
    }
}


/* =========================
   CATEGORIES
========================= */

function initializeCategories() {

    document
        .querySelectorAll(".category")
        .forEach(function (button) {

            if (
                button.getAttribute(
                    "data-category"
                ) === "all"
            ) {
                return;
            }

            button.addEventListener(
                "click",
                function () {

                    document
                        .querySelectorAll(".category")
                        .forEach(function (item) {

                            item.classList.remove(
                                "active"
                            );

                        });

                    button.classList.add(
                        "active"
                    );

                    state.selectedCategory =
                        button.getAttribute(
                            "data-category"
                        ) || "other";

                    renderProducts();
                }
            );

        });

}


/* =========================
   SEARCH
========================= */

function initializeSearch() {

    let searchInput =
        document.getElementById(
            "productSearch"
        );


    /*
     * إذا لم يكن مربع البحث موجودًا
     * في index.html يتم إنشاؤه تلقائيًا.
     */

    if (!searchInput) {

        const searchBox =
            document.createElement("div");

        searchBox.className =
            "store-search";

        searchBox.innerHTML = `
            <div
                style="
                    width:100%;
                    display:flex;
                    align-items:center;
                    gap:10px;
                    background:#ffffff;
                    border:1px solid #e1e5eb;
                    border-radius:12px;
                    padding:0 14px;
                    min-height:54px;
                    box-shadow:0 3px 12px rgba(0,0,0,.05);
                "
            >
                <span
                    style="
                        font-size:21px;
                        flex-shrink:0;
                    "
                >
                    🔍
                </span>

                <input
                    id="productSearch"
                    type="search"
                    placeholder="ابحث عن خدمة أو منتج..."
                    autocomplete="off"
                    style="
                        width:100%;
                        height:52px;
                        border:0;
                        outline:none;
                        background:transparent;
                        font-size:15px;
                        color:#172033;
                        direction:rtl;
                    "
                >
            </div>
        `;


        const dhikr =
            document.querySelector(
                ".dhikr-bar"
            );


        if (dhikr) {

            dhikr.insertAdjacentElement(
                "afterend",
                searchBox
            );

        } else {

            const container =
                document.querySelector(
                    ".container"
                );

            if (container) {

                container.prepend(
                    searchBox
                );
            }
        }


        searchInput =
            document.getElementById(
                "productSearch"
            );
    }


    if (!searchInput) return;


    searchInput.addEventListener(
        "input",
        function () {

            state.searchQuery =
                searchInput.value
                    .trim()
                    .toLowerCase();

            renderProducts();
        }
    );


    searchInput.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                searchInput.value = "";

                state.searchQuery = "";

                renderProducts();

                searchInput.blur();
            }

        }
    );

}


/* =========================
   QUICK MENU
========================= */

function initializeQuickMenu() {

    document
        .querySelectorAll(".quick-item")
        .forEach(function (item) {

            item.addEventListener(
                "click",
                function () {

                    const action =
                        item.getAttribute(
                            "data-action"
                        );

                    handleAction(action);
                }
            );

        });

}


/* =========================
   MODAL
========================= */

function initializeModal() {

    if (elements.modalClose) {

        elements.modalClose.addEventListener(
            "click",
            closeModal
        );
    }


    if (elements.modalOverlay) {

        elements.modalOverlay.addEventListener(
            "click",
            closeModal
        );
    }

}


function handleAction(action) {

    switch (action) {

        case "orders":

            showModal(
                "طلباتي",
                `
                <div class="empty-state">

                    <div
                        style="
                            font-size:40px;
                            margin-bottom:10px;
                        "
                    >
                        📦
                    </div>

                    <h3>
                        طلباتي
                    </h3>

                    <p>
                        سيتم عرض طلباتك هنا بعد تسجيل الدخول.
                    </p>

                </div>
                `
            );

            break;


        case "notifications":

            showModal(
                "الإشعارات",
                `
                <div class="empty-state">

                    <div
                        style="
                            font-size:40px;
                            margin-bottom:10px;
                        "
                    >
                        🔔
                    </div>

                    <h3>
                        لا توجد إشعارات
                    </h3>

                    <p>
                        ستظهر إشعارات طلباتك وتحديثات الحساب هنا.
                    </p>

                </div>
                `
            );

            break;


        case "account":

            showModal(
                "حسابي",
                `
                <div class="empty-state">

                    <div
                        style="
                            font-size:40px;
                            margin-bottom:10px;
                        "
                    >
                        👤
                    </div>

                    <h3>
                        حسابي
                    </h3>

                    <p>
                        سيتم تفعيل الحساب وتسجيل الدخول
                        في المرحلة التالية.
                    </p>

                </div>
                `
            );

            break;


        case "wallet":

            showModal(
                "المحفظة",
                `
                <div
                    style="
                        text-align:center;
                        padding:20px;
                    "
                >

                    <div
                        style="
                            font-size:42px;
                            margin-bottom:12px;
                        "
                    >
                        💳
                    </div>

                    <p
                        style="
                            color:#70798a;
                            margin-bottom:8px;
                        "
                    >
                        رصيدك الحالي
                    </p>

                    <strong
                        style="
                            font-size:30px;
                            color:#0d6efd;
                            direction:ltr;
                            display:block;
                            font-variant-numeric:tabular-nums;
                        "
                    >
                        ${formatBalance(state.balance)}
                    </strong>

                </div>
                `
            );

            break;


        default:
            break;
    }

}


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {

    showProductsLoading();

    try {

        /*
         * مهم:
         * الموقع موجود على GitHub Pages،
         * لذلك /api/products لن يعمل من GitHub.
         *
         * نستخدم Render مباشرة.
         */

        const response =
            await fetch(
                BACKEND_URL + "/api/products",
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json"
                    },

                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );
        }


        const data =
            await response.json();


        state.products =
            normalizeProducts(data);


        renderProducts();


    } catch (error) {

        console.error(
            "Products loading error:",
            error
        );

        showProductsError();
    }

}


/* =========================
   NORMALIZE PRODUCTS
========================= */

function normalizeProducts(data) {

    let products = [];


    if (Array.isArray(data)) {

        products = data;

    } else if (
        data &&
        Array.isArray(data.products)
    ) {

        products =
            data.products;

    } else if (
        data &&
        data.data &&
        Array.isArray(data.data)
    ) {

        products =
            data.data;

    } else if (
        data &&
        data.data &&
        Array.isArray(
            data.data.products
        )
    ) {

        products =
            data.data.products;
    }


    return products.map(
        function (product) {

            const apiPrice =
                Number(
                    product.price ??
                    product.cost ??
                    product.amount ??
                    0
                );


            const profitRate =
                10;


            const sellingPrice =
                apiPrice *
                (1 + profitRate / 100);


            return {

                id:
                    product.id ??
                    product.product_id ??
                    product.productId ??
                    null,

                name:
                    product.name ??
                    product.title ??
                    "خدمة رقمية",

                description:
                    product.description ??
                    product.desc ??
                    "خدمة رقمية",

                category:
                    product.category_name ??
                    product.category ??
                    product.categoryName ??
                    "other",

                apiPrice:
                    apiPrice,

                price:
                    sellingPrice,

                available:
                    product.available !== false &&
                    product.available !== 0,

                params:
                    Array.isArray(product.params)
                        ? product.params
                        : [],

                raw:
                    product
            };

        }
    );

}


/* =========================
   RENDER PRODUCTS
========================= */

function renderProducts() {

    if (!elements.products) {
        return;
    }


    let filteredProducts =
        state.products.filter(
            function (product) {

                /*
                 * القسم
                 */

                if (
                    state.selectedCategory !==
                    "all"
                ) {

                    const productCategory =
                        normalizeCategory(
                            product.category
                        );

                    const selectedCategory =
                        normalizeCategory(
                            state.selectedCategory
                        );


                    if (
                        productCategory !==
                        selectedCategory
                    ) {
                        return false;
                    }
                }


                /*
                 * البحث
                 */

                if (
                    state.searchQuery
                ) {

                    const searchableText =
                        (
                            String(
                                product.name || ""
                            ) +
                            " " +
                            String(
                                product.description || ""
                            ) +
                            " " +
                            String(
                                product.category || ""
                            )
                        )
                        .toLowerCase();


                    if (
                        !searchableText.includes(
                            state.searchQuery
                        )
                    ) {
                        return false;
                    }
                }


                return true;

            }
        );


    if (
        filteredProducts.length === 0
    ) {

        const hasSearch =
            Boolean(
                state.searchQuery
            );


        elements.products.innerHTML = `

            <div class="empty-state">

                <div
                    style="
                        font-size:40px;
                        margin-bottom:10px;
                    "
                >
                    ${
                        hasSearch
                            ? "🔍"
                            : "🛍️"
                    }
                </div>

                <h3>
                    ${
                        hasSearch
                            ? "لم يتم العثور على نتائج"
                            : "لا توجد خدمات"
                    }
                </h3>

                <p>
                    ${
                        hasSearch
                            ? "جرّب البحث بكلمة أخرى."
                            : "لم يتم العثور على خدمات في هذا القسم حاليًا."
                    }
                </p>

            </div>

        `;

        return;
    }


    elements.products.innerHTML = "";


    filteredProducts.forEach(
        function (product) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "product" +
                (
                    product.available
                        ? ""
                        : " product-unavailable"
                );


            card.dataset.category =
                normalizeCategory(
                    product.category
                );


            const icon =
                getProductIcon(
                    product
                );


            const price =
                formatPrice(
                    product.price
                );


            card.innerHTML = `

                <div class="product-icon">
                    ${icon}
                </div>

                <h3>
                    ${escapeHtml(
                        product.name
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        product.description
                    )}
                </p>

                <div class="price">
                    ${price}
                </div>

                <button
                    class="buy-btn"
                    ${
                        product.available
                            ? ""
                            : "disabled"
                    }
                    data-product-id="${escapeHtml(
                        String(
                            product.id ?? ""
                        )
                    )}"
                >
                    ${
                        product.available
                            ? "شراء الآن"
                            : "غير متوفر"
                    }
                </button>

            `;


            const buyButton =
                card.querySelector(
                    ".buy-btn"
                );


            if (
                product.available &&
                buyButton
            ) {

                buyButton.addEventListener(
                    "click",
                    function () {

                        openProduct(
                            product
                        );

                    }
                );

            }


            elements.products.appendChild(
                card
            );

        }
    );

}


/* =========================
   OPEN PRODUCT
========================= */

function openProduct(product) {

    if (!product) return;


    const params =
        Array.isArray(
            product.params
        )
            ? product.params
            : [];


    let paramsHtml = "";


    if (params.length > 0) {

        paramsHtml = `

            <div
                style="
                    margin-top:20px;
                "
            >

                <h4
                    style="
                        margin-bottom:12px;
                    "
                >
                    بيانات الطلب
                </h4>

                ${
                    params
                        .map(
                            function (
                                param,
                                index
                            ) {

                                const name =
                                    typeof param ===
                                    "string"

                                        ? param

                                        : param.name ??
                                          param.title ??
                                          param.key ??
                                          "البيان " +
                                          (
                                              index + 1
                                          );


                                const key =
                                    typeof param ===
                                    "string"

                                        ? param

                                        : param.key ??
                                          param.name ??
                                          "param_" +
                                          index;


                                return `

                                    <div
                                        style="
                                            margin-bottom:12px;
                                        "
                                    >

                                        <label
                                            for="param_${index}"
                                            style="
                                                display:block;
                                                margin-bottom:6px;
                                                font-size:13px;
                                            "
                                        >
                                            ${escapeHtml(
                                                name
                                            )}
                                        </label>

                                        <input
                                            id="param_${index}"
                                            name="${escapeHtml(
                                                String(key)
                                            )}"
                                            class="order-param"
                                            type="text"
                                            placeholder="أدخل ${escapeHtml(
                                                name
                                            )}"
                                            style="
                                                width:100%;
                                                padding:11px;
                                                border:1px solid #e1e5eb;
                                                border-radius:10px;
                                                outline:none;
                                            "
                                        >

                                    </div>

                                `;
                            }
                        )
                        .join("")
                }

            </div>

        `;
    }


    showModal(
        "تأكيد الطلب",
        `

        <div>

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                    margin-bottom:18px;
                "
            >

                <div
                    style="
                        width:55px;
                        height:55px;
                        border-radius:14px;
                        background:#edf4ff;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:25px;
                    "
                >
                    ${getProductIcon(
                        product
                    )}
                </div>

                <div>

                    <h3>
                        ${escapeHtml(
                            product.name
                        )}
                    </h3>

                    <p
                        style="
                            color:#70798a;
                            font-size:13px;
                            margin-top:4px;
                        "
                    >
                        ${escapeHtml(
                            product.description
                        )}
                    </p>

                </div>

            </div>


            ${paramsHtml}


            <div
                style="
                    margin-top:20px;
                    padding:14px;
                    background:#f4f7fb;
                    border-radius:12px;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                "
            >

                <span>
                    السعر
                </span>

                <strong
                    style="
                        color:#0d6efd;
                        direction:ltr;
                        font-variant-numeric:tabular-nums;
                    "
                >
                    ${formatPrice(
                        product.price
                    )}
                </strong>

            </div>


            <button
                id="confirmOrder"
                style="
                    width:100%;
                    margin-top:15px;
                    padding:12px;
                    border:0;
                    border-radius:10px;
                    background:#0d6efd;
                    color:white;
                    cursor:pointer;
                    font-size:14px;
                "
            >
                تأكيد الطلب
            </button>


        </div>

        `
    );


    const confirmButton =
        document.getElementById(
            "confirmOrder"
        );


    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            function () {

                prepareOrder(
                    product
                );

            }
        );
    }

}


/* =========================
   PREPARE ORDER
========================= */

function prepareOrder(product) {

    const inputs =
        document.querySelectorAll(
            ".order-param"
        );


    const params = {};


    inputs.forEach(
        function (input) {

            params[input.name] =
                input.value.trim();

        }
    );


    for (
        const key in params
    ) {

        if (!params[key]) {

            showToast(
                "يرجى إدخال جميع بيانات الطلب."
            );

            return;
        }

    }


    /*
     * لا يوجد حاليًا صوت نجاح أو فشل للطلب.
     *
     * الشراء الفعلي سيتم ربطه لاحقًا
     * بالحساب والمحفظة والـBackend.
     */

    showToast(
        "تم تجهيز الطلب. سيتم تفعيل الشراء بعد ربط الحساب والمحفظة."
    );


    console.log(
        "Order:",
        {
            productId:
                product.id,

            params:
                params
        }
    );

}


/* =========================
   BALANCE
========================= */

function updateBalance(amount) {

    state.balance =
        Number(amount) || 0;


    const formatted =
        formatBalance(
            state.balance
        );


    if (elements.balance) {

        elements.balance.textContent =
            formatted;
    }


    if (elements.heroBalance) {

        elements.heroBalance.textContent =
            formatted;
    }

}


/*
 * تنسيق الرصيد
 *
 * 0       → $0.000
 * 5.25    → $5.250
 * 12.375  → $12.375
 */

function formatBalance(value) {

    const number =
        Number(value) || 0;

    return "$" +
        number.toFixed(3);
}


/*
 * تنسيق أسعار المنتجات
 */

function formatPrice(value) {

    const number =
        Number(value) || 0;

    return "$" +
        number.toFixed(3);
}


/* =========================
   PRODUCT ICON
========================= */

function getProductIcon(product) {

    const category =
        normalizeCategory(
            product.category
        );


    const name =
        String(
            product.name || ""
        ).toLowerCase();


    if (
        category === "games" ||
        name.includes("pubg") ||
        name.includes("free fire") ||
        name.includes("game") ||
        name.includes("لعبة") ||
        name.includes("ألعاب")
    ) {

        if (
            name.includes("pubg")
        ) {
            return "🎯";
        }


        if (
            name.includes("free fire")
        ) {
            return "🔥";
        }


        return "🎮";
    }


    if (
        category === "numbers" ||
        name.includes("whatsapp") ||
        name.includes("telegram") ||
        name.includes("number") ||
        name.includes("رقم")
    ) {

        if (
            name.includes("telegram")
        ) {
            return "✈️";
        }


        return "📱";
    }


    if (
        category === "social" ||
        name.includes("instagram") ||
        name.includes("facebook") ||
        name.includes("youtube") ||
        name.includes("tiktok") ||
        name.includes("سوش")
    ) {

        return "📢";
    }


    return "⚡";
}


/* =========================
   CATEGORY
========================= */

function normalizeCategory(category) {

    const value =
        String(
            category || ""
        )
            .toLowerCase()
            .trim();


    if (
        value.includes("game") ||
        value.includes("لعب") ||
        value.includes("العاب") ||
        value.includes("ألعاب") ||
        value.includes("gaming")
    ) {

        return "games";
    }


    if (
        value.includes("number") ||
        value.includes("رقم") ||
        value.includes("أرقام") ||
        value.includes("numbers") ||
        value.includes("sim") ||
        value.includes("whatsapp") ||
        value.includes("telegram")
    ) {

        return "numbers";
    }


    if (
        value.includes("social") ||
        value.includes("سوش") ||
        value.includes("social media") ||
        value.includes("followers") ||
        value.includes("متابع") ||
        value.includes("instagram") ||
        value.includes("facebook") ||
        value.includes("youtube") ||
        value.includes("tiktok")
    ) {

        return "social";
    }


    return "other";
}


/* =========================
   LOADING
========================= */

function showProductsLoading() {

    if (!elements.products) return;


    elements.products.innerHTML = `

        <div class="products-loading">

            <div class="loading-spinner"></div>

            <p>
                جاري تحميل الخدمات...
            </p>

        </div>

    `;
}


/* =========================
   ERROR
========================= */

function showProductsError() {

    if (!elements.products) return;


    elements.products.innerHTML = `

        <div class="empty-state">

            <div
                style="
                    font-size:40px;
                    margin-bottom:10px;
                "
            >
                ⚠️
            </div>

            <h3>
                تعذر تحميل الخدمات
            </h3>

            <p
                style="
                    margin-top:8px;
                "
            >
                تعذر الاتصال بالخادم حاليًا.
            </p>

            <button
                id="retryProducts"
                style="
                    margin-top:15px;
                    padding:10px 18px;
                    border:0;
                    border-radius:10px;
                    background:#0d6efd;
                    color:white;
                    cursor:pointer;
                "
            >
                إعادة المحاولة
            </button>

        </div>

    `;


    const retry =
        document.getElementById(
            "retryProducts"
        );


    if (retry) {

        retry.addEventListener(
            "click",
            loadProducts
        );
    }

}


/* =========================
   TOAST
========================= */

function showToast(message) {

    if (!elements.toast) return;


    elements.toast.textContent =
        message;


    elements.toast.classList.add(
        "show"
    );


    clearTimeout(
        window.toastTimer
    );


    window.toastTimer =
        setTimeout(
            function () {

                elements.toast.classList.remove(
                    "show"
                );

            },
            3000
        );

}


/* =========================
   MODAL
========================= */

function showModal(
    title,
    content
) {

    if (
        !elements.modal ||
        !elements.modalBody
    ) {
        return;
    }


    elements.modalBody.innerHTML = `

        <h2
            style="
                margin-bottom:18px;
                font-size:20px;
            "
        >
            ${escapeHtml(title)}
        </h2>

        ${content}

    `;


    elements.modal.classList.add(
        "active"
    );


    document.body.style.overflow =
        "hidden";

}


function closeModal() {

    if (!elements.modal) return;


    elements.modal.classList.remove(
        "active"
    );


    document.body.style.overflow =
        "";

}


/* =========================
   SECURITY
========================= */

function escapeHtml(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================
   PUBLIC APP
========================= */

window.storeApp = {

    state:
        state,

    loadProducts:
        loadProducts,

    updateBalance:
        updateBalance,

    playAddBalanceSound:
        playAddBalanceSound,

    playClickSound:
        playClickSound,

    showToast:
        showToast,

    openProduct:
        openProduct,

    formatBalance:
        formatBalance,

    formatPrice:
        formatPrice
};
