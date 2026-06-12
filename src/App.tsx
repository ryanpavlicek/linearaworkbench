import { Suspense, useEffect, useState } from "react";
import { useWorkbench } from "./store/workbench";
import { initUrlSync } from "./store/urlSync";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { FooterBar } from "./components/FooterBar";
import { DetailModal } from "./components/DetailModal";
import { PinRail } from "./components/PinRail";
import { CommandPalette } from "./components/CommandPalette";
import { CategoryBadge } from "./components/CategoryBadge";
import { ModuleErrorBoundary } from "./components/ModuleErrorBoundary";
import { EmbedCard } from "./components/EmbedCard";
import { MODULE_COMPONENTS } from "./modules/registry";
import { loadJson, saveJson } from "./lib/persistence";
import { WORKBENCH_VERSION } from "./lib/citations";
import { parsePermalink } from "./lib/permalink";

// ?embed=1#/i/<id> renders a chromeless single-tablet card for iframes.
// Resolved once at boot — an embed never becomes the full app or vice versa.
const EMBED_ID: string | null = (() => {
  if (!new URLSearchParams(window.location.search).has("embed")) return null;
  const p = parsePermalink(window.location.hash);
  return p?.detail?.kind === "inscription" ? p.detail.value : null;
})();

export function App() {
  const loaded = useWorkbench((s) => s.loaded);
  const loadError = useWorkbench((s) => s.loadError);
  const activeModule = useWorkbench((s) => s.activeModule);
  const intentSeq = useWorkbench((s) => s.intentSeq);
  const loadCorpus = useWorkbench((s) => s.loadCorpusFromUrl);
  const setActive = useWorkbench((s) => s.setActiveModule);
  const closeDetail = useWorkbench((s) => s.closeDetail);
  const undoLast = useWorkbench((s) => s.undoLast);
  const settings = useWorkbench((s) => s.settings);
  // Apply the chosen theme by setting data-theme on <html>, which the CSS
  // theme overrides key off. Defaults to dark.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme ?? "dark";
  }, [settings.theme]);
  // Honor the toggle literally: if the rail is set visible, reserve its
  // grid column. The PinRail component renders a hint when there are no
  // pins, and subscribes to `pins` itself, so App needn't watch them.
  const showRail = settings.pinRailVisible;
  // Mobile slide-in nav drawer. Ephemeral UI state — kept local.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Close the mobile nav whenever the active module changes (i.e. a
  // sidebar item was tapped). Avoids the drawer hanging open after nav.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeModule]);

  const loadCustomCorpus = useWorkbench((s) => s.loadCorpusFromCustomUrl);
  useEffect(() => {
    if (!loaded) {
      const base = import.meta.env.BASE_URL || "/";
      // ?corpus=<url> swaps in someone else's inscription JSON for this
      // session (a pyaegean dump, a colleague's export) — the bundled sign
      // inventory still applies. No param: the bundled corpus.
      const custom = new URLSearchParams(window.location.search).get("corpus");
      if (custom) loadCustomCorpus(custom, `${base}corpus/signs.json`);
      else loadCorpus(`${base}corpus/`);
    }
  }, [loaded, loadCorpus, loadCustomCorpus]);

  // URL ↔ store sync: module / detail / scope are shareable permalinks.
  // Embeds skip it — the card is read-only and owns no navigation.
  useEffect(() => {
    if (EMBED_ID) return;
    return initUrlSync();
  }, []);

  // One-shot what's-new note when the version changes underneath a
  // returning user. A fresh install stays quiet — it lands on the Home
  // page — so the toast only fires when a previous version was seen.
  const toastShow = useWorkbench((s) => s.toast_show);
  useEffect(() => {
    if (!loaded) return;
    const KEY = "last-seen-version";
    const prev = loadJson<string | null>(KEY, null);
    if (prev && prev !== WORKBENCH_VERSION) {
      toastShow(
        `Updated to v${WORKBENCH_VERSION} — the changelog lists what's new`,
      );
    }
    if (prev !== WORKBENCH_VERSION) saveJson(KEY, WORKBENCH_VERSION);
  }, [loaded, toastShow]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      if (e.key === "Escape") closeDetail();
      // Command palette — works from anywhere, including inputs (the chord
      // doesn't conflict with text editing).
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "/" && !inField) {
        e.preventDefault();
        setActive("search");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !inField) {
        e.preventDefault();
        undoLast();
      }
      // Help opens on either "?" (Shift+/) or "/" alone — most ergonomic.
      // Ctrl+/ already routes to Corpus Search above, so this only fires
      // when the modifier is absent.
      if (
        !inField &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === "?" || e.key === "/")
      ) {
        e.preventDefault();
        setActive("help");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActive, closeDetail, undoLast]);

  // Chromeless embed: just the card once the corpus is in.
  if (EMBED_ID) {
    return loaded ? (
      <EmbedCard id={EMBED_ID} />
    ) : (
      <div className="loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  // Fall back to the default module if a persisted activeModule id is no
  // longer valid (e.g. restored from a prior version that had a module since
  // removed/renamed) — guards against a blank screen on rehydrate.
  const ActiveModule = MODULE_COMPONENTS[activeModule] ?? MODULE_COMPONENTS.home;
  const appClass = [
    "app",
    showRail ? "with-pin-rail" : "",
    settings.compactTables ? "compact-tables" : "",
    mobileNavOpen ? "is-mobile-nav-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={appClass}>
      <TopBar onToggleMobileNav={() => setMobileNavOpen((o) => !o)} />
      <Sidebar />
      <div
        className="mobile-nav-backdrop"
        onClick={() => setMobileNavOpen(false)}
      />
      <main className="main">
        {loadError ? (
          <div className="loader" role="alert">
            <span>Corpus failed to load: {loadError}</span>
            <span className="dim" style={{ fontSize: 12 }}>
              Usually a network hiccup or an over-eager content blocker.
            </span>
            <button
              onClick={() => {
                const base = import.meta.env.BASE_URL || "/";
                const custom = new URLSearchParams(
                  window.location.search,
                ).get("corpus");
                if (custom) loadCustomCorpus(custom, `${base}corpus/signs.json`);
                else loadCorpus(`${base}corpus/`);
              }}
            >
              Retry
            </button>
          </div>
        ) : !loaded ? (
          <div className="loader">
            <div className="loader-spinner" />
            <span>Loading Linear A corpus…</span>
          </div>
        ) : (
          <>
            <CategoryBadge />
            <ModuleErrorBoundary resetKey={activeModule}>
              <Suspense
                fallback={
                  <div className="loader">
                    <div className="loader-spinner" />
                  </div>
                }
              >
                {/* Keyed by id + intent sequence: a pivot that lands on the
                    already-mounted component (same id, or an alias mapped to
                    the same tab wrapper) remounts it so the one-shot
                    moduleIntent is read. Plain sidebar navigation carries no
                    intent and never forces a spurious remount. */}
                <ActiveModule key={`${activeModule}:${intentSeq}`} />
              </Suspense>
            </ModuleErrorBoundary>
          </>
        )}
      </main>
      <PinRail />
      <FooterBar />
      <DetailModal />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
