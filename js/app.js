const state = {
    products: [],
    selectedCategory: "all",
    balance: 0,
    user: null,
    notifications: 0,
    searchQuery: ""
};

const BACKEND_URL = "https://nabd-store-1.onrender.com";

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
    initializeTheme();

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

                    const href = link.getAttribute("href") || "";
                    if (href.startsWith("/")) {
                        closeMenu();
                        return;
                    }

                    event.preventDefault();

                    const action = href;

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

const GAME_CATALOG = [
    { title:"ببجي موبايل", aliases:["pubg mobile","pubg","ببجي"] },
    { title:"Roblox Game", aliases:["roblox"] },
    { title:"جواكر", aliases:["جواكر","jawaker"] },
    { title:"Yalla Ludo", aliases:["yalla ludo","يلا لودو"] },
    { title:"Clash of Clans", aliases:["clash of clans","clash"] },
    { title:"فري فاير", aliases:["free fire","فري فاير"] },
    { title:"Yalla Ludo Gold", aliases:["yalla ludo gold"] },
    { title:"Lords mobile", aliases:["lords mobile"] },
    { title:"FarLight84", aliases:["farlight84","farlight 84"] },
    { title:"8Ball Pool", aliases:["8ball pool","8 ball pool"] },
    { title:"Project entropy", aliases:["project entropy"] },
    { title:"Guns of glory", aliases:["guns of glory"] },
    { title:"City Of Crime Gang War", aliases:["city of crime gang war"] },
    { title:"Marvel Reveals", aliases:["marvel reveals"] },
    { title:"Whiteout Survival", aliases:["whiteout survival"] },
    { title:"Genshin Impact", aliases:["genshin impact"] },
    { title:"Super SUS", aliases:["super sus"] },
    { title:"Stumble Guys", aliases:["stumble guys"] },
    { title:"Honkai : Star Rail", aliases:["honkai","star rail"] },
    { title:"Yalla Ludo Gold Codes", aliases:["yalla ludo gold codes"] },
    { title:"Yalla Ludo Diamonds Codes", aliases:["yalla ludo diamonds codes"] },
    { title:"Mobile Legends Turkish", aliases:["mobile legends","mobile legends turkish"] },
    { title:"Hero Clash", aliases:["hero clash"] },
    { title:"Oxide : Survival Island", aliases:["oxide","survival island"] },
    { title:"King Shot", aliases:["king shot"] },
    { title:"Zepeto", aliases:["zepeto"] },
    { title:"Devil May Cry: Peak of Combat", aliases:["devil may cry","peak of combat"] },
    { title:"Crystal of Atlan", aliases:["crystal of atlan"] },
    { title:"Bullet Echo", aliases:["bullet echo"] },
    { title:"Blood Strike", aliases:["blood strike"] },
    { title:"Acecraft", aliases:["acecraft"] },
    { title:"Arena Breakout", aliases:["arena breakout"] },
    { title:"Ludo Club", aliases:["ludo club"] },
    { title:"AFK Journey", aliases:["afk journey"] },
    { title:"Division Resurgence", aliases:["division resurgence"] },
    { title:"Age Of Empires Mobile", aliases:["age of empires"] },
    { title:"Goddess of Victory: NIKKE", aliases:["goddess of victory","nikke"] },
    { title:"Age of Magic", aliases:["age of magic"] },
    { title:"Ghost Story Love Destiny", aliases:["ghost story love destiny"] },
    { title:"Arena of Valor EU", aliases:["arena of valor"] },
    { title:"Growtopia", aliases:["growtopia"] },
    { title:"Golden Spatula", aliases:["golden spatula"] },
    { title:"Hatsune Miku: Colorful Stage", aliases:["hatsune miku","colorful stage"] },
    { title:"Arknights Endfield", aliases:["arknights endfield"] },
    { title:"Haikyu Fly High", aliases:["haikyu fly high"] },
    { title:"Ballistic Hero VNG", aliases:["ballistic hero vng"] },
    { title:"Heaven Burns Red", aliases:["heaven burns red"] },
    { title:"Astral Guardians", aliases:["astral guardians"] },
    { title:"Cyber Fantasy", aliases:["cyber fantasy"] },
    { title:"Blockman Go", aliases:["blockman go"] },
    { title:"Blade X Odyssey of Heroes", aliases:["blade x","odyssey of heroes"] },
    { title:"Be The King", aliases:["be the king"] },
    { title:"Captain Tsubasa: Ace", aliases:["captain tsubasa"] },
    { title:"Idol Party", aliases:["idol party"] },
    { title:"Hyper Front", aliases:["hyper front"] },
    { title:"Infinite Lagrange", aliases:["infinite lagrange"] },
    { title:"Clash of Plants", aliases:["clash of plants"] },
    { title:"Journey Renewed: Fate Fantasy", aliases:["journey renewed","fate fantasy"] },
    { title:"Civilization: Eras & Allies", aliases:["civilization eras","civilization","eras allies"] },
    { title:"Kuroko Street Rivals", aliases:["kuroko street rivals"] },
    { title:"Cloud Song: Saga of Skywalkers", aliases:["cloud song","skywalkers"] },
    { title:"King's Choice SEA", aliases:["kings choice"] },
    { title:"Crossfire Legend", aliases:["crossfire legend"] },
    { title:"Legend of the Phoenix", aliases:["legend of the phoenix"] },
    { title:"Legacy of Discord: FuriousWings", aliases:["legacy of discord","furiouswings"] },
    { title:"Army Dudes", aliases:["army dudes"] },
    { title:"CrystalFall", aliases:["crystalfall"] },
    { title:"Crossout Mobile", aliases:["crossout mobile"] },
    { title:"Dragon Raja SEA", aliases:["dragon raja sea"] },
    { title:"Dragon Nest M SEA", aliases:["dragon nest m sea"] },
    { title:"Life Makeover Global", aliases:["life makeover"] },
    { title:"Love Nikki", aliases:["love nikki"] },
    { title:"Dragonheir: Silent Gods", aliases:["dragonheir","silent gods"] },
    { title:"Dream and Lethe Record", aliases:["dream and lethe"] },
    { title:"Eggy Party", aliases:["eggy party"] },
    { title:"Echocalypse: Scarlet Covenant", aliases:["echocalypse","scarlet covenant"] },
    { title:"Dynasty Heroes: Legend Samkok", aliases:["dynasty heroes","legend samkok"] },
    { title:"Starseed: Asnia Trigger", aliases:["starseed"] },
    { title:"Magic Chess GoGo", aliases:["magic chess gogo","magic chess"] },
    { title:"Enhypen World", aliases:["enhypen world"] },
    { title:"Marvel Duel", aliases:["marvel duel"] },
    { title:"Extraordinary Ones", aliases:["extraordinary ones"] },
    { title:"EVE Echoes", aliases:["eve echoes"] },
    { title:"Mirage Perfect Skyline", aliases:["mirage perfect","skyline"] },
    { title:"Football Master 2", aliases:["football master 2"] },
    { title:"Marvel Mystic Mayhem", aliases:["marvel mystic","mayhem"] },
    { title:"Garena Speed Drifters", aliases:["garena speed","drifters"] },
    { title:"Mongil Star Dive", aliases:["mongil star dive"] },
    { title:"Modern Strike Online", aliases:["modern strike","modern strike online"] },
    { title:"Overmortal Idle Global", aliases:["overmortal idle"] },
    { title:"Onmyoji Arena", aliases:["onmyoji arena"] },
    { title:"My Singing Monsters", aliases:["my singing","monsters"] },
    { title:"Stormshot", aliases:["stormshot"] }
];

