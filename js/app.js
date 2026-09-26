const state = {
    products: [],
    productsLoaded: false,
    productsLoadingPromise: null,
    selectedCategory: "all",
    balance: 0,
    user: null,
    notifications: 0,
    searchQuery: ""
};

const BACKEND_URL = "";

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
    initializeDhikrTicker();
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
    { title:"ببجي موبايل", aliases:["pubg mobile","pubg","ببجي"], image:"https://play-lh.googleusercontent.com/Se7jR6A5R0Mk9ClaIguf46yi2K3k32JsqKb3gAtrktIh3JwnFfxrQRmG9GLvdMpbxbMrReUOxzDkStxGxNo-5Q=w240-h480" },
    { title:"Roblox Game", aliases:["roblox"], image:"https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b4/d9/fc/b4d9fc91-b318-ab14-4d2c-f6e067afb081/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/1024x1024wd.png" },
    { title:"جواكر", aliases:["جواكر","jawaker"] },
    { title:"Yalla Ludo", aliases:["yalla ludo","يلا لودو"] },
    { title:"Clash of Clans", aliases:["clash of clans","clash"], image:"https://static.wikia.nocookie.net/logopedia/images/c/cc/Clash_of_Clans_%28App_Icon%29.png/revision/latest?cb=20220625115343" },
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
    // استخدم صورة اللعبة الرسمية المرفقة مع منتجاتها أولًا،
    // مع الاحتفاظ بصورة الكتالوج كبديل عند عدم وجود صورة من الـAPI.
    return GAME_CATALOG.map(function(game) {
        const products = state.products.filter(function(product) {
            const match = findGameMatch(product);
            return match && match.title === game.title;
        });
        const productWithImage = products.find(function(product) {
            return String(product.category_img || "").trim();
        });

        return {
            title: game.title,
            image: game.image || (productWithImage && productWithImage.category_img) || "",
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

async function loadCachedGameImages(tiles) {
    const list = Array.isArray(tiles) ? tiles : [];
    if (!list.length) return;

    try {
        const response = await fetch("/assets/games/index.json", {
            headers: {Accept: "application/json"},
            cache: "force-cache"
        });
        if (!response.ok) return;

        const manifest = await response.json();
        if (!manifest || typeof manifest !== "object") return;

        list.forEach(function(tile) {
            const image = manifest[tile.title];
            if (!image) return;

            const card = document.querySelector(
                '.game-category-tile[data-game-title="' + CSS.escape(tile.title) + '"]'
            );
            if (!card) return;

            const imageBox = card.querySelector(".game-tile-image");
            if (!imageBox) return;

            imageBox.innerHTML =
                '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">';
        });
    } catch (error) {
        console.warn("تعذر تحميل صور الألعاب المحلية:", error);
    }
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

    // صفحة الألعاب تعتمد على الكتالوج المحلي، لذلك لا يوجد سبب لانتظار API.
    // نعرضها فورًا، ثم نجلب المنتجات في الخلفية عند اختيار لعبة.
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

    // استبدل الصور الخارجية بالصور المحلية التي يتم توليدها أثناء بناء المشروع.
    loadCachedGameImages(tiles);

    content.querySelectorAll(".game-category-tile").forEach(function(tile) {
        tile.addEventListener("click", async function() {
            const gameTitle = tile.getAttribute("data-game-title") || "اللعبة";

            if (!state.productsLoaded) {
                content.innerHTML =
                    '<div class="products-loading"><div class="loading-spinner"></div><p>جاري تحميل منتجات اللعبة...</p></div>';
                try {
                    await loadProducts();
                } catch (error) {
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
    const robloxImage = "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b4/d9/fc/b4d9fc91-b318-ab14-4d2c-f6e067afb081/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/1024x1024wd.png";
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
            const pubgImage = "https://play-lh.googleusercontent.com/Se7jR6A5R0Mk9ClaIguf46yi2K3k32JsqKb3gAtrktIh3JwnFfxrQRmG9GLvdMpbxbMrReUOxzDkStxGxNo-5Q=w240-h480";
            const imageHtml = isPubgGame(gameTitle)
                ? '<img src="' + pubgImage + '" alt="PUBG MOBILE" loading="lazy">'
                : (isRoblox
                    ? '<img src="' + robloxImage + '" alt="Roblox" loading="lazy">'
                    : (group.image
                    ? '<img src="' + escapeHtml(group.image) + '" alt="" loading="lazy">'
                    : '<span class="game-placeholder">🎮</span>'));

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
        return "ID";
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

function getPubgProductPrice(product) {
    const value = Number(product && product.price);
    if (Number.isFinite(value) && value >= 0) return value;

    const original = Number(product && product.original_price);
    return Number.isFinite(original) && original >= 0 ? original : 0;
}

function renderGameProductPicker(gameTitle, group) {
    const content = document.getElementById("internalPageContent");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content || !group) return;

    if (title) title.textContent = group.title;
    if (icon) icon.textContent = "🎮";

    const products = group.products || [];
    const availableProducts = products.filter(function(product) {
        return product.available !== false && product.available !== 0;
    });
    const firstProduct = availableProducts[0] || products[0] || null;

    const listHtml = products.map(function(product, index) {
        const available = product.available !== false && product.available !== 0;
        const price = formatMoney(getPubgProductPrice(product));
        return '<button class="pubg-option' + (available ? '' : ' is-disabled') + '" type="button" data-pubg-index="' + index + '"' +
            (available ? '' : ' disabled') + '>' +
            '<span class="pubg-option-name">' + escapeHtml(product.name || "منتج") + '</span>' +
            '<span class="pubg-option-price">' + price + '</span>' +
            (available ? '' : '<span class="pubg-option-status">غير متوفر</span>') +
            '</button>';
    }).join("");

    const robloxImage = "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b4/d9/fc/b4d9fc91-b318-ab14-4d2c-f6e067afb081/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/1024x1024wd.png";
    const image = isPubgGame(gameTitle)
        ? "https://play-lh.googleusercontent.com/Se7jR6A5R0Mk9ClaIguf46yi2K3k32JsqKb3gAtrktIh3JwnFfxrQRmG9GLvdMpbxbMrReUOxzDkStxGxNo-5Q=w240-h480"
        : (isRoblox
            ? ((firstProduct && firstProduct.category_img) || robloxImage)
            : (group.image || (firstProduct && firstProduct.category_img) || ""));
    const imageSource = image
        ? (String(image).startsWith("http") ? image : BACKEND_URL + image)
        : "";
    const imageHtml = imageSource
        ? '<img src="' + escapeHtml(imageSource) + '" alt="" loading="lazy">'
        : '<span class="game-placeholder">🎮</span>';

    content.innerHTML =
        '<div class="pubg-picker">' +
            '<button class="pubg-back" type="button" id="pubgBackToGroups">← العودة إلى التصنيفات</button>' +
            '<div class="pubg-picker-head">' +
                '<div class="pubg-picker-image">' + imageHtml + '</div>' +
                '<h2>' + escapeHtml(group.title) + '</h2>' +
                '<span>' + products.length + ' منتج</span>' +
            '</div>' +
            '<div id="pubgParamFields">' +
                (firstProduct ? renderGameParamFields(firstProduct) : '') +
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
            '<div class="pubg-selected-summary">' +
                '<span>السعر</span>' +
                '<strong id="pubgSelectedPrice">' + formatMoney(firstProduct ? getPubgProductPrice(firstProduct) : 0) + '</strong>' +
            '</div>' +
            '<button class="buy-btn pubg-submit" id="pubgSubmitOrder" type="button"' +
                (!firstProduct || (firstProduct.available === false || firstProduct.available === 0) ? ' disabled' : '') +
                '>إرسال الطلب <span>→</span></button>' +
        '</div>';

    let selectedIndex = firstProduct ? products.indexOf(firstProduct) : -1;

    function updateSelectedProduct(index) {
        const product = products[index];
        if (!product) return;
        selectedIndex = index;

        const selectedName = document.getElementById("pubgSelectedName");
        const selectedPrice = document.getElementById("pubgSelectedPrice");
        const fields = document.getElementById("pubgParamFields");
        const submit = document.getElementById("pubgSubmitOrder");

        if (selectedName) selectedName.textContent = product.name || "اختر المنتج";
        if (selectedPrice) selectedPrice.textContent = formatMoney(getPubgProductPrice(product));
        if (fields) fields.innerHTML = renderGameParamFields(product);

        if (submit) {
            submit.disabled = product.available === false || product.available === 0;
        }
    }

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

    document.addEventListener("click", function closeGameDropdown(event) {
        if (!select || select.contains(event.target)) return;
        if (options && !options.hidden) {
            options.hidden = true;
            if (trigger) {
                trigger.setAttribute("aria-expanded", "false");
                trigger.classList.remove("is-open");
            }
        }
        document.removeEventListener("click", closeGameDropdown);
    });

    const submit = document.getElementById("pubgSubmitOrder");
    if (submit) {
        submit.addEventListener("click", function() {
            const product = products[selectedIndex];
            if (!product) return;
            submitGamePickerOrder(product, document.getElementById("pubgPicker"));
        });
    }

    const picker = content.querySelector(".pubg-picker");
    if (picker) picker.id = "pubgPicker";

    window.scrollTo({top: 0, behavior: "smooth"});
}

function renderGameParamFields(product) {
    const params = getUsableProductParams(product);
    if (!params.length) return "";
    return params.map(function(label, index) {
        const safeLabel = escapeHtml(getDisplayParamLabel(label));
        return '<div class="pubg-field">' +
            '<label for="gameParam_' + index + '">' + safeLabel + '</label>' +
            '<input id="gameParam_' + index + '" data-game-param="' + escapeHtml(label) + '" type="text" autocomplete="off" placeholder="أدخل ' + safeLabel + '" required aria-required="true">' +
            '</div>';
    }).join("");
}

async function submitGamePickerOrder(product, root) {
    const params = {};
    const inputs = root ? root.querySelectorAll("[data-game-param]") : [];
    let invalid = false;

    inputs.forEach(function(input) {
        const label = input.getAttribute("data-game-param") || "";
        const value = String(input.value || "").trim();
        if (!value) {
            invalid = true;
            input.classList.add("is-invalid");
        } else {
            input.classList.remove("is-invalid");
            params[label] = value;
        }
    });

    if (invalid) {
        showToast("يرجى إدخال البيانات المطلوبة أولًا.");
        return;
    }

    const submit = root ? root.querySelector("#pubgSubmitOrder") : null;
    if (submit) submit.disabled = true;

    try {
        const response = await fetch(BACKEND_URL + "/api/orders", {
            method: "POST",
            headers: {"Accept":"application/json","Content-Type":"application/json"},
            body: JSON.stringify({product_id: product.id, params: params})
        });
        const data = await response.json();
        if (!response.ok || data.status === "ERROR") {
            throw new Error(data.message || "تعذر إنشاء الطلب");
        }
        if (data.balance !== undefined) updateBalance(data.balance);
        showToast("تم إرسال الطلب بنجاح.");
        if (root) {
            const inputsAfter = root.querySelectorAll("input");
            inputsAfter.forEach(function(input) { input.value = ""; });
        }
    } catch (error) {
        console.error("PUBG order error:", error);
        showToast(error.message || "تعذر إنشاء الطلب.");
    } finally {
        if (submit) submit.disabled = false;
    }
}

function openGameProductGroup(gameTitle, groupKey) {
    const content = document.getElementById("internalPageContent");
    const isRoblox = normalizeGameText(gameTitle).includes("roblox");
    const title = document.getElementById("internalPageTitle");
    const icon = document.getElementById("internalPageIcon");
    if (!content) return;

    const group = getGameGroups(gameTitle).find(function(item) {
        return item.key === groupKey;
    });

    if (!group) return;

    if (isPubgGame(gameTitle) || isRoblox) {
        renderGameProductPicker(gameTitle, group);
        return;
    }

    if (title) title.textContent = group.title;
    if (icon) icon.textContent = "🎮";

    content.innerHTML =
        '<div class="game-products-heading">' +
            '<strong>' + group.products.length + ' منتج</strong>' +
            '<span>' + escapeHtml(group.title) + '</span>' +
        '</div>' +
        '<div class="game-products-grid">' +
        group.products.map(function(product, index) {
            const available = product.available !== false && product.available !== 0;
            const price = Number(product.price) || 0;
            const robloxProductImage = "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b4/d9/fc/b4d9fc91-b318-ab14-4d2c-f6e067afb081/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/1024x1024wd.png";
            const image = product.category_img || "";
            const imageSource = isRoblox
                ? (image ? (String(image).startsWith("http") ? image : BACKEND_URL + image) : robloxProductImage)
                : image;
            const imageHtml = imageSource
                ? '<img src="' + escapeHtml(imageSource) + '" alt="' + (isRoblox ? 'Roblox' : '') + '" loading="lazy">'
                : '<span class="game-product-fallback">🛍️</span>';

            return '<article class="game-product-card ' + (available ? "" : "product-unavailable") + '">' +
                '<div class="product-icon">' + imageHtml + '</div>' +
                '<h3>' + escapeHtml(product.name || "منتج") + '</h3>' +
                '<div class="price">' + formatMoney(price) + '</div>' +
                '<button class="buy-btn game-product-buy" type="button" data-product-index="' + index + '"' +
                    (available ? '' : ' disabled') + '>' +
                    (available ? 'شراء' : 'غير متوفر') +
                '</button>' +
            '</article>';
        }).join("") +
        '</div>';

    content.querySelectorAll(".game-product-buy").forEach(function(button) {
        button.addEventListener("click", function() {
            const index = Number(button.getAttribute("data-product-index"));
            const product = group.products[index];
            if (product && product.available !== false && product.available !== 0) {
                openProductModal(product);
            }
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

async function loadProducts() {
    if (state.productsLoadingPromise) return state.productsLoadingPromise;

    if (elements.products) {
        elements.products.innerHTML = "<div class=\"products-loading\"><div class=\"loading-spinner\"></div><p>جاري تحميل الخدمات...</p></div>";
    }

    state.productsLoaded = false;
    state.productsLoadingPromise = (async function() {
        try {
            const controller = new AbortController();
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
            renderProducts();
            return state.products;
        } catch (error) {
            state.productsLoaded = false;
            console.error("Products load error:", error);
            if (elements.products) {
                elements.products.innerHTML = "<div class=\"products-loading\"><p>تعذر تحميل المنتجات حاليًا.</p><button class=\"buy-btn\" type=\"button\" id=\"retryProducts\">إعادة المحاولة</button></div>";
                const retry = document.getElementById("retryProducts");
                if (retry) retry.addEventListener("click", loadProducts, {once:true});
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
        const safeLabel = escapeHtml(getDisplayParamLabel(String(label || "البيانات")));
        return '<div class="order-field">' +
            '<label for="param_' + index + '">' + safeLabel + '</label>' +
            '<input id="param_' + index + '" type="text" placeholder="أدخل ' + safeLabel + '" autocomplete="off">' +
            '</div>';
    }).join("");

    const minQty = Number(product.qty_values?.min || 1);
    const maxQty = Number(product.qty_values?.max || 999999999);
    const price = Number(product.price) || 0;

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
                '<strong id="orderPrice">' + formatMoney(price) + '</strong>' +
            '</div>' +
            '<button class="buy-btn order-confirm-btn" id="confirmProductOrder" type="button">تأكيد عملية الشراء</button>' +
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