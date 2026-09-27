const state = {
    products: [],
    productsLoaded: false,
    productsLoadingPromise: null,
    productsLive: false,
    productsCacheKey: "nabd-products-cache-v2",
    gameProductsIndex: null,
    gameProductsSource: null,
    selectedCategory: "all",
    balance: 0,
    user: null,
    notifications: 0,
    searchQuery: ""
};

const BACKEND_URL = "";

// سياسات التخزين المؤقت:
// هيكل المنتجات/التصنيفات/الصور: 30 دقيقة كمدة تحديث قصوى.
// الأسعار لا تُخزّن إطلاقًا، ويُجلب /api/products مباشرة في كل زيارة.
// الملفات والصور الثابتة: 7 أيام مع تحديث في الخلفية.
const PRODUCT_STRUCTURE_CACHE_TTL = 30 * 60 * 1000;

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


// Fallback click delegation for the main category tiles.
// Keeps the Games entry responsive even if another initializer fails.
document.addEventListener("click", function(event) {
    const gamesButton = event.target.closest('.category[data-category="games"]');
    if (!gamesButton) return;
    event.preventDefault();
    openGamesPage();
});


function registerNabdServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js", {scope:"/"})
            .catch(function (error) {
                console.warn("Service worker registration skipped:", error);
            });
    });
}

/* =========================
   START
========================= */

document.addEventListener("DOMContentLoaded", function () {

    registerNabdServiceWorker();
    initializeMenu();
    initializeCategories();
    initializeQuickMenu();
    initializeModal();
    initializeSounds();
    initializeSearch();
    initializeDhikrTicker();
    initializeDhikrHomeVisibility();
    initializeWelcomeSplash();
    initializeTheme();
    initializeWhatsAppHitArea();

    removeAllCategory();

    updateBalance(0);

    // لا نحمّل منتجات Nemer عند فتح الموقع. صفحة الألعاب تُعرض فورًا،
    // وتُحمّل بيانات المنتجات فقط عند الحاجة.
});


/* =========================
   DHIKR TICKER
========================= */
const DEFAULT_DHIKR_ITEMS = ["سبحان اللّٰه","الحمد للّٰه","لا إله إلا اللّٰه","اللّٰه أكبر"];

function renderDhikrTicker(items) {
    const track = document.getElementById("dhikrTrack");
    if (!track) return;
    const safeItems = (Array.isArray(items) ? items : DEFAULT_DHIKR_ITEMS)
        .map(function(item){ return String(item || "").trim(); })
        .filter(Boolean)
        .slice(0, 12);
    const finalItems = safeItems.length ? safeItems : DEFAULT_DHIKR_ITEMS;
    const group = finalItems.map(function(item){
        return "<span>" + escapeHtml(item) + "</span>";
    }).join("");
    track.innerHTML = '<div class="dhikr-group">' + group + '</div><div class="dhikr-group" aria-hidden="true">' + group + '</div>';
}

async function initializeDhikrTicker() {
    renderDhikrTicker(DEFAULT_DHIKR_ITEMS);
    try {
        const response = await fetch(BACKEND_URL + "/api/store-settings", {headers:{Accept:"application/json"}, cache:"no-store"});
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.dhikr_items)) renderDhikrTicker(data.dhikr_items);
    } catch (error) {
        console.warn("Dhikr settings load skipped:", error);
    }
}

/* =========================
   HOME-ONLY DHIKR / REMINDERS
========================= */

function setDhikrHomeVisibility() {
    const bar = document.getElementById("dhikrBar");
    if (!bar) return;

    // The ticker belongs only to the actual home view.
    const internalPage = document.getElementById("internalPage");
    const isHome = !internalPage || internalPage.hidden;
    bar.hidden = !isHome;
    bar.setAttribute("aria-hidden", isHome ? "false" : "true");
}

function initializeDhikrHomeVisibility() {
    setDhikrHomeVisibility();

    // Internal pages are rendered dynamically, so observe visibility changes.
    const internalPage = document.getElementById("internalPage");
    if (internalPage && window.MutationObserver) {
        const observer = new MutationObserver(function () {
            setDhikrHomeVisibility();
        });
        observer.observe(internalPage, { attributes: true, attributeFilter: ["hidden", "class"] });
    }

    window.addEventListener("hashchange", setDhikrHomeVisibility);
}

