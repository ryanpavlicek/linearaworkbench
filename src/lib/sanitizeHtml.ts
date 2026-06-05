// Robust HTML-fragment sanitizer built on the browser's own parser rather
// than regular expressions. Regex-based tag filtering is bypassable (malformed
// or nested tags, attribute tricks) — CodeQL flags it as `js/bad-tag-filter`
// for good reason — so this parses the markup with DOMParser, walks the tree,
// and removes active content structurally:
//
//   - dangerous elements (<script>, <style>, <iframe>, <object>, <embed>,
//     <link>, <meta>, <base>) are removed outright;
//   - every on* event-handler attribute is stripped;
//   - href / src / xlink:href values using the javascript: scheme are dropped.
//
// Returns the cleaned inner HTML. Browser-only (uses DOMParser); all callers
// run in the renderer. Used for the two places the app renders HTML it didn't
// just build itself: the bundled Younger commentary, and a finding's stored
// report HTML (which may have come from an imported backup file).

const DANGEROUS_ELEMENTS =
  "script, style, iframe, object, embed, link, meta, base, noscript";

export function sanitizeHtmlFragment(html: string): string {
  // text/html parsing never executes scripts or loads resources; it just
  // builds an inert document we can clean.
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll(DANGEROUS_ELEMENTS).forEach((el) => el.remove());

  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === "href" || name === "src" || name === "xlink:href") &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });

  // body.innerHTML also naturally drops any <html>/<head>/<body> wrappers the
  // source may have had, which the previous commentary sanitizer did by hand.
  return doc.body.innerHTML;
}
