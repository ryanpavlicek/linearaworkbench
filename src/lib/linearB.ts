// Linear A vs Linear B sign-frequency comparison.
//
// The Linear B side comes from the DAMOS corpus (Aurora 2015,
// damos.hf.uio.no — CC BY-NC-SA 4.0), via the damos-corpus.json dataset
// the pyaegean project decodes from the DAMOS public API. The license is
// NonCommercial, so the workbench NEVER bundles it: the user downloads
// the file and loads it locally; only the ~50-row aggregate (sign-value
// counts) is kept in the browser. Same posture as pyaegean's
// fetch-on-demand rule — NC data stays out of the Apache-2.0 artifact.
//
// The join key is the conventional phonetic value: Linear A's AB signs
// are matched to the Linear B syllabograms they are graphically
// identified with (KU ↔ ku). That identification is exactly the
// hypothesis the comparison probes, so the circularity caveat in
// METHODOLOGY is not optional reading.

import { PHONETIC_MAP } from "../data/phoneticMap";
import { isLexicalWord } from "../data/commodities";
import { normalizeSignLabel } from "./helpers";

// ─── DAMOS-side parsing ──────────────────────────────────────────────────

export interface LbFrequencies {
  /** dataset version from the file's _meta */
  version: string;
  generated: string;
  cite: string;
  /** syllabogram value (lowercase, e.g. "ku") → token count in words */
  counts: Record<string, number>;
  /** all sign tokens inside counted words (incl. starred signs) */
  totalSigns: number;
  /** multi-sign word tokens counted */
  wordTokens: number;
  docCount: number;
}

const LINE_LABEL_RE = /^\.[A-Za-z0-9]+\.?$/;
// A Linear B syllabogram value: 1–3 lowercase letters with an optional
// series digit (ro2, ra3, pte, dwe, a2), or an undeciphered *NN sign.
const LB_SYLLABOGRAM_RE = /^[a-z]{1,3}[0-9]?$/;
const LB_STARRED_RE = /^\*\d+[a-z]*$/;

// Normalize one transliteration piece: supraliteral quotes, editorial
// brackets and uncertainty marks, underdots (combining marks via NFD),
// unicode subscripts.
function cleanPiece(piece: string): string {
  let p = piece;
  if (p.length >= 2 && p.startsWith("'") && p.endsWith("'")) p = p.slice(1, -1);
  p = p.normalize("NFD").replace(/[̀-ͯ]/g, "");
  p = p.replace(/[[\]⟦⟧⌞⌟⌐¬?!⸤⸥]/g, "");
  p = p.replace(/₀/g, "0").replace(/₁/g, "1").replace(/₂/g, "2")
    .replace(/₃/g, "3").replace(/₄/g, "4").replace(/₅/g, "5")
    .replace(/₆/g, "6").replace(/₇/g, "7").replace(/₈/g, "8")
    .replace(/₉/g, "9");
  return p;
}

/**
 * Count Linear B syllabogram frequencies in a damos-corpus.json payload
 * (the pyaegean-hosted decode of DAMOS: `{_meta, documents:[{content…}]}`).
 *
 * Counting basis — mirrored on the Linear A side so the rates compare:
 * signs inside multi-sign WORD tokens only. Logograms (uppercase),
 * numerals, single-sign words, and pieces that don't parse as
 * syllabogram chains are skipped. Damaged-sign dots and editorial
 * brackets are stripped rather than excluded — DAMOS marks uncertainty
 * densely, and dropping every dotted sign would bias against worn
 * tablets.
 */
export function parseDamosFrequencies(payload: {
  _meta?: { version?: unknown; generated?: unknown; cite?: unknown };
  documents?: { content?: string }[];
}): LbFrequencies {
  const counts: Record<string, number> = {};
  let totalSigns = 0;
  let wordTokens = 0;
  const docs = payload.documents ?? [];
  for (const doc of docs) {
    const content = doc.content ?? "";
    for (const rawLine of content.split("\n")) {
      const pieces = rawLine.trim().split(/\s+/).filter(Boolean);
      let start = 0;
      if (pieces.length > 0 && LINE_LABEL_RE.test(pieces[0])) start = 1;
      for (let i = start; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece === "," || piece === "/") continue;
        const cleaned = cleanPiece(piece);
        if (!cleaned.includes("-")) continue;
        const parts = cleaned.split("-").filter(Boolean);
        if (parts.length < 2) continue;
        if (!parts.every((p) => LB_SYLLABOGRAM_RE.test(p) || LB_STARRED_RE.test(p)))
          continue;
        wordTokens++;
        for (const p of parts) {
          totalSigns++;
          if (LB_SYLLABOGRAM_RE.test(p)) counts[p] = (counts[p] ?? 0) + 1;
        }
      }
    }
  }
  const meta = payload._meta ?? {};
  return {
    version: String(meta.version ?? ""),
    generated: String(meta.generated ?? ""),
    cite: String(meta.cite ?? ""),
    counts,
    totalSigns,
    wordTokens,
    docCount: docs.length,
  };
}

