import { useWorkbench } from "../store/workbench";
import { SettingsPopover } from "./SettingsPopover";
import { ScopeControl } from "./ScopeControl";

interface TopBarProps {
  onToggleMobileNav?: () => void;
}

export function TopBar({ onToggleMobileNav }: TopBarProps = {}) {
  const loaded = useWorkbench((s) => s.loaded);
  const corpus = useWorkbench((s) => s.corpus);
  const corpusSource = useWorkbench((s) => s.corpusSource);
  const annotations = useWorkbench((s) => s.annotations);
  const setActive = useWorkbench((s) => s.setActiveModule);

  let meta = <>Loading…</>;
  if (loaded) {
    const nWords = [...corpus.wordIndex.keys()].filter((w) =>
      w.includes("-"),
    ).length;
    meta = (
      <>
        <b>{corpus.inscriptions.length}</b> inscriptions · <b>{nWords}</b>{" "}
        words · <b>{corpus.signs.length}</b> signs ·{" "}
        <b>{corpus.siteIndex.size}</b> sites
        {corpusSource && (
          <span
            className="tag tag-domain"
            style={{ marginLeft: 8, fontSize: 9 }}
            title={`This session is browsing a custom corpus (${corpusSource}), not the bundled one. Reload without ?corpus= to go back.`}
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
        className="mobile-nav-toggle"
        onClick={onToggleMobileNav}
        aria-label="Open module menu"
        title="Open module menu"
      >
        ☰
      </button>
      <h1>Linear A Research Workbench</h1>
      <div className="meta">{meta}</div>
      <div className="actions">
        {loaded && <ScopeControl />}
        {annotations.length > 0 && (
          <button
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
