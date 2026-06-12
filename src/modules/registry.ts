import { lazy, type ComponentType } from "react";
import type { ModuleDef, ModuleId } from "../lib/types";

// Sidebar groups, ordered by workflow with the researcher's own workspace
// first. Within each group, modules are ordered by likely frequency of use.
export const MODULE_GROUPS: { group: string; items: ModuleDef[] }[] = [
  {
    group: "Research",
    items: [
      // My Research merges the annotation notebook, collections, the findings
      // tracker, and the research report into one hub (tabs).
      {
        id: "annot",
        name: "My Research",
        group: "Research",
        keywords:
          "annotations notebook collections research report findings export notes",
      },
      {
        id: "lexicon",
        name: "My Lexicon",
        group: "Research",
        keywords: "lexicon glossary meanings annotations dictionary vocabulary",
      },
      { id: "query", name: "Query Builder", group: "Research" },
      { id: "search", name: "Corpus Search", group: "Research" },
      {
        id: "browse",
        name: "Corpus Browser",
        group: "Research",
        keywords: "browse tablets paginate walk by glyph sign index imagery",
      },
      {
        id: "commentary",
        name: "Commentary Browser",
        group: "Research",
        keywords:
          "commentary younger ku scholarly browse read inscription notes academia full-text search reference",
      },
      {
        id: "export",
        name: "Data Export",
        group: "Research",
        keywords:
          "export csv json data backup restore wipe reset cache lost recover transfer",
      },
      { id: "wlm", name: "Wordlist Manager", group: "Research" },
      {
        id: "health",
        name: "Corpus Health",
        group: "Research",
        keywords:
          "health dashboard coverage completeness damage uncertain metadata quality missing scribe period image translation",
      },
    ],
  },
  {
    group: "Vocabulary",
    items: [
      { id: "freq", name: "Word Frequency", group: "Vocabulary", category: "descriptive" },
      { id: "kwic", name: "Concordance (KWIC)", group: "Vocabulary", category: "descriptive" },
      {
        id: "cooc",
        name: "Co-occurrence",
        group: "Vocabulary",
        keywords: "network graph collocation pmi force-directed collocates",
        category: "descriptive",
      },
      { id: "ngram", name: "N-grams", group: "Vocabulary", category: "descriptive" },
      { id: "morph", name: "Morphology", group: "Vocabulary", category: "exploratory" },
      { id: "stems", name: "Stem Families", group: "Vocabulary", category: "exploratory" },
      { id: "minpairs", name: "Minimal Pairs", group: "Vocabulary", category: "descriptive" },
      { id: "roots", name: "Root Cognates", group: "Vocabulary", category: "exploratory" },
      { id: "lexstats", name: "Lexical Statistics", group: "Vocabulary", category: "descriptive" },
    ],
  },
  {
    group: "Signs & structure",
    items: [
      { id: "signref", name: "Sign Inventory", group: "Signs & structure", category: "descriptive" },
      { id: "signs", name: "Sign Concordance", group: "Signs & structure", category: "descriptive" },
      { id: "signtrans", name: "Sign Transitions", group: "Signs & structure", category: "descriptive" },
      {
        id: "signpat",
        name: "Sign Patterns",
        group: "Signs & structure",
        category: "descriptive",
        keywords: "sign pattern wildcard glob graphotactic search prefix suffix middle",
      },
      { id: "pos", name: "Positional Grammar", group: "Signs & structure", category: "descriptive" },
      { id: "seqpat", name: "Sequence Patterns", group: "Signs & structure", category: "descriptive" },
      { id: "compare", name: "Compare Inscriptions", group: "Signs & structure", category: "descriptive" },
      { id: "similarity", name: "Similarity", group: "Signs & structure", category: "descriptive" },
    ],
  },
  {
    group: "Accounts & content",
    items: [
      { id: "arith", name: "Accounting & Metrology", group: "Accounts & content", category: "descriptive" },
      {
        id: "dossiers",
        name: "Account Dossiers",
        group: "Accounts & content",
        category: "exploratory",
        keywords:
          "dossier account holder name entries quantities commodities ledger follow person prosopography",
      },
      { id: "commodities", name: "Commodity Catalog", group: "Accounts & content", category: "descriptive" },
      { id: "struct", name: "Tablet Structure", group: "Accounts & content", category: "descriptive" },
      {
        id: "doctypes",
        name: "Document Types",
        group: "Accounts & content",
        category: "descriptive",
        keywords:
          "document types support tablet roundel nodule sealing vessel libation bar physical object typology function",
      },
      { id: "lib", name: "Libation Formulas", group: "Accounts & content", category: "descriptive" },
      { id: "sem", name: "Semantic Classifier", group: "Accounts & content", category: "exploratory" },
    ],
  },
  {
    group: "Hypothesis testing",
    items: [
      { id: "comp", name: "Cross-Linguistic", group: "Hypothesis testing", category: "exploratory" },
      // Sound Shift now folds the live editor + the saved-hypothesis workspace
      // into one tabbed module; `hypws` is kept routable via the alias map so
      // deep-links / Help references still land on the Workspace tab.
      {
        id: "hyp",
        name: "Sound Shift",
        group: "Hypothesis testing",
        keywords:
          "phonetic override hypothesis workspace saved snapshot diff sound shift",
        category: "exploratory",
      },
      { id: "onomastics", name: "Name Candidates", group: "Hypothesis testing", category: "exploratory" },
    ],
  },
  {
    group: "Distribution",
    items: [
      // Geography merges the findspot map + site-distribution stats (tabs).
      {
        id: "map",
        name: "Geography",
        group: "Distribution",
        keywords: "findspot map site distribution geographic jaccard overlay",
        category: "descriptive",
      },
      // Scribes merges the per-scribe comparison + scribal network (tabs).
      {
        id: "scribes",
        name: "Scribes",
        group: "Distribution",
        keywords: "scribe comparison scribal network hand site baseline",
        category: "descriptive",
      },
      { id: "diachronic", name: "Diachronic (MM/LM)", group: "Distribution", category: "descriptive" },
    ],
  },
  {
    group: "Programmatic",
    items: [
      {
        id: "pyaegean",
        name: "Python Toolkit",
        group: "Programmatic",
        keywords:
          "python pyaegean pip code api jupyter pandas notebook programmatic snippets data round-trip",
      },
    ],
  },
  {
    group: "Help",
    items: [
      { id: "help", name: "How to Use", group: "Help" },
      {
        id: "methodology",
        name: "Methodology",
        group: "Help",
        keywords:
          "methodology math algorithms statistics pmi g2 chi-squared jaccard levenshtein fisher bonferroni wilson zipf phonetic distance citation provenance limitations",
      },
    ],
  },
];

