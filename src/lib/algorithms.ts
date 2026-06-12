import { PHONETIC_MAP } from "../data/phoneticMap";
import type { PhoneticOverrides } from "./types";

// ─── Phonetic class scheme (researcher-configurable) ─────────────────────
// The weighted phonetic distance scores a substitution as cheap (vowel↔vowel
// or same-consonant-class) or expensive ("far"). WHICH phonemes count as
// vowels / same-class is partly a linguistic judgment call, so the genuinely
// ambiguous groupings are exposed to the researcher as a PhoneticScheme. The
// defaults reproduce the original behavior exactly; the Cross-Linguistic
// module lets a user change them and re-rank live.

export interface PhoneticClasses {
  vowels: string;
  consonantClasses: string[][];
}

// Base vowel set — plain a/e/i/o/u plus the long (macron), circumflex, and
// acute variants that appear in the comparison wordlists (Greek/PIE ō, ḗ, ṓ;
// acute ó/é). Not part of the configurable scheme: vowel membership was an
// unambiguous fix, not a judgment call.
const BASE_VOWELS = "aeiou" + "āēīōū" + "âêîôû" + "áéíóú" + "ḗṓ";

// Base consonant classes — Linear A's own inventory plus the "clear win"
// extensions that aren't in dispute (emphatic ṭ, palatovelars ḱ/ǵ, velar
// fricative ḫ). The contested members (interdentals ṯ/ḏ, pharyngeal ḥ,
// voiced postalveolar ž) are layered on per the active scheme. Index
// positions are referenced by buildPhoneticClasses, so keep them stable.
const BASE_CONSONANT_CLASSES: string[][] = [
  ["p", "b"], // 0 labials
  ["t", "d", "ṭ"], // 1 dentals/alveolars + emphatic ṭ
  ["k", "g", "q", "ḱ", "ǵ", "ḫ"], // 2 velars/uvulars + palatovelars + ḫ
  ["s", "z", "š", "ṣ"], // 3 sibilants
  ["m", "n", "ṇ"], // 4 nasals
  ["l", "r"], // 5 liquids
  ["j", "w"], // 6 glides
];
const CLASS_DENTAL = 1;
const CLASS_VELAR = 2;
const CLASS_SIBILANT = 3;

// The four genuinely-ambiguous decisions, exposed to the researcher.
export interface PhoneticScheme {
  interdentals: "dental" | "sibilant" | "off"; // ṯ ḏ (θ/ð)
  pharyngealH: "velar" | "off"; // ḥ
  voicedPostalveolar: "sibilant" | "off"; // ž
  stripNotation: boolean; // strip * ₁₂₃ ʰ ʷ ◌̥ from reference forms
}

// Default = the original behavior. Changing nothing leaves results identical.
export const DEFAULT_PHONETIC_SCHEME: PhoneticScheme = {
  interdentals: "dental",
  pharyngealH: "velar",
  voicedPostalveolar: "sibilant",
  stripNotation: true,
};

// Conservative = only the indisputable base classes; the contested phonemes
// score a full mismatch. For a researcher who wants no typological "help"
// beyond the clear wins.
export const CONSERVATIVE_PHONETIC_SCHEME: PhoneticScheme = {
  interdentals: "off",
  pharyngealH: "off",
  voicedPostalveolar: "off",
  stripNotation: true,
};

// Assemble concrete class tables from a scheme.
export function buildPhoneticClasses(
  scheme: PhoneticScheme = DEFAULT_PHONETIC_SCHEME,
): PhoneticClasses {
  const classes = BASE_CONSONANT_CLASSES.map((g) => [...g]);
  if (scheme.interdentals === "dental") classes[CLASS_DENTAL].push("ṯ", "ḏ");
  else if (scheme.interdentals === "sibilant")
    classes[CLASS_SIBILANT].push("ṯ", "ḏ");
  if (scheme.pharyngealH === "velar") classes[CLASS_VELAR].push("ḥ");
  if (scheme.voicedPostalveolar === "sibilant")
    classes[CLASS_SIBILANT].push("ž");
  return { vowels: BASE_VOWELS, consonantClasses: classes };
}

export const DEFAULT_PHONETIC_CLASSES: PhoneticClasses = buildPhoneticClasses(
  DEFAULT_PHONETIC_SCHEME,
);