function normalizeGameText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[._:/\\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function findGameMatch(product) {
    const haystack = normalizeGameText(
        String(product.category_name || "") + " " + String(product.name || "")
    );

    // نطابق الاسم الأكثر تحديدًا أولًا حتى لا تُضم منتجات
    // "Yalla Ludo Gold" أو "Gold Codes" داخل "Yalla Ludo" بالخطأ.
    const candidates = GAME_CATALOG.slice().sort(function(a, b) {
        const aLength = Math.max.apply(null, a.aliases.map(function(alias) {
            return normalizeGameText(alias).length;
        }));
        const bLength = Math.max.apply(null, b.aliases.map(function(alias) {
            return normalizeGameText(alias).length;
        }));
        return bLength - aLength;
    });

    return candidates.find(function(game) {
        return game.aliases.some(function(alias) {
            const normalizedAlias = normalizeGameText(alias);
            return normalizedAlias && haystack.includes(normalizedAlias);
        });
    }) || null;
}

function getProductsForGame(gameTitle) {
    return state.products.filter(function(product) {
        const match = findGameMatch(product);
        return match && match.title === gameTitle;
    });
}

function getGameTiles() {
    const tiles = [];
    const used = new Set();

    GAME_CATALOG.forEach(function(game) {
        const products = state.products.filter(function(product) {
            return findGameMatch(product)?.title === game.title;
        });
        if (!products.length) return;

        const imageProduct = products.find(function(product) {
            return product.category_img;
        }) || products[0];

        tiles.push({
            title: game.title,
            image: imageProduct?.category_img || "",
            productCount: products.length
        });
        used.add(game.title);
    });

    // إضافة أي ألعاب جديدة من الـAPI لم تكن ضمن القائمة المصورة.
    state.products.forEach(function(product) {
        const match = findGameMatch(product);
        if (!match || used.has(match.title)) return;
        const image = product.category_img || "";
        tiles.push({title: match.title, image: image, productCount: 1});
        used.add(match.title);
    });

    return tiles;
}

function initializeCategories() {
    document.querySelectorAll(".category").forEach(function(button) {
        if (button.getAttribute("data-category") === "all") return;

        button.addEventListener("click", function() {
            const category = button.getAttribute("data-category") || "other";

            if (category === "games") {
                openGamesPage();
                return;
            }

            document.querySelectorAll(".category").forEach(function(item) {
                item.classList.remove("active");
            });
            button.classList.add("active");
            state.selectedCategory = category;
            renderProducts();
        });
    });

    const back = document.getElementById("internalBack");
    if (back) back.addEventListener("click", closeInternalPage);
}

function openGamesPage() {
    const services = document.getElementById("servicesSection");
    const internal = document.getElementById("internalPage");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    const content = document.getElementById("internalPageContent");

    if (!services || !internal || !content) return;

    services.hidden = true;
    internal.hidden = false;
    if (title) title.textContent = "الألعاب";
    if (icon) icon.textContent = "🎮";

    const tiles = getGameTiles();

    if (!tiles.length) {
        content.innerHTML = '<div class="game-empty"><strong>لم يتم تحميل ألعاب بعد</strong><p>سيتم إظهار الألعاب هنا تلقائيًا بعد تحميل بيانات الخدمات.</p></div>';
        return;
    }

    content.innerHTML =
        '<div class="game-page-note">اختر اللعبة للدخول إلى المستوى التالي.</div>' +
        '<div class="game-category-grid">' +
        tiles.map(function(tile) {
            const image = tile.image
                ? '<img src="' + escapeHtml(tile.image) + '" alt="' + escapeHtml(tile.title) + '" loading="lazy">'
                : '<span class="game-placeholder">🎮</span>';
            return '<button class="game-category-tile" type="button" data-game-title="' +
                escapeHtml(tile.title) + '">' +
                '<span class="game-tile-image">' + image + '</span>' +
                '<span class="game-tile-title">' + escapeHtml(tile.title) + '</span>' +
                '</button>';
        }).join("") +
        '</div>';

    content.querySelectorAll(".game-category-tile").forEach(function(tile) {
        tile.addEventListener("click", function() {
            openGamePlaceholder(tile.getAttribute("data-game-title") || "اللعبة");
        });
    });

    window.scrollTo({top: 0, behavior: "smooth"});
}

function openGamePlaceholder(gameTitle) {
    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content) return;

    if (title) title.textContent = gameTitle;
    if (icon) icon.textContent = "🎮";

    const products = getProductsForGame(gameTitle);

    if (!products.length) {
        content.innerHTML =
            '<div class="game-products-placeholder">' +
            '<div class="game-products-placeholder-icon">🎮</div>' +
            '<h3>' + escapeHtml(gameTitle) + '</h3>' +
            '<p>لا توجد منتجات مرتبطة بهذه اللعبة حاليًا.</p>' +
            '</div>';
        window.scrollTo({top: 0, behavior: "smooth"});
        return;
    }

    content.innerHTML =
        '<div class="game-products-heading">' +
        '<strong>' + products.length + ' منتج</strong>' +
        '<span>منتجات ' + escapeHtml(gameTitle) + '</span>' +
        '</div>' +
        '<div class="game-products-grid">' +
        products.map(function(product) {
            const available = product.available !== false && product.available !== 0;
            const price = Number(product.price) || 0;
            const image = product.category_img || "";
            const iconHtml = image
                ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">'
                : '<span class="game-product-fallback">🛍️</span>';

            return '<article class="product game-product-card ' + (available ? "" : "product-unavailable") + '">' +
                '<div class="product-icon">' + iconHtml + '</div>' +
                '<h3>' + escapeHtml(product.name || "منتج") + '</h3>' +
                '<p>' + escapeHtml(product.category_name || "") + '</p>' +
                '<div class="price">

function closeInternalPage() {
    const services = document.getElementById("servicesSection");
    const internal = document.getElementById("internalPage");
    if (internal) internal.hidden = true;
    if (services) services.hidden = false;
    window.scrollTo({top: 0, behavior: "smooth"});
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

            );

            break;

        default:
            showModal("نبض ستور", "<div class=\"empty-state\"><h3>القسم غير متاح حاليًا</h3><p>سيتم تفعيل هذه الخدمة قريبًا.</p></div>");
    }
}

function formatMoney(value) {
    const amount = Number(value) || 0;
    return "$" + amount.toFixed(3);
}

function updateBalance(value) {
    const amount = Number(value) || 0;
    state.balance = amount;
    if (elements.balance) elements.balance.textContent = formatMoney(amount);
    if (elements.heroBalance) elements.heroBalance.textContent = formatMoney(amount);
}

function showModal(title, body) {
    if (!elements.modal || !elements.modalBody) return;
    elements.modalBody.innerHTML = "<h2 style=\"margin-bottom:18px;\">" + escapeHtml(title) + "</h2>" + body;
    elements.modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    if (!elements.modal) return;
    elements.modal.classList.remove("active");
    document.body.style.overflow = "";
}

function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function getProductCategory(product) {
    const text = String(product.category_name || product.name || "").toLowerCase();
    if (/جواكر|فري فاير|free fire|ببجي|pubg|لودو|blood strike|روبلوكس|roblox|كلاش|clash|فالورانت|valorant|minecraft|ماينكرافت|fifa|فورتنايت|fortnite/.test(text)) return "games";
    if (/انستغرام|instagram|فيس بوك|facebook|تيك توك|tiktok|تلجرام|telegram|وتساب|whatsapp|واتساب|سناب|snapchat|كواي|kwai|يوتيوب|youtube|تويتر|twitter/.test(text)) return "social";
    if (/رقم|وحدات|رصيد|شحن|استرداد رصيد|mtn|syriatel|زين|شامنا/.test(text)) return "numbers";
    return "other";
}

async function loadProducts() {
    if (elements.products) {
        elements.products.innerHTML = "<div class=\"products-loading\"><div class=\"loading-spinner\"></div><p>جاري تحميل الخدمات...</p></div>";
    }
    try {
        const response = await fetch(BACKEND_URL + "/api/products", {headers:{Accept:"application/json"}});
        const data = await response.json();
        if (!response.ok || data.status === "ERROR") throw new Error(data.message || "تعذر تحميل المنتجات");
        state.products = Array.isArray(data.products) ? data.products : [];
        renderProducts();
    } catch (error) {
        console.error("Products load error:", error);
        if (elements.products) {
            elements.products.innerHTML = "<div class=\"products-loading\"><p>تعذر تحميل المنتجات حاليًا.</p><button class=\"buy-btn\" type=\"button\" id=\"retryProducts\">إعادة المحاولة</button></div>";
            const retry = document.getElementById("retryProducts");
            if (retry) retry.addEventListener("click", loadProducts);
        }
    }
}

function renderProducts() {
    if (!elements.products) return;
    const query = state.searchQuery;
    const filtered = state.products.filter(function(product) {
        const categoryMatch = state.selectedCategory === "all" || getProductCategory(product) === state.selectedCategory;
        const searchable = (String(product.name || "") + " " + String(product.category_name || "")).toLowerCase();
        return categoryMatch && (!query || searchable.includes(query));
    });

    if (!filtered.length) {
        elements.products.innerHTML = "<div class=\"products-loading\"><p>لا توجد منتجات مطابقة.</p></div>";
        return;
    }

    elements.products.innerHTML = filtered.map(function(product) {
        const available = product.available !== false && product.available !== 0;
        const price = Number(product.price) || 0;
        const image = product.category_img || "";
        const icon = image ? "<img src=\"" + escapeHtml(image) + "\" alt=\"\" style=\"width:100%;height:100%;object-fit:contain;\">" : "🛍️";
        return "<article class=\"product " + (available ? "" : "product-unavailable") + "\"><div class=\"product-icon\">" + icon + "</div><h3>" + escapeHtml(product.name || "منتج") + "</h3><p>" + escapeHtml(product.category_name || "") + "</p><div class=\"price\">$" + price.toFixed(4) + "</div><button class=\"buy-btn\" type=\"button\" data-product-id=\"" + escapeHtml(String(product.id)) + "\" " + (available ? "" : "disabled") + ">" + (available ? "شراء الآن" : "غير متوفر") + "</button></article>";
    }).join("");

    elements.products.querySelectorAll(".buy-btn[data-product-id]").forEach(function(button) {
        button.addEventListener("click", function() {
            const product = state.products.find(function(item) { return String(item.id) === String(button.getAttribute("data-product-id")); });
            if (product) openProductModal(product);
        });
    });
}

function openProductModal(product) {
    const params = Array.isArray(product.params) ? product.params : [];
    const fields = params.map(function(label, index) {
        const safeLabel = escapeHtml(String(label || "البيانات"));
        return "<label style=\"display:block;margin:12px 0 6px;font-weight:bold;\">" + safeLabel + "</label><input id=\"param_" + index + "\" type=\"text\" placeholder=\"" + safeLabel + "\" autocomplete=\"off\">";
    }).join("");

    showModal("شراء المنتج",
        "<div><h3 style=\"margin-bottom:8px;\">" + escapeHtml(product.name || "منتج") + "</h3><p style=\"margin-bottom:12px;\">السعر: <strong>" + formatMoney(product.price) + "</strong></p>" + fields + "<label style=\"display:block;margin:12px 0 6px;font-weight:bold;\">الكمية</label><input id=\"orderQty\" type=\"number\" min=\"" + Number(product.qty_values?.min || 1) + "\" max=\"" + Number(product.qty_values?.max || 999999999) + "\" value=\"" + Number(product.qty_values?.min || 1) + "\"><button class=\"buy-btn\" id=\"confirmProductOrder\" type=\"button\" style=\"margin-top:16px;\">تأكيد الطلب</button></div>"
    );

    const confirm = document.getElementById("confirmProductOrder");
    if (confirm) confirm.addEventListener("click", function() { submitProductOrder(product); });
}

async function submitProductOrder(product) {
    const params = {};
    (Array.isArray(product.params) ? product.params : []).forEach(function(label, index) {
        const input = document.getElementById("param_" + index);
        if (input && input.value.trim()) params[label] = input.value.trim();
    });
    const qtyInput = document.getElementById("orderQty");
    const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
    const confirm = document.getElementById("confirmProductOrder");
    if (confirm) confirm.disabled = true;

    try {
        const response = await fetch(BACKEND_URL + "/api/orders", {
            method: "POST",
            headers: {"Accept":"application/json","Content-Type":"application/json"},
            body: JSON.stringify({product_id: product.id, params: params, qty: qty})
        });
        const data = await response.json();
        if (!response.ok || data.status === "ERROR") throw new Error(data.message || "تعذر إنشاء الطلب");
        closeModal();
        if (data.balance !== undefined) updateBalance(data.balance);
        showToast("تم إنشاء الطلب بنجاح.");
    } catch (error) {
        console.error("Order error:", error);
        showToast(error.message || "تعذر إنشاء الطلب.");
        if (confirm) confirm.disabled = false;
    }
}

function showToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function() { elements.toast.classList.remove("show"); }, 3000);
}



