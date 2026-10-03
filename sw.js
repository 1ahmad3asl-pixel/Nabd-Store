const CACHE_VERSION = "nabd-static-v36";
const CACHE_NAME = CACHE_VERSION;
const PAGE_TTL = 0;
const ASSET_TTL = 7 * 24 * 60 * 60 * 1000;
const PRECACHE = ["/", "/index.html"];
const API_PREFIX = "/api/";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isAsset(url) {
  return url.origin === self.location.origin &&
    /\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?|avif)$/i.test(url.pathname);
}

function isPublicPage(request, url) {
  return request.mode === "navigate" &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith("/admin") &&
    !url.pathname.startsWith(API_PREFIX);
}

async function networkAndCache(request, cache) {
  const response = await fetch(request);
  if (response.ok && response.type !== "opaque") {
    const headers = new Headers(response.headers);
    headers.set("x-nabd-cached-at", String(Date.now()));
    const body = await response.clone().arrayBuffer();
    await cache.put(request, new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers
    }));
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // لوحة الإدارة وكل ملفاتها لا تستخدم Service Worker cache إطلاقًا.
  if (url.origin !== self.location.origin || url.pathname.startsWith(API_PREFIX) || url.pathname.startsWith("/admin")) return;

  if (isPublicPage(request, url) || isAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const ttl = isPublicPage(request, url) ? PAGE_TTL : ASSET_TTL;
      const cachedAt = cached ? Number(cached.headers.get("x-nabd-cached-at") || 0) : 0;
      const fresh = cached && cachedAt > 0 && (Date.now() - cachedAt < ttl);

      if (fresh) {
        // أسرع استجابة ممكنة: أظهر النسخة المخزنة فورًا، وجدّدها في الخلفية.
        event.waitUntil(networkAndCache(request, cache).catch(() => {}));
        return cached;
      }

      try {
        return await networkAndCache(request, cache);
      } catch (_) {
        return cached || Response.error();
      }
    })());
  }
});