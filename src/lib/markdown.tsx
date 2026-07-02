import { Fragment, type ReactNode } from "react";

// Tiny markdown renderer for the bundled METHODOLOGY.md. Covers the subset the
// doc actually uses: headings (##/###), paragraphs, fenced code blocks, tables
// with pipe alignment, bullet lists, horizontal rules, and inline bold /
// italic / code / links. Not a general GFM implementation — if we ever need
// one we should pull a dependency, but for one self-contained doc this avoids
// adding ~50 KB of parser to the bundle.
//
// Heading ids match the GitHub anchor algorithm (lowercase, strip non-word
// chars except space/hyphen, replace each space with a single hyphen — so
// "Sign → Unicode glyph derivation" → "sign--unicode-glyph-derivation"
// because the arrow drops out leaving two spaces), so the in-doc TOC links
// that were written by hand for GitHub continue to work in-app.

interface Opts {
  /** Rewrite a link URL before rendering — e.g. point GitHub-relative paths
   *  at github.com, or strip a known prefix. */
  rewriteLink?: (url: string) => string;
}

export interface TocEntry {
  id: string;
  level: number;
  text: string;
}

export interface RenderedMarkdown {
  toc: TocEntry[];
  content: ReactNode;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    // Drop punctuation, keep letters/digits/underscore/spaces/hyphens in any
    // script (GitHub's slugger keeps Unicode letters, so a Greek or Linear A
    // heading anchors the same here as it would on GitHub).
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .trim()
    .replace(/ /g, "-"); // each space → one hyphen, no collapse (matches GitHub)
}

// Scroll an in-doc anchor target into view. Two cross-browser gotchas drive
// the apparent over-engineering here:
//  - scrollIntoView({behavior:'smooth'}) is unreliable when the actual scroll
//    container is a non-root element (the app's <main> has overflow:auto).
//  - scrollTo({behavior:'smooth'}) on a custom scroller is silently ignored
//    in some browsers unless the container also has CSS scroll-behavior:smooth.
// So we walk up to the scroll container, compute the absolute offset, and
// scroll instantly. Reliability > polish for a doc TOC.
export function scrollAnchorIntoView(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const scroller =
    (el.closest("main") as HTMLElement | null) ??
    (document.scrollingElement as HTMLElement | null);
  if (!scroller) return;
  const elTop = el.getBoundingClientRect().top;
  const sTop = scroller.getBoundingClientRect().top;
  const offset = scroller.scrollTop + (elTop - sTop) - 16;
  scroller.scrollTo({ top: offset, behavior: "auto" });
}

