// The shared sign-key rule for phonetic-map lookups, matching wordToPhonetic
// in algorithms.ts: subscripted signs (RA₂, PA₃, TA₂, PU₂) are DISTINCT
// signs, not variants of their plain series, so only the "*" of unread sign
// labels (*118, *301) is stripped for a lookup. A subscripted sign reads only
// where the map attests a value for that exact sign — RA₂ never inherits RA.
import { PHONETIC_MAP } from "../data/phoneticMap";
import type { PhoneticOverrides } from "./types";

let activeBasePhoneticMap: Record<string, string> = PHONETIC_MAP;
let activeCaseInsensitive = false;

/** Swap the active base sign→sound map for non-Linear-A custom corpora. */
export function setActivePhoneticMap(
  map: Record<string, string> | null,
  opts?: { caseInsensitive?: boolean },
): void {
  activeBasePhoneticMap =
    map && Object.keys(map).length > 0 ? { ...map } : PHONETIC_MAP;
  activeCaseInsensitive = opts?.caseInsensitive ?? false;
}

/** Restore the default Linear A sign→sound table. */
export function resetActivePhoneticMap(): void {
  activeBasePhoneticMap = PHONETIC_MAP;
  activeCaseInsensitive = false;
}

export function getActivePhoneticMap(): Record<string, string> {
  return activeBasePhoneticMap;
}

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
  const direct = overrides[key] ?? activeBasePhoneticMap[key];
  if (direct !== undefined) return direct;
  if (activeCaseInsensitive) {
    const upper = key.toUpperCase();
    const lower = key.toLowerCase();
    return (
      overrides[upper] ??
      overrides[lower] ??
      activeBasePhoneticMap[upper] ??
      activeBasePhoneticMap[lower] ??
      null
    );
  }
  return null;
}
