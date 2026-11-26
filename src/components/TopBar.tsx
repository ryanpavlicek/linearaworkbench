import { useMemo } from "react";
import { useWorkbench } from "../store/workbench";
import { SettingsPopover } from "./SettingsPopover";
import { ScopeControl } from "./ScopeControl";

interface TopBarProps {
  onToggleMobileNav?: () => void;
  mobileNavOpen?: boolean;
  onOpenPalette?: () => void;
}

export function TopBar({
  onToggleMobileNav,
  mobileNavOpen = false,
  onOpenPalette,
}: TopBarProps = {}) {
  const loaded = useWorkbench((s) => s.loaded);
  const corpus = useWorkbench((s) => s.corpus);
  const corpusSource = useWorkbench((s) => s.corpusSource);
  const annotations = useWorkbench((s) => s.annotations);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const nWords = useMemo(() => {
    let count = 0;
    for (const w of corpus.wordIndex.keys()) {
      if (w.includes("-")) count++;
    }
    return count;
  }, [corpus.wordIndex]);

  let meta = <>Loading…</>;
  if (loaded) {
    meta = (
      <>
        <b>{corpus.inscriptions.length}</b> inscriptions · <b>{nWords}</b>{" "}
        words · <b>{corpus.signs.length}</b> signs ·{" "}
        <b>{corpus.siteIndex.size}</b> sites
        {corpusSource && (
          <span
            className="tag tag-domain"
            style={{ marginLeft: 8, fontSize: 9 }}
            title={`Browsing a custom corpus (${corpusSource}). Reload without ?corpus= to return to the bundled corpus.`}
          >
            custom corpus
          </span>
        )}
      </>
    );
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={onToggleMobileNav}
        aria-label="Toggle module menu"
        aria-expanded={mobileNavOpen}
        title="Open module menu"
      >
        ☰
      </button>
      <h1>Linear A Research Workbench</h1>
      <div className="meta">{meta}</div>
      <div className="actions">
        {onOpenPalette && (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onOpenPalette}
            title="Open command palette (Ctrl+K)"
            aria-label="Open command palette"
          >
            ⌕ Search <span className="dim" style={{ marginLeft: 4, fontSize: 10 }}>⌘K</span>
          </button>
        )}
        {loaded && <ScopeControl />}
        {annotations.length > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setActive("annot")}
            title="Open Annotations module"
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "var(--gn)",
                marginRight: 6,
              }}
            />
            {annotations.length} annotation{annotations.length === 1 ? "" : "s"}
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => setActive("help")}
          title="How to use this workbench (?)"
        >
          ? Help
        </button>
        <SettingsPopover />
        <a
          className="btn btn-sm btn-outline"
          href="https://github.com/mwenge/lineara.xyz"
          target="_blank"
          rel="noopener noreferrer"
        >
          Corpus source
        </a>
      </div>
    </header>
  );
}
