// AB-number ↔ GORILA-label aliasing for sign search.
//
// SigLA, GORILA, and Ventris & Chadwick all use the same standard Linear B
// numbering for the AB-shared sign series ("AB01/da", "AB02/ro", "AB77/ka",
// etc.). This file lets a researcher type "AB77" into the workbench's sign
// filters and have it resolve to "KA" — i.e. it bridges SigLA's AB-code
// convention to our GORILA-label convention.
//
// AB-shared mappings here are confirmed against the standard Linear B
// syllabary chart (Ventris & Chadwick 1973; cross-referenced with SigLA's
// public sign-list page at https://sigla.phis.me/sign-list.html). Uncertain
// or rare AB numbers are deliberately omitted rather than guessed at.
//
// Linear-A-only signs use the trivial mapping A### ↔ *### (since GORILA
// writes them as "*301" and SigLA writes them as "A301").

const AB_TO_LABEL: Record<number, string> = {
  1: "DA",
  2: "RO",
  3: "PA",
  4: "TE",
  5: "TO",
  6: "NA",
  7: "DI",
  8: "A",
  9: "SE",
  10: "U",
  11: "PO",
  12: "SO",
  13: "ME",
  14: "DO",
  15: "MO",
  17: "ZA",
  20: "ZO",
  21: "QI",
  23: "MU",
  24: "NE",
  26: "RU",
  27: "RE",
  28: "I",
  30: "NI",
  31: "SA",
  37: "TI",
  38: "E",
  39: "PI",
  40: "WI",
  41: "SI",
  44: "KE",
  45: "DE",
  46: "JE",
  50: "PU",
  51: "DU",
  53: "RI",
  54: "WA",
  55: "NU",
  57: "JA",
  58: "SU",
  59: "TA",
  60: "RA",
  61: "O",
  67: "KI",
  69: "TU",
  70: "KO",
  72: "PE",
  73: "MI",
  74: "ZE",
  75: "WE",
  76: "RA2",
  77: "KA",
  78: "QE",
  79: "ZU",
  80: "MA",
  81: "KU",
};

/**
 * Resolve a possibly-AB-coded sign identifier to its canonical GORILA label.
 * Returns the resolved label, or null if the input wasn't recognized as an
 * AB / A code. The match is case-insensitive and tolerates "AB 77", "ab77",
 * "AB77", "ab-77" alike. Pass-through if the input doesn't look AB-style.
 *
 * Examples:
 *   resolveSignAlias("AB77")  → "KA"
 *   resolveSignAlias("ab 8")  → "A"
 *   resolveSignAlias("A301")  → "*301"
 *   resolveSignAlias("KA")    → null  (not an AB/A code)
 *   resolveSignAlias("foo")   → null
 */
export function resolveSignAlias(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s\-_]+/g, "");
  // AB-shared: "AB" followed by digits
  const ab = cleaned.match(/^AB(\d+)$/);
  if (ab) {
    const n = parseInt(ab[1], 10);
    return AB_TO_LABEL[n] ?? null;
  }
  // Linear-A-only: "A" followed by digits (no B). Trivially maps to *N
  // because GORILA writes A-only signs with a star prefix and SigLA writes
  // them as A###.
  const aOnly = cleaned.match(/^A(\d+)$/);
  if (aOnly) {
    return `*${aOnly[1]}`;
  }
  return null;
}