function initializeTheme() {
    const saved = localStorage.getItem("nabd-theme") || "dark";
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
}
 + price.toFixed(4) + '</div>' +
                '<button class="buy-btn" type="button" data-game-product-id="' + escapeHtml(String(product.id)) + '" ' +
                (available ? "" : "disabled") + '>' +
                (available ? "شراء الآن" : "غير متوفر") +
                '</button>' +
                '</article>';
        }).join("") +
        '</div>';

    content.querySelectorAll(".buy-btn[data-game-product-id]").forEach(function(button) {
        button.addEventListener("click", function() {
            const product = state.products.find(function(item) {
                return String(item.id) === String(button.getAttribute("data-game-product-id"));
            });
            if (product) openProductModal(product);
        });
    });

    window.scrollTo({top: 0, behavior: "smooth"});
}

function closeInternalPage() {
    const services = document.getElementById("servicesSection");
    const internal = document.getElementById("internalPage");
    if (internal) internal.hidden = true;
    if (services) services.hidden = false;
    window.scrollTo({top: 0, behavior: "smooth"});
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

            );

            break;

        default:
            showModal("نبض ستور", "<div class=\"empty-state\"><h3>القسم غير متاح حاليًا</h3><p>سيتم تفعيل هذه الخدمة قريبًا.</p></div>");
    }
}

