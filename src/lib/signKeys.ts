// The shared sign-key rule for phonetic-map lookups, matching wordToPhonetic
// in algorithms.ts: subscripted signs (RA₂, PA₃, TA₂, PU₂) are DISTINCT
// signs, not variants of their plain series, so only the "*" of unread sign
// labels (*118, *301) is stripped for a lookup. A subscripted sign reads only
// where the map attests a value for that exact sign — RA₂ never inherits RA.
import { PHONETIC_MAP } from "../data/phoneticMap";
import type { PhoneticOverrides } from "./types";

// The lookup key for a sign: "*" stripped, everything else — subscripts
// included — preserved.
export function phoneticKeyOf(sign: string): string {
  return sign.replace(/\*/g, "");
}

// The attested phonetic value of a sign under the active map (base values
// plus any hypothesis overrides), or null when that exact sign has none.
export function lookupPhonetic(
  sign: string,
  overrides: PhoneticOverrides = {},
): string | null {
  const key = phoneticKeyOf(sign);
  return overrides[key] ?? PHONETIC_MAP[key] ?? null;
}
