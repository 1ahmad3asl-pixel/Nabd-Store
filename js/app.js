const state = {
    products: [],
    productsLoaded: false,
    productsLoadingPromise: null,
    productsLive: false,
    profitRate: 0,
    numberProfitRate: 0,
    profitRateLoaded: false,
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
async function loadSypExchangeRate() {
    const sourceEl = document.getElementById("sypSourceRate");
    const storeEl = document.getElementById("sypStoreRate");
    const metaEl = document.getElementById("sypRateMeta");
    if (!sourceEl || !storeEl || !metaEl) return;

    sourceEl.textContent = "جاري التحديث...";
    storeEl.textContent = "جاري التحديث...";

    try {
        const response = await fetch(BACKEND_URL + "/api/exchange-rate?_=" + Date.now(), {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "same-origin",
            cache: "no-store"
        });
        const data = await response.json();
        if (!response.ok || data.status !== "OK" || !data.rate) {
            throw new Error(data.message || "تعذر تحديث سعر الصرف.");
        }

        const buy = Number(data.rate.buy);
        const rate = Number(data.rate.rate);
        sourceEl.textContent = Number.isFinite(buy) ? buy.toLocaleString("ar-SY") : "—";
        storeEl.textContent = Number.isFinite(rate) ? rate.toLocaleString("ar-SY") : "—";

        const updated = data.rate.timestampUtc ? new Date(data.rate.timestampUtc) : null;
        const time = updated && !Number.isNaN(updated.getTime())
            ? updated.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })
            : "";
        metaEl.textContent = time
            ? "آخر تحديث من LiraScope: " + time
            : "تم تحديث السعر من LiraScope";
    } catch (error) {
        sourceEl.textContent = "—";
        storeEl.textContent = "—";
        metaEl.textContent = error.message || "تعذر تحديث سعر الصرف.";
    }
}



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
    if (gamesButton) {
        event.preventDefault();
        openGamesPage();
        return;
    }

    // مستقل عن initializeCategories: يضمن أن قسم الأرصدة يستجيب
    // حتى لو فشل initializer آخر في الصفحة.
    const appsButton = event.target.closest('.category[data-category="apps"]');
    if (appsButton) {
        event.preventDefault();
        openAppsPage();
        return;
    }

    const balanceButton = event.target.closest('.category[data-category="balance"]');
    if (balanceButton) {
        event.preventDefault();
        openBalancePage();
        return;
    }
    const numbersButton = event.target.closest('.category[data-category="numbers"]');
    if (numbersButton) {
        event.preventDefault();
        openNumbersPage();
        return;
    }

    const digitalButton = event.target.closest('.category[data-category="digital"]');
    if (digitalButton) {
        event.preventDefault();
        if (typeof openDigitalPage === "function") openDigitalPage();
    }
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
    loadSypExchangeRate();
});

document.addEventListener("DOMContentLoaded", function () {
    initializeStoreInteractionLock();

    registerNabdServiceWorker();
    initializeInternalHistory();
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

    // شاشة الترحيب العادية فقط: تظهر عند فتح الموقع أو تحديثه،
    // بدون أي شاشة ثانية لاختيار تسجيل الدخول أو المتابعة كضيف.
    splash.hidden = false;
    splash.classList.remove("is-hidden");
    splash.setAttribute("aria-hidden", "false");

    window.setTimeout(function () {
        splash.classList.add("is-hidden");
        window.setTimeout(function () {
            splash.hidden = true;
            splash.setAttribute("aria-hidden", "true");
        }, 380);
    }, 1400);
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

    // تأكيد الحالة الابتدائية: القائمة مغلقة دائمًا عند تحميل الصفحة.
    // لا تُفتح إلا عبر زر القائمة.
    closeMenu();

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
    { title:"PUBG Mobile", aliases:["pubg mobile","pubg","pubgmobile","ببجي","ببجي موبايل"] },
    { title:"Roblox", aliases:["roblox","roblox game","روبلوكس"] },
    { title:"جواكر", aliases:["جواكر","jawaker"] },
    { title:"Yalla Ludo", aliases:["yalla ludo","يلا لودو"] },
    { title:"Clash of Clans", aliases:["clash of clans","clash"] },
    { title:"فري فاير", aliases:["free fire","فري فاير"] },
    { title:"Yalla Ludo Gold", aliases:["yalla ludo gold"] },
    { title:"Lords mobile", aliases:["lords mobile"] },
    { title:"Farlight 84", aliases:["farlight84","farlight 84","فارلايت 84"] },
    { title:"8 Ball Pool", aliases:["8ball pool","8 ball pool","eight ball pool","ثمانية بول","ثمنية بول"] },
    { title:"Project entropy", aliases:["project entropy"] },
    { title:"Guns of Glory", aliases:["gun of glory","guns of glory","guns glory","غنز اوف غلوري","غنز أوف غلوري"] },
    { title:"Gangs of Glory", aliases:["gangs of glory"] },
    { title:"City Of Crime Gang War", aliases:["city of crime gang war","city of crime gang wars"] },
    { title:"Marvel Rivals", aliases:["marvel rivals","marvel reveals","مارفل ريفيلز","مارفل رايفلز"] },
    { title:"Whiteout Survival", aliases:["whiteout survival"] },
    { title:"Genshin Impact", aliases:["genshin impact"] },
    { title:"Super SUS", aliases:["super sus"] },
    { title:"Stumble Guys", aliases:["stumble guys"] },
    { title:"Honkai: Star Rail", aliases:["honkai","honkai star rail","star rail","honkai : star rail","هونكاي ستار ريل"] },
    { title:"Yalla Ludo Gold Codes", aliases:["yalla ludo gold codes"] },
    { title:"Yalla Ludo Diamonds Codes", aliases:["yalla ludo diamonds codes"] },
    { title:"Mobile Legends: Bang Bang", aliases:["mobile legends","mobile legends turkish","mobile legends bang bang","mlbb","موبايل ليجندز"] },
    { title:"Hero Clash", aliases:["hero clash"] },
    { title:"Oxide : Survival Island", aliases:["oxide","survival island"] },
        { title:"King Shot", aliases:["king shot"] },
        { title:"Zepeto", aliases:["zepeto"] },
    { title:"Devil May Cry: Peak of Combat", aliases:["devil may cry","peak of combat"] },
    { title:"Crystal of Atlan", aliases:["crystal of atlan","crystal atlan","كريستال اوف اتلان","كريستال أوف أتلان"] },
    { title:"Bullet Echo", aliases:["bullet echo","bullet echo pvp shooter","بوليت إيكو","بولت إيكو"] },
    { title:"Blood Strike", aliases:["blood strike","bloodstrike","بلود سترايك"] },
    { title:"Acecraft", aliases:["acecraft","ace craft","إيس كرافت","ايس كرافت"] },
    { title:"Arena Breakout", aliases:["arena breakout","arena breakout mobile","أرينا بريك أوت"] },
    { title:"Ludo Club", aliases:["ludo club","ludo club game","لودو كلوب"] },
        { title:"AFK Journey", aliases:["afk journey"] },
    { title:"Division Resurgence", aliases:["division resurgence"] },
    { title:"Age Of Empires Mobile", aliases:["age of empires"] },
    { title:"Goddess of Victory: NIKKE", aliases:["goddess of victory","nikke"] },
    { title:"Age of Magic", aliases:["age of magic"] },
    { title:"Ghost Story Love Destiny", aliases:["ghost story love destiny"] },
        { title:"Arena of Valor EU", aliases:["arena of valor","arena of valor eu","أرينا أوف فالور"] },
        { title:"Growtopia", aliases:["growtopia","غروتوبيا"] },
        { title:"Golden Spatula", aliases:["golden spatula","غولدن سباتولا"] },
        { title:"Hatsune Miku: Colorful Stage", aliases:["hatsune miku","colorful stage","هتسوني ميكو"] },
        { title:"Arknights Endfield", aliases:["arknights endfield","arknights","أركنايتس إندفيلد"] },
        { title:"Haikyu Fly High", aliases:["haikyu fly high","haikyu","هايكيو فلاي هاي"] },
        { title:"Ballistic Hero VNG", aliases:["ballistic hero vng","ballistic hero","بالستك هيرو"] },
        { title:"Heaven Burns Red", aliases:["heaven burns red","هيفن برنز ريد"] },
    { title:"Rise of Kingdoms: Lost Crusade", aliases:["rise of kingdoms","rise of kingdoms lost crusade","رايز أوف كينغدومز"] },
    { title:"Top War: Battle Game", aliases:["top war","top war battle game","توب وور"] },
    { title:"The Ants: Underground Kingdom", aliases:["the ants","the ants underground kingdom","النمل: المملكة تحت الأرض"] },
    { title:"Kingdom Guard: Tower Defense", aliases:["kingdom guard","kingdom guard tower defense","كينغدوم غارد"] },
    { title:"Call of Dragons", aliases:["call of dragons","call of dragons: total war","كول أوف دراغونز"] },
    { title:"Astral Guardians", aliases:["astral guardians"] },
    { title:"Cyber Fantasy", aliases:["cyber fantasy"] },
        { title:"Blockman Go", aliases:["blockman go","blockman go adventures","بلوكمان جو"] },
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
        .replace(/[٠-٩]/g, function(d){ return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); })
        .replace(/[۰-۹]/g, function(d){ return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); })
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

