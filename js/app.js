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
    if (text.includes("pubg") || text.includes("ببجي")) return BACKEND_URL + "/api/game-images/pubg-mobile";
    if (text.includes("roblox") || text.includes("روبلوكس")) return BACKEND_URL + "/api/game-images/roblox";
    if (text.includes("jawaker") || text.includes("جواكر")) return BACKEND_URL + "/api/game-images/jawaker";
    if (text.includes("free fire") || text.includes("فري فاير")) return BACKEND_URL + "/api/game-images/free-fire";
    if (text.includes("clash of clans") || text.includes("كلاش")) return BACKEND_URL + "/api/game-images/clash-of-clans";
    if (text.includes("dragonheir") || text.includes("silent gods") || text.includes("دراغون هير")) return BACKEND_URL + "/api/game-images/dragonheir-silent-gods";
    if (text.includes("cloud song") || text.includes("skywalkers") || text.includes("كلاود سونغ")) return BACKEND_URL + "/api/game-images/cloud-song";
    if (text.includes("yalla ludo gold") || text.includes("يلا لودو جولد") || text.includes("يلا لودو غولد")) {
        // Yalla Ludo Gold ليس تطبيقًا مستقلاً؛ يستخدم نفس أيقونة Yalla Ludo الرسمية.
        return BACKEND_URL + "/api/game-images/yalla-ludo";
    }
    if (text.includes("yalla ludo") || text.includes("يلا لودو")) {
        return BACKEND_URL + "/api/game-images/yalla-ludo";
    }
    if (text.includes("lords mobile") || text.includes("لوردز موبايل") || text.includes("لوردس موبايل")) {
        return BACKEND_URL + "/api/game-images/lords-mobile";
    }
    if (text.includes("8ball pool") || text.includes("8 ball pool") || text.includes("eight ball pool") || text.includes("ثمانية بول") || text.includes("ثمنية بول")) {
        return BACKEND_URL + "/api/game-images/8-ball-pool";
    }
    if (text.includes("gun of glory") || text.includes("guns of glory")) {
        return BACKEND_URL + "/api/game-images/guns-of-glory";
    }
    if (text.includes("gangs of glory") || text.includes("غانغز اوف غلوري") || text.includes("غانجز أوف غلوري")) {
        return BACKEND_URL + "/api/game-images/gangs-of-glory";
    }
    if (text.includes("project entropy") || text.includes("بروجكت انتروبي") || text.includes("بروجيكت انتروبي")) {
        return BACKEND_URL + "/api/game-images/project-entropy";
    }
    if (text.includes("farlight 84") || text.includes("farlight84") || text.includes("فارلايت 84")) {
        return BACKEND_URL + "/api/game-images/farlight-84";
    }
    if (text.includes("city of crime gang war") || text.includes("city of crime gang wars")) {
        return BACKEND_URL + "/api/game-images/city-of-crime-gang-war";
    }
    if (text.includes("marvel rivals") || text.includes("marvel reveals") || text.includes("مارفل ريفيلز") || text.includes("مارفل رايفلز")) {
        return BACKEND_URL + "/api/game-images/marvel-rivals";
    }
    if (text.includes("genshin impact")) {
        return BACKEND_URL + "/api/game-images/genshin-impact";
    }
    if (text.includes("super sus")) {
        return BACKEND_URL + "/api/game-images/super-sus";
    }
    if (text.includes("crystal of atlan") || text.includes("crystal atlan") || text.includes("كريستال اوف اتلان") || text.includes("كريستال أوف أتلان")) {
        return BACKEND_URL + "/api/game-images/crystal-of-atlan";
    }
    if (text.includes("bullet echo") || text.includes("بوليت إيكو") || text.includes("بولت إيكو")) {
        return BACKEND_URL + "/api/game-images/bullet-echo";
    }
    if (text.includes("stumble guys")) {
        return BACKEND_URL + "/api/game-images/stumble-guys";
    }
    if (text.includes("honkai") || text.includes("star rail") || text.includes("هونكاي")) return BACKEND_URL + "/api/game-images/honkai-star-rail";
    if (text.includes("mobile legends") || text.includes("mlbb") || text.includes("موبايل ليجندز")) return BACKEND_URL + "/api/game-images/mobile-legends";
    if (text.includes("age of empires mobile") || text.includes("age of empires") || text.includes("عصر الامبراطوريات موبايل")) return BACKEND_URL + "/api/game-images/age-of-empires-mobile";
    if (text.includes("goddess of victory") || text.includes("goddess of victory nikke") || text.includes("nikke") || text.includes("نيكي")) return BACKEND_URL + "/api/game-images/nikke";
    if (text.includes("division resurgence") || text.includes("the division resurgence") || text.includes("ذا ديفيجن ريزرجنس")) return BACKEND_URL + "/api/game-images/division-resurgence";
    if (text.includes("hero clash") || text.includes("هيرو كلاش")) return BACKEND_URL + "/api/game-images/hero-clash";
    if (text.includes("devil may cry") || text.includes("devil may cry peak of combat") || text.includes("peak of combat") || text.includes("ديفل ماي كراي")) return BACKEND_URL + "/api/game-images/devil-may-cry";
    if (text.includes("eggy party") || text.includes("egg party") || text.includes("إيجي بارتي")) return BACKEND_URL + "/api/game-images/eggy-party";
    if (text.includes("my singing monsters") || text.includes("my singing") || text.includes("monsters") || text.includes("ماي سينغينغ مونسترز")) return BACKEND_URL + "/api/game-images/my-singing-monsters";
    if (text.includes("onmyoji arena") || text.includes("onmyoji") || text.includes("أونميوجي أرينا")) return BACKEND_URL + "/api/game-images/onmyoji-arena";
    if (text.includes("stormshot") || text.includes("storm shot") || text.includes("ستورمشوت")) return BACKEND_URL + "/api/game-images/stormshot";
    if (text.includes("crossout mobile") || text.includes("crossout") || text.includes("كروس أوت موبايل")) return BACKEND_URL + "/api/game-images/crossout-mobile";
    if (text.includes("dragon raja sea") || text.includes("dragon raja") || text.includes("دراغون راجا")) return BACKEND_URL + "/api/game-images/dragon-raja-sea";
    if (text.includes("life makeover global") || text.includes("life makeover") || text.includes("لايف ميك أوفر")) return BACKEND_URL + "/api/game-images/life-makeover-global";
    if (text.includes("whiteout survival")) {
        return BACKEND_URL + "/api/game-images/whiteout-survival";
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
        openGamesPage(true);
        return;
    }

    if (state.view === "game") {
        openGamePlaceholder(state.gameTitle, true);
        return;
    }

    if (state.view === "products") {
        openGameProductGroup(state.gameTitle, state.groupKey, true);
        return;
    }

    closeInternalPage();
}

