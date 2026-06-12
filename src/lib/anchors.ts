// "Anchor" vocabulary — the handful of Linear A words with conventional
// readings or an agreed formulaic role in the literature. Derived from the
// same shared lists the analysis modules already use (accounting markers in
// lib/numerals, the libation-formula vocabulary in data/libation) so an
// anchor here can never disagree with how those modules classify the word.
//
// These are conventions, not decipherments: KU-RO is read "total" because
// it sits where a total sits and the arithmetic checks out, not because the
// word's language is known. The glosses say which kind of evidence backs
// each reading.

import {
  TOTAL_MARKERS,
  GRAND_TOTAL_MARKERS,
  DEFICIT_MARKERS,
} from "./numerals";
import { LIBATION_WORD_SET } from "../data/libation";

/** Conventional gloss for an anchor word, or null for ordinary vocabulary. */
export function anchorGloss(word: string): string | null {
  if (TOTAL_MARKERS.has(word))
    return "conventional reading “total” — heads sum lines, arithmetic verifiable";
  if (GRAND_TOTAL_MARKERS.has(word))
    return "conventional reading “grand total” — restates KU-RO subtotals";
  if (DEFICIT_MARKERS.has(word))
    return "conventional reading “deficit / owed” — heads shortfall entries";
  if (LIBATION_WORD_SET.has(word))
    return "libation-formula constituent — recurring slot in the dedicatory formula";
  return null;
}

/** Is this word an anchor (has any conventional reading / formulaic role)? */
export function isAnchor(word: string): boolean {
  return anchorGloss(word) !== null;
}
