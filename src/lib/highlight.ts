// Wrap occurrences of a search term in <mark> inside an HTML string,
// touching only the text between tags — markup, attribute values, and
// entities pass through untouched. Used by the Commentary Browser so a
// full-text hit is visible inside the rendered doc, not just counted in
// the results list. Input is already-sanitized HTML.

const ENTITY_SPLIT = /(&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z][\w-]*);)/;

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function highlightHtml(html: string, term: string): string {
  const t = term.trim();
  if (!t) return html;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "gi");
  return html
    .split(/(<[^>]*>)/)
    .map((seg) => {
      if (seg.startsWith("<")) return seg;
      // Preserve HTML entities (&amp;, &nbsp;, &#160;) untouched so searching
      // "amp" or "nbsp" never corrupts entity markup.
      return seg
        .split(ENTITY_SPLIT)
        .map((piece) =>
          piece.startsWith("&") && piece.endsWith(";")
            ? piece
            : piece.replace(re, (m) => `<mark>${m}</mark>`),
        )
        .join("");
    })
    .join("");
}

// Tablet references in running text — "HT 13", "HT13", "PK Za 11",
// "HT 123+124a" — become clickable corpus links. Tracks open <a> tags so it
// never produces nested anchors, escapes data-ins/title attributes, and emits
// a real hash href so links are keyboard-focusable.
const REF_RE =
  /\b([A-Z]{2,4})\s?(Za|Zb|Zc|Zd|Ze|Zf|Zg|Wa|Wb|Wc|We|Wy)?\s?(\d+[a-z]?(?:\+\d+[a-z]?)?)\b/g;

export function linkifyTabletRefs(
  html: string,
  resolveId: (candidate: string) => string | null,
): string {
  let anchorDepth = 0;
  return html
    .split(/(<[^>]*>)/)
    .map((seg) => {
      if (seg.startsWith("<")) {
        if (/^<a(?:\s|>)/i.test(seg) && !/\/>$/.test(seg)) anchorDepth++;
        else if (/^<\/a(?:\s|>)/i.test(seg) && anchorDepth > 0) anchorDepth--;
        return seg;
      }
      if (anchorDepth > 0) return seg;
      return seg
        .split(ENTITY_SPLIT)
        .map((piece) => {
          if (piece.startsWith("&") && piece.endsWith(";")) return piece;
          return piece.replace(REF_RE, (m, p1: string, p2: string, p3: string) => {
            const id = resolveId(`${p1}${p2 ?? ""}${p3}`);
            if (!id) return m;
            const escId = escapeAttr(id);
            const href = `#/i/${encodeURIComponent(id)}`;
            return `<a class="word-link" href="${href}" data-ins="${escId}" title="Open ${escId} in the corpus">${m}</a>`;
          });
        })
        .join("");
    })
    .join("");
}
