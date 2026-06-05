import { useEffect, useState } from "react";
import {
  canonicalCommentaryId,
  commentaryUrl,
  COMMENTARY_BASE,
} from "../lib/helpers";
import {
  sanitizeCommentaryHtml,
  YOUNGER_ACADEMIA_URL,
} from "../lib/commentary";

// Inline renderer for the bundled per-inscription commentary HTML (originally
// from John Younger's KU site, mirrored via mwenge/lineara.xyz, served from
// public/upstream/commentary/). The files are old-school HTML — a header line
// then a <table> with line/statement/logogram/number/fraction columns plus
// some <font color="..."> annotations. The workbench renders them inline,
// themed to match the app, rather than requiring a click-out to raw HTML.
//
// Minimal sanitization: scripts / styles / event-handler attributes are
// stripped defensively in lib/commentary.ts, but the source files come from
// the workbench's own vetted bundle so the sanitizer is mostly belt-and-
// suspenders. Theming is done via container-scoped CSS overrides in
// styles.css under .commentary-panel so the workbench doesn't have to
// rewrite every <font> tag.
//
// Caveat surfaced in-panel: the commentary mirror is a pre-2024 snapshot.
// Younger has since reorganized his material onto academia.edu — link
// included so the researcher can get to the current version with one click.
// For a standalone browse/search surface over all 1,694 commentary docs,
// see the Commentary Browser module.

// Cache fetched commentary bodies so re-opening the same inscription doesn't
// re-hit the network. Keyed by canonical commentary id (HT6a → HT6).
const cache = new Map<string, string | null>();

export function CommentaryPanel({ inscriptionId }: { inscriptionId: string }) {
  const canonical = canonicalCommentaryId(inscriptionId);
  const [html, setHtml] = useState<string | null | undefined>(
    cache.has(canonical) ? cache.get(canonical) : undefined,
  );

  useEffect(() => {
    if (cache.has(canonical)) {
      setHtml(cache.get(canonical) ?? null);
      return;
    }
    let cancelled = false;
    setHtml(undefined);
    fetch(commentaryUrl(inscriptionId))
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        const cleaned = text ? sanitizeCommentaryHtml(text) : null;
        cache.set(canonical, cleaned);
        if (!cancelled) setHtml(cleaned);
      })
      .catch(() => {
        cache.set(canonical, null);
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canonical, inscriptionId]);

  return (
    <div
      style={{
        marginTop: 16,
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--gn)",
        borderRadius: 6,
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            font: "600 10px var(--sans)",
            color: "var(--gn)",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Commentary
        </span>
        <span className="dim" style={{ fontSize: 11 }}>
          {canonical !== inscriptionId ? (
            <>
              from <code>{canonical}.html</code> · covers fragment{" "}
              <code>{inscriptionId}</code>
            </>
          ) : (
            <>
              from <code>{canonical}.html</code>
            </>
          )}
        </span>
        <span style={{ flex: 1 }} />
        <a
          href={commentaryUrl(inscriptionId)}
          target="_blank"
          rel="noopener noreferrer"
          className="dim"
          style={{ fontSize: 10 }}
          title="Open this commentary file in a standalone tab"
        >
          standalone ↗
        </a>
      </div>

      {html === undefined && (
        <div className="dim" style={{ fontSize: 12 }}>
          Loading commentary…
        </div>
      )}
      {html === null && (
        <div className="dim" style={{ fontSize: 12 }}>
          No commentary file bundled for this inscription. Most fragments
          share a commentary page with their parent tablet (HT6a → HT6.html);
          this one didn't resolve. Try the parent ID directly via the URL{" "}
          <code>
            {COMMENTARY_BASE}/{canonical}.html
          </code>
          .
        </div>
      )}
      {html !== undefined && html !== null && (
        <>
          <div
            className="commentary-panel"
            // We trust the bundled HTML (it's our own mirrored content,
            // sanitized above); React's dangerouslySetInnerHTML is the only
            // way to inject pre-formatted markup like this.
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <div
            className="dim"
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px dashed var(--border)",
              fontSize: 11,
              fontStyle: "italic",
            }}
          >
            Commentary mirrored from Younger's pre-2024 KU-hosted site (via{" "}
            mwenge/lineara.xyz). Younger now publishes updated material as{" "}
            PDFs on{" "}
            <a
              href={YOUNGER_ACADEMIA_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              academia.edu
            </a>{" "}
            — check there for the most current readings.
          </div>
        </>
      )}
    </div>
  );
}
