import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useFocusTrap } from "../lib/useFocusTrap";
import { MODULE_GROUPS } from "../modules/registry";
import type { ModuleId } from "../lib/types";

interface FlatModule {
  id: ModuleId;
  name: string;
  group: string;
  keywords?: string;
}

const ALL: FlatModule[] = MODULE_GROUPS.flatMap((g) =>
  g.items.map((i) => ({
    id: i.id,
    name: i.name,
    group: g.group,
    keywords: i.keywords,
  })),
);

// Fuzzy-ish command palette for jumping to any of the modules by name.
// Substring + initials match, ranked so prefix matches come first.
function score(query: string, m: FlatModule): number | null {
  const q = query.toLowerCase();
  const name = m.name.toLowerCase();
  const group = m.group.toLowerCase();
  if (!q) return 0;
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 60;
  // initials, e.g. "cc" → "Co-occurrence" / "sc" → "Sign Concordance"
  const initials = m.name
    .split(/[\s()/-]+/)
    .map((w) => w[0]?.toLowerCase() ?? "")
    .join("");
  if (initials.startsWith(q)) return 50;
  if (m.keywords?.toLowerCase().includes(q)) return 40;
  if (group.includes(q)) return 30;
  return null;
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const setActive = useWorkbench((s) => s.setActiveModule);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, boxRef);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const scored: { m: FlatModule; s: number }[] = [];
    for (const m of ALL) {
      const s = score(query, m);
      if (s !== null) scored.push({ m, s });
    }
    scored.sort((a, b) => b.s - a.s || a.m.name.localeCompare(b.m.name));
    return scored.map((x) => x.m);
  }, [query]);

  // Keep highlight in range and scrolled into view
  useEffect(() => {
    if (highlight >= results.length) setHighlight(0);
  }, [results.length, highlight]);

  if (!open) return null;

  function choose(m: FlatModule | undefined) {
    if (!m) return;
    setActive(m.id);
    onClose();
  }

  return (
    <div
      className="modal-scrim"
      onClick={onClose}
      style={{ alignItems: "flex-start", paddingTop: "12vh" }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 94vw)",
          background: "var(--surface-0)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--r-lg)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <input
          className="input"
          autoFocus
          value={query}
          placeholder="Jump to module… (type a name or initials)"
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[highlight]);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          style={{
            width: "100%",
            border: "none",
            borderBottom: "1px solid var(--border)",
            borderRadius: 0,
            fontSize: 15,
            padding: "12px 14px",
          }}
        />
        <div
          ref={listRef}
          style={{ maxHeight: "55vh", overflowY: "auto", padding: 4 }}
        >
          {results.length === 0 && (
            <div className="dim" style={{ padding: 14, fontSize: 13 }}>
              No module matches "{query}".
            </div>
          )}
          {results.map((m, i) => (
            <div
              key={m.id}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(m)}
              ref={(el) => {
                if (i === highlight && el)
                  el.scrollIntoView({ block: "nearest" });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 12px",
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
                background: i === highlight ? "var(--ac-soft)" : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: i === highlight ? "var(--ac)" : "var(--text)",
                  fontWeight: i === highlight ? 600 : 400,
                }}
              >
                {m.name}
              </span>
              <span
                className="tag tag-domain"
                style={{ fontSize: 9, flexShrink: 0 }}
              >
                {m.group}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            padding: "6px 12px",
            borderTop: "1px solid var(--border)",
            fontSize: 10,
            color: "var(--text-muted)",
            fontFamily: "var(--mono)",
          }}
        >
          ↑↓ navigate · ⏎ open · esc close
        </div>
      </div>
    </div>
  );
}
