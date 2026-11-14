// Service worker: installable app + offline records.
// - Pages you open (home, records, traveller pages) and downloaded PDFs are saved
//   on this device and shown when there is no internet (network first, cache fallback).
// - App files and flag images are cached for speed.
// - Admin/account pages, sign-in and form submissions are never cached.
const VERSION = "v2";
const PAGES = `ih-pages-${VERSION}`;
const ASSETS = `ih-assets-${VERSION}`;

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0b1f3a;color:#f6f1e3;text-align:center;padding:24px}h1{color:#e8d49a;font-size:22px}a{color:#e8d49a}</style></head>
<body><div><h1>You are offline</h1><p>This page hasn't been saved on this device yet.<br>Pages you've opened before still work. <a href="/records">Open saved records</a></p></div></body></html>`;

const isPublicRecordPath = (path) =>
  path === "/" || path === "/records" || path.startsWith("/profiles/") || /^\/api\/profiles\/[^/]+\/pdf$/.test(path);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(["/", "/records"]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ih-") && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    throw new Error("offline");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const cache = await caches.open(ASSETS);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname === "flagcdn.com") {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Full page loads and PDF downloads of public record pages (not RSC data requests).
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (!isRsc && isPublicRecordPath(url.pathname)) {
    event.respondWith(networkFirst(request, PAGES));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
      ),
    );
  }
});