function formatMoney(value) {
    const amount = Number(value) || 0;
    return "$" + amount.toFixed(3);
}

function updateBalance(value) {
    const amount = Number(value) || 0;
    state.balance = amount;
    if (elements.balance) elements.balance.textContent = formatMoney(amount);
    if (elements.heroBalance) elements.heroBalance.textContent = formatMoney(amount);
}

function showModal(title, body) {
    if (!elements.modal || !elements.modalBody) return;
    elements.modalBody.innerHTML = "<h2 style=\"margin-bottom:18px;\">" + escapeHtml(title) + "</h2>" + body;
    elements.modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    if (!elements.modal) return;
    elements.modal.classList.remove("active");
    document.body.style.overflow = "";
}

function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function getProductCategory(product) {
    const text = String(product.category_name || product.name || "").toLowerCase();
    if (/جواكر|فري فاير|free fire|ببجي|pubg|لودو|blood strike|روبلوكس|roblox|كلاش|clash|فالورانت|valorant|minecraft|ماينكرافت|fifa|فورتنايت|fortnite/.test(text)) return "games";
    if (/انستغرام|instagram|فيس بوك|facebook|تيك توك|tiktok|تلجرام|telegram|وتساب|whatsapp|واتساب|سناب|snapchat|كواي|kwai|يوتيوب|youtube|تويتر|twitter/.test(text)) return "social";
    if (/رقم|وحدات|رصيد|شحن|استرداد رصيد|mtn|syriatel|زين|شامنا/.test(text)) return "numbers";
    return "other";
}

