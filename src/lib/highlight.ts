// Wrap occurrences of a search term in <mark> inside an HTML string,
// touching only the text between tags — markup, attribute values, and
// entities pass through untouched. Used by the Commentary Browser so a
// full-text hit is visible inside the rendered doc, not just counted in
// the results list. Input is already-sanitized HTML.

export function highlightHtml(html: string, term: string): string {
  const t = term.trim();
  if (!t) return html;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "gi");
  return html
    .split(/(<[^>]*>)/)
    .map((seg) =>
      seg.startsWith("<")
        ? seg
        : seg.replace(re, (m) => `<mark>${m}</mark>`),
    )
    .join("");
}

// Tablet references in running text — "HT 13", "HT13", "PK Za 11",
// "HT 123+124a" — become clickable corpus links. Same text-only splitting
// as highlightHtml, and a candidate is linkified ONLY when `resolveId`
// maps it to a real corpus id, so prose that merely looks like a
// reference ("MM II", page numbers) never turns into a false link.
// Run this BEFORE highlightHtml so <mark> tags can't split a reference.
const REF_RE =
  /\b([A-Z]{2,4})\s?(Za|Zb|Zc|Zd|Ze|Zf|Zg|Wa|Wb|Wc|We|Wy)?\s?(\d+[a-z]?(?:\+\d+[a-z]?)?)\b/g;

export function linkifyTabletRefs(
  html: string,
  resolveId: (candidate: string) => string | null,
): string {
  return html
    .split(/(<[^>]*>)/)
    .map((seg) => {
      if (seg.startsWith("<")) return seg;
      return seg.replace(REF_RE, (m, p1: string, p2: string, p3: string) => {
        const id = resolveId(`${p1}${p2 ?? ""}${p3}`);
        return id
          ? `<a class="word-link" data-ins="${id}" title="Open ${id} in the corpus">${m}</a>`
          : m;
      });
    })
    .join("");
}