// Build the bare comparison key for a reference word: drop hyphens (so
// syllables concatenate like the Linear A side) and lowercase. When
// stripNotation is on, also remove pure-notation marks with no segmental
// value on the Linear A side — the reconstruction asterisk, PIE laryngeal
// subscripts (₁₂₃), the labialization/aspiration modifier letters (ʰ ʷ), and
// the combining syllabic ring (U+0325, as in r̥). So PIE *ǵʰésr̥ → ǵésr.
export function referenceKey(rawWord: string, stripNotation = true): string {
  const s = stripNotation
    ? rawWord.replace(/[-*₁₂₃ʰʷ\u0325]/g, "")
    : rawWord.replace(/-/g, "");
  return s.toLowerCase();
}

// Short human-readable description of a scheme, for stamping into saved
// findings / reports so a match ranking stays reproducible.
export function describePhoneticScheme(s: PhoneticScheme): string {
  return (
    `interdentals=${s.interdentals}, ḥ=${s.pharyngealH}, ` +
    `ž=${s.voicedPostalveolar}, strip-notation=${s.stripNotation ? "on" : "off"}`
  );
}

const isVowelIn = (c: string, cl: PhoneticClasses) => cl.vowels.includes(c);
const sameClassIn = (x: string, y: string, cl: PhoneticClasses) =>
  cl.consonantClasses.some((g) => g.includes(x) && g.includes(y));

// Tunable substitution / indel costs for the weighted phonetic edit distance.
// Defaults reproduce the original fixed behavior. Kept in [0,1] so the
// length-normalized distance stays in [0,1] (the score is 1 − distance).
export interface PhoneticWeights {
  vowel: number; // vowel ↔ vowel substitution
  sameClass: number; // same articulatory-class consonant substitution
  far: number; // any other substitution
  indel: number; // insertion / deletion
}
export const DEFAULT_WEIGHTS: PhoneticWeights = {
  vowel: 0.3,
  sameClass: 0.5,
  far: 1,
  indel: 1,
};
function subCost(
  ai: string,
  bj: string,
  w: PhoneticWeights,
  cl: PhoneticClasses = DEFAULT_PHONETIC_CLASSES,
): number {
  if (ai === bj) return 0;
  if (isVowelIn(ai, cl) && isVowelIn(bj, cl)) return w.vowel;
  if (sameClassIn(ai, bj, cl)) return w.sameClass;
  return w.far;
}

// Convert a hyphenated Linear A word to its phonetic Latin form using the
// active sign→sound map. Unknown signs fall through as lowercased text.
export function wordToPhonetic(
  word: string,
  overrides: PhoneticOverrides = {},
): string {
  const map = { ...PHONETIC_MAP, ...overrides };
  return word
    .split("-")
    .map((s) => {
      const cleaned = s.replace(/[₂₃₄*]/g, "");
      return map[cleaned] ?? s.toLowerCase();
    })
    .join("");
}

// Weighted Levenshtein over phonetic strings. Substitutions between vowels
// cost 0.3, same-class consonants cost 0.5, everything else 1. Result is
// normalized to [0,1] by dividing by the longer string length.
export function phoneticDistance(
  a: string,
  b: string,
  w: PhoneticWeights = DEFAULT_WEIGHTS,
  cl: PhoneticClasses = DEFAULT_PHONETIC_CLASSES,
): number {
  const m = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) m[i][0] = i * w.indel;
  for (let j = 0; j <= b.length; j++) m[0][j] = j * w.indel;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(
        m[i - 1][j] + w.indel,
        m[i][j - 1] + w.indel,
        m[i - 1][j - 1] + subCost(a[i - 1], b[j - 1], w, cl),
      );
    }
  }
  return m[a.length][b.length] / Math.max(a.length, b.length, 1);
}

// Consonant skeleton — drop vowels, lowercase. Used for root-cognate grouping.
// Uses the same base vowel set as the distance metric so the two stay in
// sync. (Skeletons only ever see Linear A phonetic forms, which contain
// plain a/e/i/o/u, so the accented variants never actually appear here — but
// sharing the set prevents future drift.)
const VOWEL_STRIP_RE = new RegExp(`[${BASE_VOWELS}]`, "g");
export function extractRoot(word: string, overrides?: PhoneticOverrides): string {
  return wordToPhonetic(word, overrides).replace(VOWEL_STRIP_RE, "");
}

const TOKEN_DIGITS = /^[0-9¹²³⁴⁵⁶⁷⁸⁹⁰⅟₁₂₃₄₅₆₇₈₉₀≈𐄁]+$/;
export const isNumeralToken = (w: string) => TOKEN_DIGITS.test(w);

