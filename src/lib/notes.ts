// Notes use plain Markdown for the body, with one special bit: links whose
// URL starts with a `wb:` scheme are *workbench references* to structured
// items the researcher has created or to corpus targets. They render as
// clickable chips in-app and as anchored links in the report export.
//
// Schemes:
//   wb:ins/<id>       inscription detail
//   wb:word/<word>    word detail
//   wb:sign/<label>   sign detail (opens Sign Inventory)
//   wb:annotation/<id>
//   wb:collection/<id>
//   wb:finding/<id>
//   wb:note/<id>

export type RefKind =
  | "ins"
  | "word"
  | "sign"
  | "annotation"
  | "collection"
  | "finding"
  | "note";

export interface NoteRef {
  kind: RefKind;
  value: string; // id or transliteration depending on kind
  label: string; // display label (the Markdown link text)
}

export const REF_PREFIX = "wb:";

export function refUrl(kind: RefKind, value: string): string {
  return `${REF_PREFIX}${kind}/${encodeURIComponent(value)}`;
}

export function parseRefUrl(url: string): { kind: RefKind; value: string } | null {
  if (!url.startsWith(REF_PREFIX)) return null;
  const rest = url.slice(REF_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  const kind = rest.slice(0, slash);
  const value = decodeURIComponent(rest.slice(slash + 1));
  if (
    kind === "ins" ||
    kind === "word" ||
    kind === "sign" ||
    kind === "annotation" ||
    kind === "collection" ||
    kind === "finding" ||
    kind === "note"
  )
    return { kind, value };
  return null;
}

// Markdown link form: [label](wb:kind/value)
export function refMarkdown(kind: RefKind, value: string, label: string): string {
  // Escape ] and ) in label / value to keep the link well-formed.
  const lbl = label.replace(/\]/g, "\\]");
  return `[${lbl}](${refUrl(kind, value)})`;
}

const LINK_RE = /\[([^\]]+)\]\((wb:[^)]+)\)/g;

/** Scan a note body and return every workbench reference it contains. */
export function noteRefs(body: string): NoteRef[] {
  const out: NoteRef[] = [];
  if (!body) return out;
  for (const m of body.matchAll(LINK_RE)) {
    const parsed = parseRefUrl(m[2]);
    if (parsed) out.push({ ...parsed, label: m[1] });
  }
  return out;
}

// ── Markdown rendering ────────────────────────────────────────────────────
// We intentionally implement a tiny subset rather than pull in a dependency:
// headings, paragraphs, **bold** / *italic* / `code`, bullet/numbered lists,
// > blockquote, and inline links (including our wb: refs). Anything more
// exotic just renders as literal text. Output is HTML-safe.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Inline pass: links (wb: and http), bold, italic, inline code.
export interface InlineOpts {
  // Caller-supplied renderer for wb: references — returns the HTML for the
  // chip. `label` arrives HTML-escaped (like every other text span this
  // renderer emits), so it is safe to interpolate into the chip markup
  // directly; `value` is the raw id/transliteration. Plain http(s) links get
  // rendered as normal <a target=_blank>.
  refHtml: (ref: { kind: RefKind; value: string; label: string }) => string;
}

function renderInline(text: string, opts: InlineOpts): string {
  // Tokenize links first so their bodies don't get bold/italic-mangled.
  let html = "";
  let i = 0;
  const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  LINK.lastIndex = 0;
  while ((m = LINK.exec(text))) {
    html += inlineFormat(escapeHtml(text.slice(i, m.index)));
    const label = m[1];
    const url = m[2];
    const parsed = parseRefUrl(url);
    if (parsed) {
      html += opts.refHtml({ ...parsed, label: escapeHtml(label) });
    } else if (/^https?:\/\//.test(url)) {
      html += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    } else {
      html += escapeHtml(m[0]);
    }
    i = m.index + m[0].length;
  }
  html += inlineFormat(escapeHtml(text.slice(i)));
  return html;
}

// Bold / italic / inline code on already-escaped text.
function inlineFormat(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\\])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

/**
 * Render a Markdown note body to HTML. Block-level: headings (# .. ######),
 * paragraphs, bullet lists (-), numbered lists (1.), blockquotes (>), blank
 * line = new block. Inline: see renderInline.
 */
export function renderNoteHtml(body: string, opts: InlineOpts): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2], opts)}</h${level}>`);
      i++;
      continue;
    }
    // Blockquote — gather consecutive `> ` lines
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderInline(buf.join(" "), opts)}</blockquote>`);
      continue;
    }
    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        `<ul>${items.map((it) => `<li>${renderInline(it, opts)}</li>`).join("")}</ul>`,
      );
      continue;
    }
    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(
        `<ol>${items.map((it) => `<li>${renderInline(it, opts)}</li>`).join("")}</ol>`,
      );
      continue;
    }
    // Paragraph: collect until blank line
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|>\s?|[-*]\s+|\d+\.\s+)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(buf.join("\n"), opts)}</p>`);
  }
  return out.join("\n");
}