async function loadProducts() {
    if (elements.products) {
        elements.products.innerHTML = "<div class=\"products-loading\"><div class=\"loading-spinner\"></div><p>جاري تحميل الخدمات...</p></div>";
    }
    try {
        const response = await fetch(BACKEND_URL + "/api/products", {headers:{Accept:"application/json"}});
        const data = await response.json();
        if (!response.ok || data.status === "ERROR") throw new Error(data.message || "تعذر تحميل المنتجات");
        state.products = Array.isArray(data.products) ? data.products : [];
        renderProducts();
    } catch (error) {
        console.error("Products load error:", error);
        if (elements.products) {
            elements.products.innerHTML = "<div class=\"products-loading\"><p>تعذر تحميل المنتجات حاليًا.</p><button class=\"buy-btn\" type=\"button\" id=\"retryProducts\">إعادة المحاولة</button></div>";
            const retry = document.getElementById("retryProducts");
            if (retry) retry.addEventListener("click", loadProducts);
        }
    }
}

function renderProducts() {
    if (!elements.products) return;
    const query = state.searchQuery;
    const filtered = state.products.filter(function(product) {
        const categoryMatch = state.selectedCategory === "all" || getProductCategory(product) === state.selectedCategory;
        const searchable = (String(product.name || "") + " " + String(product.category_name || "")).toLowerCase();
        return categoryMatch && (!query || searchable.includes(query));
    });

    if (!filtered.length) {
        elements.products.innerHTML = "<div class=\"products-loading\"><p>لا توجد منتجات مطابقة.</p></div>";
        return;
    }

    elements.products.innerHTML = filtered.map(function(product) {
        const available = product.available !== false && product.available !== 0;
        const price = Number(product.price) || 0;
        const image = product.category_img || "";
        const icon = image ? "<img src=\"" + escapeHtml(image) + "\" alt=\"\" style=\"width:100%;height:100%;object-fit:contain;\">" : "🛍️";
        return "<article class=\"product " + (available ? "" : "product-unavailable") + "\"><div class=\"product-icon\">" + icon + "</div><h3>" + escapeHtml(product.name || "منتج") + "</h3><p>" + escapeHtml(product.category_name || "") + "</p><div class=\"price\">$" + price.toFixed(4) + "</div><button class=\"buy-btn\" type=\"button\" data-product-id=\"" + escapeHtml(String(product.id)) + "\" " + (available ? "" : "disabled") + ">" + (available ? "شراء الآن" : "غير متوفر") + "</button></article>";
    }).join("");

    elements.products.querySelectorAll(".buy-btn[data-product-id]").forEach(function(button) {
        button.addEventListener("click", function() {
            const product = state.products.find(function(item) { return String(item.id) === String(button.getAttribute("data-product-id")); });
            if (product) openProductModal(product);
        });
    });
}