// ─── Statistical helpers ────────────────────────────────────────────────
// Polynomial approximation of erf accurate to ~1.5×10⁻⁷ (Abramowitz &
// Stegun 7.1.26). Used to compute chi-squared p-values.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * ax);
  const y =
    1.0 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

const erfc = (x: number) => 1 - erf(x);

// Log of the gamma function (Lanczos approximation). For log-factorial,
// use lgamma(n + 1).
function lgamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let sum = 1.000000000190015;
  for (let i = 0; i < 6; i++) sum += c[i] / (x + i + 1);
  return (
    Math.log((2.5066282746310005 * sum) / x) +
    (x + 0.5) * Math.log(x + 5.5) -
    (x + 5.5)
  );
}

const lfact = (n: number) => lgamma(n + 1);
const lnChoose = (n: number, k: number) =>
  lfact(n) - lfact(k) - lfact(n - k);

// 2×2 contingency table for word pair (a, b) across N documents:
//   a11 = joint count (both)         a12 = a only
//   a21 = b only                     a22 = neither
// Yates-corrected chi-squared (subtract 0.5 from |O-E| to reduce
// over-rejection at small counts). Returns the test statistic.
export function chiSquared2x2(
  joint: number,
  countA: number,
  countB: number,
  total: number,
): number {
  const a11 = joint;
  const a12 = countA - joint;
  const a21 = countB - joint;
  const a22 = total - countA - countB + joint;
  if (
    a11 < 0 ||
    a12 < 0 ||
    a21 < 0 ||
    a22 < 0 ||
    countA === 0 ||
    countB === 0 ||
    countA === total ||
    countB === total
  )
    return 0;
  // Yates continuity correction: subtract N/2 from |ad − bc|, but clamp the
  // corrected deviation at 0. Without the clamp, pairs whose observed joint
  // is within half a count of expectation (|ad − bc| < N/2) get a small
  // spurious positive χ² instead of ~0. Harmless to significance (it only
  // ever touches near-independent pairs) but technically incorrect.
  const dev = Math.abs(a11 * a22 - a12 * a21) - total / 2;
  const corrected = dev > 0 ? dev : 0;
  const numerator = total * corrected * corrected;
  const denominator = countA * countB * (total - countA) * (total - countB);
  return denominator > 0 ? numerator / denominator : 0;
}

// Log-likelihood ratio (G²) for a 2×2 contingency table — Dunning (1993),
// the corpus-linguistics standard collocation statistic. Sums the signed
// contribution of all four cells:
//
//   G² = 2 · Σ O_ij · ln(O_ij / E_ij)   over the four cells
//
// where each expected count E_ij = (row marginal · column marginal) / N.
// Cells with O_ij = 0 contribute 0 (since lim_{x→0} x·ln x = 0). Unlike the
// single-cell shortcut, this is asymptotically χ²-distributed with 1 df and
// is more robust than χ² for the sparse, low-count pairs typical of a small
// corpus. Returns the test statistic (≥ 0); larger = stronger association.
export function logLikelihoodRatio2x2(
  joint: number,
  countA: number,
  countB: number,
  total: number,
): number {
  const a11 = joint;
  const a12 = countA - joint;
  const a21 = countB - joint;
  const a22 = total - countA - countB + joint;
  if (
    a11 < 0 ||
    a12 < 0 ||
    a21 < 0 ||
    a22 < 0 ||
    countA === 0 ||
    countB === 0 ||
    countA === total ||
    countB === total
  )
    return 0;
  const e11 = (countA * countB) / total;
  const e12 = (countA * (total - countB)) / total;
  const e21 = ((total - countA) * countB) / total;
  const e22 = ((total - countA) * (total - countB)) / total;
  const term = (o: number, e: number) =>
    o > 0 && e > 0 ? o * Math.log(o / e) : 0;
  return (
    2 * (term(a11, e11) + term(a12, e12) + term(a21, e21) + term(a22, e22))
  );
}

// p-value for chi-squared with 1 degree of freedom: P(X² ≥ x) = erfc(√(x/2)).
// Returns a value in [0, 1].
export function chiSquaredPValue(x: number): number {
  if (x <= 0) return 1;
  return erfc(Math.sqrt(x / 2));
}

// Wilson score interval for a binomial proportion p̂ = k/n. Better than
// the textbook "p̂ ± z·√(p̂(1-p̂)/n)" interval because it stays inside
// [0,1] and has good coverage even at very small or extreme p̂. z = 1.96
// gives a 95 % interval.
export function wilsonInterval(
  k: number,
  n: number,
  z = 1.96,
): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half =
    (z / denom) *
    Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

