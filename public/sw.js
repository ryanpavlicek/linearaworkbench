// Offline support. After the first visit the app shell, hashed assets,
// corpus JSON, and fonts all serve from a local cache, so the workbench
// keeps working with no network — fieldwork, teaching, archives. The big
// upstream mirror (commentary HTML, facsimile images, PDFs) is deliberately
// NOT precached (~500 MB); those load network-first and simply need a
// connection the first time each is viewed.
const CACHE = "workbench-v1";
const RUNTIME = [/\/assets\//, /\/corpus\//, /\/fonts\//, /\/icons\//];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The document: network-first so a deploy lands on next load, with the
  // cached copy as the offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          cache.put(req, res.clone());
          return res;
        } catch {
          const hit = await cache.match(req);
          return hit ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (!RUNTIME.some((re) => re.test(url.pathname))) return;

  // Assets, corpus, fonts: cache-first with a background refresh. Hashed
  // asset filenames make staleness a non-issue; the corpus revalidates so
  // a data update is one reload away.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (hit) return hit;
      const fresh = await refresh;
      return fresh ?? Response.error();
    })(),
  );
});
