import { useEffect, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import {
  buildInscriptionCitation,
  CITATION_STYLE_LABEL,
  type CitationStyle,
} from "../lib/citations";

// "Cite this tablet" — the unit a paper actually cites, available at the
// moment the researcher is looking at it. Picking a style copies the
// citation (GORILA as the edition of record + the workbench permalink,
// version- and date-pinned) to the clipboard.
export function CiteButton({ id, site }: { id: string; site?: string }) {
  const toast = useWorkbench((s) => s.toast_show);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function copy(style: CitationStyle) {
    const text = buildInscriptionCitation({ id, site }, style);
    setOpen(false);
    if (!navigator.clipboard) {
      toast("Copying needs a secure (https) context", "error");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast(`${CITATION_STYLE_LABEL[style]} citation copied`),
      () => toast("Couldn't copy the citation", "error"),
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        className="btn btn-outline btn-sm"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Copy a citation for this inscription — GORILA as the edition, plus this page's permalink pinned to version and access date"
      >
        Cite ▾
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 30,
            background: "var(--surface-0)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-sm)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
            minWidth: 120,
            padding: 4,
          }}
        >
          {(Object.keys(CITATION_STYLE_LABEL) as CitationStyle[]).map((s) => (
            <button
              key={s}
              role="menuitem"
              className="btn btn-sm"
              style={{ display: "block", width: "100%", textAlign: "left" }}
              onClick={() => copy(s)}
            >
              {CITATION_STYLE_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