// Propagate a Wilson interval on the joint probability into a PMI
// confidence interval, holding the marginals fixed. Returns [low, high]
// in log₂ space.
export function pmiInterval(
  joint: number,
  countA: number,
  countB: number,
  total: number,
): [number, number] {
  if (total === 0 || countA === 0 || countB === 0)
    return [-Infinity, Infinity];
  const [pjLow, pjHigh] = wilsonInterval(joint, total);
  const pa = countA / total;
  const pb = countB / total;
  const denom = pa * pb;
  // Lower bound: if jointLow = 0, PMI lower is -∞ — clamp at a finite
  // floor (-20 in log₂ ≈ "essentially never together")
  const lo =
    pjLow > 0 ? Math.log2(pjLow / denom) : -20;
  const hi = Math.log2(pjHigh / denom);
  return [lo, hi];
}

// ─── Morphological clustering ───────────────────────────────────────────
// Heuristic lemmatization for an undeciphered script: find suffixes that
// are productive across many distinct words, then group words where one
// is a stem of another via a productive suffix.

export interface ClusterMember {
  word: string;
  count: number;
  suffix: string; // signs appended beyond the cluster stem ("" for the stem itself)
}

export interface MorphCluster {
  stem: string; // shared prefix path = shortest member
  members: ClusterMember[];
  totalCount: number;
  suffixes: string[]; // distinct suffixes attested in the cluster
}

export interface MorphOptions {
  minSuffixProductivity?: number; // min distinct words a suffix must end
  minClusterSize?: number;
  maxSuffixLen?: number; // in signs (hyphen-separated tokens)
}

export function findMorphologicalClusters(
  words: { word: string; count: number }[],
  opts: MorphOptions = {},
): MorphCluster[] {
  const minProd = opts.minSuffixProductivity ?? 5;
  const minSize = opts.minClusterSize ?? 2;
  const maxLen = opts.maxSuffixLen ?? 2;

  // Multi-sign words only — single-sign tokens carry no morphological signal.
  const multi = words.filter((w) => w.word.includes("-"));
  const byWord = new Map(multi.map((w) => [w.word, w.count]));
  const wordSet = new Set(byWord.keys());

  // Tally suffix productivity (distinct-word counts) at sign granularity.
  const suffixProd = new Map<string, Set<string>>();
  for (const { word } of multi) {
    const parts = word.split("-");
    for (let len = 1; len <= Math.min(maxLen, parts.length - 1); len++) {
      const suf = parts.slice(-len).join("-");
      let set = suffixProd.get(suf);
      if (!set) {
        set = new Set();
        suffixProd.set(suf, set);
      }
      set.add(word);
    }
  }
  const productiveSuffixes = new Set<string>();
  for (const [suf, set] of suffixProd) {
    if (set.size >= minProd) productiveSuffixes.add(suf);
  }

  // Union-Find over words: link word ↔ (word - productive suffix) when both
  // are corpus-attested. Resulting connected components are clusters.
  const parent = new Map<string, string>();
  for (const { word } of multi) parent.set(word, word);
  function find(x: string): string {
    let cur = x;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    // path compression
    let p = x;
    while (parent.get(p) !== cur) {
      const next = parent.get(p)!;
      parent.set(p, cur);
      p = next;
    }
    return cur;
  }
  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    // Make the shorter word the root — it's the likely stem
    const aParts = ra.split("-").length;
    const bParts = rb.split("-").length;
    if (aParts <= bParts) parent.set(rb, ra);
    else parent.set(ra, rb);
  }

  for (const { word } of multi) {
    const parts = word.split("-");
    for (let len = 1; len <= Math.min(maxLen, parts.length - 1); len++) {
      const suf = parts.slice(-len).join("-");
      if (!productiveSuffixes.has(suf)) continue;
      const stem = parts.slice(0, parts.length - len).join("-");
      if (wordSet.has(stem)) union(word, stem);
    }
  }

  // Collect components
  const groups = new Map<string, string[]>();
  for (const { word } of multi) {
    const root = find(word);
    let arr = groups.get(root);
    if (!arr) {
      arr = [];
      groups.set(root, arr);
    }
    arr.push(word);
  }

  const clusters: MorphCluster[] = [];
  for (const members of groups.values()) {
    if (members.length < minSize) continue;
    // The cluster stem = the shortest (fewest signs) member. Ties broken
    // by highest count.
    const sortedMembers = [...members].sort((a, b) => {
      const da = a.split("-").length - b.split("-").length;
      if (da !== 0) return da;
      return (byWord.get(b) ?? 0) - (byWord.get(a) ?? 0);
    });
    const stem = sortedMembers[0];
    const stemParts = stem.split("-");
    const list: ClusterMember[] = members.map((w) => {
      const parts = w.split("-");
      const sharedLen = stemParts.length;
      const suffix =
        w === stem
          ? ""
          : parts.length > sharedLen &&
              stemParts.every((p, i) => parts[i] === p)
            ? parts.slice(sharedLen).join("-")
            : "≠"; // member doesn't actually extend stem — flag it
      return { word: w, count: byWord.get(w) ?? 0, suffix };
    });
    list.sort((a, b) => b.count - a.count);
    const totalCount = list.reduce((s, m) => s + m.count, 0);
    const suffixes = [
      ...new Set(list.map((m) => m.suffix).filter((s) => s && s !== "≠")),
    ];
    clusters.push({ stem, members: list, totalCount, suffixes });
  }
  clusters.sort((a, b) => b.members.length - a.members.length);
  return clusters;
}

