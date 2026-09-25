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
        gain.connect(context.destination);

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
        gain.connect(context.destination);

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

    elements.drawer.classList.add("active");
    elements.overlay.classList.add("active");

    document.body.style.overflow = "hidden";
}


function closeMenu() {

    if (
        !elements.drawer ||
        !elements.overlay
    ) {
        return;
    }

    elements.drawer.classList.remove("active");
    elements.overlay.classList.remove("active");

    document.body.style.overflow = "";
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
        document.querySelector(".category");

    if (firstCategory) {

        document
            .querySelectorAll(".category")
            .forEach(function (item) {

                item.classList.remove("active");

            });

        firstCategory.classList.add("active");

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

                            item.classList.remove("active");

                        });

                    button.classList.add("active");

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
        document.getElementById("searchInput");


    if (!searchInput) {

        searchInput =
            document.getElementById("productSearch");
    }


    if (!searchInput) {

        const searchBox =
            document.createElement("div");

        searchBox.className = "store-search";

        searchBox.innerHTML = `
            <input
                id="productSearch"
                type="search"
                placeholder="ابحث عن خدمة أو منتج..."
                autocomplete="off"
            >
        `;


        const dhikr =
            document.querySelector(".dhikr-bar");


        if (dhikr) {

            dhikr.insertAdjacentElement(
                "afterend",
                searchBox
            );

        } else {

            const container =
                document.querySelector(".container");

            if (container) {
                container.prepend(searchBox);
            }
        }


        searchInput =
            document.getElementById("productSearch");
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
