// Sign-pattern matcher for word searches like "KU-*-RO" or "JA-SA-**".
// Pattern tokens are dash-separated sign labels with two wildcards:
//   *   exactly one sign (any value)
//   **  zero or more signs
//
// Examples:
//   "KU-*-RO"     → exactly 3 signs, first KU, last RO, middle any
//   "JA-SA-**"    → 2+ signs starting with JA, SA
//   "**-RE"       → any number of signs ending in RE
//   "*-KU-*"      → exactly 3 signs with KU in the middle
//   "KU-**-RO"    → 2+ signs starting KU, ending RO, any number between
//
// Sign labels are matched case-insensitively after subscript normalization
// (RA₂ ≡ RA2 ≡ ra2). Single `*` is treated as a sign-position wildcard;
// double `**` as a zero-or-more wildcard.

import { normalizeSignLabel } from "./helpers";

export const SIGN_PATTERN_HELP =
  "Dash-separated sign labels. Use * for one sign (any value), ** for zero or more. " +
  "Examples: KU-*-RO  ·  **-RE  ·  JA-SA-**  ·  *-KU-*";

export interface CompiledSignPattern {
  /** Tokens in normalized form (uppercase, subscript-folded), with the
   *  two wildcards preserved as the literal strings "*" and "**". */
  tokens: string[];
  /** True iff the pattern contains at least one variable-length wildcard. */
  hasDoubleStar: boolean;
}

export function compileSignPattern(raw: string): CompiledSignPattern | null {
  const tokens = raw
    .split("-")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  const normalized = tokens.map((t) =>
    t === "*" || t === "**" ? t : normalizeSignLabel(t).toUpperCase(),
  );
  return {
    tokens: normalized,
    hasDoubleStar: normalized.some((t) => t === "**"),
  };
}

/** Match a multi-sign word's sign sequence against a compiled pattern. */
export function matchSignPattern(
  signs: string[],
  pattern: CompiledSignPattern,
): boolean {
  const ws = signs.map((s) => normalizeSignLabel(s).toUpperCase());
  const ps = pattern.tokens;
  // Recursive matcher. ws is short (≤ ~6 signs in real Linear A words) so
  // even with `**` backtracking the cost is trivial.
  function rec(pi: number, si: number): boolean {
    if (pi === ps.length) return si === ws.length;
    const tok = ps[pi];
    if (tok === "**") {
      // Try every prefix length the rest of the pattern can absorb. We
      // bound the upper limit at the remaining word length so we don't loop
      // pointlessly past the end.
      for (let k = 0; k <= ws.length - si; k++) {
        if (rec(pi + 1, si + k)) return true;
      }
      return false;
    }
    if (si >= ws.length) return false;
    if (tok === "*") return rec(pi + 1, si + 1);
    return tok === ws[si] && rec(pi + 1, si + 1);
  }
  return rec(0, 0);
}

/** Convenience: compile and match in one call. Returns false for empty
 *  patterns or words without sign separators. */
export function wordMatchesSignPattern(word: string, raw: string): boolean {
  if (!word.includes("-")) return false;
  const compiled = compileSignPattern(raw);
  if (!compiled) return false;
  return matchSignPattern(word.split("-"), compiled);
}
