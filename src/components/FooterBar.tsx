import { useEffect, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { GORILA_CEFAEL_URL } from "../lib/citations";
import { AboutCorpus } from "./AboutCorpus";

export function FooterBar() {
  const toast = useWorkbench((s) => s.toast);
  const clear = useWorkbench((s) => s.toast_clear);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, 2400);
    return () => clearTimeout(t);
  }, [toast, clear]);

  return (
    <>
      <footer className="footer">
        <span className="footer-status">Ready</span>
        <span className="footer-spacer" style={{ flex: 1 }} />
        <span className="footer-attribution">
          Corpus:{" "}
          <a
            href="https://github.com/mwenge/lineara.xyz"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-dim)" }}
          >
            mwenge/lineara.xyz
          </a>{" "}
          ·{" "}
          <a
            href={GORILA_CEFAEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-dim)" }}
            title="The print edition, digitized — read the five GORILA volumes at CEFAEL (École française d'Athènes)"
          >
            GORILA (Godart &amp; Olivier)
          </a>{" "}
          ·{" "}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              color: "var(--ac)",
              cursor: "pointer",
              font: "inherit",
              textDecoration: "underline dotted",
            }}
            title="Corpus provenance, counts, and citations"
          >
            ⓘ About
          </button>
        </span>
        <span className="footer-spacer" style={{ flex: 1 }} />
        <span className="footer-shortcuts">
          Ctrl+K commands · Ctrl+/ search · Ctrl+Z undo · ? help · Esc close
        </span>
      </footer>
      {toast && (
        <div
          className={`toast${toast.tone === "error" ? " error" : ""}`}
          role={toast.tone === "error" ? "alert" : "status"}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
        >
          {toast.message}
        </div>
      )}
      <AboutCorpus open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
