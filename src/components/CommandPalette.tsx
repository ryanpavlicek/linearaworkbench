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

// One palette result: a module to open, or a corpus entity to jump to —
// an inscription (opens its detail), a word (opens its detail), or a site
// (becomes the global scope).
type PaletteResult =
  | { kind: "module"; module: FlatModule; name: string; tag: string }
  | { kind: "inscription" | "word" | "site"; value: string; name: string; tag: string }
  | { kind: "command"; command: "random"; name: string; tag: string };

// Fuzzy-ish matching for modules: substring + initials, ranked so prefix
// matches come first.
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

// Cap per category so the corpus (1,721 ids, thousands of words) can't
// swamp the list; exact matches always surface first.
function matchKeys(
  keys: Iterable<string>,
  q: string,
  cap: number,
): string[] {
  const exact: string[] = [];
  const partial: string[] = [];
  for (const k of keys) {
    const K = k.toUpperCase();
    if (K === q) exact.push(k);
    else if (K.includes(q)) {
      if (partial.length < cap) partial.push(k);
    }
    if (exact.length + partial.length >= cap && exact.length > 0) break;
  }
  return [...exact, ...partial].slice(0, cap);
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const setActive = useWorkbench((s) => s.setActiveModule);
  const showInscription = useWorkbench((s) => s.showInscription);
  const showWord = useWorkbench((s) => s.showWord);
  const setScope = useWorkbench((s) => s.setScope);
  const corpus = useWorkbench((s) => s.corpus);
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

  const results = useMemo<PaletteResult[]>(() => {
    const scored: { m: FlatModule; s: number }[] = [];
    for (const m of ALL) {
      const s = score(query, m);
      if (s !== null) scored.push({ m, s });
    }
    scored.sort((a, b) => b.s - a.s || a.m.name.localeCompare(b.m.name));
    const out: PaletteResult[] = scored.map((x) => ({
      kind: "module",
      module: x.m,
      name: x.m.name,
      tag: x.m.group,
    }));
    // "Surprise me" for explorers — listed when idle or when typed for.
    if (!query.trim() || "random tablet".includes(query.trim().toLowerCase())) {
      out.push({
        kind: "command",
        command: "random",
        name: "🎲 Random tablet",
        tag: "Command",
      });
    }
    // Corpus entities join in once the query is specific enough.
    if (query.trim().length >= 2) {
      const q = query.trim().toUpperCase();
      for (const id of matchKeys(corpus.byId.keys(), q, 6)) {
        out.push({ kind: "inscription", value: id, name: id, tag: "Tablet" });
      }
      for (const w of matchKeys(corpus.wordIndex.keys(), q, 6)) {
        out.push({ kind: "word", value: w, name: w, tag: "Word" });
      }
      for (const s of matchKeys(corpus.siteIndex.keys(), q, 4)) {
        out.push({ kind: "site", value: s, name: s, tag: "Site → scope" });
      }
    }
    return out;
  }, [query, corpus]);

  // Keep highlight in range and scrolled into view
  useEffect(() => {
    if (highlight >= results.length) setHighlight(0);
  }, [results.length, highlight]);

  if (!open) return null;

  function choose(r: PaletteResult | undefined) {
    if (!r) return;
    if (r.kind === "module") setActive(r.module.id);
    else if (r.kind === "inscription") showInscription(r.value);
    else if (r.kind === "word") showWord(r.value);
    else if (r.kind === "command") {
      const ids = [...corpus.byId.keys()];
      if (ids.length) {
        showInscription(ids[Math.floor(Math.random() * ids.length)]);
      }
    } else setScope({ site: r.value });
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
          placeholder="Jump to a module, tablet, word, or site…"
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
              Nothing matches "{query}".
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.kind}:${r.kind === "module" ? r.module.id : r.kind === "command" ? r.command : r.value}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(r)}
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
                {r.name}
              </span>
              <span
                className="tag tag-domain"
                style={{ fontSize: 9, flexShrink: 0 }}
              >
                {r.tag}
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