function getStoredGameImageUrl(gameTitle) {
    const text = normalizeGameText(gameTitle);
    if (text.includes("yalla ludo gold codes")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/yalla-ludo.png";
    if (text.includes("yalla ludo diamonds codes")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/yalla-ludo.png";
    if (text.includes("pubg") || text.includes("ببجي")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/pubg-mobile.png";
    if (text.includes("roblox") || text.includes("روبلوكس")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/roblox.png";
    if (text.includes("jawaker") || text.includes("جواكر")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/jawaker.png";
    if (text.includes("free fire") || text.includes("فري فاير")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/free-fire.png";
    if (text.includes("clash of clans") || text.includes("كلاش")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/clash-of-clans.png";
    if (text.includes("dragonheir") || text.includes("silent gods") || text.includes("دراغون هير")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/dragonheir-silent-gods.jpg";
    if (text.includes("cloud song") || text.includes("skywalkers") || text.includes("كلاود سونغ")) return "/game-images/cloud-song";
    if (text.includes("yalla ludo gold") || text.includes("يلا لودو جولد") || text.includes("يلا لودو غولد")) {
        // Yalla Ludo Gold ليس تطبيقًا مستقلاً؛ يستخدم نفس أيقونة Yalla Ludo الرسمية.
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/yalla-ludo.png";
    }
    if (text.includes("yalla ludo") || text.includes("يلا لودو")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/yalla-ludo.png";
    }
    if (text.includes("lords mobile") || text.includes("لوردز موبايل") || text.includes("لوردس موبايل")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/lords-mobile.png";
    }
    if (text.includes("8ball pool") || text.includes("8 ball pool") || text.includes("eight ball pool") || text.includes("ثمانية بول") || text.includes("ثمنية بول")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/8-ball-pool.png";
    }
    if (text.includes("gun of glory") || text.includes("guns of glory")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/guns-of-glory.jpg";
    }
    if (text.includes("gangs of glory") || text.includes("غانغز اوف غلوري") || text.includes("غانجز أوف غلوري")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/gangs-of-glory.webp";
    }
    if (text.includes("project entropy") || text.includes("بروجكت انتروبي") || text.includes("بروجيكت انتروبي")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/project-entropy.png";
    }
    if (text.includes("farlight 84") || text.includes("farlight84") || text.includes("فارلايت 84")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/farlight-84.png";
    }
    if (text.includes("city of crime gang war") || text.includes("city of crime gang wars")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/city-of-crime-gang-war.png";
    }
    if (text.includes("marvel rivals") || text.includes("marvel reveals") || text.includes("مارفل ريفيلز") || text.includes("مارفل رايفلز")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/marvel-rivals.jpg";
    }
    if (text.includes("genshin impact")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/genshin-impact.png";
    }
    if (text.includes("super sus")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/super-sus.png";
    }
    if (text.includes("crystal of atlan") || text.includes("crystal atlan") || text.includes("كريستال اوف اتلان") || text.includes("كريستال أوف أتلان")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/crystal-of-atlan.png";
    }
    if (text.includes("bullet echo") || text.includes("بوليت إيكو") || text.includes("بولت إيكو")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/bullet-echo.png";
    }
    if (text.includes("stumble guys")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/stumble-guys.png";
    }
    if (text.includes("honkai") || text.includes("star rail") || text.includes("هونكاي")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/honkai-star-rail.png";
    if (text.includes("mobile legends") || text.includes("mlbb") || text.includes("موبايل ليجندز")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/mobile-legends.png";
    if (text.includes("oxide") || text.includes("survival island")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/oxide-survival-island.png";
    if (text.includes("king shot") || text.includes("kingshot")) return "/game-images/king-shot";
    if (text.includes("zepeto")) return "/game-images/zepeto";
    if (text.includes("blood strike") || text.includes("bloodstrike")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/blood-strike.png";
    if (text.includes("acecraft") || text.includes("ace craft")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/acecraft.png";
    if (text.includes("age of empires mobile") || text.includes("age of empires") || text.includes("عصر الامبراطوريات موبايل")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/age-of-empires-mobile.png";
    if (text.includes("goddess of victory") || text.includes("goddess of victory nikke") || text.includes("nikke") || text.includes("نيكي")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/nikke.png";
    if (text.includes("division resurgence") || text.includes("the division resurgence") || text.includes("ذا ديفيجن ريزرجنس")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/division-resurgence.png";
    if (text.includes("arena breakout") || text.includes("arena breakout mobile") || text.includes("أرينا بريك أوت")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/arena-breakout.png";
    if (text.includes("ludo club") || text.includes("لودو كلوب")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/ludo-club.png";
    if (text.includes("afk journey")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/afk-journey.png";
    if (text.includes("age of magic")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/age-of-magic.png";
    if (text.includes("ghost story love destiny")) return "/game-images/ghost-story-love-destiny";
    if (text.includes("arena of valor") || text.includes("أرينا أوف فالور")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/arena-of-valor.png";
    if (text.includes("growtopia") || text.includes("غروتوبيا")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/growtopia.png";
    if (text.includes("golden spatula") || text.includes("غولدن سباتولا")) return "/game-images/golden-spatula";
    if (text.includes("hatsune miku") || text.includes("colorful stage") || text.includes("هتسوني ميكو")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/hatsune-miku-colorful-stage.png";
    if (text.includes("arknights endfield") || text.includes("arknights") || text.includes("أركنايتس إندفيلد")) return "/game-images/arknights-endfield";
    if (text.includes("haikyu fly high") || text.includes("haikyu") || text.includes("هايكيو فلاي هاي")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/haikyu-fly-high.png";
    if (text.includes("ballistic hero vng") || text.includes("ballistic hero") || text.includes("بالستك هيرو")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/ballistic-hero-vng.png";
    if (text.includes("heaven burns red") || text.includes("هيفن برنز ريد")) return "/game-images/heaven-burns-red";
    if (text.includes("rise of kingdoms") || text.includes("رايز أوف كينغدومز")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/rise-of-kingdoms.png";
    if (text.includes("top war") || text.includes("توب وور")) return "/game-images/top-war";
    if (text.includes("the ants") || text.includes("النمل: المملكة تحت الأرض")) return "/game-images/the-ants";
    if (text.includes("kingdom guard") || text.includes("كينغدوم غارد")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/kingdom-guard.jpg";
    if (text.includes("call of dragons") || text.includes("كول أوف دراغونز")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/call-of-dragons.jpg";
    if (text.includes("astral guardians")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/astral-guardians.png";
    if (text.includes("cyber fantasy")) return "/game-images/cyber-fantasy";
    if (text.includes("blockman go") || text.includes("بلوكمان جو")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/blockman-go.png";
    if (text.includes("blade x") || text.includes("odyssey of heroes")) return "/game-images/blade-x";
    if (text.includes("be the king")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/be-the-king.png";
    if (text.includes("captain tsubasa")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/captain-tsubasa.jpg";
    if (text.includes("idol party")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/idol-party.png";
    if (text.includes("hyper front")) return "/game-images/hyper-front";
    if (text.includes("infinite lagrange")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/infinite-lagrange.png";
    if (text.includes("clash of plants")) return "/game-images/clash-of-plants";
    if (text.includes("journey renewed") || text.includes("fate fantasy")) return "/game-images/journey-renewed";
    if (text.includes("civilization") || text.includes("eras & allies")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/civilization-eras-allies.png";
    if (text.includes("kuroko street rivals") || text.includes("kuroko")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/kuroko-street-rivals.png";
    if (text.includes("cloud song") || text.includes("skywalkers")) return "/game-images/cloud-song";
    if (text.includes("king's choice") || text.includes("kings choice")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/kings-choice-sea.png";
    if (text.includes("crossfire legend")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/crossfire-legend.png";
    if (text.includes("legend of the phoenix")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/legend-of-the-phoenix.png";
    if (text.includes("legacy of discord") || text.includes("furiouswings")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/legacy-of-discord.png";
    if (text.includes("army dudes")) return "/game-images/army-dudes";
    if (text.includes("crystalfall")) return "/game-images/crystalfall";
    if (text.includes("crossout mobile") || text.includes("crossout")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/crossout-mobile.jpg";
    if (text.includes("dragon raja")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/dragon-raja-sea.png";
    if (text.includes("dragon nest m") || text.includes("dragon nest")) return "/game-images/dragon-nest-m-sea";
    if (text.includes("life makeover")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/life-makeover-global.png";
    if (text.includes("love nikki")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/love-nikki.png";
    if (text.includes("dragonheir") || text.includes("dragonheir silent gods")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/dragonheir-silent-gods.jpg";
    if (text.includes("dream and lethe") || text.includes("dream & lethe")) return "/game-images/dream-and-lethe-record";
    if (text.includes("eggy party")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/eggy-party.png";
    if (text.includes("echocalypse") || text.includes("scarlet covenant")) return "/game-images/echocalypse-scarlet-covenant";
    if (text.includes("hero clash") || text.includes("هيرو كلاش")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/hero-clash.png";
    if (text.includes("devil may cry") || text.includes("devil may cry peak of combat") || text.includes("peak of combat") || text.includes("ديفل ماي كراي")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/devil-may-cry.png";
    if (text.includes("eggy party") || text.includes("egg party") || text.includes("إيجي بارتي")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/eggy-party.png";
    if (text.includes("my singing monsters") || text.includes("my singing") || text.includes("monsters") || text.includes("ماي سينغينغ مونسترز")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/my-singing-monsters.jpg";

    if (text.includes("dynasty heroes") || text.includes("legend samkok")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/dynasty-heroes.png";
    if (text.includes("starseed") || text.includes("asnia trigger")) return "/game-images/starseed";
    if (text.includes("magic chess") || text.includes("magic chess gogo") || text.includes("magic chess go go")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/magic-chess-gogo.png";
    if (text.includes("enhypen world") || text.includes("enhypen")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/enhypen-world.png";
    if (text.includes("marvel duel")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/marvel-duel.png";
    if (text.includes("extraordinary ones")) return "/game-images/extraordinary-ones";
    if (text.includes("eve echoes") || text.includes("eve echo")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/eve-echoes.png";
    if (text.includes("mirage perfect skyline") || text.includes("mirage:perfect skyline") || text.includes("mirage")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/mirage-perfect-skyline.png";
    if (text.includes("football master 2") || text.includes("football master")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/football-master-2.jpg";
    if (text.includes("marvel mystic mayhem")) return "/game-images/marvel-mystic-mayhem";
    if (text.includes("garena speed drifters") || text.includes("speed drifters")) return "/game-images/garena-speed-drifters";
    if (text.includes("mongil star dive")) return "/game-images/mongil-star-dive";
    if (text.includes("modern strike online")) return "/game-images/modern-strike-online";
    if (text.includes("overmortal idle global") || text.includes("overmortal")) return "/game-images/overmortal-idle-global";    if (text.includes("onmyoji arena") || text.includes("onmyoji") || text.includes("أونميوجي أرينا")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/onmyoji-arena.png";
    if (text.includes("stormshot") || text.includes("storm shot") || text.includes("ستورمشوت")) return "/game-images/stormshot";
    if (text.includes("crossout mobile") || text.includes("crossout") || text.includes("كروس أوت موبايل")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/crossout-mobile.jpg";
    if (text.includes("dragon raja sea") || text.includes("dragon raja") || text.includes("دراغون راجا")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/dragon-raja-sea.png";
    if (text.includes("life makeover global") || text.includes("life makeover") || text.includes("لايف ميك أوفر")) return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/life-makeover-global.png";
    if (text.includes("whiteout survival")) {
        return "https://raw.githubusercontent.com/1ahmad3asl-pixel/Nabd-Store/main/public/game-images/whiteout-survival.png";
    }
    return "";
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
            image: getStoredGameImageUrl(game.title) ||
                game.image ||
                (productWithImage && productWithImage.category_img) ||
                "",
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
            if (category === "apps") {
                openAppsPage();
                return;
            }
            if (category === "balance") {
                openBalancePage();
                return;
            }
            if (category === "numbers") {
                openNumbersPage();
                return;
            }
            if (category === "digital") {
                if (typeof openDigitalPage === "function") openDigitalPage();
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
    if (back) back.addEventListener("click", function() {
        if (window.history.state && window.history.state.nabdInternal) {
            window.history.back();
        } else {
            closeInternalPage();
        }
    });
}

function cleanGameCategoryName(value) {
    return String(value || "")
        .replace(/[•·]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function getGameProducts(gameTitle) {
    return state.products.filter(function(product) {
        const text = normalizeGameText(
            String(product.category_name || "") + " " +
            String(product.name || "")
        );

        if (isPubgGame(gameTitle)) {
            return text.includes("ببجي") || text.includes("pubg");
        }

        // جواكر: اربط كل منتجات جواكر مباشرة بالنص القادم من الكتالوج،
        // ثم دع getJawakerGroupTitle يفرزها إلى المربعات الثلاثة.
        if (normalizeGameText(gameTitle).includes("jawaker") || normalizeGameText(gameTitle).includes("جواكر")) {
            return text.includes("جواكر") || text.includes("jawaker");
        }

        const match = findGameMatch(product);
        return match && match.title === gameTitle;
    });
}

function getRobloxGroupTitle(product) {
    const text = normalizeGameText(product && (String(product.category_name || "") + " " + String(product.name || "")));
    if (text.includes("usa") || text.includes("usd")) return "Roblox USA";
    if (text.includes("ksa") || text.includes("sar")) return "Roblox KSA";
    if (text.includes("uae") || text.includes("aed")) return "Roblox UAE";
    if (text.includes("cad")) return "Roblox CAD";
    if (text.includes("eur") || text.includes("€")) return "Roblox EUR";
    return cleanGameCategoryName(product && product.category_name || "Roblox");
}

function getJawakerGroupTitle(product) {
    const raw = cleanGameCategoryName(
        String(product && product.category_name || "") + " " +
        String(product && product.name || "")
    );
    const text = normalizeGameText(raw);

    if (
        text.includes("مسرع") || text.includes("مسرعات") || text.includes("مسرعه") ||
        text.includes("تسريع") || text.includes("تسريعات") ||
        text.includes("accelerator") || text.includes("accelerate") ||
        text.includes("booster") || text.includes("boost") ||
        text.includes("blue accelerator") || text.includes("red accelerator") ||
        text.includes("yellow accelerator")
    ) return "مسرع جواكر";

    if (
        text.includes("s2") || text.includes("s 2") ||
        text.includes("عداد جواكر s2") || text.includes("jawaker counter s2") ||
        text.includes("counter s2")
    ) return "عداد جواكر S2";

    if (
        text.includes("s1") || text.includes("s 1") || text.includes("cum") ||
        text.includes("server") || text.includes("سيرفر") || text.includes("سرفر") ||
        text.includes("عداد جواكر سيرفر") || text.includes("jawaker server")
    ) return "جواكر سيرفر S1";

    return "";
}

function getJawakerGroupDefinitions() {
    return [
        { key: "jawaker|accelerator", title: "مسرع جواكر" },
        { key: "jawaker|counter-s2", title: "عداد جواكر S2" },
        { key: "jawaker|server-s1", title: "جواكر سيرفر S1" }
    ];
}

function getJawakerProductSortValue(product) {
    const price = getGameProductPrice(product);
    return price === null ? Number.POSITIVE_INFINITY : price;
}

function sortJawakerProducts(products) {
    return products.slice().sort(function(a, b) {
        const priceDiff = getJawakerProductSortValue(a) - getJawakerProductSortValue(b);
        if (priceDiff !== 0) return priceDiff;
        return String(a.name || "").localeCompare(String(b.name || ""), "ar");
    });
}

function sortGameProducts(products) {
    return products.slice().sort(function(a, b) {
        const ap = getGameProductPrice(a);
        const bp = getGameProductPrice(b);
        const ad = ap === null ? Number.POSITIVE_INFINITY : ap;
        const bd = bp === null ? Number.POSITIVE_INFINITY : bp;
        if (ad !== bd) return ad - bd;
        return String(a.name || "").localeCompare(String(b.name || ""), "ar");
    });
}

function getGameGroups(gameTitle) {
    const products = getGameProducts(gameTitle);
    const groups = [];
    const seen = new Map();
    const normalizedGame = normalizeGameText(gameTitle);
    const isRoblox = normalizedGame.includes("roblox");
    const isJawaker = normalizedGame.includes("jawaker") || normalizedGame.includes("جواكر");
    const isFreeFire = normalizedGame.includes("free fire") || normalizedGame.includes("فري فاير");
    const isClashOfClans = normalizedGame.includes("clash of clans") || normalizedGame.includes("كلاش");
    const isDragonheir = normalizedGame.includes("dragonheir") || normalizedGame.includes("silent gods") || normalizedGame.includes("دراغون هير");
    const isCloudSong = normalizedGame.includes("cloud song") || normalizedGame.includes("skywalkers") || normalizedGame.includes("كلاود سونغ");
    const isYallaLudo = normalizedGame.includes("yalla ludo") || normalizedGame.includes("يلا لودو");
    const isYallaLudoGold = normalizedGame.includes("yalla ludo gold") || normalizedGame.includes("يلا لودو جولد") || normalizedGame.includes("يلا لودو غولد");
    const isLordsMobile = normalizedGame.includes("lords mobile") || normalizedGame.includes("لوردز موبايل") || normalizedGame.includes("لوردس موبايل");
    const isEightBallPool = normalizedGame.includes("8ball pool") || normalizedGame.includes("8 ball pool") || normalizedGame.includes("eight ball pool") || normalizedGame.includes("ثمانية بول") || normalizedGame.includes("ثمنية بول");
    const isGunsOfGlory = normalizedGame.includes("gun of glory") || normalizedGame.includes("guns of glory");
    const isGangsOfGlory = normalizedGame.includes("gangs of glory") || normalizedGame.includes("غانغز اوف غلوري") || normalizedGame.includes("غانجز أوف غلوري");
    const isProjectEntropy = normalizedGame.includes("project entropy") || normalizedGame.includes("بروجكت انتروبي") || normalizedGame.includes("بروجيكت انتروبي");
    const isFarlight84 = normalizedGame.includes("farlight 84") || normalizedGame.includes("farlight84") || normalizedGame.includes("فارلايت 84");
    const isMarvelRivals = normalizedGame.includes("marvel rivals") || normalizedGame.includes("marvel reveals") || normalizedGame.includes("مارفل ريفيلز") || normalizedGame.includes("مارفل رايفلز");
    const isCityOfCrimeGangWar = normalizedGame.includes("city of crime gang war") || normalizedGame.includes("city of crime gang wars");

    if (isJawaker) {
        const definitions = getJawakerGroupDefinitions();
        definitions.forEach(function(definition) {
            const groupProducts = sortJawakerProducts(
                products.filter(function(product) {
                    return getJawakerGroupTitle(product) === definition.title;
                })
            );

            groups.push({
                key: definition.key,
                title: definition.title,
                image: (groupProducts[0] && groupProducts[0].category_img) || "",
                products: groupProducts
            });
        });

        return groups;
    }

    products.forEach(function(product) {
        const categoryName = isRoblox
            ? getRobloxGroupTitle(product)
            : cleanGameCategoryName(product.category_name || "منتجات " + gameTitle);
        const parentKey = String(product.parent_id ?? "");
        const key = (isRoblox || isFreeFire || isClashOfClans || isDragonheir || isCloudSong || isYallaLudo || isYallaLudoGold || isLordsMobile || isEightBallPool || isGunsOfGlory || isGangsOfGlory || isProjectEntropy || isFarlight84 || isMarvelRivals || isCityOfCrimeGangWar)
            ? normalizeGameText(gameTitle) + "|" + normalizeGameText(categoryName)
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

    groups.forEach(function(group) {
        group.products = sortGameProducts(group.products);
    });
    return groups;
}

function pushInternalHistory(view, data) {
    const state = Object.assign({ nabdInternal: true, view: view }, data || {});
    window.history.pushState(state, "", window.location.href);
}

function handleInternalHistoryState(state) {
    if (!state || !state.nabdInternal) {
        closeInternalPage();
        return;
    }

    if (state.view === "games") {
        openGamesPage(true);        return;
    }

    if (state.view === "game") {
        openGamePlaceholder(state.gameTitle, true);
        return;
    }

    if (state.view === "products") {
        openGameProductGroup(state.gameTitle, state.groupKey, true);
        return;
    }

    if (state.view === "apps") {
        openAppsPage(true);
        return;
    }

    if (state.view === "app-server") {
        openAppServerPlaceholder(state.appServerTitle, state.appServerKey, true);
        return;
    }

    if (state.view === "app-products") {
        const serverTitle = state.appServerKey === "server-2" ? "تطبيقات سيرفر 2" : "تطبيقات سيرفر 1";
        const apps = state.appServerKey === "server-2" ? getServerTwoApps() : getServerOneApps();
        const app = apps.find(function(item){ return item.title === state.appTitle; });
        if (app) openAppProducts(app, state.appServerKey, true);
        else openAppServerPlaceholder(serverTitle, state.appServerKey, true);
        return;
    }

    if (state.view === "numbers") {
        openNumbersPage(true);
        return;
    }

    if (state.view === "number-products") {
        openNumberGroupProducts(state.numberGroupKey, true);
        return;
    }

    if (state.view === "balance") {
        openBalancePage(true);
        return;
    }

    if (state.view === "digital") {
        if (typeof openDigitalPage === "function") openDigitalPage(true);
        return;
    }

    if (state.view === "digital-products") {
        if (typeof getDigitalGroups === "function" && typeof openDigitalProducts === "function") {
            const group = getDigitalGroups().find(function(item){ return item.key === state.digitalGroupKey; });
            if (group) openDigitalProducts(group, true);
            else openDigitalPage(true);
        }
        return;
    }

    if (state.view === "balance-subgroups") {
        openBalanceSubgroups(state.balanceGroupKey, true);
        return;
    }

    if (state.view === "balance-products") {
        openBalanceSubgroupProducts(state.balanceGroupKey, state.subgroupKey, true);
        return;
    }

    closeInternalPage();
}

function initializeInternalHistory() {
    window.addEventListener("popstate", function(event) {
        handleInternalHistoryState(event.state);
    });
}

function getNumberGroupDefinitions() {
    return [
        {key:"whatsapp-s1",title:"أرقام واتساب S1",aliases:["ارقام واتساب s1","أرقام واتساب s1","whatsapp s1","واتساب سيرفر 1","واتساب سيرفر واحد","ارقام واتساب 1","أرقام واتساب 1","whatsapp server 1","whatsapp server1","whatsapp 1"]},
        {key:"whatsapp-s2",title:"أرقام واتساب S2",aliases:["ارقام واتساب s2","أرقام واتساب s2","whatsapp s2","واتساب سيرفر 2","واتساب سيرفر اثنين","واتساب سيرفر اثنان","ارقام واتساب 2","أرقام واتساب 2","whatsapp server 2","whatsapp server2","whatsapp 2"]},
        {key:"gmail",title:"أرقام جيميل",aliases:["ارقام جيميل","أرقام جيميل","gmail","google mail","جوجل ميل"]},
        {key:"facebook",title:"أرقام فيسبوك",aliases:["ارقام فيسبوك","أرقام فيسبوك","facebook","fb","فيس بوك","فيسبوك"]},
        {key:"icloud",title:"أرقام آيكلاود",aliases:["ارقام ايكلاود","أرقام ايكلاود","ايكلاود","آيكلاود","اي كلاود","آي كلاود","icloud","icloud number","icloud numbers","icloud phone","apple icloud"]},
        {key:"imo",title:"أرقام ايمو",aliases:["ارقام ايمو","أرقام ايمو","ايمو","إيمو","imo","imo number","imo numbers","imo phone"]},
        {key:"instagram",title:"أرقام انستغرام",aliases:["ارقام انستغرام","أرقام انستغرام","انستغرام","إنستغرام","انستا","instagram","ig","instagram number","instagram numbers","instagram phone"]},
        {key:"whatsapp-badawi",title:"رقم واتساب بدوي",aliases:["رقم واتساب بدوي","ارقام واتساب بدوي","أرقام واتساب بدوي","واتساب بدوي","whatsapp badawi","badawi whatsapp","badawi number"]},
        {key:"whatsapp-ban",title:"حظر رقم واتساب",aliases:["حظر رقم واتساب","حظر ارقام واتساب","أرقام واتساب محظورة","حظر واتساب","whatsapp ban","banned whatsapp","whatsapp banned number","blocked whatsapp number"]}
    ];
}

function getNumberGroupProducts(group) {
    const aliases=(group.aliases||[]).map(normalizeGameText).filter(Boolean);

    function containsToken(text, token) {
        const normalizedText = " " + normalizeGameText(text) + " ";
        const normalizedToken = normalizeGameText(token);
        return !!normalizedToken && normalizedText.includes(" " + normalizedToken + " ");
    }

    return state.products.filter(function(product){
        const category=normalizeGameText(product && product.category_name);
        const name=normalizeGameText(product && product.name);
        const text=(category+" "+name).trim();

        // WhatsApp S1/S2: match the actual server identity without allowing
        // S1 to accidentally match S10, or server 1 to match server 10.
        if(group.key==="whatsapp-s1" || group.key==="whatsapp-s2"){
            const serverNumber=group.key==="whatsapp-s1" ? "1" : "2";
            const hasWhatsapp=containsToken(text,"whatsapp") || containsToken(text,"واتساب");
            const serverPatterns=group.key==="whatsapp-s1"
                ? ["s1","server 1","server1","سيرفر 1","سيرفر واحد","واتساب 1"]
                : ["s2","server 2","server2","سيرفر 2","سيرفر اثنين","سيرفر اثنان","واتساب 2"];
            const hasServer=serverPatterns.some(function(pattern){
                return containsToken(text, pattern);
            }) || containsToken(text, serverNumber);
            if(hasWhatsapp && hasServer) return true;
        }

        // All other number groups use exact normalized token/phrase matching.
        // Do not use reverse matching, which can attach an unrelated product
        // merely because its text is shorter than an alias.
        return aliases.some(function(alias){
            return containsToken(text, alias);
        });
    });
}

function getNumberGroupImage(group) {
    // Use the WhatsApp brand asset for both WhatsApp number servers.
    if(group && (group.key==="whatsapp-s1" || group.key==="whatsapp-s2")){
        return BACKEND_URL + "/assets/whatsapp.svg";
    }
    if(group && group.key==="facebook") return BACKEND_URL + "/assets/facebook.svg";
    if(group && group.key==="gmail") return BACKEND_URL + "/assets/gmail.svg";
    if(group && group.key==="icloud") return BACKEND_URL + "/assets/icloud.svg";
    if(group && group.key==="imo") return BACKEND_URL + "/assets/imo.svg";
    if(group && group.key==="instagram") return BACKEND_URL + "/assets/instagram.svg";
    if(group && group.key==="whatsapp-badawi") return BACKEND_URL + "/assets/whatsapp.svg";
    if(group && group.key==="whatsapp-ban") return BACKEND_URL + "/assets/whatsapp.svg";
    const p=getNumberGroupProducts(group).find(function(item){return String(item.category_img||"").trim();});
    return p ? String(p.category_img) : "";
}

function openNumbersPage(fromHistory) {
    if(!fromHistory) pushInternalHistory("numbers");
    const services=document.getElementById("servicesSection"),internal=document.getElementById("internalPage"),title=document.getElementById("internalPageTitle"),icon=document.getElementById("internalPageIcon"),content=document.getElementById("internalPageContent");
    if(!services||!internal||!content)return;
    services.hidden=true; internal.hidden=false; if(title)title.textContent="الأرقام"; if(icon)icon.textContent="📲";
    // المستوى الثاني يعرض التصنيفات فقط؛ جلب المنتجات يتم بعد الضغط على التصنيف.
    const groups=getNumberGroupDefinitions().map(function(g){return Object.assign({},g,{image:getNumberGroupImage(g)});});
    content.innerHTML='<div class="numbers-page-note">اختر نوع الرقم لجلب منتجاته المتاحة.</div><div class="game-category-grid numbers-category-grid">'+groups.map(function(g){
        const img=g.image?'<img src="'+escapeHtml(g.image)+'" alt="" loading="lazy">':'<span class="numbers-placeholder">📲</span>';
        return '<button class="game-category-tile numbers-category-tile" type="button" data-number-group="'+escapeHtml(g.key)+'"><span class="game-tile-image">'+img+'</span><span class="game-tile-title">'+escapeHtml(g.title)+'</span></button>';
    }).join("")+'</div>';
    content.querySelectorAll(".numbers-category-tile:not([disabled])").forEach(function(tile){tile.addEventListener("click",function(){openNumberGroupProducts(tile.getAttribute("data-number-group"));});});
    window.scrollTo({top:0,behavior:"smooth"});
}

function openNumberGroupProducts(groupKey,fromHistory) {
    const group=getNumberGroupDefinitions().find(function(g){return g.key===groupKey;});
    if(!group){openNumbersPage(!!fromHistory);return;}
    if(!fromHistory)pushInternalHistory("number-products",{numberGroupKey:groupKey});
    const services=document.getElementById("servicesSection"),internal=document.getElementById("internalPage"),content=document.getElementById("internalPageContent");
    if(!services||!internal||!content)return;
    services.hidden=true;internal.hidden=false;

    // المستوى الثالث هو نقطة جلب منتجات التصنيف.
    if(!state.productsLive){
        content.innerHTML='<div class="products-loading"><div class="loading-spinner"></div><p>جاري تحميل منتجات هذا التصنيف...</p></div>';
        loadProducts({force:true}).then(function(){openNumberGroupProducts(groupKey,true);}).catch(function(){
            content.innerHTML='<div class="game-products-placeholder"><div class="game-products-placeholder-icon">⚠️</div><h3>'+escapeHtml(group.title)+'</h3><p>تعذر تحميل المنتجات حاليًا.</p></div>';
        });
        return;
    }

    const products=getNumberGroupProducts(group);
    renderGameProductPicker(
        group.title,
        {title:group.title,image:getNumberGroupImage(group),products:products},
        {
            type:"numbers",
            onBack:function(){openNumbersPage();}
        }
    );
}
function getAppServerTiles() {
    return [
        { key:"server-1", title:"تطبيقات سيرفر 1", image:BACKEND_URL + "/assets/app-server-1.svg" },
        { key:"server-2", title:"تطبيقات سيرفر 2", image:BACKEND_URL + "/assets/app-server-2.svg" },
        { key:"server-3", title:"تطبيقات سيرفر 3", image:BACKEND_URL + "/assets/app-server-3.svg" },
        { key:"server-4", title:"تطبيقات سيرفر 4", image:BACKEND_URL + "/assets/app-server-4.svg" }
    ];
}

function openAppsPage(fromHistory) {
    if (!fromHistory) pushInternalHistory("apps");
    const services = document.getElementById("servicesSection");
    const internal = document.getElementById("internalPage");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    const content = document.getElementById("internalPageContent");
    if (!services || !internal || !content) return;

    services.hidden = true;
    internal.hidden = false;
    if (title) title.textContent = "قسم التطبيقات";
    if (icon) icon.textContent = "📱";

    const tiles = getAppServerTiles();
    content.innerHTML =
        '<div class="products-loading app-services-loading"><div class="loading-spinner"></div><p>جاري تحميل الخدمات...</p></div>' +
        '<div class="app-page-note">اختر قسم السيرفر للدخول إلى التطبيقات المتاحة.</div>' +
        '<div class="game-category-grid app-server-grid">' +
        tiles.map(function(tile) {
            return '<button class="game-category-tile app-server-tile" type="button" data-app-server="' +
                escapeHtml(tile.key) + '">' +
                '<span class="game-tile-image app-server-image">' +
                    '<img src="' + escapeHtml(tile.image) + '" alt="" loading="lazy">' +
                '</span>' +
                '<span class="game-tile-title">' + escapeHtml(tile.title) + '</span>' +
            '</button>';
        }).join("") +
        '</div>';

    content.querySelectorAll(".app-server-tile").forEach(function(tile) {
        tile.addEventListener("click", function() {
            const key = tile.getAttribute("data-app-server") || "";
            const selected = tiles.find(function(item) { return item.key === key; });
            if (selected) openAppServerPlaceholder(selected.title, key);
        });
    });

    window.scrollTo({top: 0, behavior: "smooth"});
}

function getServerOneApps() {
    const catalog = [["سول تشيل كريستال","SOUL CHILL CRYSTAL"],["يوهو واكا","YOHO WAKA"],["هاوك شات","Hawk Chat"],["هيليلي شات","Helli Chat"],["بشار شات","BISHAR CHAT"],["Limmatna","Limmatna"],["أهلن شات","AHLAN CHAT"],["بوتا جرين","BOTA GREEN"],["ياهلا شات","YAAHLAN CHAT"],["تاكا لايف","TAKA LIVE"],["وي بارتي","WE PARTY"],["وينكو","Winko"],["هوكي شات","HOKI CHAT"],["زافا لايف","ZAFFA LIVE"],["شاتي","Chati"],["هيبّا","Hebba"],["كراش لايف","CRUSH LIVE"],["تي لايف","TI LIVE"],["فوكا شات","Voca Chat"],["ديوان توك","DIWAN TALK"],["هوني جار","Honey Jar"],["نيو شات","NiuChat"],["سوجو","SUGO"],["روفا","Ruffa"],["سوهة","Soha"],["واهو شات","WAHO CHAT"],["فيلا","VILAA"],["شباب شات","Shabab Chat"],["4PARTY","4PARTY"],["أويوني شات","Oyuni Chat"],["سول شات","Soul chat"],["لوتفن","LOTFUN"],["زينا لايف","XENA LIVE"],["ناخّي","NAHKI"],["فوستار","VoStar"],["تامي شات","TAMI CHAT"],["جونكو شات","JUNKO CHAT"],["بيست لايف","BEST LIVE"],["بوبو لايف","Poppo"],["هاكي شات","HAKI CHAT"],["يسو فارم","Yeso Farm"],["يويو شات","YOYO CHAT"],["ليجو لايف","LIGO LIVE"],["سول ستار","SOUL STAR"],["لامي شات","LAMI CHAT"],["هيا شات","HIYA CHAT"],["لايت","LIGHT"],["لايكي لايف","LIKEE LIVE"],["فورفن شات","4FUN CHAT"],["بارتي ستار","PARTY STAR"],["فانسي لايف","FANCY LIVE"],["بيجو لايف","Bigo Live"],["ساما شات","Sama Chat"],["أب لايف","UP LIVE"],["أوهلا شات","OOHLA CHAT"],["روح","ROOH"],["تالك تالك","TALK TALK"],["ميكو شات","MICO CHAT"],["هابي شات","Habby Chat"],["ليت شات","LIT CHAT"],["سوبر لايف","SUPER LIVE"],["لاما شات","LAMA CHAT"],["بوبو شات","BOBO CHAT"],["كيو لايف","KIYO LIVE"],["أولامت","OLAMET"],["سكاي شات","SKY CHAT"],["هاوا شات","HAWA Chat"],["كواي لايف","KWAI LIVE"],["بيلا شات","Beela Chat"],["أزال لايف","Azal Live"],["سويو شات","SOYO CHAT"],["ميو","MEYO"],["بينمو شات","Binmo Chat"],["هامستر","HAMSTER"],["واياك شات","WYAK CHAT"],["كوكو لايف","COCCO LIVE"],["أيوومي","Ayome"],["ميجو لايف","MIGO LIVE"],["واكي ستار","Woki star"],["توب فويس","TOP VOICE"],["يوبي شات","YOBI CHAT"],["جولد شات","Gold Chat"],["هيو شات","HIYOO CHAT"],["ألو شات","ALLO CHAT"],["سوالفنا شات","SAWALFNA CHAT"],["ديمو","Dimo"],["ديتو لايف","DITTO LIVE"],["توب شات","TOP CHAT"],["آي ستار شات","1STAR CHAT"],["ليلى شات","LAYLA CHAT"],["سلام شات","SALAM CHAT"],["جيمي لايف","GIMME LIVE"],["هوب","HOOB"],["ليونز شات","LIONS CHAT"],["غالا ستار","GALA STAR"],["ويجو","WEGO"],["تادا شات","Tada Chat"],["تانجو","Tango"],["عمار","AMAR"],["سوماتش","SOMATCH"],["شاميت","CHAMET"],["هابي شات","HABI CHAT"],["بارتي هيرو","PARTY HERO"],["أمو","AMO"],["مجلس شات","MAJLIS CHAT"],["لايام","LAYAM"],["هالا مي","HALA ME"],["وصلة","WASLA"],["روستار","RoStar"],["هيجو لايف","HIGO LIVE"],["أشا لايف","ASHA LIVE"],["دانا شات","DANA CHAT"],["صدفة شات","SODFA CHAT"],["ويسو شات","WESO CHAT"],["شيلا شات","SHILA CHAT"],["فوفو شات","FOFO CHAT"],["يامي ستار","YAMI STAR"],["سایا لايكي","SAYA LIKEE"],["يودو فون","YUDO FUN"],["أب فن","UP FUN"],["ناوا شات","NAWA CHAT"],["مازا","MAZA"],["إنفون","INFUN"],["كيتي","KITI"],["يو بارتي","YOPARTY"],["بوتا لايف","PotaLive"],["لادو شات","LADO CHAT"],["بولي","BOLI"],["جاكو","JACO"],["واو شات","WAAW CHAT"],["جاني","GHANNY"],["كارني","CARNI"],["فوكا","VOCA"],["هاتي","HATI"],["يوهو ستار","YOHOO STAR"],["ليسكي","LEESKY"],["ساهرة","SAHRA"],["هالو ستار","HALO STAR"],["فف بارتي","VVPARTY"],["بوكيت","POCKET"],["هايوكي","HAYUKI"],["مزيون","MAZYOUN"],["جاميت","GAMET"],["هالا","HALLA"],["لكلك","LKLK"],["هاجو","HAGO"],["كيسميت","KESSMET"],["هيبارتي","HIPARTY"]];
    const products = Array.isArray(state.products) ? state.products : [];
    const normalize = function(value) {
        return normalizeGameText(String(value || ""));
    };
    return catalog.map(function(item) {
        const title = item[0];
        const aliases = [item[0], item[1]].map(normalize).filter(Boolean);
        let match = null;
        for (const product of products) {
            const text = normalize((product.category_name || "") + " " + (product.name || ""));
            if (aliases.some(function(alias) { return text.includes(alias) || alias.includes(text); })) {
                if (!match || (!match.category_img && product.category_img)) match = product;
            }
        }
        return {
            title: title,
            search: item[1],
            image: match && match.category_img ? String(match.category_img) : "",
            product: match || null
        };
    });
}


function getServerTwoApps() {
    const catalog = [["WeStar","WeStar"],["GoGoc","GoGoc"],["Toki Voice","Toki Voice"],["Helli","Helli"],["Ruffa","Ruffa"],["Ahlan","Ahlan"],["Soul Chill","Soul Chill"],["Taka Chat","Taka Chat"],["Oloo","Oloo"],["7Star","7Star"],["Likee","Likee"],["Xena Live","Xena Live"],["Party Star","Party Star"],["Honey Jar","Honey Jar"],["Soul Star","Soul Star"],["Pota Live","Pota Live"],["Cocco","Cocco"],["Amar Chat","Amar Chat"],["Yoho","Yoho"],["Ya","Ya"],["Lit Chat","Lit Chat"],["Tada Chat","Tada Chat"],["4Fun","4Fun"],["Saya","Saya"],["Poppo","Poppo"],["Nivi","Nivi"],["Migo Live","Migo Live"],["So Match","So Match"],["Lama Chat","Lama Chat"],["Soyo","Soyo"],["Roka Live","Roka Live"],["Tango","Tango"],["4Party","4Party"],["Mico Chat","Mico Chat"],["Hiya Chat","Hiya Chat"],["Talk Talk","Talk Talk"],["Fancy Live","Fancy Live"],["Kwai Live","Kwai Live"],["Binmo Chat","Binmo Chat"],["Salam Chat","Salam Chat"],["Zaffa Live","Zaffa Live"],["Hawa Chat","Hawa Chat"],["Habby Chat","Habby Chat"],["Super Live","Super Live"],["Wego","Wego"],["Olamet","Olamet"],["WYAK Chat","WYAK Chat"],["MR7BA Chat","MR7BA Chat"],["Lami Chat","Lami Chat"],["UP Live","UP Live"],["Hoby Chat","Hoby Chat"],["Hami Party","Hami Party"],["Layla Chat","Layla Chat"],["Tami Chat","Tami Chat"],["Soul Chat","Soul Chat"],["Hi Play Chat","Hi Play Chat"],["Lions Chat","Lions Chat"],["Pep Live","Pep Live"],["Hi Party","Hi Party"],["Allo Chat","Allo Chat"],["Yami Star","Yami Star"],["Junko Chat","Junko Chat"],["Party Hero","Party Hero"],["Layam","Layam"],["Amo","Amo"],["Saada Chat","Saada Chat"],["Dana Chat","Dana Chat"],["Nawa Live","Nawa Live"],["Sodfa Chat","Sodfa Chat"],["Jaco","Jaco"],["Up Fun","Up Fun"],["Yudo Chat","Yudo Chat"],["Fofo Chat","Fofo Chat"],["Pocket Chat","Pocket Chat"],["Mango Live","Mango Live"],["Maan Chat","Maan Chat"],["Pawa Live","Pawa Live"],["Mazyoun","Mazyoun"],["Sky Chat","Sky Chat"],["Chat Chill","Chat Chill"],["Lot Fun","Lot Fun"],["Leesky","Leesky"],["Laki Chat","Laki Chat"],["Sahra Chat","Sahra Chat"],["Gold Chat","Gold Chat"],["Halo Star","Halo Star"],["Hati","Hati"],["1Star Chat","1Star Chat"],["Hayi","Hayi"],["Rooka","Rooka"],["Nahki Chat","Nahki Chat"],["Yoparti","Yoparti"],["Boli Chat","Boli Chat"],["Lessmet Chat","Lessmet Chat"],["Waaw Chat","Waaw Chat"],["Baat","Baat"],["InFun","InFun"],["Mango Star","Mango Star"],["Hago","Hago"],["Yoso Farm","Yoso Farm"],["Masti Chat","Masti Chat"],["Waki Star","Waki Star"],["Vilaa Chat","Vilaa Chat"],["Maza","Maza"],["Hoob","Hoob"],["Will Chill","Will Chill"],["Doli Live","Doli Live"],["Hart Live","Hart Live"],["Rooh Chat","Rooh Chat"],["Dawa Chat","Dawa Chat"],["Yo2 App","Yo2 App"],["Our Talk","Our Talk"],["Hala Chat","Hala Chat"],["E-Party","E-Party"],["Zaar Chat","Zaar Chat"],["Tayyb Chat","Tayyb Chat"],["Hapi","Hapi"],["Mate Met","Mate Met"],["Chill Chat","Chill Chat"],["Yoki Chat","Yoki Chat"],["Yayya Chat","Yayya Chat"],["Hopi Star","Hopi Star"],["Yudo","Yudo"],["Super Meet","Super Meet"],["Ume","Ume"],["Shabab Chat","Shabab Chat"],["Vone","Vone"],["Ohla","Ohla"],["Karak Chat","Karak Chat"],["Dika Live","Dika Live"],["Arab Star","Arab Star"],["4Chat","4Chat"],["Sahi","Sahi"],["Woho Chat","Woho Chat"],["Best Live","Best Live"],["Taya Chat","Taya Chat"],["Bulala","Bulala"],["Niu Chat","Niu Chat"],["Mikoo","Mikoo"],["Crush","Crush"],["Hayuki","Hayuki"],["Fun Star","Fun Star"],["Yena","Yena"],["Nafass","Nafass"],["Ti Live","Ti Live"],["Litme","Litme"],["Fomi","Fomi"],["Wahda","Wahda"],["Amisu","Amisu"],["Rixo","Rixo"],["Yobi","Yobi"],["Shila","Shila"],["Hoki","Hoki"],["Kafu","Kafu"],["Winko","Winko"],["Laka","Laka"],["Fomi Party","Fomi Party"],["Wadi","Wadi"],["Yaza Chat","Yaza Chat"],["Vostar","Vostar"],["Carni Live","Carni Live"],["Yula","Yula"],["SillaGCC","SillaGCC"],["Sophia","Sophia"],["Wechill","Wechill"],["Hi Chat","Hi Chat"],["Chati","Chati"],["ChatA","ChatA"],["Sohha","Sohha"],["Moma","Moma"],["Chamoji","Chamoji"],["Lemi Live","Lemi Live"],["Toki","Toki"],["Nita","Nita"],["Shaghaf Chat","Shaghaf Chat"],["Faby Star","Faby Star"],["Yomee","Yomee"],["Nady Star","Nady Star"],["We Party","We Party"],["Sami","Sami"],["Chamet","Chamet"],["Dream Chat","Dream Chat"],["Sama Chat","Sama Chat"],["Bota Chat","Bota Chat"],["Funni","Funni"],["Nimo TV","Nimo TV"],["Falla","Falla"]];
    const products = Array.isArray(state.products) ? state.products : [];
    const normalize = function(value) {
        return normalizeGameText(String(value || ""));
    };
    return catalog.map(function(item) {
        const title = item[0];
        const aliases = [item[0], item[1]].map(normalize).filter(Boolean);
        const matches = products.filter(function(product) {
            const category = normalize(product.category_name || "");
            const name = normalize(product.name || "");
            return aliases.some(function(alias) {
                return category === alias ||
                    category.includes(alias) ||
                    alias.includes(category) ||
                    name === alias ||
                    name.includes(alias);
            });
        });
        return {
            title: title,
            search: item[1],
            image: "",
            product: matches[0] || null,
            products: matches
        };
    });
}

function renderAppImage(appItem) {
    if (appItem.image) {
        const src = String(appItem.image).startsWith("http") ? appItem.image : BACKEND_URL + appItem.image;
        return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(appItem.title) + '" loading="lazy">';
    }
    return '<span class="game-placeholder">📱</span>';
}


function openAppServerPlaceholder(titleText, serverKey, fromHistory) {
    if (!fromHistory) pushInternalHistory("app-server", {appServerTitle:titleText, appServerKey:serverKey});
    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content) return;
    if (title) title.textContent = titleText;
    if (icon) icon.textContent = "📱";

    if (!state.productsLoaded && !state.productsLoadingPromise) {
        loadProducts({force:true}).then(function(){ openAppServerPlaceholder(titleText, serverKey, true); }).catch(function(){
            content.innerHTML = '<div class="game-products-placeholder app-level-placeholder"><div class="game-products-placeholder-icon">📱</div><h3>' + escapeHtml(titleText) + '</h3><p>تعذر تحميل المنتجات حاليًا.</p></div>';
        });
        content.innerHTML = '<div class="products-loading"><div class="loading-spinner"></div><p>جاري تحميل تطبيقات السيرفر...</p></div>';
        return;
    }

    if (!state.productsLoaded && state.productsLoadingPromise) {
        content.innerHTML = '<div class="products-loading"><div class="loading-spinner"></div><p>جاري تحميل تطبيقات السيرفر...</p></div>';
        state.productsLoadingPromise.then(function(){ openAppServerPlaceholder(titleText, serverKey, true); });
        return;
    }

    if (serverKey !== "server-2" && serverKey !== "server-1") {
        content.innerHTML =
            '<div class="game-products-placeholder app-level-placeholder">' +
                '<div class="game-products-placeholder-icon">📱</div>' +
                '<h3>' + escapeHtml(titleText) + '</h3>' +
                '<p>سيتم إضافة تطبيقات هذا السيرفر وفقًا للصور المرجعية القادمة.</p>' +
            '</div>';
        window.scrollTo({top:0, behavior:"smooth"});
        return;
    }

    const apps = serverKey === "server-2" ? getServerTwoApps() : getServerOneApps();
    const serverLabel = serverKey === "server-2" ? "تطبيقات سيرفر 2" : "تطبيقات سيرفر 1";
    const hideImages = serverKey === "server-2";

    content.innerHTML =
        '<div class="app-level-toolbar"><button class="pubg-back" type="button" id="appServerBack">← العودة إلى سيرفرات التطبيقات</button>' +
        '<div class="game-products-heading"><strong>' + apps.length + ' تطبيق</strong><span>' + serverLabel + '</span></div></div>' +
        '<div class="app-server-one-grid">' +
        apps.map(function(appItem, index) {
            const imagePart = hideImages
                ? ''
                : '<span class="app-product-image">' + renderAppImage(appItem) + '</span>';
            const count = Array.isArray(appItem.products) ? appItem.products.length : (appItem.product ? 1 : 0);
            return '<button class="app-product-tile' + (hideImages ? ' app-no-image-tile' : '') + '" type="button" data-app-index="' + index + '">' +
                imagePart +
                '<span class="app-product-title">' + escapeHtml(appItem.title) + '</span>' +
                '<span class="app-product-count">' + count + ' منتج</span>' +
            '</button>';
        }).join("") +
        '</div>';

    const back = document.getElementById("appServerBack");
    if (back) back.addEventListener("click", function(){ openAppsPage(true); });

    content.querySelectorAll(".app-product-tile").forEach(function(tile) {
        tile.addEventListener("click", function() {
            const index = Number(tile.getAttribute("data-app-index"));
            const selected = apps[index];
            if (!selected) return;
            if (serverKey === "server-2") {
                openAppProducts(selected, "server-2");
            } else {
                if (selected.product) {
                    openAppProducts(selected, "server-1");
                } else {
                    showToast("لا توجد منتجات مرتبطة بهذا التطبيق حاليًا.");
                }
            }
        });
    });

    window.scrollTo({top:0, behavior:"smooth"});
}

function openAppProducts(appItem, serverKey, fromHistory) {
    if (!appItem) return;
    if (!fromHistory) {
        pushInternalHistory("app-products", {
            appServerKey: serverKey,
            appTitle: appItem.title
        });
    }

    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content) return;

    const products = Array.isArray(appItem.products) ? appItem.products : [];
    if (title) title.textContent = appItem.title;
    if (icon) icon.textContent = "📱";

    if (!products.length) {
        content.innerHTML =
            '<div class="game-products-placeholder app-level-placeholder">' +
                '<div class="game-products-placeholder-icon">📱</div>' +
                '<h3>' + escapeHtml(appItem.title) + '</h3>' +
                '<p>لا توجد منتجات مرتبطة بهذا التطبيق حاليًا.</p>' +
                '<button class="pubg-back" type="button" id="appProductsBack">← العودة إلى التطبيقات</button>' +
            '</div>';
        const emptyBack = document.getElementById("appProductsBack");
        if (emptyBack) emptyBack.addEventListener("click", function(){ openAppServerPlaceholder(serverKey === "server-2" ? "تطبيقات سيرفر 2" : "تطبيقات سيرفر 1", serverKey, true); });
        return;
    }

    const group = {
        key: "app|" + serverKey + "|" + normalizeGameText(appItem.title),
        title: appItem.title,
        image: "",
        products: products,
        appServerKey: serverKey,
        appTitle: appItem.title,
        noImage: true
    };

    renderAppProductPicker(group);
}

function renderAppProductPicker(group) {
    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content || !group) return;

    if (title) title.textContent = group.title;
    if (icon) icon.textContent = "📱";

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
        const hasQuantity = Number.isFinite(minRaw) || Number.isFinite(maxRaw) || Number.isFinite(stepRaw) || !!(product && (product.qty || product.quantity));
        return {
            enabled: hasQuantity,
            min: Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 1,
            max: Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 999999999,
            step: Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : 1
        };
    }

    const listHtml = products.map(function(product, index) {
        const available = product.available !== false && product.available !== 0;
        const price = getGameProductPrice(product);
        return '<button class="pubg-option' + (available ? '' : ' is-disabled') + '" type="button" data-app-product-index="' + index + '"' + (available ? '' : ' disabled') + '>' +
            '<span class="pubg-option-name">' + escapeHtml(product.name || "منتج") + '</span>' +
            '<span class="pubg-option-price">' + (price === null ? 'السعر غير متاح' : formatProductMoney(product, price)) + '</span>' +
            (available ? '' : '<span class="pubg-option-status">غير متوفر</span>') +
        '</button>';
    }).join("");

    content.innerHTML =
        '<div class="pubg-picker universal-game-picker app-product-picker-no-image">' +
            '<button class="pubg-back" type="button" id="appProductBack">← العودة إلى التطبيقات</button>' +
            '<div class="pubg-picker-head app-product-picker-head">' +
                '<h2>' + escapeHtml(group.title) + '</h2>' +
                '<span>' + products.length + ' منتج</span>' +
            '</div>' +
            '<div class="game-required-fields-title">المعلومات المطلوبة</div>' +
            '<div id="appParamFields">' + (firstProduct ? renderGameParamFields(firstProduct, group.title) : '') + '</div>' +
            '<div class="pubg-field-label">اختر المنتج</div>' +
            '<div class="pubg-select" id="appProductSelect">' +
                '<button class="pubg-select-trigger" type="button" aria-expanded="false"><span id="appSelectedName">' + escapeHtml(firstProduct ? (firstProduct.name || "اختر المنتج") : "اختر المنتج") + '</span><span class="pubg-select-arrow">▼</span></button>' +
                '<div class="pubg-options" id="appProductOptions" hidden>' + listHtml + '</div>' +
            '</div>' +
            '<div id="appQuantityField"></div>' +
            '<div class="pubg-selected-summary"><span>السعر</span><strong id="appSelectedPrice">' + (firstProduct ? formatProductPrice(firstProduct) : 'السعر غير متاح') + '</strong></div>' +
            '<button class="buy-btn pubg-submit" id="appSubmitOrder" type="button"' +
                (!firstProduct || firstProduct.available === false || firstProduct.available === 0 || getGameProductPrice(firstProduct) === null ? ' disabled' : '') +
                '>إرسال الطلب <span>→</span></button>' +
        '</div>';

    let selectedIndex = firstProduct ? products.indexOf(firstProduct) : -1;

    function renderQuantity(product) {
        const holder = document.getElementById("appQuantityField");
        if (!holder) return;
        const config = getProductQuantityConfig(product);
        if (!config.enabled) {
            holder.innerHTML = "";
            return;
        }
        holder.innerHTML =
            '<div class="pubg-field game-quantity-field"><label for="appOrderQty">الكمية</label>' +
            '<input id="appOrderQty" type="number" min="' + config.min + '" max="' + config.max + '" step="' + config.step + '" value="" placeholder="' + quantityRangePlaceholder(config.min,config.max) + '" inputmode="numeric" required></div>';
    }

    function updateTotal() {
        const product = products[selectedIndex];
        const priceEl = document.getElementById("appSelectedPrice");
        const qtyInput = document.getElementById("appOrderQty");
        if (!product || !priceEl) return;
        const qty = qtyInput ? Number(qtyInput.value) : 1;
        const unit = getGameProductPrice(product);
        if (!Number.isFinite(qty) || qty < 1 || unit === null) {
            priceEl.textContent = "السعر غير متاح";
            return;
        }
        priceEl.textContent = formatMoney(ceilPrice(unit * qty, getPriceDecimalPlaces(product.price)), getPriceDecimalPlaces(product.price));
    }

    function updateProduct(index) {
        const product = products[index];
        if (!product) return;
        selectedIndex = index;
        const nameEl = document.getElementById("appSelectedName");
        const priceEl = document.getElementById("appSelectedPrice");
        const fields = document.getElementById("appParamFields");
        const submit = document.getElementById("appSubmitOrder");
        if (nameEl) nameEl.textContent = product.name || "اختر المنتج";
        if (priceEl) priceEl.textContent = formatProductPrice(product);
        if (fields) fields.innerHTML = renderGameParamFields(product, group.title);
        renderQuantity(product);
        updateTotal();
        if (submit) submit.disabled = product.available === false || product.available === 0 || getGameProductPrice(product) === null;
    }

    renderQuantity(firstProduct);
    updateTotal();

    const q = document.getElementById("appQuantityField");
    if (q) q.addEventListener("input", updateTotal);

    const back = document.getElementById("appProductBack");
    if (back) back.addEventListener("click", function() {
        openAppServerPlaceholder(group.appServerKey === "server-2" ? "تطبيقات سيرفر 2" : "تطبيقات سيرفر 1", group.appServerKey, true);
    });

    const select = document.getElementById("appProductSelect");
    const trigger = select ? select.querySelector(".pubg-select-trigger") : null;
    const options = document.getElementById("appProductOptions");
    if (trigger && options) {
        trigger.addEventListener("click", function() {
            const open = !options.hidden;
            options.hidden = open;
            trigger.setAttribute("aria-expanded", String(!open));
            trigger.classList.toggle("is-open", !open);
        });
        options.querySelectorAll("[data-app-product-index]").forEach(function(option) {
            option.addEventListener("click", function() {
                updateProduct(Number(option.getAttribute("data-app-product-index")));
                options.hidden = true;
                trigger.setAttribute("aria-expanded", "false");
                trigger.classList.remove("is-open");
            });
        });
    }

    const submit = document.getElementById("appSubmitOrder");
    if (submit) submit.addEventListener("click", function() {
        const product = products[selectedIndex];
        if (!product) return;
        submitGamePickerOrder(product, document.querySelector(".app-product-picker-no-image"));
    });

    window.scrollTo({top:0, behavior:"smooth"});
}


function openGamesPage(fromHistory) {
    if (!fromHistory) pushInternalHistory("games");
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

    // المستوى الثاني لا يجلب المنتجات. جلب منتجات اللعبة يبدأ بعد ضغط العميل على اللعبة.
    const tiles = getGameTiles();

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
            if (!state.productsLive) {
                try {
                    await loadProducts({force:true});
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

function openGamePlaceholder(gameTitle, fromHistory) {
    if (!fromHistory) pushInternalHistory("game", {gameTitle: gameTitle});
    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content) return;

    if (title) title.textContent = gameTitle;
    if (icon) icon.textContent = "🎮";

    // المستوى الثالث هو نقطة جلب منتجات اللعبة حسب القاعدة العامة للمشروع.
    if (!state.productsLive) {
        content.innerHTML = '<div class="products-loading"><div class="loading-spinner"></div><p>جاري تحميل منتجات هذه اللعبة...</p></div>';
        loadProducts({force:true}).then(function(){ openGamePlaceholder(gameTitle, true); }).catch(function(){
            content.innerHTML = '<div class="game-products-placeholder"><div class="game-products-placeholder-icon">⚠️</div><h3>' + escapeHtml(gameTitle) + '</h3><p>تعذر تحميل المنتجات حاليًا.</p><button class="buy-btn" type="button" id="retryGameProducts">↻ إعادة المحاولة</button></div>';
            const retry=document.getElementById("retryGameProducts");
            if(retry) retry.addEventListener("click",function(){openGamePlaceholder(gameTitle);});
        });
        return;
    }

    const groups = getGameGroups(gameTitle);
    const isRoblox = normalizeGameText(gameTitle).includes("roblox");
    const robloxNotice = isRoblox
        ? '<div class="game-page-note roblox-delivery-note"><strong>تنبيه لروبلوكس:</strong> عند الشراء سيصل الكود تلقائيًا، ويتضمن البطاقة الجديدة.</div>'
        : '';

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
        robloxNotice +
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
        return "ID اللاعب";
    }
    return String(label || "").trim();
}

function renderPubgParamFields(product) {
    // في PUBG نستخدم أسماء params القادمة من الكتالوج/API حرفيًا.
    // لا ننشئ playerId ولا نعيد تسمية أي parameter.
    const params = Array.isArray(product && product.params)
        ? product.params.map(function(label) { return String(label ?? "").trim(); })
            .filter(function(label) { return label.length > 0; })
        : [];

    if (!params.length) {
        return '<div class="game-no-required-fields">لا توجد معلومات إضافية مطلوبة لهذا المنتج.</div>';
    }

    return params.map(function(label, index) {
        const safeLabel = escapeHtml(label);
        const inputId = "pubgParam_" + index;
        return '<div class="pubg-field game-required-field">' +
            '<label for="' + inputId + '">' + safeLabel + '</label>' +
            '<input id="' + inputId + '" type="text" data-pubg-param="' + safeLabel + '" placeholder="' + safeLabel + '" autocomplete="off" required aria-required="true">' +
            '</div>';
    }).join("");
}

function renderGameParamFields(product, gameTitle) {
    // كل الألعاب: نستخدم params القادمة من API/الكتالوج حرفيًا.
    // الاسم نفسه هو عنوان الحقل والـplaceholder، دون أي إعادة تسمية أو إضافة.
    const params = Array.isArray(product && product.params)
        ? product.params.map(function(label) { return String(label ?? "").trim(); })
            .filter(function(label) { return label.length > 0; })
        : [];

    if (!params.length) {
        return '<div class="game-no-required-fields">لا توجد معلومات إضافية مطلوبة لهذا المنتج.</div>';
    }

    return params.map(function(label, index) {
        const safeLabel = escapeHtml(label);
        const inputId = "gameParam_" + index;
        return '<div class="pubg-field game-required-field">' +
            '<label for="' + inputId + '">' + safeLabel + '</label>' +
            '<input id="' + inputId + '" type="text" data-game-param="' + safeLabel + '" placeholder="' + safeLabel + '" autocomplete="off" required aria-required="true">' +
            '</div>';
    }).join("");
}
function getTurkcellParamConfig(product) {
    const params = Array.isArray(product && product.params)
        ? product.params.map(function(label) { return String(label ?? "").trim(); }).filter(Boolean)
        : [];
    const normalized = params.map(function(label) {
        return normalizeBalanceText(label).toLowerCase();
    });
    const phoneIndex = normalized.findIndex(function(label) {
        return /رابط|link|url|phone|mobile|number|رقم|هاتف|موبايل/.test(label);
    });
    const phoneParamIndex = phoneIndex >= 0 ? phoneIndex : 0;
    let serviceParamIndex = -1;
    for (let index = 0; index < params.length; index++) {
        if (index === phoneParamIndex) continue;
        if (/خدمة|service|package|باقة|اشتراك|subscriber|plan/.test(normalized[index])) {
            serviceParamIndex = index;
            break;
        }
    }
    if (serviceParamIndex < 0 && params.length > 1) {
        serviceParamIndex = params.findIndex(function(_, index) { return index !== phoneParamIndex; });
    }
    return {
        params: params,
        phoneKey: params[phoneParamIndex] || "",
        serviceKey: serviceParamIndex >= 0 ? params[serviceParamIndex] : ""
    };
}

function renderBalanceRequiredFields(product, groupTitle, serviceProducts, selectedServiceIndex) {
    const isTurkey = /ترك|تروكسل|turkcell|turkey/.test(normalizeBalanceText(groupTitle || "")) ||
        normalizeBalanceText(product && product.category_name || "").includes("تركي") ||
        /ترك|تروكسل|turkcell|turkey/.test(normalizeBalanceText(product && product.name || ""));
    if (!isTurkey) return renderGameParamFields(product, groupTitle);

    const config = getTurkcellParamConfig(product);
    if (!config.phoneKey) {
        return '<div class="game-no-required-fields">لا توجد معلومات إضافية مطلوبة لهذا المنتج.</div>';
    }

    let html = '<div class="pubg-field game-required-field">' +
        '<label for="gameParam_0">أدخل الرقم</label>' +
        '<input id="gameParam_0" type="tel" data-game-param="' + escapeHtml(config.phoneKey) + '" placeholder="أدخل الرقم" inputmode="tel" autocomplete="tel" required aria-required="true">' +
        '</div>';

    if (config.serviceKey && Array.isArray(serviceProducts) && serviceProducts.length) {
        const selected = Math.max(0, Math.min(serviceProducts.length - 1, Number(selectedServiceIndex || 0)));
        html += '<div class="pubg-field game-required-field">' +
            '<label for="turkcellServiceSelect">اختر الخدمة</label>' +
            '<select id="turkcellServiceSelect" data-game-param="' + escapeHtml(config.serviceKey) + '" required aria-required="true">' +
            serviceProducts.map(function(service, index) {
                return '<option value="' + escapeHtml(service.name || "") + '" data-service-index="' + index + '"' + (index === selected ? ' selected' : '') + '>' +
                    escapeHtml(service.name || "خدمة") + '</option>';
            }).join("") +
            '</select>' +
            '</div>';
    }

    return html;
}

function getRawProductPrice(product) {
    const value = product && product.original_price;
    if (value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) {
        return Number(value);
    }
    return null;
}
function getProductProfitRateForClient(product) {
    const text = String(product && product.category_name || "") + " " + String(product && product.name || "");
    const isNumber = /\b(numbers?|number|whatsapp|facebook|gmail|icloud|instagram|imo)\b|أرقام|رقم|واتساب|فيسبوك|جيميل|ايكلاود|آي كلاود|انستغرام|إنستغرام|ايمو/i.test(text);
    return isNumber ? Number(state.numberProfitRate || 0) : Number(state.profitRate || 0);
}
function getGameProductPrice(product) {
    const value = product && product.price;
    if (value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) {
        return Number(value);
    }
    return null;
}
function formatProductPrice(product) {
    const value = getGameProductPrice(product);
    return value === null ? "السعر غير متاح" : formatMoney(value);
}

function renderGameProductPicker(gameTitle, group, pickerOptions) {
    pickerOptions = pickerOptions || {};
    const isNumberPicker = pickerOptions.type === "numbers";
    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content || !group) return;

    if (title) title.textContent = group.title;
    if (icon) icon.textContent = isNumberPicker ? "📲" : "🎮";

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
        const price = getGameProductPrice(product);
        const optionImage = getProductImage(product);
        const optionImageHtml = optionImage
            ? '<span class="pubg-option-image"><img src="' + escapeHtml(optionImage) + '" alt="" loading="lazy"></span>'
            : '<span class="pubg-option-image pubg-option-image-placeholder">📲</span>';
        return '<button class="pubg-option' + (available ? '' : ' is-disabled') + '" type="button" data-pubg-index="' + index + '"' +
            (available ? '' : ' disabled') + '>' +
            optionImageHtml +
            '<span class="pubg-option-name">' + escapeHtml(product.name || "منتج") + '</span>' +
            '<span class="pubg-option-price">' + (price === null ? 'السعر غير متاح' : formatProductMoney(product, price)) + '</span>' +
            (available ? '' : '<span class="pubg-option-status">غير متوفر</span>') +
        '</button>';
    }).join("");

    const gameImage = isNumberPicker ? null : getGameTiles().find(function(tile) {
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

    const robloxProductNotice = normalizeGameText(gameTitle).includes("roblox")
        ? '<div class="game-page-note roblox-delivery-note"><strong>تنبيه لروبلوكس:</strong> عند الشراء سيصل الكود تلقائيًا، ويتضمن البطاقة الجديدة.</div>'
        : '';

    content.innerHTML =
        '<div class="pubg-picker universal-game-picker">' +
            robloxProductNotice +
            '<button class="pubg-back" type="button" id="pubgBackToGroups">← العودة إلى التصنيفات</button>' +
            '<div class="pubg-picker-head">' +
                '<div class="pubg-picker-image">' + imageHtml + '</div>' +
                '<h2>' + escapeHtml(group.title) + '</h2>' +
                '<span>' + products.length + ' منتج</span>' +
            '</div>' +
            '<div class="game-required-fields-title">المعلومات المطلوبة</div>' +
            '<div id="pubgParamFields">' +
                (firstProduct ? (isPubgGame(gameTitle)
                    ? renderPubgParamFields(firstProduct)
                    : renderGameParamFields(firstProduct, gameTitle)) : '') +
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

    function isJawakerServerQuantityProduct(product) {
        const text = normalizeGameText(
            String(product && product.category_name || "") + " " +
            String(product && product.name || "")
        );
        if (!text.includes("jawaker") && !text.includes("جواكر")) return false;
        const isS2 = text.includes("s2") || text.includes("s 2");
        const isS1 = text.includes("s1") || text.includes("s 1") ||
            text.includes("server") || text.includes("سيرفر") || text.includes("سرفر") ||
            text.includes("cum");
        return isS1 || isS2;
    }

    function getGameQuantityConfig(product) {
        if (isJawakerServerQuantityProduct(product)) {
            return {enabled:true, min:10000, max:1000000, step:1};
        }
        return getProductQuantityConfig(product);
    }

    function renderQuantity(product) {
        const holder = document.getElementById("gameQuantityField");
        if (!holder) return;

        // ببجي طلبها لمنتج واحد ولا نعرض حقل كمية حتى لو أعاده الكتالوج.
        if (isPubgGame(gameTitle)) {
            holder.innerHTML = "";
            return;
        }

        const config = getGameQuantityConfig(product);

        if (!config.enabled) {
            holder.innerHTML = "";
            return;
        }

        holder.innerHTML =
            '<div class="pubg-field game-quantity-field">' +
                '<label for="gameOrderQty">الكمية</label>' +
                '<input id="gameOrderQty" type="number" min="' + config.min + '" max="' + config.max + '" step="' + config.step + '" value="" placeholder="' + quantityRangePlaceholder(config.min,config.max) + '" inputmode="numeric" required aria-required="true">' +
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
        if (fields) fields.innerHTML = (isPubgGame(gameTitle)
            ? renderPubgParamFields(product)
            : renderGameParamFields(product, gameTitle));
        renderQuantity(product);
        updateQuantityTotalPrice();

        if (submit) {
            submit.disabled = product.available === false || product.available === 0 || getGameProductPrice(product) === null;
        }
    }

    renderQuantity(firstProduct);

    function updateQuantityTotalPrice() {
        const qtyInput = document.getElementById("gameOrderQty");
        const selectedPrice = document.getElementById("pubgSelectedPrice");
        const product = products[selectedIndex];
        if (!selectedPrice || !product) return;

        const qty = qtyInput ? Number(qtyInput.value) : 1;
        const unitPrice = getGameProductPrice(product);
        const decimals = getPriceDecimalPlaces(product.price);

        if (!Number.isFinite(qty) || qty < 1 || unitPrice === null) {
            selectedPrice.textContent = "السعر غير متاح";
            return;
        }

        // القاعدة الموحدة: نحسب السعر النهائي للوحدة × الكمية أولًا،
        // ثم نقرّبه إلى الأعلى حسب دقة المنتج. هذه هي القيمة المعروضة.
        const finalTotal = ceilPrice(unitPrice * qty, decimals);
        selectedPrice.textContent = finalTotal === null
            ? "السعر غير متاح"
            : formatMoney(finalTotal, decimals);
    }

    const quantityField = document.getElementById("gameQuantityField");
    if (quantityField) {
        quantityField.addEventListener("input", updateQuantityTotalPrice);
    }
    updateQuantityTotalPrice();

    const back = document.getElementById("pubgBackToGroups");
    if (back) back.addEventListener("click", function() {
        if (typeof pickerOptions.onBack === "function") {
            pickerOptions.onBack();
        } else {
            openGamePlaceholder(gameTitle);
        }
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

async function submitGamePickerOrder(product, root) {
    if (!(await requireCustomerLoginForPurchase())) return;
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
        } else {            input.classList.remove("is-invalid");
            params[label] = value;
        }
    });

    const qtyInput = root ? root.querySelector("#gameOrderQty") : null;
    let qty = 1;
    if (qtyInput) {
        qty = Number(qtyInput.value);
        const min = Number(qtyInput.min || 1);
        const max = Number(qtyInput.max || 999999999);
        if (!Number.isInteger(qty) || qty < min || qty > max) {
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

function openGameProductGroup(gameTitle, groupKey, fromHistory) {
    if (!fromHistory) pushInternalHistory("products", {gameTitle: gameTitle, groupKey: groupKey});
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
        async function () {

            state.searchQuery =
                searchInput.value
                    .trim()
                    .toLowerCase();

            // لا توجد قائمة منتجات عامة في الواجهة؛ تظهر النتائج فقط عند البحث.
            if (!state.searchQuery) {
                if (elements.products) {
                    elements.products.innerHTML = "";
                    elements.products.hidden = true;
                }
                return;
            }

            // البحث مستقل عن القسم الذي كان مفتوحًا سابقًا، ويبحث في جميع المنتجات.
            state.selectedCategory = "all";

            if (elements.products) {
                elements.products.hidden = false;
                elements.products.innerHTML =
                    '<div class="products-loading"><div class="loading-spinner"></div><p>جاري البحث عن المنتجات...</p></div>';
            }

            try {
                await loadProducts();
                renderProducts();
                if (elements.products) {
                    elements.products.scrollIntoView({behavior:"smooth", block:"start"});
                }
            } catch (error) {
                if (elements.products) {
                    elements.products.innerHTML =
                        '<div class="products-loading"><p>تعذر البحث عن المنتجات حاليًا.</p></div>';
                }
            }
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


async function showCustomerOrdersModal() {
    showModal(
        "طلباتي",
        `
        <div class="customer-orders-view" id="customerOrdersView">
            <div class="customer-orders-loading">جاري تحميل طلباتك...</div>
        </div>
        `
    );

    const container = document.getElementById("customerOrdersView");
    if (!container) return;

    try {
        const response = await fetch(BACKEND_URL + "/api/customer/orders", {
            headers: {Accept: "application/json"},
            credentials: "include",
            cache: "no-store"
        });

        let data = {};
        try { data = await response.json(); } catch (_) {}

        if (response.status === 401) {
            container.innerHTML = `
                <div class="customer-orders-empty">
                    <div class="customer-orders-empty-icon">🔐</div>
                    <h3>سجّل الدخول أولًا</h3>
                    <p>يمكنك رؤية طلباتك بعد تسجيل الدخول إلى حسابك.</p>
                    <button type="button" class="buy-btn customer-orders-login" onclick="window.location.href='/customer-login.html'">تسجيل الدخول</button>
                </div>
            `;
            return;
        }

        if (!response.ok || data.status === "ERROR") {
            throw new Error(data.message || "تعذر تحميل الطلبات.");
        }

        renderCustomerOrders(container, Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
        console.error("Customer orders load failed:", error);
        container.innerHTML = `
            <div class="customer-orders-empty">
                <div class="customer-orders-empty-icon">⚠️</div>
                <h3>تعذر تحميل الطلبات</h3>
                <p>${escapeHtml(error?.message || "حدث خطأ أثناء تحميل الطلبات.")}</p>
                <button type="button" class="buy-btn customer-orders-retry" id="customerOrdersRetry">إعادة المحاولة</button>
            </div>
        `;
        const retry = document.getElementById("customerOrdersRetry");
        if (retry) retry.addEventListener("click", showCustomerOrdersModal);
    }
}

function parseCustomerOrderObject(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
        return {};
    }
}

function customerOrderStatusInfo(order) {
    const raw = String(order?.status || order?.nemer_response?.status || "").toLowerCase();
    const failed = ["failed","rejected","cancelled","canceled","error"].includes(raw);
    const success = ["success","successful","completed","complete","done","delivered","ok"].includes(raw);
    if (failed) return {label:"فشل الطلب", className:"customer-order-status-failed"};
    if (success) return {label:"تم الطلب بنجاح", className:"customer-order-status-success"};
    if (raw === "processing" || raw === "pending") return {label:"قيد المعالجة", className:"customer-order-status-processing"};
    return {label: String(order?.status || "غير محدد"), className:"customer-order-status-processing"};
}

function formatCustomerOrderDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("ar", {
        year:"numeric", month:"2-digit", day:"2-digit",
        hour:"2-digit", minute:"2-digit"
    });
}

function renderCustomerOrderParams(params) {
    const object = parseCustomerOrderObject(params);
    const entries = Object.entries(object).filter(function(entry) {
        return String(entry[0] || "").trim() && String(entry[1] ?? "").trim();
    });
    if (!entries.length) return '<span class="customer-order-muted">لا توجد معلومات إضافية</span>';
    return entries.map(function(entry) {
        return '<div class="customer-order-param"><strong>' +
            escapeHtml(String(entry[0])) + ':</strong> <span>' +
            escapeHtml(String(entry[1])) + '</span></div>';
    }).join("");
}

function renderCustomerOrderResponse(response) {
    const object = parseCustomerOrderObject(response);
    if (!Object.keys(object).length) {
        return '<div class="customer-order-system-response customer-order-muted">لا يوجد رد نظام</div>';
    }
    const downloadUrl =
        object.download_url || object.downloadUrl || object.url || object.file_url || object.fileUrl ||
        object.data?.download_url || object.data?.downloadUrl || object.data?.url ||
        object.data?.file_url || object.data?.fileUrl;
    if (downloadUrl && /^https?:\/\//i.test(String(downloadUrl))) {
        return '<div class="customer-order-system-response">' +
            '<a class="customer-order-download" href="' + escapeHtml(String(downloadUrl)) +
            '" target="_blank" rel="noopener noreferrer" download>تحميل رد النظام</a></div>';
    }
    const message = object.message || object.msg || object.response || object.data?.message;
    if (message && typeof message !== "object") {
        return '<div class="customer-order-system-response customer-order-response-text">' +
            escapeHtml(String(message)) + '</div>';
    }
    return '<div class="customer-order-system-response customer-order-muted">وصل رد من النظام، لكن لا يوجد ملف تحميل في الاستجابة.</div>';
}

function renderCustomerOrders(container, orders) {
    if (!orders.length) {
        container.innerHTML = `
            <div class="customer-orders-empty">
                <div class="customer-orders-empty-icon">📦</div>
                <h3>لا توجد طلبات حتى الآن</h3>
                <p>ستظهر طلباتك هنا بعد إتمام أول عملية شراء.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(function(order, index) {
        const status = customerOrderStatusInfo(order);
        const orderNumber = order.order_id || order.id || "-";
        const price = Number(order.price);
        const displayPrice = Number.isFinite(price) ? price.toFixed(3) : "-";
        const response = parseCustomerOrderObject(order.nemer_response);
        const responseId = response.id ?? response.order_id ?? response.data?.id ?? response.data?.order_id;
        const shownOrderNumber = responseId || orderNumber;
        return `
            <article class="customer-order-card">
                <div class="customer-order-head">
                    <div>
                        <span class="customer-order-index">طلب #${orders.length - index}</span>
                        <h3>${escapeHtml(String(order.product_name || "طلب"))}</h3>
                    </div>
                    <span class="customer-order-status ${status.className}">${escapeHtml(status.label)}</span>
                </div>
                <div class="customer-order-grid">
                    <div class="customer-order-detail">
                        <span>رقم الطلب</span>
                        <strong dir="ltr">${escapeHtml(String(shownOrderNumber))}</strong>
                    </div>
                    <div class="customer-order-detail">
                        <span>سعر الطلب</span>
                        <strong>${escapeHtml(displayPrice)} USD</strong>
                    </div>
                    <div class="customer-order-detail">
                        <span>تاريخ الطلب</span>
                        <strong>${escapeHtml(formatCustomerOrderDate(order.created_at))}</strong>
                    </div>
                </div>
                <div class="customer-order-section">
                    <h4>المعلومات التي أدخلها الزبون</h4>
                    <div class="customer-order-params">${renderCustomerOrderParams(order.order_params)}</div>
                </div>
                <div class="customer-order-section">
                    <h4>رد النظام من Nemer</h4>
                    ${renderCustomerOrderResponse(order.nemer_response)}
                </div>
            </article>
        `;
    }).join("");
}

function handleAction(action) {

    switch (action) {

        case "orders":
            showCustomerOrdersModal();
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

function getPriceDecimalPlaces(value) {
    // أسعار المتجر تُعرض دائمًا بثلاث خانات عشرية، مع التقريب إلى الأعلى.
    return 3;
}

function ceilPrice(value, decimals) {
    const amount = Number(value);
    const places = Number.isInteger(decimals) ? Math.max(0, Math.min(12, decimals)) : 3;
    if (!Number.isFinite(amount)) return null;
    const factor = 10 ** places;
    const scaled = amount * factor;
    const epsilon = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
    return Math.ceil(scaled - epsilon) / factor;
}

function formatMoney(value, decimals) {
    const amount = Number(value) || 0;
    const places = Number.isInteger(decimals) ? Math.max(0, Math.min(12, decimals)) : 3;
    return "$" + amount.toFixed(places);
}

function formatProductMoney(product, value) {
    const amount = value === undefined ? getGameProductPrice(product) : value;
    if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return "السعر غير متاح";
    const decimals = 3;
    const roundedUp = ceilPrice(amount, decimals);
    return roundedUp === null ? "السعر غير متاح" : formatMoney(roundedUp, decimals);
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

function formatQuantityBound(value){
    const amount=Number(value);
    if(!Number.isFinite(amount))return "";
    return Math.trunc(amount).toLocaleString("en-US");
}
function quantityRangePlaceholder(min,max){
    return formatQuantityBound(min)+" ← "+formatQuantityBound(max);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

const BALANCE_CATALOG = [
    // قسم الأرصدة: تصنيفات المستوى الثاني ثابتة، بينما بعض التصنيفات لها تقسيمات مخصصة في المستوى الثالث.
    // يبقى ظاهرًا بحالة غير متاحة، بينما المنتجات تُربط ديناميكيًا بكتالوج Nemer.
    {
        key:"turkey-balance",
        title:"رصيد تركي",
        aliases:["رصيد تركي","الرصيد التركي","تركيا","تركي","turkish balance","turkey balance","turkey","try","tl"],
        image:"/assets/balance/turkey-balance.svg"
    },
    {
        key:"syriatel",
        title:"سيريتيل",
        aliases:["سيريتل","سيرياتيل","سيريتيل","syriatel","syriatel cash"],
        image:"https://www.zarkachat.com/wp-content/uploads/2020/04/syriatel-28227.jpg"
    },
    {
        key:"mtn",
        title:"MTN",
        aliases:["mtn","mtn syria","mtn cash","ام تي ان"],
        image:"/assets/balance/mtn.svg"
    },
    {
        key:"zain-cash",
        title:"زين كاش",
        aliases:["زين كاش","zain cash","zaincash","zain"],
        image:"/assets/balance/zain-cash.svg"
    },
    {
        key:"instapay",
        title:"InstaPay",
        aliases:["instapay","insta pay","انستا باي","إنستا باي"],
        image:"/assets/balance/instapay.svg"
    },
    {
        key:"reflect",
        title:"Reflect",
        aliases:["reflect","ريفلكت","رفلكت"],
        image:"https://reflectapp.com/wp-content/themes/reflectapp/images/reflect_footer.png?v=20261003"
    },
    {
        key:"papara",
        title:"Papara",
        aliases:["papara","بابارا"],
        image:"https://upload.wikimedia.org/wikipedia/commons/d/dd/Papara_Logo.png?v=20261003"
    },
    {
        key:"paypal",
        title:"PayPal",
        aliases:["paypal","باي بال","بايبال"],
        image:"/assets/balance/paypal.svg"
    },
    {
        key:"payoneer",
        title:"Payoneer",
        aliases:["payoneer","بايونير"],
        image:"/assets/balance/payoneer.svg"
    },
    {
        key:"touch",
        title:"Touch",
        aliases:["touch","touch lebanon","تاتش","تتش"],
        image:"/assets/balance/touch.svg"
    },
    {
        key:"alfa",
        title:"Alfa",
        aliases:["alfa","alfa lebanon","ألفا","الفا"],
        image:"/assets/balance/alfa.svg"
    },
    {
        key:"rcell",
        title:"Rcell",
        aliases:["rcell","r cell","ارسل","آر سيل"],
        image:"/assets/balance/rcell.svg"
    },
    {
        key:"whish-money",
        title:"Whish Money",
        aliases:["whish money","whish","ويش موني","ويش","wish money"],
        image:"/assets/balance/whish-money.svg"
    },
    {
        key:"asia-cell",
        title:"آسيا سيل",
        aliases:["اسيا سيل","آسيا سيل","asiacell","asia cell","asia-cell","asiacell cash"],
        image:"/assets/balance/asia-cell.svg"
    }
];
function normalizeBalanceText(value) {
    return normalizeGameText(String(value || ""))
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي");
}

function findBalanceCatalogItem(product) {
    const categoryText = normalizeBalanceText(product && product.category_name);
    const productText = normalizeBalanceText(product && product.name);
    const combined = (categoryText + " " + productText).trim();
    return BALANCE_CATALOG.find(function(item) {
        return item.aliases.some(function(alias) {
            const needle = normalizeBalanceText(alias);
            if (!needle) return false;
            return categoryText.includes(needle) || combined.includes(needle);
        });
    }) || null;
}

function isBalanceProduct(product) {
    return !!findBalanceCatalogItem(product);
}

function getBalanceGroups() {
    const groups = BALANCE_CATALOG.map(function(item) {
        return {key:item.key,title:item.title,image:item.image || "",products:[]};
    });
    const byKey = new Map(groups.map(function(group){ return [group.key, group]; }));
    state.products.forEach(function(product) {
        const item = findBalanceCatalogItem(product);
        if (!item) return;
        const group = byKey.get(item.key);
        if (!group) return;
        // صور قسم الأرصدة ثابتة ومحلية بالكامل؛ لا نستخدم category_img من API.
        group.products.push(product);
    });
    // لا نحذف أي تصنيف: حتى إذا لم توجد منتجات حاليًا، يبقى المربع ظاهرًا
    // بحالة غير متاحة. هذا يحافظ على بنية قسم الأرصدة ويمنع اختفاء التصنيفات.
    return groups;
}

function openBalancePage(fromHistory) {
    if (!fromHistory) pushInternalHistory("balance");
    const services=document.getElementById("servicesSection"), internal=document.getElementById("internalPage");
    const title=document.getElementById("internalPageTitle"), icon=document.getElementById("internalPageIcon"), content=document.getElementById("internalPageContent");
    if (!services || !internal || !content) return;
    services.hidden=true; internal.hidden=false; internal.classList.add("balance-internal-page");
    if(title) title.textContent="الأرصدة"; if(icon) icon.textContent="";
    // المستوى الثاني يعرض التصنيفات الثابتة فقط؛ لا نستدعي Nemer هنا.
    // استدعاء API وربط المنتجات يتم عند دخول المستوى الثالث/صفحة الشراء.
    const groups=getBalanceGroups();
    content.innerHTML='<div class="game-page balance-level-two"><div class="game-category-grid balance-category-grid">'+groups.map(function(group){
        const image=group.image || "";
        const imageHtml=image?'<img src="'+escapeHtml(image)+'" alt="'+escapeHtml(group.title)+'" loading="lazy">':'<span class="game-placeholder">💵</span>';
        // المستوى الثاني لا يعطل التصنيف قبل تحميل API؛ الضغط عليه هو الذي يبدأ تحميل منتجاته.
        return '<button class="game-category-tile game-product-group-card balance-category-tile" type="button" data-balance-group="'+escapeHtml(group.key)+'"><span class="game-tile-image '+(["instapay","zain-cash","reflect","paypal","payoneer","alfa","rcell","asia-cell"].includes(group.key)?"balance-brand-image":"")+'">'+imageHtml+'</span><span class="game-tile-title">'+escapeHtml(group.title)+'</span></button>';
    }).join("")+'</div></div>';
    const back=document.getElementById("balanceBack"); if(back) back.addEventListener("click",closeInternalPage);
    content.querySelectorAll("[data-balance-group]").forEach(function(card){card.addEventListener("click",function(){openBalanceProductGroup(card.getAttribute("data-balance-group")||"");});});
    window.scrollTo({top:0,behavior:"smooth"});
}

function getBalanceSubgroupTitle(product, fallbackTitle) {
    const categoryName = cleanGameCategoryName(product && product.category_name);
    const combined = normalizeBalanceText(
        String(product && product.category_name || "") + " " +
        String(product && product.name || "")
    );
    const provider = normalizeBalanceText(fallbackTitle || "");

    // Nemer displays Syriatel as three distinct level-3 tiles even when
    // some API records share the same parent/category: S1, S2 and invoices.
    if (provider.includes("سيريتل") || provider.includes("سيرياتيل") || provider.includes("سيريتيل") || provider.includes("syriatel")) {
        if (combined.includes("s1") || combined.includes("s 1")) return "وحدات سيريتل S1";
        if (combined.includes("s2") || combined.includes("s 2")) return "وحدات سيريتل S2";
        if (combined.includes("فاتور") || combined.includes("invoice")) return "فواتير سيريتل";
    }

    return categoryName || fallbackTitle || "منتجات";
}

function getBalanceSubgroupRank(groupTitle, subgroupTitle) {
    const provider = normalizeBalanceText(groupTitle || "");
    const title = normalizeBalanceText(subgroupTitle || "");
    if (provider.includes("سيريتل") || provider.includes("سيرياتيل") || provider.includes("سيريتيل") || provider.includes("syriatel")) {
        if (title.includes("s1")) return 1;
        if (title.includes("s2")) return 2;
        if (title.includes("فاتور") || title.includes("invoice")) return 3;
    }
    return 999;
}

function getBalanceSubgroups(group) {
    if (!group) return [];

    const products = Array.isArray(group.products) ? group.products : [];

    // الرصيد التركي له مستويان ثابتان فقط:
    // 1) باقة تركسل
    // 2) تسديد تركسل
    // لا نحذف أو ننسخ منتجات Nemer؛ نعيد تجميع المنتجات الموجودة
    // داخل هذين التصنيفين فقط مع الحفاظ على product.id وباقي بيانات الطلب.
    if (group.key === "turkey-balance") {
        const bundleProducts = [];
        const paymentProducts = [];

        function isTurkcellBundleProduct(product) {
            const combined = normalizeBalanceText(
                String(product && product.category_name || "") + " " +
                String(product && product.name || "")
            ).toLowerCase();

            const isPayment = /تسديد|تسديدات|فاتور|فواتير|دفع|دفعة|invoice|invoices|payment|bill|billing|fatura|fatur/.test(combined);
            if (isPayment) return false;

            // باقة تركسل يجب أن تكون باقة مركبة فعلية، وليست منتج رسائل أو دقائق منفردًا.
            // نتحقق من وجود مكوّنات الباقة الثلاثة: إنترنت + دقائق + SMS.
            const hasInternet = /internet|data|gb|mb|g[b]?|m[b]?|انترنت|إنترنت|جيجا|ميجا/.test(combined);
            const hasMinutes = /دقائق?|دقيقه|دقيقة|minute|minutes|dk|min/.test(combined);
            const hasSms = /sms|رسائل?|message|messages/.test(combined);

            return hasInternet && hasMinutes && hasSms;
        }

        products.forEach(function(product) {
            const combined = normalizeBalanceText(
                String(product && product.category_name || "") + " " +
                String(product && product.name || "")
            );
            const isPayment = /تسديد|تسديدات|فاتور|فواتير|دفع|دفعة|invoice|invoices|payment|bill|billing|fatura|fatur/.test(combined);

            if (isPayment) {
                paymentProducts.push(product);
            } else if (isTurkcellBundleProduct(product)) {
                bundleProducts.push(product);
            }
        });

        // لا نستخدم احتياطًا يعرض منتجات غير مطابقة؛ إذا لم نجد باقات مركبة
        // يجب أن يظهر قسم باقة تركسل فارغًا بدل خلطه بمنتجات أخرى.

        return [
            {
                key: "turkey-balance|turkcell-bundle",
                title: "باقة تركسل",
                image: group.image || "",
                products: sortGameProducts(bundleProducts),
                balanceGroupKey: group.key,
                providerTitle: group.title
            },
            {
                key: "turkey-balance|turkcell-payment",
                title: "تسديد تروكسل",
                image: group.image || "",
                products: sortGameProducts(paymentProducts),
                balanceGroupKey: group.key,
                providerTitle: group.title
            }
        ];
    }

    const groups = [];
    const seen = new Map();

    products.forEach(function(product) {
        const title = getBalanceSubgroupTitle(product, group.title);
        const parentKey = String(product && product.parent_id != null ? product.parent_id : "");
        const normalizedTitle = normalizeBalanceText(title);
        const key = parentKey + "|" + normalizedTitle;

        if (!seen.has(key)) {
            const subgroup = {
                key: key,
                title: title,
                image: group.image || "",
                products: [],
                balanceGroupKey: group.key,
                providerTitle: group.title
            };
            seen.set(key, subgroup);
            groups.push(subgroup);
        }

        const subgroup = seen.get(key);
        // صورة المستوى الثالث تبقى صورة المزود المحلية، وليس صورة API.
        subgroup.products.push(product);
    });

    groups.forEach(function(subgroup) {
        subgroup.products = sortGameProducts(subgroup.products);
    });

    groups.sort(function(a,b){
        const rankDiff = getBalanceSubgroupRank(group.title,a.title) - getBalanceSubgroupRank(group.title,b.title);
        if (rankDiff !== 0) return rankDiff;
        return groups.indexOf(a) - groups.indexOf(b);
    });

    return groups;
}

function openBalanceSubgroups(groupKey, fromHistory) {
    if (!fromHistory) pushInternalHistory("balance-subgroups", {balanceGroupKey:groupKey});

    const content=document.getElementById("internalPageContent");
    const title=document.getElementById("internalPageTitle");
    const icon=document.getElementById("internalPageIcon");
    if(!content) return;

    // قاعدة الأرصدة: لا نطلب منتجات API قبل ضغط المستوى الثاني.
    // بعد نجاح الطلب نعيد الدخول مرة واحدة مع fromHistory=true لعرض التصنيفات،
    // ولا نعيد استدعاء API من داخل الاستدعاء الثاني.
    if (!fromHistory) {
        content.innerHTML='<div class="products-loading"><div class="loading-spinner"></div><p>جاري تحميل منتجات هذا التصنيف...</p></div>';
        const request = loadProducts({force:true});
        request.then(function(){ openBalanceSubgroups(groupKey, true); }).catch(function(){
            content.innerHTML='<div class="game-products-placeholder"><div class="game-products-placeholder-icon">⚠️</div><h3>تعذر تحميل المنتجات</h3><p>يرجى المحاولة مرة أخرى.</p><button class="buy-btn" type="button" id="retryBalanceProducts">↻ إعادة المحاولة</button></div>';
            const retry=document.getElementById("retryBalanceProducts");
            if(retry) retry.addEventListener("click",function(){openBalanceSubgroups(groupKey);});
        });
        return;
    }

    const group=getBalanceGroups().find(function(item){return item.key===groupKey;});
    if(!group) return;

    if(title) title.textContent=group.title;
    if(icon) icon.textContent="💵";

    const subgroups=getBalanceSubgroups(group);

    if(!subgroups.length){
        content.innerHTML='<div class="game-products-placeholder"><div class="game-products-placeholder-icon">💵</div><h3>'+escapeHtml(group.title)+'</h3><p>لا توجد منتجات متاحة حاليًا لهذا التصنيف.</p></div>';
        return;
    }

    content.innerHTML=
        '<div class="game-page balance-level-three">' +
            '<button class="pubg-back" type="button" id="balanceBackToGroups">← العودة إلى الأرصدة</button>' +
            '<div class="game-products-heading"><strong>'+subgroups.length+' تصنيف</strong><span>تصنيفات '+escapeHtml(group.title)+'</span></div>' +
            '<div class="game-category-grid game-product-groups-grid balance-subgroup-grid">' +
                subgroups.map(function(subgroup){
                    const available=subgroup.products.some(function(product){return product.available!==false&&product.available!==0;});
                    // قسم الأرصدة: جميع الصور محلية من BALANCE_CATALOG فقط.
                    // لا نستخدم category_img أو أي صورة قادمة من API.
                    const image = subgroup.image || group.image || "";
                    const imageHtml=image
                        ? '<img src="'+escapeHtml(String(image).startsWith("http")?image:BACKEND_URL+image)+'" alt="'+escapeHtml(subgroup.title)+'" loading="lazy">'
                        : '<span class="game-placeholder">💵</span>';
                    return '<button class="game-category-tile game-product-group-card balance-subgroup-tile'+(available?'':' is-disabled')+'" type="button" data-balance-subgroup="'+escapeHtml(subgroup.key)+'"'+(available?'':' disabled')+'>' +
                        '<span class="game-tile-image">'+imageHtml+'</span>' +
                        '<span class="game-tile-title">'+escapeHtml(subgroup.title)+'</span>' +
                    '</button>';
                }).join("") +
            '</div>' +
        '</div>';

    const back=document.getElementById("balanceBackToGroups");
    if(back) back.addEventListener("click",function(){openBalancePage();});

    content.querySelectorAll("[data-balance-subgroup]").forEach(function(card){
        card.addEventListener("click",function(){
            openBalanceSubgroupProducts(groupKey,card.getAttribute("data-balance-subgroup")||"");
        });
    });

    window.scrollTo({top:0,behavior:"smooth"});
}

function openBalanceSubgroupProducts(groupKey, subgroupKey, fromHistory) {
    if(!fromHistory) pushInternalHistory("balance-products",{balanceGroupKey:groupKey,subgroupKey:subgroupKey});

    const group=getBalanceGroups().find(function(item){return item.key===groupKey;});
    if(!group) return;

    const subgroup=getBalanceSubgroups(group).find(function(item){return item.key===subgroupKey;});
    if(subgroup && subgroup.products.length) {
        renderBalanceProductPicker(subgroup);
    }
}

function openBalanceProductGroup(groupKey, fromHistory) {
    openBalanceSubgroups(groupKey, fromHistory);
}

function isTurkcellBundleGroup(groupInfo) {
    const title = normalizeBalanceText(groupInfo && groupInfo.title || "");
    return title.includes("باقة") && (title.includes("تركي") || title.includes("تروكسل") || title.includes("turkcell"));
}

function renderBalanceProductPicker(group) {
    const content=document.getElementById("internalPageContent"), title=document.getElementById("internalPageTitle"), icon=document.getElementById("internalPageIcon");
    if(!content || !group) return;
    if(title) title.textContent=group.title;
    if(icon) icon.textContent="💵";

    const products=Array.isArray(group.products)?group.products:[];
    const available=products.filter(function(p){return p.available!==false&&p.available!==0;});
    const first=available[0]||products[0]||null;

    function getBalanceSaleUnitPrice(product){
        // /api/products already returns the final selling price from the live Nemer price
        // plus the configured margin. Use it directly so balance products such as MTN
        // and Syriatel S1/S2 cannot lose their price because of a second margin calculation.
        const selling=Number(product&&product.price);
        if(Number.isFinite(selling)&&selling>=0)return selling;

        // Backward-compatible fallback for any product carrying only original_price.
        const raw=getRawProductPrice(product);
        if(raw===null)return null;
        return raw*(1+getProductProfitRateForClient(product)/100);
    }
    function formatBalancePrice(product,value){
        const amount=Number(value);
        if(!Number.isFinite(amount))return "السعر غير متاح";
        return formatProductMoney(product,amount);
    }
    const list=products.map(function(product,index){
        const ok=product.available!==false&&product.available!==0;
        const price=getBalanceSaleUnitPrice(product);
        return '<button class="pubg-option'+(ok?'':' is-disabled')+'" type="button" data-balance-index="'+index+'"'+(ok?'':' disabled')+'><span class="pubg-option-name">'+escapeHtml(product.name||"منتج")+'</span><span class="pubg-option-price">'+(price===null?'السعر غير متاح':formatBalancePrice(product,price))+'</span>'+(ok?'':'<span class="pubg-option-status">غير متوفر</span>')+'</button>';
    }).join("");

    const image=group.image||"";
    const imageHtml=image
        ? '<img src="'+escapeHtml(String(image).startsWith("http")?image:BACKEND_URL+image)+'" alt="'+escapeHtml(group.title)+'" loading="lazy">'
        : '<span class="game-placeholder">💵</span>';

    content.innerHTML='<div class="pubg-picker universal-game-picker"><button class="pubg-back" type="button" id="balanceBackToSubgroups">← العودة إلى التصنيفات</button><div class="pubg-picker-head"><div class="pubg-picker-image">'+imageHtml+'</div><h2>'+escapeHtml(group.title)+'</h2><span>'+products.length+' منتج</span></div><div class="game-required-fields-title">المعلومات المطلوبة</div><div id="balanceParamFields">'+(first?renderBalanceRequiredFields(first,group.title,products,0):"")+'</div><div class="pubg-field-label"'+(isTurkcellBundleGroup(group)?' style="display:none"':'')+'>'+ (isTurkcellBundleGroup(group)?"الخدمة المختارة":"اختر المنتج")+'</div><div class="pubg-select" id="balanceSelect"'+(isTurkcellBundleGroup(group)?' style="display:none"':'')+'><button class="pubg-select-trigger" type="button" aria-expanded="false"><span id="balanceSelectedName"><span class="pubg-select-arrow">▼</span></button><div class="pubg-options" id="balanceOptions" hidden>'+list+'</div></div><div id="balanceQuantityField"></div><div class="pubg-selected-summary"><span>السعر</span><strong id="balanceSelectedPrice">'+(first&&getBalanceSaleUnitPrice(first)!==null?formatBalancePrice(first,getBalanceSaleUnitPrice(first)):"السعر غير متاح")+'</strong></div><button class="buy-btn pubg-submit" id="balanceSubmitOrder" type="button"'+(!first||first.available===false||first.available===0||getBalanceSaleUnitPrice(first)===null?" disabled":"")+'>إرسال الطلب <span>→</span></button></div>';

    let selectedIndex=first?products.indexOf(first):-1;
    function isTurkcellBundle(groupInfo){
        return isTurkcellBundleGroup(groupInfo);
    }
    function qtyConfig(p){
        // باقة تركسل في Nemer تُباع كمنتج/باقة ثابتة ولا تحتوي على كمية.
        // لا نُظهر حقل الكمية حتى لو أعادت بيانات المنتج حقول qty قديمة أو عامة.
        if(isTurkcellBundle(group)) return{enabled:false,min:1,max:1,step:1};

        const v=p&&p.qty_values?p.qty_values:{},min=Number(v.min),max=Number(v.max),step=Number(v.step);
        const productTitle=normalizeBalanceText((p&&p.category_name||"")+" "+(p&&p.name||""));
        const subgroupTitle=normalizeBalanceText(group.title||"");
        // فواتير MTN: نربط الحد بالمنتج نفسه، لا بعنوان المستوى الثالث.
        // هذا يمنع انتقال حد MTN إلى جواكر أو أي منتج آخر.
        const isMtnInvoice =
            String(group.balanceGroupKey || "").toLowerCase() === "mtn" &&
            (productTitle.includes("فاتور") || productTitle.includes("invoice") || subgroupTitle.includes("فاتور") || subgroupTitle.includes("invoice"));
        if(isMtnInvoice){
            return{enabled:true,min:500,max:1000000,step:1};
        }
        const enabled=Number.isFinite(min)||Number.isFinite(max)||Number.isFinite(step)||!!(p&&(p.qty||p.quantity));
        return{enabled:enabled,min:Number.isFinite(min)&&min>0?min:1,max:Number.isFinite(max)&&max>0?max:999999999,step:Number.isFinite(step)&&step>0?step:1};
    }
    function renderQty(p){
        const h=document.getElementById("balanceQuantityField");if(!h)return;
        const q=qtyConfig(p);
        h.innerHTML=q.enabled?'<div class="pubg-field game-quantity-field"><label for="balanceOrderQty">الكمية</label><input id="balanceOrderQty" type="number" min="'+q.min+'" max="'+q.max+'" step="'+q.step+'" value="" placeholder="'+quantityRangePlaceholder(q.min,q.max)+'" inputmode="numeric" required></div>':"";
    }
    let customerDiscount=0;
    async function loadBalanceCustomerDiscount(){
        try{
            const response=await fetch(BACKEND_URL+"/api/customer/auth/me",{headers:{Accept:"application/json"},credentials:"include",cache:"no-store"});
            if(!response.ok)return;
            const data=await response.json();
            customerDiscount=Math.min(100,Math.max(0,Number(data.customer&&data.customer.discount||0)));
        }catch(error){
            customerDiscount=0;
        }finally{
            updateTotal();
        }
    }
    function updateTotal(){
        const p=products[selectedIndex],el=document.getElementById("balanceSelectedPrice"),q=document.getElementById("balanceOrderQty");
        if(!p||!el)return;

        const saleUnit=getBalanceSaleUnitPrice(p);
        if(saleUnit===null){el.textContent="السعر غير متاح";return;}

        const discountedUnit=saleUnit*(1-customerDiscount/100);
        const qty=q?Number(q.value):NaN;
        if(!Number.isFinite(qty)||qty<1){
            // المنتجات الثابتة مثل باقات تركسل لا تحتوي كمية؛ السعر هو سعر المنتج نفسه.
            if(!q){
                el.textContent=formatBalancePrice(p,discountedUnit);
                return;
            }
            el.textContent="$0.000";
            return;
        }

        const total=ceilPrice(discountedUnit*qty,getPriceDecimalPlaces(saleUnit));
        el.textContent=total===null?"السعر غير متاح":formatBalancePrice(p,total);
    }
    function updateProduct(index){
        const p=products[index];if(!p)return;
        selectedIndex=index;
        const n=document.getElementById("balanceSelectedName"),pr=document.getElementById("balanceSelectedPrice"),f=document.getElementById("balanceParamFields"),s=document.getElementById("balanceSubmitOrder");
        if(n)n.textContent=p.name||"اختر المنتج";
        if(pr){const unit=getBalanceSaleUnitPrice(p);pr.textContent=unit===null?"السعر غير متاح":formatBalancePrice(p,unit);}
        if(f)f.innerHTML=renderBalanceRequiredFields(p,group.title,products,index);
        renderQty(p);updateTotal();
        if(s)s.disabled=p.available===false||p.available===0||getBalanceSaleUnitPrice(p)===null;
    }
    renderQty(first);updateTotal();loadBalanceCustomerDiscount();
    const qh=document.getElementById("balanceQuantityField");if(qh)qh.addEventListener("input",updateTotal);
    const back=document.getElementById("balanceBackToSubgroups");
    if(back)back.addEventListener("click",function(){openBalanceSubgroups(group.balanceGroupKey||"");});
    const select=document.getElementById("balanceSelect"),trigger=select&&select.querySelector(".pubg-select-trigger"),options=document.getElementById("balanceOptions");
    if(trigger&&options){
        trigger.addEventListener("click",function(){
            const open=!options.hidden;options.hidden=open;trigger.setAttribute("aria-expanded",String(!open));
        });
        options.querySelectorAll("[data-balance-index]").forEach(function(o){
            o.addEventListener("click",function(){
                updateProduct(Number(o.getAttribute("data-balance-index")));
                options.hidden=true;trigger.setAttribute("aria-expanded","false");
            });
        });
    }
    if(content){
        content.addEventListener("change",function(event){
            if(!event.target || event.target.id!=="turkcellServiceSelect") return;
            const option=event.target.options[event.target.selectedIndex];
            const index=option?Number(option.getAttribute("data-service-index")):NaN;
            if(Number.isInteger(index)) updateProduct(index);
        });
    }
    const submit=document.getElementById("balanceSubmitOrder");
    if(submit)submit.addEventListener("click",function(){
        const p=products[selectedIndex];if(!p)return;
        const params={};let invalid=false;
        document.querySelectorAll("#balanceParamFields [data-game-param]").forEach(function(input){
            const label=input.getAttribute("data-game-param")||"",value=String(input.value||"").trim();
            if(!value){invalid=true;input.classList.add("is-invalid");}
            else{params[label]=value;input.classList.remove("is-invalid");}
        });
        // باقة تركسل تحتاج رقم الهاتف + الخدمة المختارة؛ باقي منتجات الأرصدة تستخدم حقولها الخاصة.
        const qi=document.getElementById("balanceOrderQty");
        const isFixedTurkcellBundle=isTurkcellBundle(group);
        const qty=qi?Number(qi.value):1;
        if(qi&&(!Number.isFinite(qty)||qty<Number(qi.min)||qty>Number(qi.max)))invalid=true;
        if(invalid){showToast(isFixedTurkcellBundle?"يرجى إدخال رقم الهاتف بشكل صحيح.":"يرجى إدخال جميع المعلومات المطلوبة والكمية بشكل صحيح.");return;}
        submit.disabled=true;
        fetch(BACKEND_URL+"/api/orders",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({product_id:p.id,params:params,qty:isFixedTurkcellBundle?1:qty})})
            .then(async function(response){
                const data=await response.json();
                if(!response.ok||data.status==="ERROR")throw new Error(data.message||"تعذر إنشاء الطلب");
                if(data.balance!==undefined)updateBalance(data.balance);
                showToast("تم إرسال الطلب بنجاح.");
            })
            .catch(function(error){console.error("Balance order error:",error);showToast(error.message||"تعذر إنشاء الطلب.");})
            .finally(function(){submit.disabled=false;});
    });

    window.scrollTo({top:0,behavior:"smooth"});
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
            state.profitRate = Number(data.profit_rate) || 0;
            state.numberProfitRate = Number(data.number_profit_rate) || 0;
            state.profitRateLoaded = true;
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
        return "<article class=\"product " + (available ? "" : "product-unavailable") + "\"><div class=\"product-icon\">" + icon + "</div><h3>" + escapeHtml(product.name || "منتج") + "</h3><p>" + escapeHtml(product.category_name || "") + "</p><div class=\"price\">" + (hasLivePrice ? formatProductMoney(product, price) : "جاري تحديث السعر…") + "</div><button class=\"buy-btn\" type=\"button\" data-product-id=\"" + escapeHtml(String(product.id)) + "\" " + (purchaseEnabled ? "" : "disabled") + ">" + (available ? (hasLivePrice ? "شراء الآن" : "جاري تحديث السعر") : "غير متوفر") + "</button></article>";
    }).join("");

    elements.products.querySelectorAll(".buy-btn[data-product-id]").forEach(function(button) {
        button.addEventListener("click", function() {
            const product = state.products.find(function(item) { return String(item.id) === String(button.getAttribute("data-product-id")); });
            if (product) openProductModal(product);
        });
    });
}

async function requireCustomerLoginForPurchase() {
    try {
        const response = await fetch("/api/customer/auth/me", {
            headers: {Accept:"application/json"},
            credentials: "same-origin"
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.customer) return true;
        }
    } catch (error) {}
    showModal(
        "تسجيل الدخول مطلوب",
        '<div class="empty-state"><div style="font-size:42px;margin-bottom:10px">🔐</div><h3>سجّل الدخول لإتمام الشراء</h3><p>يمكنك مشاهدة المنتجات والأسعار كضيف، لكن شراء أي منتج يتطلب تسجيل الدخول إلى حسابك.</p><a class="buy-btn" href="/customer-login.html" style="display:inline-flex;text-decoration:none;align-items:center;justify-content:center;margin-top:12px">تسجيل الدخول</a></div>'
    );
    return false;
}

async function openProductModal(product) {
    if (!(await requireCustomerLoginForPurchase())) return;
    const params = Array.isArray(product.params) ? product.params : [];
    const fields = params.map(function(label, index) {
        const safeLabel = escapeHtml(String(label || ""));
        return '<div class="order-field">' +
            '<label for="param_' + index + '">' + safeLabel + '</label>' +
            '<input id="param_' + index + '" type="text" placeholder="' + escapeHtml(String(label || "")) + '" autocomplete="off">' +
            '</div>';    }).join("");

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
                '<input id="orderQty" type="number" min="' + minQty + '" max="' + maxQty + '" step="1" value="" placeholder="' + quantityRangePlaceholder(minQty,maxQty) + '" inputmode="numeric" required>' +
            '</div>' +
            '<div class="order-price-row">' +
                '<span>السعر</span>' +
                '<strong id="orderPrice">' + (hasLivePrice ? formatProductMoney(product, price) : 'السعر غير متاح') + '</strong>' +
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
    if (!(await requireCustomerLoginForPurchase())) return;
    const params = {};
    (Array.isArray(product.params) ? product.params : []).forEach(function(label, index) {
        const input = document.getElementById("param_" + index);
        if (input && input.value.trim()) params[label] = input.value.trim();
    });
    const qtyInput = document.getElementById("orderQty");
    const qty = qtyInput ? Number(qtyInput.value) : NaN;
    const minQty = Number(product.qty_values?.min || 1);
    const maxQty = Number(product.qty_values?.max || 999999999);
    if (qtyInput && (!Number.isInteger(qty) || qty < minQty || qty > maxQty)) {
        qtyInput.classList.add("is-invalid");
        showToast("يرجى إدخال كمية بين " + formatQuantityBound(minQty) + " و " + formatQuantityBound(maxQty) + ".");
        return;
    }
    if (qtyInput) qtyInput.classList.remove("is-invalid");
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
/* =========================
   STORE INTERACTION LOCK
========================= */
function initializeStoreInteractionLock() {
    // امنع قائمة المتصفح/الضغط المطوّل الذي يكشف روابط الصور أو خيارات النسخ.
    document.addEventListener("contextmenu", function (event) {
        event.preventDefault();
    }, {capture:true});

    // امنع سحب الصور والروابط والنصوص من واجهة المتجر.
    document.addEventListener("dragstart", function (event) {
        if (event.target && event.target.closest && event.target.closest("img, a, svg, [draggable='true']")) {
            event.preventDefault();
        }
    }, {capture:true});

    // لا نسمح بتحديد نصوص الواجهة. حقول الإدخال تبقى قابلة للتحرير.
    document.addEventListener("selectstart", function (event) {
        const editable = event.target && event.target.closest &&
            event.target.closest("input, textarea, select, [contenteditable='true']");
        if (!editable) event.preventDefault();
    }, {capture:true});

    // تأكيد إضافي للصور حتى لا تتحول إلى هدف مستقل للّمس الطويل.
    document.addEventListener("pointerdown", function (event) {
        if (event.target && event.target.closest && event.target.closest("img, svg")) {
            event.preventDefault();
        }
    }, {capture:true});
}
