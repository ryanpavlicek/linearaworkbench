import { useMemo } from "react";
import { useWorkbench } from "../store/workbench";
import { wordToPhonetic } from "./algorithms";
import type { Inscription, PhoneticOverrides, WordEntry } from "./types";

export interface MultiWordEntry {
  word: string;
  entry: WordEntry;
}

// Multi-sign words only (sign-1-sign-2-…) — these are the linguistic units of interest.
export function useMultiWords() {
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  return useMemo(() => {
    const list: MultiWordEntry[] = [];
    for (const [word, entry] of wordIndex) {
      if (word.includes("-")) list.push({ word, entry });
    }
    list.sort((a, b) => b.entry.count - a.entry.count);
    return list;
  }, [wordIndex]);
}

export function useInscriptionList() {
  return useWorkbench((s) => s.corpus.inscriptions);
}

export function useHypothesis(): PhoneticOverrides {
  return useWorkbench((s) => s.hypothesis);
}

export function w2p(word: string, overrides: PhoneticOverrides): string {
  return wordToPhonetic(word, overrides);
}

// Truncate large rendered lists with a friendly message.
export const MAX_ROWS = 300;

export function classifyToken(
  word: string,
): "word" | "numeral" | "ideogram" | "separator" | "text" {
  if (word === "𐄁") return "separator";
  if (/^[0-9¹²³⁴⁵⁶⁷⁸⁹⁰⅟₁₂₃₄₅₆₇₈₉₀≈]+$/.test(word)) return "numeral";
  if (
    !word.includes("-") &&
    ["OLE", "GRA", "VIN", "FIC", "AES", "AUR", "ARG"].includes(word)
  )
    return "ideogram";
  if (word.includes("-")) return "word";
  return "text";
}

export function downloadFile(
  name: string,
  content: string | Blob,
  type = "text/csv",
) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// True when the user has asked the OS/browser to minimize motion. Used to
// skip JS-driven animations (smooth map pan/zoom, force-graph settling)
// that CSS reduced-motion rules can't reach.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function describeInscription(i: Inscription): string {
  const parts = [i.support, i.scribe, i.findspot].filter(Boolean);
  return parts.join(" · ");
}

// Subscript digits (₂₃₄) in transliteration tokens are distinct Unicode
// codepoints. The build script normalizes them to ASCII digits in signs.json,
// so we mirror that normalization at lookup time.
export function normalizeSignLabel(label: string): string {
  return label.replace(/[₂₃₄]/g, (c) =>
    ({ "₂": "2", "₃": "3", "₄": "4" })[c] ?? c,
  );
}

// Base paths for upstream auxiliary content (commentary HTML, facsimile
// images, GORILA PDFs). The actual inscription corpus + sign data live in
// public/corpus/ and are always bundled — these paths are only used by
// the click-through Commentary ↗ link, the facsimile/photograph viewer,
// and the GORILA image-rights link.
//
// Default: local mirror under public/upstream/, which is committed to the
// repo and shipped with the GitHub Pages build. Makes the deployment
// completely self-contained — zero dependency on third-party hosting at
// runtime.
//
// To save repo size and fall back to upstream CDNs instead:
//   - Gitignore `public/upstream/` so it doesn't get committed
//   - Override via env var at build time:
//       VITE_ASSET_BASE=https://raw.githubusercontent.com/mwenge/lineara.xyz/master npm run build
//       VITE_COMMENTARY_BASE=https://lineara.xyz/commentary npm run build
const LOCAL_ASSETS = (() => {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  return `${base}/upstream`;
})();
const LOCAL_COMMENTARY = `${LOCAL_ASSETS}/commentary`;

export const ASSET_BASE: string =
  (import.meta.env.VITE_ASSET_BASE as string | undefined) ?? LOCAL_ASSETS;
export const COMMENTARY_BASE: string =
  (import.meta.env.VITE_COMMENTARY_BASE as string | undefined) ??
  LOCAL_COMMENTARY;

