// Parsing of Aegean numeral values out of the transliterated token stream.
//
// The upstream transcription already renders the Linear A decimal numerals
// as ordinary integers ("197", "70") and the metrological fractions as
// Unicode built-up fractions (superscript numerator + U+2044 fraction slash
// + subscript denominator, e.g. "³⁄₄"). A handful of precomposed vulgar
// fractions (½ ¼ ¾ …) may also appear. This module turns those tokens into
// numbers so the accounting tablets can be summed and checked.

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};
const SUBSCRIPTS: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};
const PRECOMPOSED: Record<string, number> = {
  "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4,
  "⅕": 1 / 5, "⅖": 2 / 5, "⅗": 3 / 5, "⅘": 4 / 5,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8,
};

function mapDigits(s: string, table: Record<string, string>): string | null {
  let out = "";
  for (const ch of s) {
    const d = table[ch];
    if (d === undefined) return null;
    out += d;
  }
  return out.length ? out : null;
}

// Parse a single token into a numeric value, or null if it isn't a numeral.
// Handles: plain integers, built-up fractions (³⁄₄), precomposed vulgar
// fractions (¾), and approximate readings ("≈ ¹⁄₆").
export function parseValue(token: string): number | null {
  // "≈" prefixes an editor-estimated reading of a damaged or unclear
  // quantity ("≈ ¹⁄₆"). Use the estimated value itself — returning null
  // silently dropped these quantities from every accounting sum they feed.
  // The ≈ qualifier is editorial apparatus, like the marks classifyTokens
  // skips; it is not propagated, so the value sums at face value (the
  // module's convention: quantities are the editor's best reading).
  const t = token.trim().replace(/^≈\s*/, "");
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (PRECOMPOSED[t] !== undefined) return PRECOMPOSED[t];

  // Built-up fraction: split on the fraction slash (U+2044) or ASCII slash.
  const parts = t.split(/[⁄/]/);
  if (parts.length === 2) {
    const num = mapDigits(parts[0], SUPERSCRIPTS) ?? parts[0];
    const den = mapDigits(parts[1], SUBSCRIPTS) ?? parts[1];
    // Both sides must be a non-empty run of ASCII digits. An empty numerator
    // or denominator ("/2", "3/") would otherwise coerce to Number("") === 0
    // and yield a bogus value; non-digit junk ("x/2") would coerce to NaN.
    if (!/^\d+$/.test(num) || !/^\d+$/.test(den)) return null;
    const n = Number(num);
    const d = Number(den);
    // A metrological fraction is a proper, positive fraction (0 < n < d).
    // Reject zero/improper numerators and zero denominators.
    if (n > 0 && d > 0 && n < d) return n / d;
  }
  return null;
}

export const isValueToken = (token: string): boolean =>
  parseValue(token) !== null;

// Sum all numeric tokens in a line. Consecutive integer + fraction tokens
// ("5", "³⁄₄") naturally add to the line's quantity (5.75), and standalone
// fractions add too. Returns 0 if the line has no numerals.
export function lineValue(tokens: string[]): number {
  let sum = 0;
  for (const tk of tokens) {
    const v = parseValue(tk);
    if (v !== null) sum += v;
  }
  return sum;
}

export function hasValue(tokens: string[]): boolean {
  return tokens.some(isValueToken);
}

// Render a decimal value with the metrological fraction shown when it's one
// of the common Linear A fractions, e.g. 31.75 → "31¾". Falls back to a
// rounded decimal.
const FRACTION_GLYPH: [number, string][] = [
  [1 / 2, "½"], [1 / 3, "⅓"], [2 / 3, "⅔"], [1 / 4, "¼"], [3 / 4, "¾"],
  [1 / 6, "⅙"], [5 / 6, "⅚"], [1 / 8, "⅛"], [3 / 8, "⅜"], [5 / 8, "⅝"],
  [7 / 8, "⅞"], [1 / 16, "¹⁄₁₆"], [1 / 5, "⅕"],
];
export function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  // Work on the magnitude so a negative mixed number keeps its sign and its
  // integer part: -1.5 → "-1½", not "½". Math.floor would round -1.5 to -2.
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const whole = Math.floor(abs);
  const frac = abs - whole;
  for (const [f, glyph] of FRACTION_GLYPH) {
    if (Math.abs(frac - f) < 1e-6)
      return whole > 0 ? `${sign}${whole}${glyph}` : `${sign}${glyph}`;
  }
  // Unknown fraction — show a tidy decimal.
  return v.toFixed(3).replace(/\.?0+$/, "");
}

// Total-marker recognition. Linear A uses KU-RO / KU-RA (total), PO-TO-KU-RO
// (grand total), and KI-RO (deficit/owed). Linear B uses Mycenaean Greek
// to-so / to-sa / to-so-de (total) and o-pe-ro / o-pe-ro-si (deficit), matched
// case-insensitively to handle lowercase DAMOS transliterations.
export const TOTAL_MARKERS = new Set(["KU-RO", "KU-RA"]);
export const GRAND_TOTAL_MARKERS = new Set(["PO-TO-KU-RO"]);
export const DEFICIT_MARKERS = new Set(["KI-RO"]);

export interface AccountingMarkers {
  total: ReadonlySet<string>;
  grandTotal: ReadonlySet<string>;
  deficit: ReadonlySet<string>;
  caseInsensitive?: boolean;
}

export const LINEAR_A_MARKERS: AccountingMarkers = {
  total: TOTAL_MARKERS,
  grandTotal: GRAND_TOTAL_MARKERS,
  deficit: DEFICIT_MARKERS,
  caseInsensitive: false,
};