// ─── Linear A side ───────────────────────────────────────────────────────

export interface LaValueCounts {
  /** phonetic value (lowercase) → token count + the AB labels behind it */
  byValue: Map<string, { count: number; labels: string[] }>;
  totalSigns: number;
}

/**
 * Token-weighted sign counts over the lexical multi-sign vocabulary,
 * keyed by each sign's conventional phonetic value (lowercased — the
 * Linear B join key). Signs without a conventional value still count
 * toward the total, so the two corpora's rates share a denominator
 * definition.
 */
export function linearASignValueCounts(
  words: readonly { word: string; count: number }[],
): LaValueCounts {
  const byValue = new Map<string, { count: number; labels: string[] }>();
  let totalSigns = 0;
  for (const { word, count } of words) {
    if (!isLexicalWord(word)) continue;
    for (const rawPart of word.split("-")) {
      totalSigns += count;
      const label = normalizeSignLabel(rawPart);
      const value = PHONETIC_MAP[label];
      if (!value) continue;
      const key = value.toLowerCase();
      let rec = byValue.get(key);
      if (!rec) {
        rec = { count: 0, labels: [] };
        byValue.set(key, rec);
      }
      rec.count += count;
      if (!rec.labels.includes(label)) rec.labels.push(label);
    }
  }
  return { byValue, totalSigns };
}

// ─── The divergence join ─────────────────────────────────────────────────

// Transliteration bridge for the join. PHONETIC_MAP writes phonological
// values — kwa/kwe for the labiovelar signs QA/QE, dza/dze/dzo for the
// affricate signs ZA/ZE/ZO — while Linear B transliteration (the DAMOS
// side) writes those same series with q and z: qa, qe, za, ze, zo. These
// five are the only divergent pairs in the intersection of the two
// alphabets; every other shared value (a … wo) is spelled identically on
// both sides, i.e. the DAMOS key for a shared sign is always its label
// lowercased. Without the bridge the whole q- and z-series silently drops
// out of the comparison (kwa can never equal qa).
export const LA_VALUE_TO_LB_TRANSLIT: Readonly<Record<string, string>> = {
  kwa: "qa",
  kwe: "qe",
  dza: "za",
  dze: "ze",
  dzo: "zo",
};

export interface DivergenceRow {
  /**
   * Shared phonetic value in the workbench's convention, e.g. "ku" or
   * "kwa"; joined to the DAMOS counts via LA_VALUE_TO_LB_TRANSLIT where
   * the Linear B transliteration spells it differently (kwa ↔ qa).
   */
  value: string;
  labels: string[]; // Linear A sign label(s) behind the value
  laCount: number;
  lbCount: number;
  laPer1000: number;
  lbPer1000: number;
  /** log₂ of the add-half-smoothed rate ratio; + = over-used in Linear A */
  logRatio: number;
}

export function buildLbDivergence(
  la: LaValueCounts,
  lb: LbFrequencies,
): DivergenceRow[] {
  const rows: DivergenceRow[] = [];
  if (la.totalSigns === 0 || lb.totalSigns === 0) return rows;
  for (const [value, rec] of la.byValue) {
    const lbCount = lb.counts[LA_VALUE_TO_LB_TRANSLIT[value] ?? value] ?? 0;
    if (lbCount === 0) continue; // not a shared attested value
    const laRate = rec.count / la.totalSigns;
    const lbRate = lbCount / lb.totalSigns;
    const smoothedLa = (rec.count + 0.5) / (la.totalSigns + 1);
    const smoothedLb = (lbCount + 0.5) / (lb.totalSigns + 1);
    rows.push({
      value,
      labels: rec.labels,
      laCount: rec.count,
      lbCount,
      laPer1000: laRate * 1000,
      lbPer1000: lbRate * 1000,
      logRatio: Math.log2(smoothedLa / smoothedLb),
    });
  }
  rows.sort((a, b) => Math.abs(b.logRatio) - Math.abs(a.logRatio));
  return rows;
}

// Spearman rank correlation with average ranks for ties. One number for
// "do the two scripts use the shared signary in the same proportions?"
export function spearmanRho(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return 0;
  const rank = (vals: readonly number[]) => {
    const idx = vals.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const ranks = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg;
      i = j + 1;
    }
    return ranks;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += rx[i];
    sy += ry[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx;
    const dy = ry[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0;
}