// Render the inline syntax inside a paragraph / list item / table cell.
// Supports `code`, **bold**, *italic*, and [text](url). Nested formatting
// works inside bold/italic but the parser is line-based so don't go wild.
function renderInline(text: string, opts: Opts, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let buf = "";
  let key = 0;
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };
  while (i < text.length) {
    const rest = text.slice(i);
    // Inline code — backticks. No backticks allowed inside.
    let m = rest.match(/^`([^`]+)`/);
    if (m) {
      flush();
      out.push(<code key={`${keyBase}-c${key++}`}>{m[1]}</code>);
      i += m[0].length;
      continue;
    }
    // Bold **...**
    m = rest.match(/^\*\*([^*]+(?:\*[^*]+)*)\*\*/);
    if (m) {
      flush();
      out.push(
        <strong key={`${keyBase}-b${key++}`}>
          {renderInline(m[1], opts, `${keyBase}-b${key}`)}
        </strong>,
      );
      i += m[0].length;
      continue;
    }
    // Italic *...* — single asterisks. Require non-space first char so we
    // don't accidentally bold-up math formulas with asterisks.
    m = rest.match(/^\*(\S[^*]*?)\*/);
    if (m) {
      flush();
      out.push(
        <em key={`${keyBase}-i${key++}`}>
          {renderInline(m[1], opts, `${keyBase}-i${key}`)}
        </em>,
      );
      i += m[0].length;
      continue;
    }
    // Link [text](url) — also handles [text](#anchor) for in-page jumps.
    m = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (m) {
      flush();
      const [, label, rawUrl] = m;
      const href = opts.rewriteLink ? opts.rewriteLink(rawUrl) : rawUrl;
      const isAnchor = href.startsWith("#");
      const isExternal = /^https?:\/\//.test(href);
      out.push(
        <a
          key={`${keyBase}-a${key++}`}
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          onClick={
            isAnchor
              ? (e) => {
                  // Smooth-scroll within the doc instead of letting the
                  // browser jump (which would also push history).
                  e.preventDefault();
                  scrollAnchorIntoView(href.slice(1));
                  history.replaceState(null, "", href);
                }
              : undefined
          }
        >
          {renderInline(label, opts, `${keyBase}-a${key}`)}
        </a>,
      );
      i += m[0].length;
      continue;
    }
    buf += text[i];
    i++;
  }
  flush();
  return out;
}

type Block =
  | { kind: "heading"; level: number; id: string; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; lang?: string; text: string }
  | { kind: "list"; items: string[] }
  | {
      kind: "table";
      header: string[];
      rows: string[][];
      align: ("left" | "right" | "center")[];
    }
  | { kind: "hr" };

function parseBlocks(src: string): Block[] {
  const lines = src.split(/\r?\n/);
  const blocks: Block[] = [];
  // Duplicate headings dedupe GitHub-style: "notes", "notes-1", "notes-2" —
  // otherwise repeated headings collide and an in-page link can only reach
  // the first occurrence.
  const slugCounts = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || undefined;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: "code", lang, text: buf.join("\n") });
      continue;
    }
    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      const text = hm[2];
      const base = slugify(text);
      const seen = slugCounts.get(base) ?? 0;
      slugCounts.set(base, seen + 1);
      blocks.push({
        kind: "heading",
        level: hm[1].length,
        id: seen === 0 ? base : `${base}-${seen}`,
        text,
      });
      i++;
      continue;
    }
    // Horizontal rule
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }
    // Table — header row followed by a separator row of dashes/colons.
    if (
      /^\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\|[\s|:\-]+\|\s*$/.test(lines[i + 1])
    ) {
      const splitRow = (l: string) =>
        l
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const header = splitRow(line);
      const sep = splitRow(lines[i + 1]);
      const align = sep.map((s) => {
        if (s.startsWith(":") && s.endsWith(":")) return "center" as const;
        if (s.endsWith(":")) return "right" as const;
        return "left" as const;
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: "table", header, rows, align });
      continue;
    }
    // Bullet list — collect contiguous "- " or "* " lines, with simple
    // continuation support (a line indented under a bullet joins that bullet).
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        let item = lines[i].replace(/^[-*]\s/, "");
        i++;
        while (
          i < lines.length &&
          lines[i].length > 0 &&
          /^\s{2,}\S/.test(lines[i])
        ) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(item);
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    // Blank line — paragraph boundary, just skip.
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Paragraph — accumulate until we hit a blank line or a block opener.
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|```|[-*]\s|\|.*\|\s*$|-{3,}\s*$)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: buf.join(" ") });
  }
  return blocks;
}

export function renderMarkdown(src: string, opts: Opts = {}): RenderedMarkdown {
  const blocks = parseBlocks(src);
  const toc: TocEntry[] = blocks
    .filter(
      (b): b is { kind: "heading"; level: number; id: string; text: string } =>
        b.kind === "heading",
    )
    .map(({ id, level, text }) => ({ id, level, text }));
  const content = (
    <Fragment>
      {blocks.map((b, idx) => {
        if (b.kind === "heading") {
          const Tag = `h${b.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
          return (
            <Tag key={idx} id={b.id}>
              {renderInline(b.text, opts, `h${idx}`)}
            </Tag>
          );
        }
        if (b.kind === "p") {
          return <p key={idx}>{renderInline(b.text, opts, `p${idx}`)}</p>;
        }
        if (b.kind === "code") {
          return (
            <pre key={idx} className={b.lang ? `lang-${b.lang}` : undefined}>
              <code>{b.text}</code>
            </pre>
          );
        }
        if (b.kind === "list") {
          return (
            <ul key={idx}>
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, opts, `l${idx}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === "table") {
          return (
            <table key={idx}>
              <thead>
                <tr>
                  {b.header.map((c, j) => (
                    <th key={j} style={{ textAlign: b.align[j] }}>
                      {renderInline(c, opts, `t${idx}h${j}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, j) => (
                      <td key={j} style={{ textAlign: b.align[j] }}>
                        {renderInline(c, opts, `t${idx}r${ri}c${j}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (b.kind === "hr") return <hr key={idx} />;
        return null;
      })}
    </Fragment>
  );
  return { toc, content };
}
