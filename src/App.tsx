import { Suspense, useEffect, useState } from "react";
import { useWorkbench } from "./store/workbench";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { FooterBar } from "./components/FooterBar";
import { DetailModal } from "./components/DetailModal";
import { PinRail } from "./components/PinRail";
import { Welcome } from "./components/Welcome";
import { CommandPalette } from "./components/CommandPalette";
import { CategoryBadge } from "./components/CategoryBadge";
import { MODULE_COMPONENTS } from "./modules/registry";

export function App() {
  const loaded = useWorkbench((s) => s.loaded);
  const loadError = useWorkbench((s) => s.loadError);
  const activeModule = useWorkbench((s) => s.activeModule);
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

  useEffect(() => {
    if (!loaded) {
      const base = import.meta.env.BASE_URL || "/";
      loadCorpus(`${base}corpus/`);
    }
  }, [loaded, loadCorpus]);

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

  // Fall back to the default module if a persisted activeModule id is no
  // longer valid (e.g. restored from a prior version that had a module since
  // removed/renamed) — guards against a blank screen on rehydrate.
  const ActiveModule = MODULE_COMPONENTS[activeModule] ?? MODULE_COMPONENTS.search;
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
          <div className="loader">
            <span>Corpus failed to load: {loadError}</span>
          </div>
        ) : !loaded ? (
          <div className="loader">
            <div className="loader-spinner" />
            <span>Loading Linear A corpus…</span>
          </div>
        ) : (
          <>
            <CategoryBadge />
            <Suspense
              fallback={
                <div className="loader">
                  <div className="loader-spinner" />
                </div>
              }
            >
              <ActiveModule />
            </Suspense>
          </>
        )}
      </main>
      <PinRail />
      <FooterBar />
      <DetailModal />
      <Welcome />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