function initializeInternalHistory() {
    window.addEventListener("popstate", function(event) {
        handleInternalHistoryState(event.state);
    });
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
        const price = getGameProductPrice(product);
        return '<button class="pubg-option' + (available ? '' : ' is-disabled') + '" type="button" data-pubg-index="' + index + '"' +
            (available ? '' : ' disabled') + '>' +
            '<span class="pubg-option-name">' + escapeHtml(product.name || "منتج") + '</span>' +
            '<span class="pubg-option-price">' + (price === null ? 'السعر غير متاح' : formatProductMoney(product, price)) + '</span>' +
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
                '<input id="gameOrderQty" type="number" min="' + config.min + '" max="' + config.max + '" step="' + config.step + '" value="' + config.min + '"  inputmode="numeric" required aria-required="true">' +
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
        return "<article class=\"product " + (available ? "" : "product-unavailable") + "\"><div class=\"product-icon\">" + icon + "</div><h3>" + escapeHtml(product.name || "منتج") + "</h3><p>" + escapeHtml(product.category_name || "") + "</p><div class=\"price\">" + (hasLivePrice ? formatProductMoney(product, price) : "جاري تحديث السعر…") + "</div><button class=\"buy-btn\" type=\"button\" data-product-id=\"" + escapeHtml(String(product.id)) + "\" " + (purchaseEnabled ? "" : "disabled") + ">" + (available ? (hasLivePrice ? "شراء الآن" : "جاري تحديث السعر") : "غير متوفر") + "</button></article>";
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
        const safeLabel = escapeHtml(String(label || ""));
        return '<div class="order-field">' +
            '<label for="param_' + index + '">' + safeLabel + '</label>' +
            '<input id="param_' + index + '" type="text" placeholder="' + escapeHtml(String(label || "")) + '" autocomplete="off">' +
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