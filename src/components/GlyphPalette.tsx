import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useFocusTrap } from "../lib/useFocusTrap";
import { Glyph } from "./Glyph";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (query: string) => void;
  initialQuery?: string;
}

type Filter = "all" | "shared" | "aOnly";

// A click-to-assemble glyph keyboard. Users pick signs from the grid;
// they accumulate into a query like "KA-RU-*301" which gets handed back
// to the caller for use as a corpus search term.
export function GlyphPalette({ open, onClose, onPick, initialQuery }: Props) {
  const signs = useWorkbench((s) => s.corpus.signs);
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Reset selection state every time the palette is reopened
  useEffect(() => {
    if (open) {
      setSelected(initialQuery ? initialQuery.split("-") : []);
      setSearch("");
    }
  }, [open, initialQuery]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visible = useMemo(() => {
    return signs.filter((s) => {
      if (filter === "shared" && !s.sharedWithLinearB) return false;
      if (filter === "aOnly" && !s.linearAOnly) return false;
      if (search) {
        const u = search.toUpperCase();
        return (
          s.label.toUpperCase().includes(u) ||
          (s.phonetic && s.phonetic.toUpperCase().includes(u))
        );
      }
      return true;
    });
  }, [signs, filter, search]);

  useFocusTrap(open, rootRef);

  if (!open) return null;

  const queryString = selected.join("-");

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal"
        ref={rootRef}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760, maxHeight: "90vh" }}
      >
        <div className="modal-head">
          <div>
            <h3>Search by glyph</h3>
            <div className="meta">
              Click signs to assemble a search query. The result is plugged
              into Corpus Search.
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          {/* Query preview */}
          <div
            style={{
              padding: 10,
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              marginBottom: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              minHeight: 56,
            }}
          >
            {selected.length === 0 ? (
              <span className="dim" style={{ fontStyle: "italic" }}>
                No signs picked yet — tap any glyph below.
              </span>
            ) : (
              selected.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  onClick={() =>
                    setSelected((cur) =>
                      cur.filter((_, idx) => idx !== i),
                    )
                  }
                  title="Remove this sign"
                  style={{
                    display: "inline-flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    padding: "4px 8px",
                    background: "var(--ac-soft)",
                    border: "1px solid var(--ac)",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  <Glyph sign={s} size={22} />
                  <span
                    style={{
                      font: "500 10px var(--mono)",
                      color: "var(--ac)",
                    }}
                  >
                    {s}
                  </span>
                </button>
              ))
            )}
            <span style={{ flex: 1 }} />
            {selected.length > 0 && (
              <>
                <span
                  style={{
                    font: "500 12px var(--mono)",
                    color: "var(--text)",
                  }}
                >
                  → <b>{queryString}</b>
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setSelected([])}
                  title="Clear all picked signs"
                >
                  Clear
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    onPick(queryString);
                    onClose();
                  }}
                  title="Use this sign sequence as the corpus search query"
                >
                  Search
                </button>
              </>
            )}
          </div>

          {/* Filter & search controls */}
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <input
              className="input"
              placeholder="Filter by label or phonetic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
              {(
                [
                  ["all", "All"],
                  ["shared", "AB-shared"],
                  ["aOnly", "A-only"],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  className={`tab-btn${filter === k ? " active" : ""}`}
                  onClick={() => setFilter(k)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Sign grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))",
              gap: 4,
              maxHeight: "50vh",
              overflowY: "auto",
              padding: 4,
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
          >
            {visible.map((s) => (
              <button
                key={s.label}
                onClick={() => setSelected((cur) => [...cur, s.label])}
                title={
                  s.phonetic
                    ? `${s.label} /${s.phonetic}/  ×${s.total}`
                    : `${s.label} ×${s.total}`
                }
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  padding: 4,
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  minHeight: 52,
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget.style.borderColor = "var(--ac)"))
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget.style.borderColor = "var(--border)"))
                }
              >
                <Glyph sign={s.label} size={20} />
                <span
                  style={{
                    font: "500 9px var(--mono)",
                    color: "var(--text)",
                  }}
                >
                  {s.label}
                </span>
              </button>
            ))}
            {visible.length === 0 && (
              <div className="dim" style={{ padding: 12, gridColumn: "1/-1" }}>
                No signs match the current filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
