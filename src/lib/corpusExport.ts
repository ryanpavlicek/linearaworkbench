// Structured JSON export of the workbench's enriched corpus. The shape is
// designed for downstream use in Python / R / spreadsheets — every canonical
// field from the upstream transcription is preserved, plus a `derived` block
// per inscription with the cheap analyses the workbench performs on it (multi-
// sign word count, tablet-structure heuristic + any researcher override, the
// accounting balance check when applicable). An opt-in `userState` block
// includes the researcher's annotations, collection memberships, and pin
// state — leave it off for a clean export, leave it on to preserve the full
// workbench view.
//
// Schema version is bumped on any breaking change so downstream consumers can
// branch behavior cleanly.

import type {
  Annotation,
  Collection,
  CorpusScope,
  Inscription,
  Pin,
  SignData,
} from "./types";
import { wordToPhonetic } from "./algorithms";
import { LIBATION_WORD_SET } from "../data/libation";
import {
  parseAccountLines,
  checkBalances,
  formatValue,
  hasValue,
} from "./numerals";
import type { PhoneticOverrides, WordEntry } from "./types";

export const SCHEMA_VERSION = 1;
export const TOOL_NAME = "Linear A Research Workbench";
export const TOOL_REPO = "https://github.com/ryanpavlicek/linearaworkbench";
export const METHODOLOGY_URL =
  "https://github.com/ryanpavlicek/linearaworkbench/blob/main/docs/METHODOLOGY.md";

export type StructCategory =
  | "accounting"
  | "libation"
  | "list"
  | "text"
  | "other";
export function heuristicCategory(ins: Inscription): StructCategory {
  const ws = ins.words;
  // hasValue catches fractions too — a tablet of fraction-only quantities
  // is still an accounting document.
  const hasNums = hasValue(ws);
  const hasKuro = ws.includes("KU-RO");
  const hasLib = ws.some((w) => LIBATION_WORD_SET.has(w));
  const multi = ws.filter((w) => w.includes("-")).length;
  const sep = ws.filter((w) => w === "𐄁").length;
  if (hasKuro || (hasNums && multi > 2)) return "accounting";
  if (hasLib) return "libation";
  if (sep > 3 && !hasNums) return "list";
  if (multi > 4 && !hasNums) return "text";
  return "other";
}

interface BalanceSummary {
  hasTotal: boolean;
  totalsChecked: number;
  allBalance: boolean;
  checks: {
    marker: string;
    statedTotal: number;
    computedSum: number;
    statedDisplay: string;
    computedDisplay: string;
    difference: number;
    balances: boolean;
    itemCount: number;
  }[];
}
function balanceSummary(ins: Inscription): BalanceSummary | undefined {
  if (!ins.lines.length) return undefined;
  const lines = parseAccountLines(ins.lines);
  const checks = checkBalances(lines);
  if (checks.length === 0)
    return { hasTotal: false, totalsChecked: 0, allBalance: true, checks: [] };
  return {
    hasTotal: true,
    totalsChecked: checks.length,
    allBalance: checks.every((c) => c.balances),
    checks: checks.map((c) => ({
      marker: c.marker,
      statedTotal: c.statedTotal,
      computedSum: c.computedSum,
      statedDisplay: formatValue(c.statedTotal),
      computedDisplay: formatValue(c.computedSum),
      difference: c.difference,
      balances: c.balances,
      itemCount: c.itemCount,
    })),
  };
}

interface ExportOptions {
  scope: CorpusScope;
  scopeSummary: string;
  includeUserState: boolean;
  includeSigns: boolean;
  includeWordFrequencies: boolean;
  hypothesis: PhoneticOverrides;
  // Source-of-truth lookups for the user-state side.
  annotations: Annotation[];
  collections: Collection[];
  pins: Pin[];
  tabletCategoryOverrides: Record<string, string>;
}

export interface InscriptionExport {
  id: string;
  site: string;
  period: string;
  scribe: string;
  support: string;
  findspot: string;
  name: string;
  words: string[];
  translations: string[];
  lines: string[][];
  glyphs: string;
  transcription: string;
  images: {
    facsimile: string[];
    photograph: string[];
    rights: string;
    rightsUrl: string;
  };
  derived: {
    multiSignWordCount: number;
    tabletStructureHeuristic: StructCategory;
    tabletStructureCategory: StructCategory;
    tabletStructureOverridden: boolean;
    balance?: BalanceSummary;
  };
  userState?: {
    annotations: Pick<
      Annotation,
      "id" | "proposedMeaning" | "confidence" | "notes" | "evidenceIds"
    >[];
    collections: string[];
    pinned: boolean;
  };
}

export interface CorpusExport {
  _meta: {
    exportedAt: string;
    tool: string;
    toolRepo: string;
    methodologyUrl: string;
    corpusSource: string;
    schemaVersion: number;
    scope: CorpusScope;
    scopeSummary: string;
    inscriptionCount: number;
    includesUserState: boolean;
    includesSigns: boolean;
    includesWordFrequencies: boolean;
    notes: string[];
  };
  inscriptions: InscriptionExport[];
  signs?: SignData[];
  wordFrequencies?: { word: string; phonetic: string; count: number; sites: string[] }[];
}

