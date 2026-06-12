// Overlay modes for the Findspot Map: recolor sites by where something
// appears — a word, a commodity logogram, a scribe's hand, a dating phase,
// or a tablet-structure category. Pure functions over the scoped
// inscriptions so the map component stays thin and this logic is testable.

import {
  COMMODITIES,
  commodityHead,
  isUndecipheredLogogram,
} from "../data/commodities";
import { heuristicCategory, type StructCategory } from "./corpusExport";
import type { Inscription } from "./types";

export type OverlayMode = "word" | "commodity" | "scribe" | "period" | "category";

export const OVERLAY_MODES: { id: OverlayMode; label: string }[] = [
  { id: "word", label: "Word" },
  { id: "commodity", label: "Commodity" },
  { id: "scribe", label: "Scribe" },
  { id: "period", label: "Period" },
  { id: "category", label: "Tablet type" },
];

const CATEGORY_LABELS: Record<StructCategory, string> = {
  accounting: "accounting",
  libation: "libation formula",
  list: "list",
  text: "text",
  other: "other",
};

// Dating phases sort chronologically, not lexically: MM (Middle Minoan)
// precedes LM (Late Minoan).
function phaseRank(context: string): number {
  if (context.startsWith("EM")) return 0;
  if (context.startsWith("MM")) return 1;
  if (context.startsWith("LM")) return 2;
  return 3;
}

export function overlayMatches(
  ins: Inscription,
  mode: OverlayMode,
  value: string,
): boolean {
  switch (mode) {
    case "word":
      return ins.words.some((w) => w.toUpperCase() === value.toUpperCase());
    case "commodity":
      // Catalog heads (ligature-aware) plus undeciphered *NNN logograms,
      // which the Commodity Catalog treats as first-class.
      return ins.words.some(
        (w) =>
          commodityHead(w) === value ||
          (isUndecipheredLogogram(w) && w === value),
      );
    case "scribe":
      return ins.scribe === value;
    case "period":
      return ins.context === value;
    case "category":
      return heuristicCategory(ins) === value;
  }
}

/** Per-site count of inscriptions matching the overlay. Empty value → null
 *  (no overlay active). */
export function overlaySiteCounts(
  inscriptions: Inscription[],
  mode: OverlayMode,
  value: string,
): Map<string, number> | null {
  if (!value.trim()) return null;
  const m = new Map<string, number>();
  for (const ins of inscriptions) {
    if (!ins.site) continue;
    if (overlayMatches(ins, mode, value))
      m.set(ins.site, (m.get(ins.site) ?? 0) + 1);
  }
  return m;
}

export interface OverlayOption {
  value: string;
  label: string;
  count: number; // inscriptions matching, for the dropdown's at-a-glance
}

/** The selectable values for a mode, computed from the loaded (scoped)
 *  corpus. The word mode is free-text and returns no options. */
export function overlayOptions(
  inscriptions: Inscription[],
  mode: OverlayMode,
): OverlayOption[] {
  if (mode === "word") return [];
  const counts = new Map<string, number>();
  for (const ins of inscriptions) {
    if (!ins.site) continue;
    if (mode === "commodity") {
      const heads = new Set<string>();
      for (const w of ins.words) {
        const h =
          commodityHead(w) ?? (isUndecipheredLogogram(w) ? w : null);
        if (h) heads.add(h);
      }
      for (const h of heads) counts.set(h, (counts.get(h) ?? 0) + 1);
    } else if (mode === "scribe") {
      if (ins.scribe) counts.set(ins.scribe, (counts.get(ins.scribe) ?? 0) + 1);
    } else if (mode === "period") {
      if (ins.context) counts.set(ins.context, (counts.get(ins.context) ?? 0) + 1);
    } else {
      const c = heuristicCategory(ins);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const out: OverlayOption[] = [...counts.entries()].map(([value, count]) => ({
    value,
    count,
    label:
      mode === "commodity"
        ? `${value} — ${COMMODITIES[value]?.gloss ?? (isUndecipheredLogogram(value) ? "undeciphered" : "?")}`
        : mode === "category"
          ? CATEGORY_LABELS[value as StructCategory] ?? value
          : value,
  }));
  if (mode === "period") {
    out.sort(
      (a, b) =>
        phaseRank(a.value) - phaseRank(b.value) ||
        a.value.localeCompare(b.value),
    );
  } else {
    out.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  return out;
}