// Fisher's exact test, two-sided, for the 2×2 contingency table. Sums the
// hypergeometric probabilities of all tables with the same marginals
// whose probability is ≤ the observed table's. More accurate than
// chi-squared for small expected counts but O(N) per pair.
export function fishersExact(
  joint: number,
  countA: number,
  countB: number,
  total: number,
): number {
  if (
    joint < 0 ||
    countA <= 0 ||
    countB <= 0 ||
    countA > total ||
    countB > total
  )
    return 1;
  const lnP = (k: number) =>
    lnChoose(countA, k) +
    lnChoose(total - countA, countB - k) -
    lnChoose(total, countB);
  const observedLnP = lnP(joint);
  const kMin = Math.max(0, countA + countB - total);
  const kMax = Math.min(countA, countB);
  let sum = 0;
  // Iterate all possible joint counts; include those with p ≤ observed.
  // We compare lnP <= observedLnP + tiny epsilon to handle float fuzz.
  for (let k = kMin; k <= kMax; k++) {
    const ln = lnP(k);
    if (ln <= observedLnP + 1e-12) sum += Math.exp(ln);
  }
  return Math.min(1, sum);
}

// Standard Levenshtein over arbitrary token sequences. Used by the
// Similarity module to compare whole inscriptions as ordered bags of words.
export function sequenceDistance<T>(a: readonly T[], b: readonly T[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = new Array(m + 1);
  let curr = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

// Normalize sequence distance to a 0–1 similarity (1 = identical).
export function sequenceSimilarity<T>(
  a: readonly T[],
  b: readonly T[],
): number {
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - sequenceDistance(a, b) / maxLen;
}

// ─── Phoneme-level alignment ─────────────────────────────────────────────
export type AlignOp =
  | "match"
  | "sub-vowel"
  | "sub-class"
  | "sub-far"
  | "ins" // gap in `a` (b has an extra char)
  | "del"; // gap in `b` (a has an extra char)

export interface AlignCell {
  a: string; // char from a or "" for ins
  b: string; // char from b or "" for del
  op: AlignOp;
}

// Run weighted Levenshtein, then backtrace to emit a per-position alignment.
// Used by the cross-language matrix view to visualize phoneme correspondence.
export function alignPhonetic(
  a: string,
  b: string,
  w: PhoneticWeights = DEFAULT_WEIGHTS,
  cl: PhoneticClasses = DEFAULT_PHONETIC_CLASSES,
): AlignCell[] {
  const n = a.length;
  const m = b.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i * w.indel;
  for (let j = 0; j <= m; j++) d[0][j] = j * w.indel;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + w.indel,
        d[i][j - 1] + w.indel,
        d[i - 1][j - 1] + subCost(a[i - 1], b[j - 1], w, cl),
      );
    }
  }

  const out: AlignCell[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const ai = a[i - 1];
      const bj = b[j - 1];
      const cost = subCost(ai, bj, w, cl);
      if (d[i][j] === d[i - 1][j - 1] + cost) {
        const op: AlignOp =
          ai === bj
            ? "match"
            : isVowelIn(ai, cl) && isVowelIn(bj, cl)
              ? "sub-vowel"
              : sameClassIn(ai, bj, cl)
                ? "sub-class"
                : "sub-far";
        out.unshift({ a: ai, b: bj, op });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && d[i][j] === d[i - 1][j] + w.indel) {
      out.unshift({ a: a[i - 1], b: "", op: "del" });
      i--;
      continue;
    }
    out.unshift({ a: "", b: b[j - 1], op: "ins" });
    j--;
  }
  return out;
}
