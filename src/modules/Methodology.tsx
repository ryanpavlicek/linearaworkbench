import { useEffect, useMemo, useRef, useState } from "react";
// Bundle the canonical methodology doc as a raw string. Single source of truth:
// the same .md file is what GitHub serves, what citers can quote, and what the
// in-app module renders. No drift, no duplicate maintenance.
import methodologyMd from "../../docs/METHODOLOGY.md?raw";
import { renderMarkdown, scrollAnchorIntoView } from "../lib/markdown";
import { useWorkbench } from "../store/workbench";

const GITHUB_BLOB_BASE =
  "https://github.com/ryanpavlicek/linearaworkbench/blob/main";

export default function Methodology() {
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Render once — the doc is static and the render is pure.
  const { toc, content } = useMemo(
    () =>
      renderMarkdown(methodologyMd, {
        rewriteLink: (url) => {
          // GitHub-relative source-file links (../src/lib/algorithms.ts and
          // friends) — in-app we can't open source, so point them at the file
          // on github.com so the link still resolves to something useful.
          if (url.startsWith("../")) {
            return GITHUB_BLOB_BASE + "/" + url.replace(/^\.\.\//, "");
          }
          // Same-doc relative paths (e.g. "docs/METHODOLOGY.md" referencing
          // siblings) get the same treatment.
          if (!url.startsWith("#") && !/^[a-z]+:/i.test(url)) {
            return GITHUB_BLOB_BASE + "/" + url.replace(/^\.\//, "");
          }
          return url;
        },
      }),
    [],
  );

  // Scroll-spy — track the heading whose top is just above the fold so the
  // TOC can highlight your current location as you read.
  useEffect(() => {
    function onScroll() {
      const root = contentRef.current;
      if (!root) return;
      let current: string | null = null;
      for (const t of toc) {
        const el = root.querySelector<HTMLElement>(`#${CSS.escape(t.id)}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top < 140) current = t.id;
        else break;
      }
      setActive(current);
    }
    onScroll();
    const scroller = contentRef.current?.closest("main") ?? window;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [toc]);

  // Filter the TOC live as the reader types. We don't filter the body — the
  // body stays intact so the reader can scan back/forth — but the TOC
  // collapses to just sections matching the query so jumping is easier in a
  // long doc.
  const filteredToc = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return toc;
    return toc.filter((t) => t.text.toLowerCase().includes(q));
  }, [toc, filter]);

  function jumpTo(id: string) {
    scrollAnchorIntoView(id);
    setActive(id);
    history.replaceState(null, "", "#" + id);
  }

  // Honor a target section on first paint — either from moduleIntent.focus
  // (the canonical cross-module pivot, e.g. CrossLinguistic's "open in
  // Methodology at #cross-linguistic-distance"), or from #anchor in the URL
  // (e.g. someone pasted a deep link). We retry on rAF a few times because
  // the lazy-loaded module + heavy markdown render can leave the heading
  // element absent from the DOM for a frame or two; the scroll silently
  // no-ops until then.
  useEffect(() => {
    const intent = useWorkbench.getState().moduleIntent;
    const target = intent?.focus || window.location.hash.slice(1);
    if (!target) return;
    // Retry on a short setTimeout schedule because the heading element may
    // not be in the DOM yet on the very first tick (cross-module pivot →
    // Suspense unfurls the lazy chunk → React commits → only then can we
    // query by id). requestAnimationFrame turned out unreliable for this
    // — its callback never fired in the pivot path, presumably starved by
    // the heavy initial render. setTimeout 50ms × up to 20 tries gets us
    // there in practice on the first or second attempt.
    let tries = 0;
    function attempt() {
      const el = document.getElementById(target);
      if (el) {
        jumpTo(target);
        return;
      }
      if (tries++ < 20) setTimeout(attempt, 50);
    }
    setTimeout(attempt, 0);
     
  }, []);

  return (
    <div className="panel methodology-panel">
      <div className="methodology-layout">
        <aside className="methodology-toc" aria-label="Methodology contents">
          <h4>Contents</h4>
          <input
            type="search"
            className="input"
            placeholder="Filter sections…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ fontSize: 12, padding: "4px 8px", marginBottom: 8 }}
          />
          <nav>
            {filteredToc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className={`methodology-toc-link methodology-toc-l${t.level}${active === t.id ? " active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  jumpTo(t.id);
                }}
              >
                {t.text}
              </a>
            ))}
            {filteredToc.length === 0 && (
              <div className="dim" style={{ fontSize: 12, padding: 8 }}>
                No sections match.
              </div>
            )}
          </nav>
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid var(--border)",
              fontSize: 11,
            }}
            className="dim"
          >
            Canonical source:{" "}
            <a
              href={`${GITHUB_BLOB_BASE}/docs/METHODOLOGY.md`}
              target="_blank"
              rel="noreferrer"
            >
              docs/METHODOLOGY.md
            </a>{" "}
            on GitHub.
          </div>
        </aside>
        <article className="methodology-doc" ref={contentRef}>
          {content}
        </article>
      </div>
    </div>
  );
}
