// Bring-your-own corpus: accept inscription data from outside the app —
// a ?corpus=<url> query parameter or a local file — and normalize it to
// the workbench's Inscription shape. Two input forms are accepted:
//
//   1. a plain JSON array of inscription records (the same shape as
//      public/corpus/inscriptions.json, with most fields optional), or
//   2. a schema-v1 corpus export (the object Data Export and api/v1
//      produce, with the records under `inscriptions`). Its renamed
//      fields are mapped back: `period` -> `context`, and the nested
//      `images` block -> the flat imagery fields, so the workbench's own
//      export re-imports losslessly.
//
// Missing fields get safe defaults so a minimal corpus — say, a pyaegean
// dump with just ids, words, and sites — loads with every module working.
// Entries with no id (or a duplicate id) are skipped and counted rather
// than failing the whole load.

import type { Inscription } from "./types";

export interface NormalizedCorpus {
  inscriptions: Inscription[];
  skipped: number;
  source: "array" | "export";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function linesOf(v: unknown): string[][] {
  if (!Array.isArray(v)) return [];
  return v
    .map((line) => strArray(line))
    .filter((line) => line.length > 0);
}

// The workbench renders translations 1:1 against words; pad or truncate so
// a partial gloss list can't shift against its words.
function alignTranslations(v: unknown, n: number): string[] {
  const t = strArray(v).slice(0, n);
  while (t.length < n) t.push("");
  return t;
}

/**
 * Normalize untrusted corpus JSON. Throws an Error with a human-readable
 * message when the input isn't usable at all; otherwise returns the
 * normalized inscriptions plus a count of skipped entries.
 */
export function normalizeCorpusJson(raw: unknown): NormalizedCorpus {
  let arr: unknown[];
  let source: "array" | "export" = "array";
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { inscriptions?: unknown }).inscriptions)
  ) {
    arr = (raw as { inscriptions: unknown[] }).inscriptions;
    source = "export";
  } else {
    throw new Error(
      "Expected a JSON array of inscriptions, or a workbench corpus export with an `inscriptions` array.",
    );
  }

  const out: Inscription[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const entry of arr) {
    const r = (entry ?? {}) as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : null;
    if (!id || seen.has(id)) {
      skipped++;
      continue;
    }
    const lines = linesOf(r.lines);
    const words = strArray(r.words);
    const finalWords = words.length > 0 ? words : lines.flat();
    if (finalWords.length === 0 && !str(r.transcription)) {
      skipped++;
      continue;
    }
    seen.add(id);
    // The schema-v1 export nests imagery under an `images` object
    // (facsimile/photograph/rights/rightsUrl); the legacy array shape
    // keeps the flat fields.
    const img =
      r.images && typeof r.images === "object" && !Array.isArray(r.images)
        ? (r.images as Record<string, unknown>)
        : null;
    out.push({
      id,
      site: str(r.site) || "Unknown",
      support: str(r.support) || "unknown",
      scribe: str(r.scribe),
      findspot: str(r.findspot),
      // The export writes the dating period as `period`; the legacy shape
      // (and the bundled corpus) calls it `context`.
      context: str(r.context) || str(r.period),
      name: str(r.name) || id,
      words: finalWords,
      translations: alignTranslations(r.translations, finalWords.length),
      lines: lines.length > 0 ? lines : [finalWords],
      glyphs: str(r.glyphs),
      transcription: str(r.transcription),
      facsimileImages: img
        ? strArray(img.facsimile)
        : strArray(r.facsimileImages),
      images: img ? strArray(img.photograph) : strArray(r.images),
      imageRights: img ? str(img.rights) : str(r.imageRights),
      imageRightsURL: img ? str(img.rightsUrl) : str(r.imageRightsURL),
    });
  }

  if (out.length === 0) {
    throw new Error(
      "No usable inscriptions found — every entry lacked an id or any text.",
    );
  }
  return { inscriptions: out, skipped, source };
}
