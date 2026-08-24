/* さくらマッチ: 静的アセットのオフライン閲覧用 Service Worker */
const CACHE_NAME = "sakura-senior-site-v75";
const CORE_ASSETS = [
  "./index.html",
  "./goals.html",
  "./analytics.html",
  "./manifest.webmanifest",
  "./SGroupGeneration.png",
  "./background.png",
  "./backgroundgold.png",
  "./SG.gif",
  "./style.css?v=sakura-site-v59",
  "./site-nav.css?v=sakura-site-v25",
  "./offline.css",
  "./trash-panel.css",
  "./goal-notice-overlay.css",
  "./match-notice-overlay.css",
  "./script.js?v=sakura-site-v61",
  "./offline-sync-core.js",
  "./offline-ui.js",
  "./trash-core.js",
  "./trash-ui.js",
  "./accordion.js",
  "./site-nav.js?v=sakura-site-v31",
  "./notify-core.js",
  "./goal-notice-overlay.js",
  "./match-notice-overlay.js",
];

function shouldUseNetworkFirst(url) {
  if (url.pathname.endsWith(".html")) return true;
  if (url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) return true;
  if (url.search.includes("v=sakura")) return true;
  return false;
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(cacheName).then((cache) => cache.put(req, copy));
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === "navigate") {
      const fallback = await caches.match("./index.html");
      if (fallback) return fallback;
    }
    throw new Error("offline");
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(cacheName).then((cache) => cache.put(req, copy));
  }
  return res;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
          return Promise.resolve();
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const useNetworkFirst =
    req.mode === "navigate" || shouldUseNetworkFirst(url);

  event.respondWith(
    useNetworkFirst ? networkFirst(req, CACHE_NAME) : cacheFirst(req, CACHE_NAME),
  );
});