function openProductModal(product) {
    const params = Array.isArray(product.params) ? product.params : [];
    const fields = params.map(function(label, index) {
        const safeLabel = escapeHtml(String(label || "البيانات"));
        return "<label style=\"display:block;margin:12px 0 6px;font-weight:bold;\">" + safeLabel + "</label><input id=\"param_" + index + "\" type=\"text\" placeholder=\"" + safeLabel + "\" autocomplete=\"off\">";
    }).join("");

    showModal("شراء المنتج",
        "<div><h3 style=\"margin-bottom:8px;\">" + escapeHtml(product.name || "منتج") + "</h3><p style=\"margin-bottom:12px;\">السعر: <strong>" + formatMoney(product.price) + "</strong></p>" + fields + "<label style=\"display:block;margin:12px 0 6px;font-weight:bold;\">الكمية</label><input id=\"orderQty\" type=\"number\" min=\"" + Number(product.qty_values?.min || 1) + "\" max=\"" + Number(product.qty_values?.max || 999999999) + "\" value=\"" + Number(product.qty_values?.min || 1) + "\"><button class=\"buy-btn\" id=\"confirmProductOrder\" type=\"button\" style=\"margin-top:16px;\">تأكيد الطلب</button></div>"
    );

    const confirm = document.getElementById("confirmProductOrder");
    if (confirm) confirm.addEventListener("click", function() { submitProductOrder(product); });
}