export const LINEAR_B_MARKERS: AccountingMarkers = {
  total: new Set(["TO-SO", "TO-SA", "TO-SO-DE"]),
  grandTotal: new Set<string>(),
  deficit: new Set(["O-PE-RO", "O-PE-RO-SI"]),
  caseInsensitive: true,
};

export const EMPTY_MARKERS: AccountingMarkers = {
  total: new Set<string>(),
  grandTotal: new Set<string>(),
  deficit: new Set<string>(),
  caseInsensitive: true,
};

export function hasMarker(
  term: string,
  set: ReadonlySet<string>,
  caseInsensitive = false,
): boolean {
  if (set.size === 0) return false;
  if (set.has(term)) return true;
  if (!caseInsensitive) return false;
  const upper = term.toUpperCase();
  if (set.has(upper)) return true;
  for (const m of set) {
    if (m.toUpperCase() === upper) return true;
  }
  return false;
}

export function markersForScript(scriptId: string): AccountingMarkers {
  const key = scriptId.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (key === "linearb" || key === "lb") return LINEAR_B_MARKERS;
  if (key === "lineara" || key === "la" || key === "") return LINEAR_A_MARKERS;
  return EMPTY_MARKERS;
}

export type LineRole = "header" | "item" | "total" | "grand-total" | "deficit";

export interface AccountLine {
  index: number;
  tokens: string[];
  terms: string[]; // multi-sign word tokens on the line
  ideograms: string[]; // commodity logograms on the line
  value: number; // summed numeric value of the line (0 if none)
  hasNumber: boolean;
  role: LineRole;
}

const IDEOGRAM_RE = /^[A-Z*][A-Z0-9*+'[\]?]*$/; // logograms / ligatures, not syllabic words

function classifyTokens(tokens: string[]): {
  terms: string[];
  ideograms: string[];
} {
  const terms: string[] = [];
  const ideograms: string[] = [];
  for (const tk of tokens) {
    if (parseValue(tk) !== null) continue;
    if (tk === "𐄁" || tk === "𐝫" || tk === "—" || tk === "≈") continue;
    if (tk.includes("-")) terms.push(tk);
    else if (IDEOGRAM_RE.test(tk)) ideograms.push(tk);
    else terms.push(tk);
  }
  return { terms, ideograms };
}

// Parse a tablet's lines into role-tagged accounting lines.
export function parseAccountLines(
  lines: string[][],
  markers: AccountingMarkers = LINEAR_A_MARKERS,
): AccountLine[] {
  const ci = markers.caseInsensitive ?? false;
  return lines.map((tokens, index) => {
    const value = lineValue(tokens);
    const hasNumber = hasValue(tokens);
    const { terms, ideograms } = classifyTokens(tokens);
    let role: LineRole = "item";
    if (terms.some((t) => hasMarker(t, markers.grandTotal, ci)))
      role = "grand-total";
    else if (terms.some((t) => hasMarker(t, markers.total, ci))) role = "total";
    else if (terms.some((t) => hasMarker(t, markers.deficit, ci)))
      role = "deficit";
    else if (!hasNumber) role = "header";
    return { index, tokens, terms, ideograms, value, hasNumber, role };
  });
}

export interface BalanceCheck {
  statedTotal: number; // value on the total / grand-total line
  computedSum: number; // sum of the item lines feeding it
  itemCount: number;
  difference: number; // computed - stated
  balances: boolean;
  marker: string; // e.g. "KU-RO", "PO-TO-KU-RO", "to-so"
  totalLineIndex: number;
}

// Verify each total line on a tablet. A subtotal (KU-RO / to-so) is checked
// against the item lines since the previous total; a grand total (PO-TO-KU-RO)
// is checked against the stated subtotals that precede it (plus any trailing
// items that never got their own subtotal). Deficit (KI-RO / o-pe-ro) and
// header lines are excluded from the sums. A total with nothing to check
// against yields no check rather than a spurious zero-sum discrepancy.
export function checkBalances(
  lines: AccountLine[],
  markers: AccountingMarkers = LINEAR_A_MARKERS,
): BalanceCheck[] {
  const ci = markers.caseInsensitive ?? false;
  const checks: BalanceCheck[] = [];
  let runningItems: AccountLine[] = [];
  let subtotals: number[] = [];
  const push = (
    line: AccountLine,
    computedSum: number,
    itemCount: number,
  ) => {
    const difference = computedSum - line.value;
    checks.push({
      statedTotal: line.value,
      computedSum,
      itemCount,
      difference,
      balances: Math.abs(difference) < 1e-6,
      marker:
        line.terms.find(
          (t) =>
            hasMarker(t, markers.total, ci) ||
            hasMarker(t, markers.grandTotal, ci),
        ) ?? "",
      totalLineIndex: line.index,
    });
  };
  for (const line of lines) {
    if (line.role === "item" && line.hasNumber) {
      runningItems.push(line);
    } else if (line.role === "total") {
      if (line.hasNumber) {
        if (runningItems.length > 0) {
          push(
            line,
            runningItems.reduce((s, l) => s + l.value, 0),
            runningItems.length,
          );
        }
        // The stated subtotal feeds any later grand total regardless of
        // whether it was checkable itself.
        subtotals.push(line.value);
      }
      runningItems = [];
    } else if (line.role === "grand-total") {
      if (line.hasNumber) {
        const parts = subtotals.length + runningItems.length;
        if (parts > 0) {
          push(
            line,
            subtotals.reduce((s, v) => s + v, 0) +
              runningItems.reduce((s, l) => s + l.value, 0),
            parts,
          );
        }
      }
      subtotals = [];
      runningItems = [];
    }
  }
  return checks;
}
