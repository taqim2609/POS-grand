/* Grand Aceh Kuliner POS — service worker
   Strategy: network-first with cache fallback for the app shell & same-origin
   static assets, so the app keeps opening (from cache) when the internet is
   down. API calls are ALWAYS network-only (never intercepted/cached) so that
   downloads (project zip, backups) and live data are never buffered or stale.
   The offline sales queue is handled by the app's own localStorage. */
const CACHE = "gak-pos-shell-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/", "/index.html", "/manifest.json"])).catch(() => {})
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ignore backend/API & cross-origin
  if (url.pathname.startsWith("/api/")) return;     // API is always network-only (no SW caching)

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
