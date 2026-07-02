// HTML-fragment sanitizer for every place the app renders HTML it did not
// build itself: the bundled Younger commentary, a finding's stored report
// HTML (in-app and in the exported report file), and the research-note
// preview (all of which may carry content from an imported backup file).
// Each flows into dangerouslySetInnerHTML or an exported document, so this
// is a security trust boundary.
//
// Built on DOMPurify, the audited industry-standard sanitizer, rather than a
// hand-rolled DOM walk. A bespoke sanitizer cannot keep up with the bypass
// catalogue (control-char scheme obfuscation, data: URIs, SVG SMIL href
// animation, mutation XSS); DOMPurify is purpose-built for exactly this and is
// maintained against new vectors as they are discovered.

import DOMPurify from "dompurify";

export function sanitizeHtmlFragment(html: string): string {
  // DOMPurify strips active content (<script>, event-handler attributes, and
  // unsafe URL schemes incl. javascript:, data:text/html, and vbscript:, plus
  // SVG SMIL href animation) while keeping safe formatting / structural HTML.
  // FORBID_TAGS additionally drops <style> / <link> / <meta> / <base>, which have
  // no place in a sanitized fragment. Browser-only (uses the DOM); all callers
  // run in the renderer.
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "link", "meta", "base"],
  });
}
