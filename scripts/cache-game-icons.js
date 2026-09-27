const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const APP_FILE = path.join(ROOT, "js", "app.js");
const OUT_DIR = path.join(ROOT, "assets", "games");
const MANIFEST_FILE = path.join(OUT_DIR, "index.json");
const CACHE_DIR = process.env.XDG_CACHE_HOME
  ? path.join(process.env.XDG_CACHE_HOME, "nabd-store-game-icons")
  : null;
const CACHE_MANIFEST_FILE = CACHE_DIR ? path.join(CACHE_DIR, "index.json") : null;

function slugify(value) {
  const raw = String(value || "").trim();
  const base = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "game";
  const hash = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 10);
  return base + "-" + hash;
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\b(game|games|mobile|global|sea|eu|codes|code)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleScore(target, candidate) {
  const a = normalizeTitle(target);
  const b = normalizeTitle(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const at = new Set(a.split(" "));
  const bt = new Set(b.split(" "));
  let common = 0;
  for (const token of at) if (bt.has(token)) common++;

  const overlap = common / Math.max(1, Math.min(at.size, bt.size));
  if (a.includes(b) || b.includes(a)) return Math.max(0.9, overlap);
  return overlap;
}

function extractCatalog(source) {
  const catalog = [];
  const re = /\{\s*title:\s*"([^"]+)"\s*,\s*aliases:\s*\[([^\]]*)\]/g;
  let match;

  while ((match = re.exec(source))) {
    const aliases = [];
    const aliasRe = /"([^"]+)"/g;
    let alias;
    while ((alias = aliasRe.exec(match[2]))) aliases.push(alias[1].trim());

    const title = match[1].trim();
    if (title && !catalog.some(item => item.title === title)) {
      catalog.push({title, aliases});
    }
  }

  return catalog;
}

function copyCachedIcons() {
  if (!CACHE_DIR || !fs.existsSync(CACHE_MANIFEST_FILE)) return {};
  try {
    fs.mkdirSync(OUT_DIR, {recursive: true});
    const cached = JSON.parse(fs.readFileSync(CACHE_MANIFEST_FILE, "utf8"));
    if (!cached || typeof cached !== "object") return {};
    for (const url of Object.values(cached)) {
      if (typeof url !== "string" || !url.startsWith("/assets/games/")) continue;
      const filename = path.basename(url);
      const source = path.join(CACHE_DIR, filename);
      const target = path.join(OUT_DIR, filename);
      if (fs.existsSync(source) && !fs.existsSync(target)) {
        fs.copyFileSync(source, target);
      }
    }
    return cached;
  } catch (error) {
    console.warn("[game-icon] cache restore failed:", error.message);
    return {};
  }
}

function saveIconCache(manifest) {
  if (!CACHE_DIR) return;
  try {
    fs.mkdirSync(CACHE_DIR, {recursive: true});
    fs.copyFileSync(MANIFEST_FILE, CACHE_MANIFEST_FILE);
    for (const url of Object.values(manifest)) {
      if (typeof url !== "string" || !url.startsWith("/assets/games/")) continue;
      const filename = path.basename(url);
      const source = path.join(OUT_DIR, filename);
      if (fs.existsSync(source)) fs.copyFileSync(source, path.join(CACHE_DIR, filename));
    }
  } catch (error) {
    console.warn("[game-icon] cache save failed:", error.message);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {...options, signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
}

function extractAppIds(html) {
  const ids = [];
  const re = /(?:https?:\/\/play\.google\.com)?\/store\/apps\/details\?id=([A-Za-z0-9._-]+)/g;
  let match;
  while ((match = re.exec(html)) && ids.length < 8) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

function extractMeta(html, property) {
  const re = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    if (String(match[1]).toLowerCase() === String(property).toLowerCase()) {
      return match[2]
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/\\u003d/g, "=")
        .replace(/\\u0026/g, "&");
    }
  }
  return "";
}

async function getPlayDetails(appId) {
  const url = "https://play.google.com/store/apps/details?id=" +
    encodeURIComponent(appId) + "&hl=en&gl=US";

  const response = await fetchWithTimeout(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; Nabd-Store build asset verifier)"
    }
  }, 10000);

  if (!response.ok) return null;

  const html = await response.text();
  const title = extractMeta(html, "og:title");
  const image = extractMeta(html, "og:image");
  if (!title || !image) return null;

  return {title, image};
}

