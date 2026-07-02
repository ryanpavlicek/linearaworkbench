// Offline support. Install precaches the app shell — the document, the
// hashed JS/CSS bundles it references, the corpus JSON, the web manifest,
// fonts, and icons — so the workbench keeps working with no network from
// the first visit onward: fieldwork, teaching, archives. The big upstream
// mirror (commentary HTML, facsimile images, PDFs) is deliberately NOT
// precached (~500 MB); those load network-first and simply need a
// connection the first time each is viewed.
//
// The version placeholder is stamped with the app version at build time
// (vite.config.ts), so each release opens a fresh cache and `activate`
// prunes the previous release's entries.
const VERSION = "__WORKBENCH_VERSION__";
const CACHE = `workbench-${VERSION}`;
const RUNTIME = [/\/assets\//, /\/corpus\//, /\/fonts\//, /\/icons\//];

// The shell document. Relative URLs here and below resolve against the
// worker's own URL, which sits at the deploy base alongside index.html.
const SHELL = "./";

// The static shell files, enumerated from public/. The hashed JS/CSS
// bundles are parsed out of the built document at install time (their
// names change every build), and the font files are parsed out of
// fonts.css (its contents track scripts/fetch-fonts.mjs output).
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // The document, cached under the scope root the navigation handler
      // falls back to. no-cache so a new worker never precaches a stale
      // shell out of the HTTP cache.
      const shellRes = await fetch(SHELL, { cache: "no-cache" });
      if (!shellRes.ok) throw new Error(`precache: shell ${shellRes.status}`);
      const html = await shellRes.clone().text();
      await cache.put(SHELL, shellRes);

      // The hashed JS/CSS the document references (script src, stylesheet
      // + modulepreload links).
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => u.includes("assets/"));

      // The font files fonts.css declares.
      const cssUrl = new URL("fonts/fonts.css", self.location.href);
      const cssRes = await fetch(cssUrl, { cache: "no-cache" });
      if (!cssRes.ok) throw new Error(`precache: fonts.css ${cssRes.status}`);
      const css = await cssRes.clone().text();
      await cache.put(cssUrl, cssRes);
      const fonts = [...css.matchAll(/url\(([^)]+)\)/g)].map(
        (m) => new URL(m[1].replace(/["']/g, ""), cssUrl).href,
      );

      // Dedupe on the resolved URL; addAll rejects on any non-ok response,
      // so a broken deploy fails the install instead of caching errors.
      const urls = [
        ...new Set(
          [...PRECACHE, ...assets, ...fonts].map(
            (u) => new URL(u, self.location.href).href,
          ),
        ),
      ];
      await cache.addAll(urls.map((u) => new Request(u, { cache: "no-cache" })));
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Prune previous releases' caches. Scoped to the workbench prefix so
      // a shared origin (e.g. a *.github.io user domain) is left alone.
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

  // The document: network-first so a deploy lands on next load, with the
  // cached copy as the offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          // Only a good response replaces the cached shell — a 404/500
          // during a deploy window must not poison the offline fallback.
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          const hit =
            (await cache.match(req, { ignoreSearch: true })) ??
            (await cache.match(SHELL));
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