async function submitProductOrder(product) {
    const params = {};
    (Array.isArray(product.params) ? product.params : []).forEach(function(label, index) {
        const input = document.getElementById("param_" + index);
        if (input && input.value.trim()) params[label] = input.value.trim();
    });
    const qtyInput = document.getElementById("orderQty");
    const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
    const confirm = document.getElementById("confirmProductOrder");
    if (confirm) confirm.disabled = true;

    try {
        const response = await fetch(BACKEND_URL + "/api/orders", {
            method: "POST",
            headers: {"Accept":"application/json","Content-Type":"application/json"},
            body: JSON.stringify({product_id: product.id, params: params, qty: qty})
        });
        const data = await response.json();
        if (!response.ok || data.status === "ERROR") throw new Error(data.message || "تعذر إنشاء الطلب");
        closeModal();
        if (data.balance !== undefined) updateBalance(data.balance);
        showToast("تم إنشاء الطلب بنجاح.");
    } catch (error) {
        console.error("Order error:", error);
        showToast(error.message || "تعذر إنشاء الطلب.");
        if (confirm) confirm.disabled = false;
    }
}

function showToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function() { elements.toast.classList.remove("show"); }, 3000);
}



function initializeTheme() {
    const saved = localStorage.getItem("nabd-theme") || "dark";
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
}