function initializeWelcomeSplash() {
    const splash = document.getElementById("welcomeSplash");
    if (!splash) return;

    // يظهر عند كل دخول/تحديث للصفحة الرئيسية، ويستمر لمدة ثانيتين.
    splash.hidden = false;
    splash.classList.remove("is-hidden");
    splash.setAttribute("aria-hidden", "false");

    window.setTimeout(function () {
        splash.classList.add("is-hidden");
        window.setTimeout(function () {
            splash.hidden = true;
            splash.setAttribute("aria-hidden", "true");
        }, 380);
    }, 2000);
}

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

const GAME_MATCH_CANDIDATES = GAME_CATALOG.slice().sort(function(a, b) {
    const aLength = Math.max.apply(null, a.aliases.map(function(alias) { return normalizeGameText(alias).length; }));
    const bLength = Math.max.apply(null, b.aliases.map(function(alias) { return normalizeGameText(alias).length; }));
    return bLength - aLength;
});

const gameMatchCache = new WeakMap();

function findGameMatch(product) {
    if (product && typeof product === "object" && gameMatchCache.has(product)) return gameMatchCache.get(product);

    const categoryText = normalizeGameText(product && product.category_name);
    const productText = normalizeGameText(product && product.name);
    const combinedText = (categoryText + " " + productText).trim();

    function matches(text, game) {
        if (!text) return false;
        const padded = " " + text + " ";
        return game.aliases.some(function(alias) {
            const normalizedAlias = normalizeGameText(alias);
            return normalizedAlias && padded.includes(" " + normalizedAlias + " ");
        });
    }

    const match = GAME_MATCH_CANDIDATES.find(function(game) {
        return matches(categoryText, game);
    }) || GAME_MATCH_CANDIDATES.find(function(game) {
        return matches(combinedText, game);
    }) || null;

    if (product && typeof product === "object") gameMatchCache.set(product, match);
    return match;
}

function getGameProductsIndex() {
    if (state.gameProductsSource === state.products && state.gameProductsIndex) return state.gameProductsIndex;

    const index = new Map();
    state.products.forEach(function(product) {
        const match = findGameMatch(product);
        if (!match) return;
        if (!index.has(match.title)) index.set(match.title, []);
        index.get(match.title).push(product);
    });

    state.gameProductsSource = state.products;
    state.gameProductsIndex = index;
    return index;
}


function getProductsForGame(gameTitle) {
    return getGameProductsIndex().get(gameTitle) || [];
}

