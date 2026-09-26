const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_FILE = path.join(ROOT, "js", "app.js");
const OUT_DIR = path.join(ROOT, "assets", "games");
const MANIFEST_FILE = path.join(OUT_DIR, "index.json");

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "game";
}

function extractTitles(source) {
  const titles = [];
  const re = /\{\s*title:\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(source))) {
    const title = match[1].trim();
    if (title && !titles.includes(title)) titles.push(title);
  }
  return titles;
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

async function findOfficialIcon(title) {
  const searchUrl =
    "https://play.google.com/store/search?q=" +
    encodeURIComponent(title) +
    "&c=apps&hl=en&gl=US";

  const response = await fetchWithTimeout(searchUrl, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; Nabd-Store build asset cache)"
    }
  });

  if (!response.ok) throw new Error("Google Play search HTTP " + response.status);

  const html = await response.text();
  const matches = [];
  const re = /https:\/\/play-lh\.googleusercontent\.com\/[^"'\\\s<]+/g;
  let match;

  while ((match = re.exec(html)) && matches.length < 20) {
    const imageUrl = match[0]
      .replace(/\\u003d/g, "=")
      .replace(/\\u0026/g, "&");

    if (!matches.includes(imageUrl)) matches.push(imageUrl);
  }

  for (const imageUrl of matches) {
    try {
      const image = await fetchWithTimeout(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Nabd-Store build asset cache)" }
      }, 10000);

      if (!image.ok) continue;

      const type = String(image.headers.get("content-type") || "").toLowerCase();
      if (!type.startsWith("image/")) continue;

      const buffer = Buffer.from(await image.arrayBuffer());
      if (buffer.length < 1000) continue;

      let ext = "webp";
      if (type.includes("png")) ext = "png";
      else if (type.includes("jpeg") || type.includes("jpg")) ext = "jpg";

      return {buffer, ext};
    } catch (_) {
      // Try the next official Play image candidate.
    }
  }

  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const source = fs.readFileSync(APP_FILE, "utf8");
  const titles = extractTitles(source);
  const manifest = {};

  console.log("Caching official game icons:", titles.length);

  // Keep build-time requests deliberately small and sequential so this never
  // becomes a runtime request storm for site visitors.
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    try {
      const result = await findOfficialIcon(title);
      if (!result) {
        console.warn("[game-icon] not found:", title);
        continue;
      }

      const filename = slugify(title) + "." + result.ext;
      fs.writeFileSync(path.join(OUT_DIR, filename), result.buffer);
      manifest[title] = "/assets/games/" + filename;
      console.log("[game-icon]", i + 1 + "/" + titles.length, title, "->", filename);
    } catch (error) {
      console.warn("[game-icon] failed:", title, "-", error.message);
    }
  }

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n");
  console.log("Game icon cache complete:", Object.keys(manifest).length + "/" + titles.length);
}

main().catch(error => {
  console.error("Game icon cache failed:", error);
  // Do not block deployment: existing catalog/product images remain valid fallbacks.
  process.exit(0);
});