async function findOfficialIcon(item) {
  const queries = [item.title].concat(item.aliases || []).filter(Boolean);
  const seenIds = new Set();
  let best = null;

  for (const query of queries) {
    const searchUrl =
      "https://play.google.com/store/search?q=" +
      encodeURIComponent(query) +
      "&c=apps&hl=en&gl=US";

    const response = await fetchWithTimeout(searchUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; Nabd-Store build asset verifier)"
      }
    }, 12000);

    if (!response.ok) continue;

    const html = await response.text();
    const ids = extractAppIds(html);

    for (const appId of ids) {
      if (seenIds.has(appId)) continue;
      seenIds.add(appId);

      try {
        const details = await getPlayDetails(appId);
        if (!details) continue;

        const score = Math.max(
          titleScore(item.title, details.title),
          ...(item.aliases || []).map(alias => titleScore(alias, details.title))
        );

        if (!best || score > best.score) {
          best = {score, appId, ...details};
        }

        // Only accept a clearly matching application. Never fall back to the
        // first image returned by Google Play search.
        if (score >= 0.9) {
          return details.image;
        }
      } catch (_) {
        // Try the next candidate.
      }
    }

    if (best && best.score >= 0.8) return best.image;
  }

  return best && best.score >= 0.75 ? best.image : null;
}

async function downloadImage(url) {
  const image = await fetchWithTimeout(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Nabd-Store build asset verifier)" }
  }, 10000);

  if (!image.ok) return null;

  const type = String(image.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("image/")) return null;

  const buffer = Buffer.from(await image.arrayBuffer());
  if (buffer.length < 1000) return null;

  let ext = "webp";
  if (type.includes("png")) ext = "png";
  else if (type.includes("jpeg") || type.includes("jpg")) ext = "jpg";

  return {buffer, ext};
}

async function main() {
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const source = fs.readFileSync(APP_FILE, "utf8");
  const catalog = extractCatalog(source);
  const manifest = Object.assign({}, copyCachedIcons());
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      Object.assign(manifest, JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8")));
    } catch (_) {}
  }

  // Older builds used "game.png" for every Arabic-only title, so several
  // different games overwrote one another. Remove those legacy collisions.
  for (const [title, url] of Object.entries(manifest)) {
    if (/\/assets\/games\/game\.(png|jpg|jpeg|webp)$/i.test(String(url))) {
      delete manifest[title];
    }
  }

  console.log("Verifying official game icons:", catalog.length);

  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];

    try {
      const officialUrl = await findOfficialIcon(item);
      if (!officialUrl) {
        console.warn("[game-icon] no confident match:", item.title);
        continue;
      }

      const result = await downloadImage(officialUrl);
      if (!result) {
        console.warn("[game-icon] image download failed:", item.title);
        continue;
      }

      const filename = slugify(item.title) + "." + result.ext;
      fs.writeFileSync(path.join(OUT_DIR, filename), result.buffer);
      manifest[item.title] = "/assets/games/" + filename;
      console.log("[game-icon]", i + 1 + "/" + catalog.length, item.title, "->", filename);
    } catch (error) {
      console.warn("[game-icon] failed:", item.title, "-", error.message);
    }
  }

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n");
  console.log("Game icon verification complete:", Object.keys(manifest).length + "/" + catalog.length);
}

main().catch(error => {
  console.error("Game icon verification failed:", error);
  process.exit(0);
});