/** Build the enriched, schema-versioned single-inscription record. */
export function buildInscriptionExport(
  ins: Inscription,
  opts: Pick<
    ExportOptions,
    "includeUserState" | "annotations" | "collections" | "pins" | "tabletCategoryOverrides"
  >,
): InscriptionExport {
  const heuristic = heuristicCategory(ins);
  const override = opts.tabletCategoryOverrides[ins.id] as StructCategory | undefined;
  const effective: StructCategory =
    override && ["accounting", "libation", "list", "text", "other"].includes(override)
      ? override
      : heuristic;
  const rec: InscriptionExport = {
    id: ins.id,
    site: ins.site,
    period: ins.context,
    scribe: ins.scribe,
    support: ins.support,
    findspot: ins.findspot,
    name: ins.name,
    words: ins.words,
    translations: ins.translations,
    lines: ins.lines,
    glyphs: ins.glyphs,
    transcription: ins.transcription,
    images: {
      facsimile: ins.facsimileImages,
      photograph: ins.images,
      rights: ins.imageRights,
      rightsUrl: ins.imageRightsURL,
    },
    derived: {
      multiSignWordCount: ins.words.filter((w) => w.includes("-")).length,
      tabletStructureHeuristic: heuristic,
      tabletStructureCategory: effective,
      tabletStructureOverridden: !!override && override !== heuristic,
      balance: balanceSummary(ins),
    },
  };
  if (opts.includeUserState) {
    const userAnnotations = opts.annotations.filter(
      (a) => a.target.kind === "inscription" && a.target.value === ins.id,
    );
    const collectionNames = opts.collections
      .filter((c) =>
        c.items.some((i) => i.kind === "inscription" && i.value === ins.id),
      )
      .map((c) => c.name);
    const pinned = opts.pins.some(
      (p) => p.kind === "inscription" && p.value === ins.id,
    );
    rec.userState = {
      annotations: userAnnotations.map((a) => ({
        id: a.id,
        proposedMeaning: a.proposedMeaning,
        confidence: a.confidence,
        notes: a.notes,
        evidenceIds: a.evidenceIds,
      })),
      collections: collectionNames,
      pinned,
    };
  }
  return rec;
}

/** Build the full enriched corpus export (one inscription per `inscriptions[]`
 *  entry, plus optional signs + word frequencies). Respects the active scope
 *  via the pre-filtered `inscriptions` list the caller passes in. */
export function buildCorpusExport(
  inscriptions: Inscription[],
  signs: SignData[],
  wordIndex: Map<string, WordEntry>,
  opts: ExportOptions,
): CorpusExport {
  const notes: string[] = [
    "Each entry under `inscriptions[]` is a single tablet/document.",
    "`words` is the flat token sequence (line-break markers removed); `lines` preserves the physical line grouping.",
    "`derived.tabletStructureCategory` reflects any researcher override (`tabletStructureOverridden` flags it). `tabletStructureHeuristic` is always the raw rule-based call.",
    "`derived.balance` is present only when the inscription's `lines` could be parsed for accounting checks (KU-RO / PO-TO-KU-RO totals).",
    "Sign-to-Unicode mapping is empirical (see methodology). `derived.multiSignWordCount` counts only the syllabic words (containing `-`), excluding numerals, ideograms, separators.",
    "The schema version (`_meta.schemaVersion`) is bumped on any breaking change.",
  ];
  if (opts.includeUserState) {
    notes.push(
      "`userState` blocks preserve researcher annotations, collection memberships, and pin state at export time.",
    );
  }
  const result: CorpusExport = {
    _meta: {
      exportedAt: new Date().toISOString(),
      tool: TOOL_NAME,
      toolRepo: TOOL_REPO,
      methodologyUrl: METHODOLOGY_URL,
      corpusSource:
        "mwenge/lineara.xyz, transcribed from GORILA (Godart & Olivier, 1976–1985)",
      schemaVersion: SCHEMA_VERSION,
      scope: opts.scope,
      scopeSummary: opts.scopeSummary,
      inscriptionCount: inscriptions.length,
      includesUserState: opts.includeUserState,
      includesSigns: opts.includeSigns,
      includesWordFrequencies: opts.includeWordFrequencies,
      notes,
    },
    inscriptions: inscriptions.map((ins) => buildInscriptionExport(ins, opts)),
  };
  if (opts.includeSigns) {
    result.signs = signs;
  }
  if (opts.includeWordFrequencies) {
    const rows: { word: string; phonetic: string; count: number; sites: string[] }[] = [];
    for (const [w, d] of wordIndex) {
      if (!w.includes("-")) continue;
      rows.push({
        word: w,
        phonetic: wordToPhonetic(w, opts.hypothesis),
        count: d.count,
        sites: [...d.sites],
      });
    }
    rows.sort((a, b) => b.count - a.count);
    result.wordFrequencies = rows;
  }
  return result;
}