function getGameTiles() {
    const index = getGameProductsIndex();
    return GAME_CATALOG.map(function(game) {
        const products = index.get(game.title) || [];
        const productWithImage = products.find(function(product) {
            return String(product.category_img || "").trim();
        });
        return {
            title: game.title,
            image: normalizeGameText(game.title).includes("ببجي") || normalizeGameText(game.title).includes("pubg")
                ? BACKEND_URL + "/api/game-images/pubg-mobile"
                : (game.image || (productWithImage && productWithImage.category_img) || ""),
            productCount: products.length
        };
    });
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

function cleanGameCategoryName(value) {
    return String(value || "")
        .replace(/[•·]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function getGameProducts(gameTitle) {
    return state.products.filter(function(product) {
        if (isPubgGame(gameTitle)) {
            const text = normalizeGameText(
                String(product.category_name || "") + " " +
                String(product.name || "")
            );
            return text.includes("ببجي") || text.includes("pubg");
        }

        const match = findGameMatch(product);
        return match && match.title === gameTitle;
    });
}

function getRobloxGroupTitle(product) {
    const text = normalizeGameText(product && product.category_name);
    if (text.includes("usa")) return "Roblox USA";
    if (text.includes("ksa") || text.includes("sar")) return "Roblox KSA";
    if (text.includes("uae") || text.includes("aed")) return "Roblox UAE";
    if (text.includes("cad")) return "Roblox CAD";
    if (text.includes("eur") || text.includes("€")) return "Roblox EUR";
    return cleanGameCategoryName(product && product.category_name || "Roblox");
}

function getGameGroups(gameTitle) {
    const products = getGameProducts(gameTitle);
    const groups = [];
    const seen = new Map();
    const isRoblox = normalizeGameText(gameTitle).includes("roblox");

    products.forEach(function(product) {
        const categoryName = isRoblox
            ? getRobloxGroupTitle(product)
            : cleanGameCategoryName(product.category_name || "منتجات " + gameTitle);
        const parentKey = String(product.parent_id ?? "");
        const key = isRoblox
            ? "roblox|" + (parentKey || categoryName)
            : parentKey + "|" + categoryName;

        if (!seen.has(key)) {
            const group = {
                key: key,
                title: categoryName,
                image: product.category_img || "",
                products: []
            };
            seen.set(key, group);
            groups.push(group);
        }

        seen.get(key).products.push(product);
    });

    return groups;
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

    // صفحة الألعاب تعتمد على الكتالوج المحلي، لذلك تظهر فورًا.
    // نبدأ تحميل المنتجات في الخلفية بدون حبس المستخدم داخل شاشة تحميل.
    const tiles = getGameTiles();
    if (!state.productsLoaded && !state.productsLoadingPromise) {
        loadProducts().catch(function(error) {
            console.warn("Background products preload failed:", error);
        });
    }

    content.innerHTML =
        '<div class="game-page-note">اختر اللعبة للدخول إلى التصنيفات والمنتجات المتاحة.</div>' +
        '<div class="game-category-grid">' +
        tiles.map(function(tile) {
            return '<button class="game-category-tile" type="button" data-game-title="' +
                escapeHtml(tile.title) + '">' +
                '<span class="game-tile-image">' +
                    (tile.image
                        ? '<img src="' + escapeHtml(tile.image) + '" alt="" loading="lazy">' 
                        : '<span class="game-placeholder">🎮</span>') +
                '</span>' +
                '<span class="game-tile-title">' + escapeHtml(tile.title) + '</span>' +
            '</button>';
        }).join("") +
        '</div>';

    content.querySelectorAll(".game-category-tile").forEach(function(tile) {
        tile.addEventListener("click", async function() {
            const gameTitle = tile.getAttribute("data-game-title") || "اللعبة";

            // لا نعرض شاشة تحميل مزعجة عند الضغط على اللعبة.
            // إذا كانت البيانات جاهزة نفتح المستوى الثالث مباشرة.
            // وإذا لم تجهز بعد، ننتظر طلب الخلفية ثم نعرض النتيجة أو رسالة واضحة.
            if (!state.productsLoaded) {
                try {
                    await loadProducts();
                } catch (error) {
                    openGamePlaceholder(gameTitle);
                    return;
                }
            }

            openGamePlaceholder(gameTitle);
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

    const groups = getGameGroups(gameTitle);
    const isRoblox = normalizeGameText(gameTitle).includes("roblox");

    if (!groups.length) {
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
            '<strong>' + groups.length + ' تصنيف</strong>' +
            '<span>تصنيفات ' + escapeHtml(gameTitle) + '</span>' +
        '</div>' +
        '<div class="game-category-grid game-product-groups-grid">' +
        groups.map(function(group) {
            const gameTile = getGameTiles().find(function(tile) {
                return tile.title === gameTitle;
            });
            // المستوى الثالث يعرض صورة اللعبة، وليس صورة أول منتج داخلها.
            const gameImage = gameTile && gameTile.image ? gameTile.image : "";
            const imageHtml = gameImage
                ? '<img src="' + escapeHtml(gameImage) + '" alt="' + escapeHtml(gameTitle) + '" loading="lazy">'
                : (group.image
                    ? '<img src="' + escapeHtml(group.image) + '" alt="' + escapeHtml(gameTitle) + '" loading="lazy">'
                    : '<span class="game-placeholder">🎮</span>');

            return '<button class="game-category-tile game-product-group-card" type="button" data-game-group="' +
                escapeHtml(group.key) + '">' +
                '<span class="game-tile-image">' + imageHtml + '</span>' +
                '<span class="game-tile-title">' + escapeHtml(group.title) + '</span>' +
            '</button>';
        }).join("") +
        '</div>';

    content.querySelectorAll(".game-product-group-card").forEach(function(card) {
        card.addEventListener("click", function() {
            const key = card.getAttribute("data-game-group") || "";
            openGameProductGroup(gameTitle, key);
        });
    });

    window.scrollTo({top: 0, behavior: "smooth"});
}


function isPubgGame(gameTitle) {
    const text = normalizeGameText(gameTitle);
    return text.includes("pubg") || text.includes("ببجي");
}

function getUsableProductParams(product) {
    return (Array.isArray(product && product.params) ? product.params : [])
        .map(function(label) { return String(label || "").trim(); })
        .filter(function(label) {
            return label && label !== "." && label !== "-" && label !== "_";
        });
}

function getDisplayParamLabel(label) {
    const text = normalizeGameText(label);
    if (
        text.includes("ايدي") ||
        text.includes("الايدي") ||
        text.includes("id")
    ) {
        return "ID المقاتل";
    }
    return String(label || "").trim();
}

function renderPubgParamFields(product) {
    const params = getUsableProductParams(product);

    // ببجي تحتاج حقلًا واضحًا وثابتًا للـID، ولا نعرض اسمًا داخليًا
    // قادمًا من الكتالوج مثل "ناتج البيانات في كتالوج" للمستخدم.
    // نستخدم مفتاح الـID الفعلي من API إن كان معروفًا، وإلا نستخدم
    // أول باراميتر للمنتج حتى يبقى الإرسال متوافقًا مع API.
    const idKey = params.find(function(label) {
        const normalized = normalizeGameText(label);
        return normalized.includes("ايدي") ||
            normalized.includes("الايدي") ||
            normalized.includes("playerid") ||
            normalized.includes("player id") ||
            normalized === "player";
    }) || params[0] || "playerId";

    const safeKey = escapeHtml(idKey);

    return '<div class="pubg-field pubg-fighter-id-field">' +
        '<label for="pubgFighterId">ID المقاتل</label>' +
        '<input id="pubgFighterId" name="fighter_id" data-pubg-param="' + safeKey + '" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="أدخل ID المقاتل" required aria-required="true">' +
        '</div>';
}

function renderGameParamFields(product) {
    const params = getUsableProductParams(product);
    if (!params.length) {
        return '<div class="game-no-required-fields">لا توجد معلومات إضافية مطلوبة لهذا المنتج.</div>';
    }

    return params.map(function(label, index) {
        const normalized = normalizeGameText(label);
        const isId = normalized.includes("ايدي") ||
            normalized.includes("الايدي") ||
            normalized.includes("playerid") ||
            normalized.includes("player id") ||
            normalized === "player";
        const displayLabel = getDisplayParamLabel(label);
        const inputId = "gameParam_" + index;
        return '<div class="pubg-field game-required-field">' +
            '<label for="' + inputId + '">' + escapeHtml(displayLabel) + '</label>' +
            '<input id="' + inputId + '" type="text" data-game-param="' + escapeHtml(label) + '" placeholder="أدخل ' + escapeHtml(displayLabel) + '" autocomplete="off" required aria-required="true">' +
            '</div>';
    }).join("");
}

function getPubgProductPrice(product) {
    const value = product && product.price;
    if (value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) {
        return Number(value);
    }
    return null;
}
function formatProductPrice(product) {
    const value = getPubgProductPrice(product);
    return value === null ? "السعر غير متاح" : formatMoney(value);
}

function renderGameProductPicker(gameTitle, group) {
    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content || !group) return;

    if (title) title.textContent = group.title;
    if (icon) icon.textContent = "🎮";

    const products = Array.isArray(group.products) ? group.products : [];
    const availableProducts = products.filter(function(product) {
        return product.available !== false && product.available !== 0;
    });
    const firstProduct = availableProducts[0] || products[0] || null;

    function getProductQuantityConfig(product) {
        const values = product && product.qty_values ? product.qty_values : {};
        const minRaw = Number(values.min);
        const maxRaw = Number(values.max);
        const stepRaw = Number(values.step);
        const hasQuantity =
            Number.isFinite(minRaw) ||
            Number.isFinite(maxRaw) ||
            Number.isFinite(stepRaw) ||
            !!(product && (product.qty || product.quantity));

        return {
            enabled: hasQuantity,
            min: Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 1,
            max: Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 999999999,
            step: Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : 1
        };
    }

    function getProductImage(product) {
        const source = (product && product.category_img) || group.image || "";
        return source ? (String(source).startsWith("http") ? source : BACKEND_URL + source) : "";
    }

    const listHtml = products.map(function(product, index) {
        const available = product.available !== false && product.available !== 0;
        const price = getPubgProductPrice(product);
        return '<button class="pubg-option' + (available ? '' : ' is-disabled') + '" type="button" data-pubg-index="' + index + '"' +
            (available ? '' : ' disabled') + '>' +
            '<span class="pubg-option-name">' + escapeHtml(product.name || "منتج") + '</span>' +
            '<span class="pubg-option-price">' + (price === null ? 'السعر غير متاح' : formatMoney(price)) + '</span>' +
            (available ? '' : '<span class="pubg-option-status">غير متوفر</span>') +
        '</button>';
    }).join("");

    const gameImage = getGameTiles().find(function(tile) {
        return tile.title === gameTitle;
    });
    // صورة التطبيق هي المرجع الموحد داخل المستوى الثالث وصفحة المنتجات.
    // لا نسمح لصورة تصنيف منتج مختلف باستبدال صورة اللعبة.
    const image = (gameImage && gameImage.image ? gameImage.image : "") ||
        getProductImage(firstProduct);
    const imageSource = image
        ? (String(image).startsWith("http") ? image : BACKEND_URL + image)
        : "";
    const imageHtml = imageSource
        ? '<img src="' + escapeHtml(imageSource) + '" alt="' + escapeHtml(gameTitle) + '" loading="lazy">'
        : '<span class="game-placeholder">🎮</span>';

    content.innerHTML =
        '<div class="pubg-picker universal-game-picker">' +
            '<button class="pubg-back" type="button" id="pubgBackToGroups">← العودة إلى التصنيفات</button>' +
            '<div class="pubg-picker-head">' +
                '<div class="pubg-picker-image">' + imageHtml + '</div>' +
                '<h2>' + escapeHtml(group.title) + '</h2>' +
                '<span>' + products.length + ' منتج</span>' +
            '</div>' +
            '<div class="game-required-fields-title">المعلومات المطلوبة</div>' +
            '<div id="pubgParamFields">' +
                (firstProduct ? (isPubgGame(gameTitle) && normalizeGameText(group.title).includes("روبوت") && normalizeGameText(group.title).includes("سيرفر") && normalizeGameText(group.title).includes("2")
                    ? renderPubgParamFields(firstProduct)
                    : renderGameParamFields(firstProduct)) : '') +
            '</div>' +
            '<div class="pubg-field-label">اختر المنتج</div>' +
            '<div class="pubg-select" id="pubgSelect">' +
                '<button class="pubg-select-trigger" type="button" aria-expanded="false" aria-controls="pubgOptions">' +
                    '<span id="pubgSelectedName">' + escapeHtml(firstProduct ? (firstProduct.name || "اختر المنتج") : "اختر المنتج") + '</span>' +
                    '<span class="pubg-select-arrow">▼</span>' +
                '</button>' +
                '<div class="pubg-options" id="pubgOptions" hidden>' +
                    listHtml +
                '</div>' +
            '</div>' +
            '<div id="gameQuantityField"></div>' +
            '<div class="pubg-selected-summary">' +
                '<span>السعر</span>' +
                '<strong id="pubgSelectedPrice">' + (firstProduct ? formatProductPrice(firstProduct) : 'السعر غير متاح') + '</strong>' +
            '</div>' +
            '<button class="buy-btn pubg-submit" id="pubgSubmitOrder" type="button"' +
                (!firstProduct || (firstProduct.available === false || firstProduct.available === 0) ? ' disabled' : '') +
                '>إرسال الطلب <span>→</span></button>' +
        '</div>';

    let selectedIndex = firstProduct ? products.indexOf(firstProduct) : -1;

    function renderQuantity(product) {
        const holder = document.getElementById("gameQuantityField");
        if (!holder) return;

        // ببجي طلبها لمنتج واحد ولا نعرض حقل كمية حتى لو أعاده الكتالوج.
        if (isPubgGame(gameTitle)) {
            holder.innerHTML = "";
            return;
        }

        const config = getProductQuantityConfig(product);

        if (!config.enabled) {
            holder.innerHTML = "";
            return;
        }

        holder.innerHTML =
            '<div class="pubg-field game-quantity-field">' +
                '<label for="gameOrderQty">الكمية</label>' +
                '<input id="gameOrderQty" type="number" min="' + config.min + '" max="' + config.max + '" step="' + config.step + '" value="' + config.min + '" inputmode="numeric" required aria-required="true">' +
            '</div>';
    }

    function updateSelectedProduct(index) {
        const product = products[index];
        if (!product) return;
        selectedIndex = index;

        const selectedName = document.getElementById("pubgSelectedName");
        const selectedPrice = document.getElementById("pubgSelectedPrice");
        const fields = document.getElementById("pubgParamFields");
        const submit = document.getElementById("pubgSubmitOrder");

        if (selectedName) selectedName.textContent = product.name || "اختر المنتج";
        if (selectedPrice) selectedPrice.textContent = formatProductPrice(product);
        if (fields) fields.innerHTML = (isPubgGame(gameTitle) && normalizeGameText(group.title).includes("روبوت") && normalizeGameText(group.title).includes("سيرفر") && normalizeGameText(group.title).includes("2")
            ? renderPubgParamFields(product)
            : renderGameParamFields(product));
        renderQuantity(product);

        if (submit) {
            submit.disabled = product.available === false || product.available === 0;
        }
    }

    renderQuantity(firstProduct);

    const back = document.getElementById("pubgBackToGroups");
    if (back) back.addEventListener("click", function() {
        openGamePlaceholder(gameTitle);
    });

    const select = document.getElementById("pubgSelect");
    const trigger = select ? select.querySelector(".pubg-select-trigger") : null;
    const options = document.getElementById("pubgOptions");

    if (trigger && options) {
        trigger.addEventListener("click", function() {
            const open = !options.hidden;
            options.hidden = open;
            trigger.setAttribute("aria-expanded", String(!open));
            trigger.classList.toggle("is-open", !open);
        });

        options.querySelectorAll(".pubg-option").forEach(function(option) {
            option.addEventListener("click", function() {
                const index = Number(option.getAttribute("data-pubg-index"));
                updateSelectedProduct(index);
                options.hidden = true;
                trigger.setAttribute("aria-expanded", "false");
                trigger.classList.remove("is-open");
            });
        });
    }

    function closeGameDropdown(event) {
        if (!select || select.contains(event.target)) return;
        if (options && !options.hidden) {
            options.hidden = true;
            if (trigger) {
                trigger.setAttribute("aria-expanded", "false");
                trigger.classList.remove("is-open");
            }
        }
        document.removeEventListener("click", closeGameDropdown);
    }
    document.addEventListener("click", closeGameDropdown);

    const submit = document.getElementById("pubgSubmitOrder");
    if (submit) {
        submit.addEventListener("click", function() {
            const product = products[selectedIndex];
            if (!product) return;
            submitGamePickerOrder(product, document.querySelector(".universal-game-picker"));
        });
    }

    window.scrollTo({top: 0, behavior: "smooth"});
}

function submitGamePickerOrder(product, root) {
    const params = {};
    const inputs = root ? root.querySelectorAll("[data-game-param], [data-pubg-param]") : [];
    let invalid = false;

    inputs.forEach(function(input) {
        const label = input.getAttribute("data-game-param") ||
            input.getAttribute("data-pubg-param") || "";
        const value = String(input.value || "").trim();
        if (!value) {
            invalid = true;
            input.classList.add("is-invalid");
        } else {
            input.classList.remove("is-invalid");
            params[label] = value;
        }
    });

    const qtyInput = root ? root.querySelector("#gameOrderQty") : null;
    let qty = 1;
    if (qtyInput) {
        qty = Number(qtyInput.value);
        const min = Number(qtyInput.min || 1);
        const max = Number(qtyInput.max || 999999999);
        if (!Number.isFinite(qty) || qty < min || qty > max) {
            invalid = true;
            qtyInput.classList.add("is-invalid");
        } else {
            qtyInput.classList.remove("is-invalid");
        }
    }

    if (invalid) {
        showToast("يرجى إدخال جميع المعلومات المطلوبة والكمية بشكل صحيح.");
        return;
    }

    const submit = root ? root.querySelector("#pubgSubmitOrder") : null;
    if (submit) submit.disabled = true;

    fetch(BACKEND_URL + "/api/orders", {
        method: "POST",
        headers: {"Accept":"application/json","Content-Type":"application/json"},
        body: JSON.stringify({product_id: product.id, params: params, qty: qty})
    }).then(async function(response) {
        const data = await response.json();
        if (!response.ok || data.status === "ERROR") {
            throw new Error(data.message || "تعذر إنشاء الطلب");
        }
        if (data.balance !== undefined) updateBalance(data.balance);
        showToast("تم إرسال الطلب بنجاح.");
        if (root) {
            root.querySelectorAll("input").forEach(function(input) { input.value = ""; });
        }
    }).catch(function(error) {
        console.error("Game order error:", error);
        showToast(error.message || "تعذر إنشاء الطلب.");
    }).finally(function() {
        if (submit) submit.disabled = false;
    });
}

function openGameProductGroup(gameTitle, groupKey) {
    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content) return;

    const group = getGameGroups(gameTitle).find(function(item) {
        return item.key === groupKey;
    });

    if (!group) return;

    // جميع الألعاب تستخدم الآن نفس مسار PUBG:
    // المستوى الثالث = تصنيف اللعبة، المستوى الرابع = قائمة المنتجات النهائية.
    // المعلومات المطلوبة والكمية تظهر قبل اختيار/إرسال المنتج.
    renderGameProductPicker(gameTitle, group);
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
                type="text"
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

async function loadProducts(options) {
    options = options || {};
    if (state.productsLoadingPromise) return state.productsLoadingPromise;

    // اعرض آخر نسخة محفوظة فورًا، ثم حدّثها في الخلفية. هذا يلغي انتظار
    // اتصال Nemer عند كل فتح للموقع أو صفحة الألعاب.
    if (!options.force && !state.productsLoaded) {
        try {
            const cached = JSON.parse(localStorage.getItem(state.productsCacheKey) || "null");
            if (cached && Array.isArray(cached.products) && cached.products.length) {
                // الكاش مخصص للهيكل والتصنيفات والصور فقط. لا نستخدمه كسعر.
                state.products = cached.products;
                state.productsLoaded = true;
                state.productsLive = false;
                renderProducts();

                const cacheAge = Date.now() - Number(cached.savedAt || 0);
                if (cacheAge > PRODUCT_STRUCTURE_CACHE_TTL) {
                    console.info("Product structure cache expired; refreshing from Nemer.");
                }
            }
        } catch (error) {
            localStorage.removeItem(state.productsCacheKey);
        }
    }

    if (!state.productsLoaded && elements.products) {
        elements.products.innerHTML = "<div class=\"products-loading\"><div class=\"loading-spinner\"></div><p>جاري تحميل الخدمات...</p></div>";
    }

    state.productsLoadingPromise = (async function() {
        try {
            const controller = new AbortController();
            // مهلة قصيرة مع إبقاء الواجهة مستجيبة.
            const timeout = setTimeout(function() { controller.abort(); }, 15000);
            let response;
            try {
                response = await fetch(BACKEND_URL + "/api/products", {
                    headers:{Accept:"application/json"},
                    cache:"no-store",
                    signal: controller.signal
                });
            } catch (error) {
                if (error && error.name === "AbortError") {
                    throw new Error("انتهت مهلة تحميل منتجات المتجر.");
                }
                throw error;
            } finally {
                clearTimeout(timeout);
            }
            const data = await response.json();
            if (!response.ok || data.status === "ERROR") {
                throw new Error(data.message || "تعذر تحميل المنتجات");
            }

            state.products = Array.isArray(data.products) ? data.products : [];
            state.productsLoaded = true;
            state.productsLive = true;
            state.gameProductsIndex = null;
            state.gameProductsSource = null;
            try {
                localStorage.setItem(state.productsCacheKey, JSON.stringify({
                    savedAt: Date.now(),
                    // نخزن هيكل/تصنيفات المنتجات فقط، ولا نخزن الأسعار.
                    // السعر الذي يصل للواجهة يبقى من Nemer مباشرة.
                    products: state.products.map(function(product) {
                        const cached = Object.assign({}, product);
                        delete cached.price;
                        delete cached.original_price;
                        return cached;
                    })
                }));
            } catch (error) {
                console.warn("Products cache skipped:", error);
            }
            renderProducts();
            return state.products;
        } catch (error) {
            // إذا كانت بنية المنتجات موجودة من الكاش، نحافظ عليها ولا نحذف الصفحة
            // بسبب تعذر اتصال Nemer مؤقتًا. الأسعار تبقى غير قابلة للشراء حتى تصل نسخة حية.
            if (!state.productsLive) state.productsLoaded = Array.isArray(state.products) && state.products.length > 0;
            console.error("Products live refresh error:", error);
            if (elements.products && !state.productsLoaded) {
                elements.products.innerHTML = "<div class=\"products-loading\"><div class=\"loading-spinner\"></div><p>تعذر التحديث الآن.</p><button class=\"buy-btn\" type=\"button\" id=\"retryProducts\">↻ إعادة التحميل</button></div>";
                const retry = document.getElementById("retryProducts");
                if (retry) retry.addEventListener("click", function() { loadProducts({force:true}).catch(function(){}); });
            }
            throw error;
        } finally {
            state.productsLoadingPromise = null;
        }
    })();

    return state.productsLoadingPromise;
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
        const rawPrice = product.price;
        const hasLivePrice = state.productsLive && rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== "" && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0;
        const price = hasLivePrice ? Number(rawPrice) : 0;
        const image = product.category_img || "";
        const icon = image ? "<img src=\"" + escapeHtml(image) + "\" alt=\"\" style=\"width:100%;height:100%;object-fit:contain;\">" : "🛍️";
        const purchaseEnabled = available && hasLivePrice;
        return "<article class=\"product " + (available ? "" : "product-unavailable") + "\"><div class=\"product-icon\">" + icon + "</div><h3>" + escapeHtml(product.name || "منتج") + "</h3><p>" + escapeHtml(product.category_name || "") + "</p><div class=\"price\">" + (hasLivePrice ? "$" + price.toFixed(4) : "جاري تحديث السعر…") + "</div><button class=\"buy-btn\" type=\"button\" data-product-id=\"" + escapeHtml(String(product.id)) + "\" " + (purchaseEnabled ? "" : "disabled") + ">" + (available ? (hasLivePrice ? "شراء الآن" : "جاري تحديث السعر") : "غير متوفر") + "</button></article>";
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
        const safeLabel = escapeHtml(getDisplayParamLabel(String(label || "البيانات")));
        return '<div class="order-field">' +
            '<label for="param_' + index + '">' + safeLabel + '</label>' +
            '<input id="param_' + index + '" type="text" placeholder="أدخل ' + safeLabel + '" autocomplete="off">' +
            '</div>';
    }).join("");

    const minQty = Number(product.qty_values?.min || 1);
    const maxQty = Number(product.qty_values?.max || 999999999);
    const rawPrice = product.price;
    const hasLivePrice = rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== "" && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0;
    const price = hasLivePrice ? Number(rawPrice) : 0;

    showModal("تأكيد عملية الشراء",
        '<div class="order-form">' +
            '<div class="order-product-name">' + escapeHtml(product.name || "منتج") + '</div>' +
            fields +
            '<div class="order-field">' +
                '<label for="orderQty">الكمية</label>' +
                '<input id="orderQty" type="number" min="' + minQty + '" max="' + maxQty + '" value="' + minQty + '" inputmode="numeric">' +
            '</div>' +
            '<div class="order-price-row">' +
                '<span>السعر</span>' +
                '<strong id="orderPrice">' + (hasLivePrice ? formatMoney(price) : 'السعر غير متاح') + '</strong>' +
            '</div>' +
            '<button class="buy-btn order-confirm-btn" id="confirmProductOrder" type="button"' + (!hasLivePrice ? ' disabled' : '') + '>تأكيد عملية الشراء</button>' +
        '</div>'
    );

    const confirm = document.getElementById("confirmProductOrder");
    if (confirm) confirm.addEventListener("click", function() {
        submitProductOrder(product);
    });
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


function initializeWhatsAppHitArea() {
    const supportButton = document.querySelector(".whatsapp-float");
    if (!supportButton) return;

    supportButton.addEventListener("click", function(event) {
        const rect = supportButton.getBoundingClientRect();
        const x = event.clientX - (rect.left + rect.width / 2);
        const y = event.clientY - (rect.top + rect.height / 2);
        const radius = Math.min(rect.width, rect.height) / 2;

        // لا تسمح بفتح واتساب إلا إذا كانت الضغطة داخل الدائرة
        // نفسها، حتى لو حدثت مشكلة في حساب منطقة اللمس على الهاتف.
        if ((x * x) + (y * y) > radius * radius) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
}