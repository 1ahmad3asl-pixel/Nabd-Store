Warning: truncated output (original token count: 52449)
Total output lines: 4044

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
let pendingNotificationRead = null;

/*
 * NABD ISOLATION CONTRACT
 * -----------------------
 * Every section/category/product owns its own scope key.
 * Shared helpers may read data, but navigation, selection and UI state
 * must always be resolved through the current scope. A change inside one
 * scope must never mutate another scope implicitly.
 */
const NabdScope = Object.freeze({
    HOME: "home",
    GAMES: "games",
    APPS: "apps",
    BALANCE: "balance",
    NUMBERS: "numbers",
    DIGITAL: "digital",
    BOOST: "boost",
    OTHER: "other"
});

function createSectionScope(section, category, productId) {
    const safeSection = String(section || NabdScope.HOME);
    const safeCategory = category == null ? null : String(category);
    const safeProductId = productId == null ? null : String(productId);
    return Object.freeze({
        section: safeSection,
        category: safeCategory,
        productId: safeProductId,
        key: [safeSection, safeCategory, safeProductId].filter(function(value) {
            return value !== null && value !== "";
        }).join(":")
    });
}

const sectionState = {
    current: createSectionScope(NabdScope.HOME),
    revision: 0
};

function setSectionScope(section, category, productId) {
    const next = createSectionScope(section, category, productId);
    sectionState.current = next;
    sectionState.revision += 1;
    return next;
}

function captureSectionScope(section, category, productId) {
    const scope = setSectionScope(section, category, productId);
    return { scope: scope, revision: sectionState.revision };
}

function isCurrentSectionScope(snapshot) {
    return !!snapshot && snapshot.revision === sectionState.revision &&
        snapshot.scope.key === sectionState.current.key;
}

// Small shared API for the section modules. No wrapper layers are required.
window.NabdScope = NabdScope;
window.captureSectionScope = captureSectionScope;
window.isCurrentSectionScope = isCurrentSectionScope;


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


// One stable delegated handler for all first-level category tiles.
// Keeping a single event path prevents duplicate touch/click routing.
document.addEventListener("click", function (event) {
    const button = event.target && event.target.closest
        ? event.target.closest(".category[data-category]")
        : null;
    if (!button) return;

    const category = button.getAttribute("data-category") || "other";

    if (category === "games") {
        event.preventDefault();
        openGamesPage();
        return;
    }
    if (category === "apps") {
        event.preventDefault();
        if (typeof openAppsPage === "function") openAppsPage();
        return;
    }
    if (category === "balance") {
        event.preventDefault();
        openBalancePage(false);
        return;
    }
    if (category === "numbers") {
        event.preventDefault();
        openNumbersPage();
        return;
    }
    if (category === "digital") {
        event.preventDefault();
        if (typeof openDigitalPage === "function") openDigitalPage(false);
        return;
    }
    if (category === "boost") {
        event.preventDefault();
        if (typeof openBoost === "function") openBoost(false);
        return;
    }

    document.querySelectorAll(".category").forEach(function (item) {
        item.classList.remove("active");
    });
    button.classList.add("active");
    state.selectedCategory = category;
    renderProducts();
});

function registerNabdServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js?v=20261125-responsive1", {scope:"/"})
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
    // شغّل شاشة الترحيب أولًا قبل أي مهيّئ آخر، حتى لا تبقى عالقة
    // إذا حدث خطأ في مهيّئ لاحق أثناء تحميل الصفحة.
    initializeWelcomeSplash();

    // لا نضع أي قفل عام على أحداث اللمس؛ عناصر المتجر التفاعلية يجب أن تستجيب مباشرة.

    registerNabdServiceWorker();
    initializeInternalHistory();
    initializeMenu();
    initializeCategories();
    initializeModal();
    initializeSounds();
    initializeCustomerNotifications();
    initializeSearch();
    initializeDhikrTicker();
    initializeDhikrHomeVisibility();
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

    // تظهر فقط عند فتح الصفحة أو عمل Refresh، وليس عند الرجوع داخل الموقع.
    let navigationType = "navigate";
    try {
        const entry = performance.getEntriesByType("navigation")[0];
        if (entry && entry.type) navigationType = entry.type;
    } catch (_) {}

    if (navigationType === "back_forward") {
        splash.hidden = true;
        splash.classList.add("is-hidden");
        splash.setAttribute("aria-hidden", "true");
        splash.style.display = "none";
        return;
    }

    splash.hidden = false;
    splash.classList.remove("is-hidden");
    splash.style.display = "flex";
    splash.setAttribute("aria-hidden", "false");

    window.setTimeout(function () {
        splash.classList.add("is-hidden");
        splash.setAttribute("aria-hidden", "true");
        window.setTimeout(function () {
            splash.hidden = true;
            splash.style.display = "none";
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

    if (localStorage.getItem("nabd-sound-enabled") === "off") return;

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

    if (localStorage.getItem("nabd-sound-enabled") === "off") return;

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
                    "button, a, .category, .drawer-link, .whatsapp-float, .buy-btn"
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


    const drawerLinks = document.querySelectorAll(".drawer-link");

    function setActiveDrawerLink(activeLink) {
        drawerLinks.forEach(function (item) {
            const isActive = item === activeLink;
            item.classList.toggle("active", isActive);
            if (isActive) {
                item.setAttribute("aria-current", "page");
            } else {
                item.removeAttribute("aria-current");
            }
        });
    }

    // الصفحة الرئيسية هي الحالة المحددة افتراضيًا عند فتح المتجر.
    const levelsModal = document.getElementById("customerLevelsModal");
    const activeInternalPage = document.getElementById("internalPage");
    if (!levelsModal || !levelsModal.classList.contains("is-open")) {
        if (!activeInternalPage || activeInternalPage.hidden) {
            const homeLink = document.querySelector('.drawer-link[href="#home"]');
            if (homeLink) setActiveDrawerLink(homeLink);
        }
    }

    drawerLinks.forEach(function (link) {
        link.addEventListener("click", function (event) {
            const href = link.getAttribute("href") || "";

            // صفحة المستويات تملك معالج فتح مستقلًا؛ نحدّد الزر فقط هنا.
            if (link.classList.contains("drawer-levels-trigger")) {
                setActiveDrawerLink(link);
                return;
            }

            if (href.startsWith("/")) {
                closeMenu();
                return;
            }

            event.preventDefault();
            setActiveDrawerLink(link);
            closeMenu();

            if (href === "#home") {
                window.location.reload();
            } else {
                handleAction(href.replace("#", ""));
            }
        });
    });

}


function openMenu() {

    if (
        !elements.drawer ||
        !elements.overlay
    ) {
        return;
    }

    // إذا فُتحت القائمة من داخل نافذة المستويات، أغلق النافذة أولًا
    // حتى لا تبقى طبقتها فوق القائمة الجانبية وتحجب التفاعل معها.
    const customerLevelsModal = document.getElementById("customerLevelsModal");
    if (customerLevelsModal && customerLevelsModal.classList.contains("is-open")) {
        const levelsCloseButton = customerLevelsModal.querySelector(".levels-back");
        if (levelsCloseButton) {
            levelsCloseButton.click();
        } else {
            customerLevelsModal.classList.remove("is-open");
            customerLevelsModal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        }
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
    if (text.includes("yalla ludo gold codes")) return "/public/images/الألعاب/yalla-ludo.jpg";
    if (text.includes("yalla ludo diamonds codes")) return "/public/images/الألعاب/yalla-ludo.jpg";
    if (text.includes("pubg") || text.includes("ببجي")) return "/public/images/الألعاب/pubg-mobile.jpg";
    if (text.includes("roblox") || text.includes("روبلوكس")) return "/public/images/الألعاب/roblox.jpg";
    if (text.includes("jawaker") || text.includes("جواكر")) return "/public/images/الألعاب/jawaker.jpg";
    if (text.includes("free fire") || text.includes("فري فاير")) return "/public/images/الألعاب/free-fire.jpg";
    if (text.includes("clash of clans") || text.includes("كلاش")) return "/public/images/الألعاب/clash-of-clans.jpg";
    if (text.includes("dragonheir") || text.includes("silent gods") || text.includes("دراغون هير")) return "/public/images/الألعاب/dragonheir-silent-gods.jpg";
    if (text.includes("cloud song") || text.includes("skywalkers") || text.includes("كلاود سونغ")) return "/public/images/الألعاب/cloud-song.jpg";
    if (text.includes("yalla ludo gold") || text.includes("يلا لودو جولد") || text.includes("يلا لودو غولد")) {
        // Yalla Ludo Gold ليس تطبيقًا مستقلاً؛ يستخدم نفس أيقونة Yalla Ludo الرسمية.
        return "/public/images/الألعاب/yalla-ludo.jpg";
    }
    if (text.includes("yalla ludo") || text.includes("يلا لودو")) {
        return "/public/images/الألعاب/yalla-ludo.jpg";
    }
    if (text.includes("lords mobile") || text.includes("لوردز موبايل") || text.includes("لوردس موبايل")) {
        return "/public/images/الألعاب/lords-mobile.jpg";
    }
    if (text.includes("8ball pool") || text.includes("8 ball pool") || text.includes("eight ball pool") || text.includes("ثمانية بول") || text.includes("ثمنية بول")) {
        return "/public/images/الألعاب/8-ball-pool.jpg";
    }
    if (text.includes("gun of glory") || text.includes("guns of glory")) {
        return "/public/images/الألعاب/guns-of-glory.jpg";
    }
    if (text.includes("gangs of glory") || text.includes("غانغز اوف غلوري") || text.includes("غانجز أوف غلوري")) {
        return "/public/images/الألعاب/gangs-of-glory.jpg";
    }
    if (text.includes("project entropy") || text.includes("بروجكت انتروبي") || text.includes("بروجيكت انتروبي")) {
        return "/public/images/الألعاب/project-entropy.jpg";
    }
    if (text.includes("farlight 84") || text.includes("farlight84") || text.includes("فارلايت 84")) {
        return "/public/images/الألعاب/farlight-84.jpg";
    }
    if (text.includes("city of crime gang war") || text.includes("city of crime gang wars")) {
        return "/public/images/الألعاب/city-of-crime-gang-war.jpg";
    }
    if (text.includes("marvel rivals") || text.includes("marvel reveals") || text.includes("مارفل ريفيلز") || text.includes("مارفل رايفلز")) {
        return "/public/images/الألعاب/marvel-rivals.jpg";
    }
    if (text.includes("genshin impact")) {
        return "/public/images/الألعاب/genshin-impact.jpg";
    }
    if (text.includes("super sus")) {
        return "/public/images/الألعاب/super-sus.jpg";
    }
    if (text.includes("crystal of atlan") || text.includes("crystal atlan") || text.includes("كريستال اوف اتلان") || text.includes("كريستال أوف أتلان")) {
        return "/public/images/الألعاب/crystal-of-atlan.jpg";
    }
    if (text.includes("bullet echo") || text.includes("بوليت إيكو") || text.includes("بولت إيكو")) {
        return "/public/images/الألعاب/bullet-echo.jpg";
    }
    if (text.includes("stumble guys")) {
        return "/public/images/الألعاب/stumble-guys.jpg";
    }
    if (text.includes("honkai") || text.includes("star rail") || text.includes("هونكاي")) return "/public/images/الألعاب/honkai-star-rail.jpg";
    if (text.includes("mobile legends") || text.includes("mlbb") || text.includes("موبايل ليجندز")) return "/public/images/الألعاب/mobile-legends.jpg";
    if (text.includes("oxide") || text.includes("survival island")) return "/public/images/الألعاب/oxide-survival-island.jpg";
    if (text.includes("king shot") || text.includes("kingshot")) return "/public/images/الألعاب/king-shot.jpg";
    if (text.includes("zepeto")) return "/public/images/الألعاب/zepeto.jpg";
    if (text.includes("blood strike") || text.includes("bloodstrike")) return "/public/images/الألعاب/blood-strike.jpg";
    if (text.includes("acecraft") || text.includes("ace craft")) return "/public/images/الألعاب/acecraft.jpg";
    if (text.includes("age of empires mobile") || text.includes("age of empires") || text.includes("عصر الامبراطوريات موبايل")) return "/public/images/الألعاب/age-of-empires-mobile.jpg";
    if (text.includes("goddess of victory") || text.includes("goddess of victory nikke") || text.includes("nikke") || text.includes("نيكي")) return "/public/images/الألعاب/nikke.jpg";
    if (text.includes("division resurgence") || text.includes("the division resurgence") || text.includes("ذا ديفيجن ريزرجنس")) return "/public/images/الألعاب/division-resurgence.jpg";
    if (text.includes("arena breakout") || text.includes("arena breakout mobile") || text.includes("أرينا بريك أوت")) return "/public/images/الألعاب/arena-breakout.jpg";
    if (text.includes("ludo club") || text.includes("لودو كلوب")) return "/public/images/الألعاب/ludo-club.jpg";
    if (text.includes("afk journey")) return "/public/images/الألعاب/afk-journey.jpg";
    if (text.includes("age of magic")) return "/public/images/الألعاب/age-of-magic.jpg";
    if (text.includes("ghost story love destiny")) return "/public/images/الألعاب/ghost-story-love-destiny.jpg";
    if (text.includes("arena of valor") || text.includes("أرينا أوف فالور")) return "/public/images/الألعاب/arena-of-valor.jpg";
    if (text.includes("growtopia") || text.includes("غروتوبيا")) return "/public/images/الألعاب/growtopia.jpg";
    if (text.includes("golden spatula") || text.includes("غولدن سباتولا")) return "/public/images/الألعاب/golden-spatula.jpg";
    if (text.includes("hatsune miku") || text.includes("colorful stage") || text.includes("هتسوني ميكو")) return "/public/images/الألعاب/hatsune-miku-colorful-stage.jpg";
    if (text.includes("arknights endfield") || text.includes("arknights") || text.includes("أركنايتس إندفيلد")) return "/public/images/الألعاب/arknights-endfield.jpg";
    if (text.includes("haikyu fly high") || text.includes("haikyu") || text.includes("هايكيو فلاي هاي")) return "/public/images/الألعاب/haikyu-fly-high.jpg";
    if (text.includes("ballistic hero vng") || text.includes("ballistic hero") || text.includes("بالستك هيرو")) return "/public/images/الألعاب/ballistic-hero-vng.jpg";
    if (text.includes("heaven burns red") || text.includes("هيفن برنز ريد")) return "/public/images/الألعاب/heaven-burns-red.jpg";
    if (text.includes("rise of kingdoms") || text.includes("رايز أوف كينغدومز")) return "/public/images/الألعاب/rise-of-kingdoms.jpg";
    if (text.includes("top war") || text.includes("توب وور")) return "/public/images/الألعاب/top-war.jpg";
    if (text.includes("the ants") || text.includes("النمل: المملكة تحت الأرض")) return "/public/images/الألعاب/the-ants.jpg";
    if (text.includes("kingdom guard") || text.includes("كينغدوم غارد")) return "/public/images/الألعاب/kingdom-guard.jpg";
    if (text.includes("call of dragons") || text.includes("كول أوف دراغونز")) return "/public/images/الألعا…32449 tokens truncated…MS.
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

    // Syriatel always has exactly three level-3 tiles. Build these explicitly
    // so S1 never disappears just because Nemer omits its provider/category
    // label on some products; each tile contains only its own matching API items.
    if (group.key === "syriatel") {
        const syriatelGroups = [
            {key:"syriatel|s1", title:"وحدات سيريتيل S1", products:[]},
            {key:"syriatel|s2", title:"وحدات سيريتيل S2", products:[]},
            {key:"syriatel|invoices", title:"فواتير سيريتيل", products:[]}
        ];
        products.forEach(function(product) {
            const combined = normalizeBalanceText(
                String(product && product.category_name || "") + " " +
                String(product && product.name || "")
            );
            const invoice = /فاتور|فواتير|تسديد|دفع|invoice|payment|bill|billing/.test(combined);
            if (invoice) {
                syriatelGroups[2].products.push(product);
                return;
            }
            if (/(^|\s)s ?1(\s|$)/i.test(combined)) {
                syriatelGroups[0].products.push(product);
                return;
            }
            if (/(^|\s)s ?2(\s|$)/i.test(combined)) {
                syriatelGroups[1].products.push(product);
            }
        });
        syriatelGroups.forEach(function(subgroup) {
            subgroup.image = group.image || "";
            subgroup.balanceGroupKey = group.key;
            subgroup.providerTitle = group.title;
            subgroup.products = sortGameProducts(subgroup.products);
        });
        return syriatelGroups;
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
                        ? '<img src="'+escapeHtml(safeImageUrl(/^https?:\/\//i.test(String(image))?String(image):BACKEND_URL+(String(image).startsWith("/")?String(image):"/"+String(image))))+'" alt="'+escapeHtml(subgroup.title)+'" loading="lazy">'
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
    // Reflect يحتوي على منتج واحد فقط؛ نختاره تلقائيًا ونخفي قائمة اختيار المنتج.
    const isReflectSingleProduct = group && group.balanceGroupKey === "reflect" && available.length === 1;
    // فواتير MTN لها منتج واحد فقط؛ نختاره تلقائيًا ونخفي حقل اختيار المنتج.
    const isMtnInvoiceProduct = group && String(group.balanceGroupKey || "").toLowerCase() === "mtn" && /فاتور|invoice/i.test(normalizeBalanceText(String((first && first.category_name) || "") + " " + String((first && first.name) || "") + " " + String(group.title || "")));

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
        ? '<img src="'+escapeHtml(safeImageUrl(/^https?:\/\//i.test(String(image))?String(image):BACKEND_URL+(String(image).startsWith("/")?String(image):"/"+String(image))))+'" alt="'+escapeHtml(group.title)+'" loading="lazy">'
        : '<span class="game-placeholder">💵</span>';

    content.innerHTML='<div class="pubg-picker universal-game-picker"><button class="pubg-back" type="button" id="balanceBackToSubgroups">← العودة إلى التصنيفات</button><div class="pubg-picker-head"><div class="pubg-picker-image'+(group.balanceGroupKey==="reflect"?' reflect-picker-image':'')+'">'+imageHtml+'</div><h2>'+escapeHtml(group.title)+'</h2><span>'+products.length+' منتج</span></div><div class="game-required-fields-title">المعلومات المطلوبة</div><div id="balanceParamFields">'+(first?renderBalanceRequiredFields(first,group.title,products,0):"")+'</div><div class="pubg-field-label"'+(isTurkcellBundleGroup(group)||isReflectSingleProduct||isMtnInvoiceProduct?' style="display:none"':'')+'>'+ (isTurkcellBundleGroup(group)?"الخدمة المختارة":"اختر المنتج")+'</div><div class="pubg-select" id="balanceSelect"'+(isTurkcellBundleGroup(group)||isReflectSingleProduct||isMtnInvoiceProduct?' style="display:none"':'')+'><button class="pubg-select-trigger" type="button" aria-expanded="false"><span id="balanceSelectedName">'+escapeHtml(first?(first.name||"اختر المنتج"):"اختر المنتج")+'</span><span class="pubg-select-arrow">▼</span></button><div class="pubg-options" id="balanceOptions" hidden>'+list+'</div></div><div id="balanceQuantityField"></div><div class="pubg-selected-summary"><span>السعر</span><strong id="balanceSelectedPrice">'+(first&&getBalanceSaleUnitPrice(first)!==null?formatBalancePrice(first,getBalanceSaleUnitPrice(first)):"السعر غير متاح")+'</strong></div><button class="buy-btn pubg-submit" id="balanceSubmitOrder" type="button"'+(!first||first.available===false||first.available===0||getBalanceSaleUnitPrice(first)===null?" disabled":"")+'>إرسال الطلب <span>→</span></button></div>';

    let selectedIndex=first?products.indexOf(first):-1;
    function isTurkcellBundle(groupInfo){
        return isTurkcellBundleGroup(groupInfo);
    }
    function qtyConfig(p){
        // باقة تركسل في Nemer تُباع كمنتج/باقة ثابتة ولا تحتوي على كمية.
        // لا نُظهر حقل الكمية حتى لو أعادت بيانات المنتج حقول qty قديمة أو عامة.
        if(isTurkcellBundle(group)) return{enabled:false,min:1,max:1,step:1};

        const productTitle=normalizeBalanceText((p&&p.category_name||"")+" "+(p&&p.name||""));
        // إعداد الكمية خاص بالمنتج نفسه، وليس بالتصنيف، حتى لا تنتقل حدود
        // منتج إلى منتج آخر.
        const isReflectProduct = /(^|\\s)(reflect|ريفلكت|رفلكت)(\\s|$)/i.test(productTitle);
        if(isReflectProduct){
            return{enabled:true,min:50,max:5000,step:1};
        }
        const v=p&&p.qty_values?p.qty_values:{},min=Number(v.min),max=Number(v.max),step=Number(v.step);
        const subgroupTitle=normalizeBalanceText(group.title||"");
        // فواتير MTN: نربط الحد بالمنتج نفسه، لا بعنوان المستوى الثالث.
        // هذا يمنع انتقال حد MTN إلى جواكر أو أي منتج آخر.
        const isMtnInvoice =
            String(group.balanceGroupKey || "").toLowerCase() === "mtn" &&
            (productTitle.includes("فاتور") || productTitle.includes("invoice") || subgroupTitle.includes("فاتور") || subgroupTitle.includes("invoice"));
        if(isMtnInvoice){
            return{enabled:true,min:500,max:5000000000,step:1};
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
            customerDiscount=Math.min(100,Math.max(0,Number(data.customer&&data.customer.effective_discount!=null?data.customer.effective_discount:(data.customer&&data.customer.discount||0))));
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
            if(document.getElementById("balanceSubmitOrder")) document.getElementById("balanceSubmitOrder").disabled=true;
            return;
        }
        // Reflect: الكمية المقبولة من 50 إلى 5,000 فقط. خارج هذا النطاق يظهر الإجمالي صفرًا ولا يُسمح بالطلب.
        const qConfig=qtyConfig(p);
        if(qConfig.enabled && (qty < qConfig.min || qty > qConfig.max || ((qty-qConfig.min)%qConfig.step)!==0)){
            el.textContent="$0.000";
            if(document.getElementById("balanceSubmitOrder")) document.getElementById("balanceSubmitOrder").disabled=true;
            return;
        }

        const total=ceilPrice(discountedUnit*qty,getPriceDecimalPlaces(saleUnit));
        el.textContent=total===null?"السعر غير متاح":formatBalancePrice(p,total);
        if(document.getElementById("balanceSubmitOrder")) document.getElementById("balanceSubmitOrder").disabled=total===null;
    }
    function updateProduct(index){
        const p=products[index];if(!p)return;
        selectedIndex=index;
        const n=document.getElementById("balanceSelectedName"),pr=document.getElementById("balanceSelectedPrice"),f=document.getElementById("balanceParamFields"),s=document.getElementById("balanceSubmitOrder");
        if(n)n.textContent=p.name||"اختر المنتج";
        if(pr){const unit=getBalanceSaleUnitPrice(p);pr.textContent=unit===null?"السعر غير متاح":formatBalancePrice(p,unit);}
        if(f)f.innerHTML=renderBalanceRequiredFields(p,group.title,products,index);
        renderQty(p);updateTotal();
        if(s){
            const q=qtyConfig(p);
            const input=document.getElementById("balanceOrderQty");
            const entered=input?Number(input.value):NaN;
            const qtyInvalid=q.enabled && (!Number.isFinite(entered)||entered<q.min||entered>q.max||((entered-q.min)%q.step)!==0);
            s.disabled=p.available===false||p.available===0||getBalanceSaleUnitPrice(p)===null||qtyInvalid;
        }
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
        const selectedQtyConfig=qtyConfig(p);
        if(selectedQtyConfig.enabled && (!Number.isInteger(qty)||qty<selectedQtyConfig.min||qty>selectedQtyConfig.max||((qty-selectedQtyConfig.min)%selectedQtyConfig.step)!==0)){
            invalid=true;
            if(qi) qi.classList.add("is-invalid");
        }
        if(invalid){showToast(isFixedTurkcellBundle?"يرجى إدخال رقم الهاتف بشكل صحيح.":(selectedQtyConfig.enabled?"الكمية المدخلة غير صحيحة لهذا المنتج.":"يرجى إدخال جميع المعلومات المطلوبة والكمية بشكل صحيح."));return;}
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
        const image = safeImageUrl(product.category_img || "");
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
        '<div class="empty-state"><div style="font-size:42px;margin-bottom:10px">🔐</div><h3>سجّل الدخول لإتمام الشراء</h3><p>يجب تسجيل الدخول إلى حسابك لمتابعة الشراء.</p><a class="buy-btn" href="/customer-login.html" style="display:inline-flex;text-decoration:none;align-items:center;justify-content:center;margin-top:12px">تسجيل الدخول</a></div>'
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