export const ALL_MODULES: ModuleDef[] = MODULE_GROUPS.flatMap((g) => g.items);

// Secondary ids that resolve to a consolidated module's primary sidebar entry.
// Used to keep the sidebar highlight correct when a deep-link / pivot routes to
// a sub-view by its old id (e.g. "collections" → the "My Research" entry).
export const MODULE_ALIASES: Partial<Record<ModuleId, ModuleId>> = {
  network: "cooc",
  geo: "map",
  scribenet: "scribes",
  collections: "annot",
  report: "annot",
  hypws: "hyp",
};

// Consolidated modules: several ids resolve to one tabbed wrapper. The
// "secondary" ids (network, geo, scribenet, collections, report) are kept
// routable so existing deep-links / "Open in" pivots / Help links still work;
// the wrapper reads the active id to open on the right tab.
const CooccurrenceTabs = lazy(() => import("./CooccurrenceTabs"));
const Geography = lazy(() => import("./Geography"));
const Scribes = lazy(() => import("./Scribes"));
const ResearchHub = lazy(() => import("./ResearchHub"));
const SoundShiftTabs = lazy(() => import("./SoundShiftTabs"));

export const MODULE_COMPONENTS: Record<ModuleId, ComponentType> = {
  search: lazy(() => import("./CorpusSearch")),
  browse: lazy(() => import("./CorpusBrowser")),
  freq: lazy(() => import("./WordFrequency")),
  morph: lazy(() => import("./Morphology")),
  cooc: CooccurrenceTabs,
  ngram: lazy(() => import("./Ngrams")),
  arith: lazy(() => import("./ArithmeticCheck")),
  signs: lazy(() => import("./SignConcordance")),
  signref: lazy(() => import("./SignInventory")),
  comp: lazy(() => import("./CrossLinguistic")),
  hyp: SoundShiftTabs,
  sem: lazy(() => import("./SemanticClassifier")),
  pos: lazy(() => import("./PositionalGrammar")),
  struct: lazy(() => import("./TabletStructure")),
  lib: lazy(() => import("./LibationFormulas")),
  roots: lazy(() => import("./RootCognates")),
  seqpat: lazy(() => import("./SequencePatterns")),
  geo: Geography,
  hypws: SoundShiftTabs,
  export: lazy(() => import("./DataExport")),
  wlm: lazy(() => import("./WordlistManager")),
  annot: ResearchHub,
  lexicon: lazy(() => import("./MyLexicon")),
  query: lazy(() => import("./QueryBuilder")),
  compare: lazy(() => import("./CompareInscriptions")),
  network: CooccurrenceTabs,
  collections: ResearchHub,
  similarity: lazy(() => import("./Similarity")),
  map: Geography,
  kwic: lazy(() => import("./Concordance")),
  stems: lazy(() => import("./StemFamilies")),
  scribes: Scribes,
  scribenet: Scribes,
  commodities: lazy(() => import("./Commodities")),
  signtrans: lazy(() => import("./SignTransitions")),
  minpairs: lazy(() => import("./MinimalPairs")),
  lexstats: lazy(() => import("./LexicalStats")),
  diachronic: lazy(() => import("./Diachronic")),
  onomastics: lazy(() => import("./Onomastics")),
  report: ResearchHub,
  methodology: lazy(() => import("./Methodology")),
  signpat: lazy(() => import("./SignPatterns")),
  commentary: lazy(() => import("./CommentaryBrowser")),
  pyaegean: lazy(() => import("./PythonToolkit")),
  health: lazy(() => import("./CorpusHealth")),
  doctypes: lazy(() => import("./DocumentTypes")),
  dossiers: lazy(() => import("./AccountDossiers")),
  help: lazy(() => import("./Help")),
};
