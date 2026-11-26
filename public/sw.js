// Offline support. Install precaches the app shell, all built JS/CSS chunks
// (including lazy-loaded module chunks injected at build time), the corpus
// JSON, the web manifest, core fonts, and icons so every module works offline
// from the first visit onward. The upstream image/commentary/PDF mirror (~500 MB)
// loads on demand.
//
// Both VERSION and BUILT_ASSETS are stamped at build time by vite.config.ts
// using package.json version + a content hash of dist/assets/.
const VERSION = "__WORKBENCH_VERSION__";
const CACHE = `workbench-${VERSION}`;
const BUILT_ASSETS = __PRECACHE_ASSETS__;

// The shell document. Relative URLs resolve against the worker's own URL.
const SHELL = "./";

const PRECACHE = [
  "manifest.webmanifest",
  "corpus/inscriptions.json",
  "corpus/signs.json",
  "corpus/manifest.json",
  "corpus/commentary-index.json",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

function isCacheableBasic(res) {
  return Boolean(res && res.ok && (res.type === "basic" || res.type === "default"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // Cache the shell document under SHELL so navigation offline fallback hits.
      const shellRes = await fetch(SHELL, { cache: "no-cache" });
      if (!isCacheableBasic(shellRes)) {
        throw new Error(`precache: shell ${shellRes.status}`);
      }
      const html = await shellRes.clone().text();
      await cache.put(SHELL, shellRes);

      // Combine build-time chunk list (all lazy modules) with any HTML-referenced assets.
      const htmlAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => u.includes("assets/"));
      const assets = Array.isArray(BUILT_ASSETS)
        ? [...BUILT_ASSETS, ...htmlAssets]
        : htmlAssets;

      // Precache fonts.css and its declared woff2 files (Latin + Linear A).
      const cssUrl = new URL("fonts/fonts.css", self.location.href);
      const cssRes = await fetch(cssUrl, { cache: "no-cache" });
      if (!isCacheableBasic(cssRes)) {
        throw new Error(`precache: fonts.css ${cssRes.status}`);
      }
      const css = await cssRes.clone().text();
      await cache.put(cssUrl, cssRes);
      const fonts = [...css.matchAll(/url\(([^)]+)\)/g)]
        .map((m) => m[1].replace(/["']/g, ""))
        .filter((u) => !/(?:greek-ext|cyrillic|vietnamese)/i.test(u))
        .map((u) => new URL(u, cssUrl).href);

      const urls = [
        ...new Set(
          [...PRECACHE, ...assets, ...fonts].map(
            (u) => new URL(u, self.location.href).href,
          ),
        ),
      ];
      await cache.addAll(urls.map((u) => new Request(u, { cache: "no-cache" })));
    })(),
  );
});

// Allow the client to opt into activating a waiting worker cleanly on reload,
// avoiding mid-session chunk 404s for already-open tabs.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("workbench-") && key !== CACHE) {
          await caches.delete(key);
        }
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

  const scopePath = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;
  const relPath = url.pathname.slice(scopePath.length);

  // Never intercept local pyaegean bridge API requests.
  if (relPath.startsWith("api/local/")) return;

  // Navigation: network-first, updating the normalized SHELL entry on HTML success.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          const ct = res.headers.get("content-type") || "";
          if (isCacheableBasic(res) && ct.includes("text/html")) {
            await cache.put(SHELL, res.clone());
          }
          return res;
        } catch {
          const hit = await cache.match(SHELL);
          return hit ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Immutable content-hashed assets, fonts, icons, manifest: pure cache-first.
  const isImmutable =
    relPath.startsWith("assets/") ||
    relPath.startsWith("fonts/") ||
    relPath.startsWith("icons/") ||
    relPath === "manifest.webmanifest";
  if (isImmutable) {
    const cleanKey = new Request(url.origin + url.pathname);
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(cleanKey);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (isCacheableBasic(res)) {
            await cache.put(cleanKey, res.clone());
          }
          return res;
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Corpus JSON: stale-while-revalidate with event.waitUntil(refresh).
  if (relPath.startsWith("corpus/")) {
    const cleanKey = new Request(url.origin + url.pathname);
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(cleanKey);
        const refresh = fetch(req)
          .then(async (res) => {
            if (isCacheableBasic(res)) {
              await cache.put(cleanKey, res.clone());
            }
            return res;
          })
          .catch(() => null);
        if (hit) {
          event.waitUntil(refresh);
          return hit;
        }
        const fresh = await refresh;
        return fresh ?? Response.error();
      })(),
    );
  }
});
