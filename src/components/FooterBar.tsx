import { useEffect, useState } from "react";
import { useWorkbench } from "../store/workbench";
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
        <span>Ready</span>
        <span style={{ flex: 1 }} />
        <span>
          Corpus:{" "}
          <a
            href="https://github.com/mwenge/lineara.xyz"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--text-dim)" }}
          >
            mwenge/lineara.xyz
          </a>{" "}
          · GORILA (Godart & Olivier) ·{" "}
          <button
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
            title="What's loaded, where it came from, the count distinction, and how to cite it — one click"
          >
            ⓘ About
          </button>
        </span>
        <span style={{ flex: 1 }} />
        <span>
          Ctrl+K commands · Ctrl+/ search · Ctrl+Z undo · ? help · Esc close
        </span>
      </footer>
      {toast && (
        <div className={`toast${toast.tone === "error" ? " error" : ""}`}>
          {toast.message}
        </div>
      )}
      <AboutCorpus open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
