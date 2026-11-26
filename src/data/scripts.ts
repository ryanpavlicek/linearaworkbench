// Aegean script profiles for multi-script custom-corpus sessions.
//
// The bundled corpus is always Linear A (`lineara`). When a researcher loads
// an external corpus via `?corpus=...&script=linearb` (for example from
// `aegean workbench --corpus`), a schema-v1 export carrying `_meta.script`, or
// a local JSON upload, the workbench adapts its script badge, glyph font
// fallback, phonetic lookup case behavior, and accounting markers (`to-so` /
// `o-pe-ro` for Linear B) to match the active script.

import {
  LINEAR_A_MARKERS,
  LINEAR_B_MARKERS,
  EMPTY_MARKERS,
  type AccountingMarkers,
} from "../lib/numerals";

export type ScriptId =
  | "lineara"
  | "linearb"
  | "cypriot"
  | "cyprominoan"
  | "custom";

export interface ScriptProfile {
  id: ScriptId;
  label: string;
  shortLabel: string;
  status: "undeciphered" | "deciphered" | "custom";
  language: string;
  accountingMarkers: AccountingMarkers;
  totalLabel: string;
  grandTotalLabel: string | null;
  deficitLabel: string;
  caseInsensitivePhonetic: boolean;
}

export const SCRIPT_PROFILES: Record<ScriptId, ScriptProfile> = {
  lineara: {
    id: "lineara",
    label: "Linear A",
    shortLabel: "Linear A",
    status: "undeciphered",
    language: "Minoan (unclassified)",
    accountingMarkers: LINEAR_A_MARKERS,
    totalLabel: "KU-RO",
    grandTotalLabel: "PO-TO-KU-RO",
    deficitLabel: "KI-RO",
    caseInsensitivePhonetic: false,
  },
  linearb: {
    id: "linearb",
    label: "Linear B",
    shortLabel: "Linear B",
    status: "deciphered",
    language: "Mycenaean Greek",
    accountingMarkers: LINEAR_B_MARKERS,
    totalLabel: "TO-SO",
    grandTotalLabel: null,
    deficitLabel: "O-PE-RO",
    caseInsensitivePhonetic: true,
  },
  cypriot: {
    id: "cypriot",
    label: "Cypriot Syllabic",
    shortLabel: "Cypriot",
    status: "deciphered",
    language: "Arcadocypriot Greek / Eteocypriot",
    accountingMarkers: EMPTY_MARKERS,
    totalLabel: "Total",
    grandTotalLabel: null,
    deficitLabel: "Deficit",
    caseInsensitivePhonetic: true,
  },
  cyprominoan: {
    id: "cyprominoan",
    label: "Cypro-Minoan",
    shortLabel: "Cypro-Minoan",
    status: "undeciphered",
    language: "Unknown (Bronze Age Cyprus)",
    accountingMarkers: EMPTY_MARKERS,
    totalLabel: "Total",
    grandTotalLabel: null,
    deficitLabel: "Deficit",
    caseInsensitivePhonetic: true,
  },
  custom: {
    id: "custom",
    label: "Custom Script",
    shortLabel: "Custom",
    status: "custom",
    language: "Custom corpus",
    accountingMarkers: EMPTY_MARKERS,
    totalLabel: "Total",
    grandTotalLabel: null,
    deficitLabel: "Deficit",
    caseInsensitivePhonetic: true,
  },
};

const SCRIPT_ALIASES: Record<string, ScriptId> = {
  lineara: "lineara",
  "linear-a": "lineara",
  linear_a: "lineara",
  "linear a": "lineara",
  la: "lineara",
  linearb: "linearb",
  "linear-b": "linearb",
  linear_b: "linearb",
  "linear b": "linearb",
  lb: "linearb",
  cypriot: "cypriot",
  "cypriot-syllabic": "cypriot",
  cypriot_syllabic: "cypriot",
  "cypriot syllabic": "cypriot",
  cyprominoan: "cyprominoan",
  "cypro-minoan": "cyprominoan",
  cypro_minoan: "cyprominoan",
  "cypro minoan": "cyprominoan",
  cm: "cyprominoan",
  custom: "custom",
};

/** Normalize a raw script identifier (from `?script=` or `_meta.script`), or null if unrecognized. */
export function parseScriptId(raw: unknown): ScriptId | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return SCRIPT_ALIASES[key] ?? null;
}

/** Normalize a raw script identifier, falling back to `"lineara"`. */
export function normalizeScriptId(raw: unknown): ScriptId {
  return parseScriptId(raw) ?? "lineara";
}

export function getScriptProfile(id: ScriptId): ScriptProfile {
  return SCRIPT_PROFILES[id] ?? SCRIPT_PROFILES.lineara;
}
