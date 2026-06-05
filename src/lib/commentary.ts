// Shared helpers for the bundled Younger commentary HTML.
//
// The CommentaryPanel (inline render inside each inscription detail modal)
// and the CommentaryBrowser module (standalone search/browse surface) both
// fetch the same vetted HTML files from public/upstream/commentary/ and need
// the same sanitization pass and the same canonical academia.edu pointer.
// Anything that ought to behave identically across both surfaces lives here.

import { COMMENTARY_BASE } from "./helpers";

export const YOUNGER_ACADEMIA_URL =
  "https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction";

export const COMMENTARY_INDEX_URL = (() => {
  // Mirror the BASE_URL trick used in helpers.ts so dev/prod/GH-Pages all
  // resolve to the right path under the deployed sub-directory.
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  return `${base}/corpus/commentary-index.json`;
})();

/** Belt-and-suspenders sanitizer for the bundled commentary HTML. The source
 *  files are our own vetted mirror so this is defense-in-depth, not the
 *  primary trust boundary. Strips scripts, styles, event handlers, and the
 *  outer <html>/<body> wrappers (some files have them, some don't). */
export function sanitizeCommentaryHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/^[\s\S]*?<body[^>]*>/i, "")
    .replace(/<\/body>[\s\S]*$/i, "");
}

/** Fetch the raw HTML of a commentary file by its bundled filename
 *  (e.g. "HT1.html", "APZa1.html"). Returns sanitized HTML, or null on
 *  miss. Differs from helpers.commentaryUrl() in that this takes a
 *  filename directly rather than mapping an inscription id to a parent
 *  tablet id — the Browser is keyed by file, not by inscription. */
export async function fetchCommentaryFile(
  filename: string,
): Promise<string | null> {
  try {
    const r = await fetch(`${COMMENTARY_BASE}/${encodeURIComponent(filename)}`);
    if (!r.ok) return null;
    return sanitizeCommentaryHtml(await r.text());
  } catch {
    return null;
  }
}

export interface CommentaryDoc {
  /** Filename without .html, e.g. "HT1" or "APZa1" or "HT(_)Wc3022". */
  id: string;
  /** Leading site code: HT, ARKH, ZA, AP, CR, ... */
  site: string;
  /** Secondary classifier code (Za, Zb, Wc, ...) if the id encodes one. */
  type: string | null;
  /** Trailing numeric part as a Number for natural sort; null if absent. */
  num: number | null;
  /** Raw filename including .html — what fetch() needs. */
  filename: string;
  /** Pre-stripped, lowercased text content for full-text search. */
  text: string;
}

export interface CommentaryIndex {
  _meta: {
    generated: string;
    source: string;
    count: number;
    maxTextChars: number;
    note: string;
  };
  docs: CommentaryDoc[];
}

let cachedIndex: Promise<CommentaryIndex> | null = null;
/** Load and cache the commentary search index. Subsequent calls hit the cache. */
export function loadCommentaryIndex(): Promise<CommentaryIndex> {
  if (!cachedIndex) {
    cachedIndex = fetch(COMMENTARY_INDEX_URL).then((r) => {
      if (!r.ok) throw new Error(`commentary-index.json fetch failed: ${r.status}`);
      return r.json() as Promise<CommentaryIndex>;
    });
  }
  return cachedIndex;
}
