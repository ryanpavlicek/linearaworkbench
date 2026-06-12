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