// The upstream commentary files are keyed by parent-tablet ID, not the
// per-fragment inscription ID. e.g. HT6a and HT6b both resolve to HT6.html,
// HT127fr.1 to HT127.html. This helper derives the canonical parent ID.
export function canonicalCommentaryId(inscriptionId: string): string {
  let id = inscriptionId;
  // Strip ".fr.N", "fr.N", ".tab.N", "tab.N" fragment indicators
  id = id.replace(/\.?(?:fr|tab)\.\d+$/i, "");
  // Strip ".bis" / "bis" annotations
  id = id.replace(/\.?bis$/i, "");
  // Strip trailing single lowercase letter that follows a digit
  // (HT6a → HT6, KH11b → KH11)
  id = id.replace(/(\d)[a-z]$/, "$1");
  // Strip "?" indicating uncertainty on the ID
  id = id.replace(/\?$/, "");
  return id;
}

export function commentaryUrl(inscriptionId: string): string {
  const canonical = canonicalCommentaryId(inscriptionId);
  return `${COMMENTARY_BASE}/${encodeURIComponent(canonical)}.html`;
}

// SigLA (https://sigla.phis.me/) keys its documents by space-separated IDs
// like "HT 1", "HT Wa 1001", "ARKH 1a". Our corpus IDs are collapsed
// ("HT1", "HTWa1001", "ARKH1a"). Insert spaces at the right transitions:
//   - between an uppercase letter and a following Title-case word
//     (HT|Wa → "HT Wa")
//   - between letters and digits (HT|1 → "HT 1")
// Verified against SigLA's published document index format.
export function siglaDocumentId(inscriptionId: string): string {
  return inscriptionId
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2");
}

export function siglaUrl(inscriptionId: string): string {
  return `https://sigla.phis.me/document/${encodeURIComponent(
    siglaDocumentId(inscriptionId),
  )}/`;
}

// SigLA's sign list (https://sigla.phis.me/sign-list.html) shows every sign
// with per-scribe variant drawings. The list uses SigLA's own codes
// (AB##/phon for AB-shared, A### for A-only) but rows look like "AB01/da" so
// the GORILA Linear-B value (`da`) and the SigLA code both appear. We don't
// maintain a GORILA-label → AB-number map (too brittle), so the link opens
// the sign list with a modern-browser "scroll to text" fragment for the
// sign's phonetic value — most browsers (Chrome, Edge, Safari 17+) will
// jump straight to the row. On older browsers it just lands at the top of
// the list and the user can Ctrl+F. Honest fallback rather than fragile
// guessed-at deep links.
export function siglaSignListUrl(signLabel?: string): string {
  const base = "https://sigla.phis.me/sign-list.html";
  if (!signLabel) return base;
  // Strip workbench-internal subscripts, lowercase to match SigLA's row format
  // ("AB01/da" — the bit after the slash is what we want to match against).
  const cleaned = signLabel
    .replace(/[₂₃₄]/g, (c) => ({ "₂": "2", "₃": "3", "₄": "4" })[c] ?? c)
    .replace(/^\*/, "") // *301 → 301 (matches "A301" in SigLA when prefixed below)
    .toLowerCase();
  // For star-prefixed A-only signs, SigLA codes them "A###" so the text
  // fragment should target that pattern.
  const isAOnly = /^\*?\d/.test(signLabel);
  const fragment = isAOnly ? `A${cleaned}` : `/${cleaned}`;
  return `${base}#:~:text=${encodeURIComponent(fragment)}`;
}

// Resolve any relative upstream path (e.g. "images/HT1-Facsimile.jpg",
// "papers/GORILA-Vol1.pdf#page=38") to a usable URL. Preserves fragments
// and pass-through any absolute URL the corpus might contain.
export function upstreamAsset(relative: string): string {
  if (!relative) return "";
  if (/^https?:\/\//i.test(relative)) return relative;
  const stripped = relative.replace(/^\/+/, "");
  return `${ASSET_BASE}/${stripped}`;
}
