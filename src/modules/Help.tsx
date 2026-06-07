import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { SECTIONS, GROUPS } from "./help/helpSections";
import type { Section } from "./help/helpPrimitives";

// Wrap matches of `query` in the live DOM under `root` with <mark> tags.
// Returns a list of inserted nodes so they can be cleaned up later.
function highlightInDom(root: HTMLElement, query: string): HTMLElement[] {
  const inserted: HTMLElement[] = [];
  if (!query.trim()) return inserted;
  const q = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.toLowerCase().includes(q))
        return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (
        !parent ||
        parent.tagName === "MARK" ||
        parent.tagName === "SCRIPT" ||
        parent.tagName === "STYLE"
      )
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets: Text[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    targets.push(n as Text);
    n = walker.nextNode();
  }
  for (const text of targets) {
    const value = text.nodeValue ?? "";
    const lower = value.toLowerCase();
    let cursor = 0;
    const frag = document.createDocumentFragment();
    while (cursor < value.length) {
      const found = lower.indexOf(q, cursor);
      if (found < 0) {
        frag.appendChild(document.createTextNode(value.slice(cursor)));
        break;
      }
      if (found > cursor)
        frag.appendChild(document.createTextNode(value.slice(cursor, found)));
      const mark = document.createElement("mark");
      mark.className = "help-hl";
      mark.textContent = value.slice(found, found + q.length);
      frag.appendChild(mark);
      inserted.push(mark);
      cursor = found + q.length;
    }
    text.parentNode?.replaceChild(frag, text);
  }
  return inserted;
}

function clearHighlights(marks: HTMLElement[]) {
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  }
}

export default function Help() {
  const [q, setQ] = useState("");
  const setActive = useWorkbench((s) => s.setActiveModule);
  const contentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) return SECTIONS;
    const u = q.toLowerCase();
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(u) ||
        s.keywords.toLowerCase().includes(u) ||
        s.group.toLowerCase().includes(u),
    );
  }, [q]);

  const filteredByGroup = useMemo(() => {
    const map = new Map<string, Section[]>();
    for (const g of GROUPS) map.set(g, []);
    for (const s of filtered) {
      const arr = map.get(s.group);
      if (arr) arr.push(s);
    }
    return map;
  }, [filtered]);

  function scrollTo(id: string) {
    const el = document.getElementById(`help-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Highlight matches in the rendered content after each query change.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const inserted = highlightInDom(root, q);
    return () => clearHighlights(inserted);
  }, [q, filtered]);

  return (
    <div className="panel" style={{ maxWidth: 1600 }}>
      <h2>How to Use</h2>
      <p className="panel-desc">
        Comprehensive guide to every feature in the workbench. Use the
        sidebar to jump to a section, or search by keyword.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Sticky table of contents */}
        <aside
          style={{
            position: "sticky",
            top: 0,
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            paddingRight: 8,
          }}
        >
          <input
            className="input"
            placeholder="Search help…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          />
          {GROUPS.map((g) => {
            const items = filteredByGroup.get(g) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={g} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    font: "600 9px var(--sans)",
                    color: "var(--text-faint)",
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    marginBottom: 4,
                  }}
                >
                  {g}
                </div>
                {items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "3px 8px",
                      borderRadius: 3,
                      color: "var(--text-dim)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--surface-1)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "")
                    }
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        {/* Content */}
        <div
          ref={contentRef}
          style={{
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            paddingRight: 8,
          }}
        >
          {filtered.length === 0 ? (
            <div className="card">
              <div className="dim">No help sections match "{q}".</div>
            </div>
          ) : (
            GROUPS.map((g) => {
              const items = filteredByGroup.get(g) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={g}>
                  <div
                    style={{
                      font: "600 11px var(--sans)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 1.4,
                      marginTop: 24,
                      marginBottom: 8,
                      paddingBottom: 4,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {g}
                  </div>
                  {items.map((s) => (
                    <section
                      key={s.id}
                      id={`help-${s.id}`}
                      style={{ scrollMarginTop: 16, marginBottom: 20 }}
                    >
                      <h2
                        style={{
                          font: "400 22px var(--serif)",
                          color: "var(--text)",
                          marginBottom: 4,
                        }}
                      >
                        {s.title}
                      </h2>
                      {s.body}
                    </section>
                  ))}
                </div>
              );
            })
          )}
          <div style={{ marginTop: 32, paddingBottom: 60 }}>
            <button
              className="btn btn-outline"
              onClick={() => setActive("search")}
            >
              ← Back to Corpus Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
