export interface Inscription {
  id: string;
  site: string;
  support: string;
  scribe: string;
  findspot: string;
  context: string; // LM/MM dating period (e.g. "LMIB", "MMIIIA")
  name: string;
  words: string[]; // transliterated GORILA tokens (flat, line breaks removed)
  translations: string[]; // editorial English glosses, aligned 1:1 with words
  lines: string[][]; // tokens grouped by the tablet's physical line breaks
  glyphs: string; // raw parsedInscription — Unicode Linear A glyph string
  transcription: string;
  facsimileImages: string[];
  images: string[];
  imageRights: string;
  imageRightsURL: string;
}

export interface SignData {
  label: string; // GORILA label, e.g. "KA" or "*301"
  glyph: string | null; // Unicode Linear A character (modal of corpus alignment); null when the sign has no Unicode encoding (the *9xx complex signs)
  codepoint: number | null;
  phonetic: string | null; // Linear B value if AB-shared
  sharedWithLinearB: boolean;
  linearAOnly: boolean;
  total: number; // attestation count in alignment
  confidence: number; // 0-1 — modal-glyph fraction
  altGlyphs: { glyph: string; count: number }[];
}

export interface WordEntry {
  count: number;
  inscriptionIds: string[];
  sites: Set<string>;
}

export interface SiteEntry {
  count: number;
  inscriptionIds: string[];
}

export interface ComparisonEntry {
  w: string; // word in source script
  m: string; // meaning
  d: string; // domain code
  p?: string; // precomputed phonetic form
}

export type ComparisonLanguages = Record<string, ComparisonEntry[]>;

export interface PhoneticOverrides {
  [sign: string]: string;
}

export type ThemeMode = "dark" | "light";

export interface DisplaySettings {
  showGlyphsInline: boolean; // render Linear A glyphs next to word transliterations
  showPhoneticInline: boolean; // show /phon/ form next to words
  showAnnotationChips: boolean; // colored dot for annotated targets (fallback when word tools off)
  inlineWordTools: boolean; // inline ✎ control on every word (annotate + collections + pin)
  compactTables: boolean; // tighter row padding
  pinRailVisible: boolean; // collapsed even when pins exist
  hoverPreviews: boolean; // tooltip-card on hover
  pinRailWidth: number; // px, user-resizable
  theme: ThemeMode; // overall color scheme (dark default, light alternative)
}

export type PinKind = "word" | "inscription";
export interface Pin {
  id: string;
  kind: PinKind;
  value: string;
  pinnedAt: string;
  note?: string;
}

export interface Collection {
  id: string;
  name: string;
  items: { kind: "word" | "inscription"; value: string }[];
  createdAt: string;
  updatedAt: string;
}

// A saved "finding": a result/view captured from any analysis module — the
// module that produced it, a user title, a human-readable summary, and an
// optional JSON payload the module can use to restore the exact view. Tracked
// as a list, exportable, and compiled into the research report.
export interface Finding {
  id: string;
  module: ModuleId;
  moduleLabel: string; // display name at save time (e.g. "Compare Inscriptions")
  title: string;
  summary: string; // readable snapshot (may be multi-line, the one-line story)
  payload?: unknown; // module-specific restore data, JSON-serializable
  // Pre-rendered representation of the actual result, captured at save time —
  // used by the research report so the finding shows the table / list / view
  // that produced it, not just the headline summary.
  report?: { html: string; markdown?: string };
  notes?: string;
  createdAt: string;
}

export interface OverrideEvidence {
  note: string;
  evidenceWords: string[];
  evidenceInscriptionIds: string[];
}

// Free-form Markdown note in My Research. References to other items live in
// the body as Markdown links with a special URL scheme — see noteRefs in
// lib/notes.ts. The persisted shape stays plain JSON for easy backup.
export interface ResearchNote {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedHypothesis {
  name: string;
  overrides: PhoneticOverrides;
  timestamp: string;
  notes: string;
  evidence: Record<string, OverrideEvidence>;
}

export interface MatchResult {
  word: string;
  meaning: string;
  domain: string;
  lang: string;
  dist: number;
  linearPhonetic: string;
  comparePhonetic: string;
}

export type AnnotationTarget =
  | { kind: "word"; value: string }
  | { kind: "inscription"; value: string }
  | { kind: "sign"; value: string };

export type Confidence = "low" | "medium" | "high";

export interface Annotation {
  id: string;
  target: AnnotationTarget;
  proposedMeaning: string;
  confidence: Confidence;
  notes: string;
  evidenceIds: string[]; // inscription IDs supporting this reading
  createdAt: string;
  updatedAt: string;
}

// Lightweight "intent" carried alongside a module switch so deep-links from
// the Help system can pre-select tabs / views.
export interface ModuleIntent {
  tab?: string;
  focus?: string;
  // Full saved-state restoration (findings rehydration): the payload a
  // SaveFindingButton recorded with the finding. Modules that support it
  // read their own fields back out in their state initializers; unknown
  // fields are ignored, so stale payloads degrade gracefully.
  payload?: Record<string, unknown>;
}

// Global "corpus scope": a workbench-wide filter that restricts which
// inscriptions the analysis modules see. Each dimension is single-select and
// combines with the others by AND (e.g. site=Haghia Triada AND period=LMIB).
// `collectionId` scopes to the inscription members of a saved collection.
// All-null means "whole corpus" (no filtering, zero cost).
export interface CorpusScope {
  site: string | null;
  period: string | null;
  scribe: string | null;
  support: string | null;
  collectionId: string | null;
}

export type ModuleId =
  | "home"
  | "search"
  | "browse"
  | "freq"
  | "morph"
  | "cooc"
  | "ngram"
  | "arith"
  | "signs"
  | "signref"
  | "comp"
  | "hyp"
  | "sem"
  | "pos"
  | "struct"
  | "lib"
  | "roots"
  | "seqpat"
  | "geo"
  | "hypws"
  | "export"
  | "wlm"
  | "annot"
  | "lexicon"
  | "query"
  | "compare"
  | "network"
  | "collections"
  | "similarity"
  | "map"
  | "kwic"
  | "stems"
  | "scribes"
  | "scribenet"
  | "commodities"
  | "signtrans"
  | "minpairs"
  | "lexstats"
  | "diachronic"
  | "onomastics"
  | "report"
  | "methodology"
  | "signpat"
  | "commentary"
  | "pyaegean"
  | "health"
  | "doctypes"
  | "dossiers"
  | "metrology"
  | "timeline"
  | "reader"
  | "school"
  | "write"
  | "trainer"
  | "constellation"
  | "plates"
  | "help";

// Calibration badge surfaced inside each analytical module — makes the
// descriptive vs hypothesis-generating distinction visible at the point of
// use, not just in the README. Modules that aren't analytical (My Research,
// Query Builder, Corpus Search, Data Export, Wordlist Manager, Help,
// Methodology) leave this undefined and render no badge.
//   "descriptive": direct counts and structural observations from the corpus.
//   "exploratory": heuristic / interpretive output that should be treated as
//                  hypothesis to verify, not as evidence in itself.
export type ModuleCategory = "descriptive" | "exploratory";

export interface ModuleDef {
  id: ModuleId;
  name: string;
  group: string;
  // Extra search terms for the command palette — useful for consolidated
  // modules whose sub-views (e.g. "network", "collections") aren't in the name.
  keywords?: string;
  category?: ModuleCategory;
}
