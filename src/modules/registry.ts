import { lazy, type ComponentType } from "react";
import type { ModuleDef, ModuleId } from "../lib/types";

// Sidebar groups, ordered by workflow with the researcher's own workspace
// first. Related views are consolidated into tabbed workspaces (34 sidebar
// entries across 9 groups); every legacy sub-view id stays routable via
// MODULE_ALIASES and MODULE_COMPONENTS so existing permalinks, Help links,
// and Command Palette searches land on the exact tab.
export const MODULE_GROUPS: { group: string; items: ModuleDef[] }[] = [
  {
    group: "Start",
    items: [
      {
        id: "home",
        name: "Home",
        group: "Start",
        keywords:
          "home getting started welcome landing overview intro first credits",
      },
    ],
  },
  {
    group: "Research",
    items: [
      {
        id: "annot",
        name: "My Research",
        group: "Research",
        keywords:
          "annotations notebook lexicon glossary meanings dictionary collections research report findings export notes",
      },
      { id: "query", name: "Query Builder", group: "Research" },
      {
        id: "commentary",
        name: "Commentary Browser",
        group: "Research",
        keywords:
          "commentary younger ku scholarly browse read inscription notes academia full-text search reference",
      },
      {
        id: "browse",
        name: "Corpus Explorer",
        group: "Research",
        keywords:
          "browse tablets paginate walk by glyph sign index imagery plates facsimile photographs gorila autopsy viewer",
      },
      {
        id: "health",
        name: "Corpus Health",
        group: "Research",
        keywords:
          "health dashboard coverage completeness damage uncertain metadata quality missing scribe period image translation",
      },
      { id: "search", name: "Corpus Search", group: "Research" },
      {
        id: "export",
        name: "Data Export & Python",
        group: "Research",
        keywords:
          "export csv json data backup restore wipe reset cache recover transfer python pyaegean pip code api jupyter pandas notebook cli mcp",
      },
    ],
  },
  {
    group: "Vocabulary",
    items: [
      {
        id: "cooc",
        name: "Co-occurrence",
        group: "Vocabulary",
        keywords: "network graph collocation pmi force-directed collocates",
        category: "descriptive",
      },
      { id: "kwic", name: "Concordance (KWIC)", group: "Vocabulary", category: "descriptive" },
      { id: "lexstats", name: "Lexical Statistics", group: "Vocabulary", category: "descriptive" },
      {
        id: "morph",
        name: "Morphology & Paradigms",
        group: "Vocabulary",
        keywords:
          "morphology affixes prefix suffix stem families kober paradigm minimal pairs substitution root cognates consonant skeleton",
        category: "exploratory",
      },
      { id: "ngram", name: "N-grams", group: "Vocabulary", category: "descriptive" },
      { id: "freq", name: "Word Frequency", group: "Vocabulary", category: "descriptive" },
    ],
  },
  {
    group: "Signs & structure",
    items: [
      { id: "compare", name: "Compare Inscriptions", group: "Signs & structure", category: "descriptive" },
      { id: "pos", name: "Positional Grammar", group: "Signs & structure", category: "descriptive" },
      { id: "seqpat", name: "Sequence Patterns", group: "Signs & structure", category: "descriptive" },
      {
        id: "signref",
        name: "Signs & Graphotactics",
        group: "Signs & structure",
        keywords:
          "sign inventory concordance linear b ab shared transitions bigram surprisal pattern wildcard glob graphotactic search",
        category: "descriptive",
      },
      { id: "similarity", name: "Similarity", group: "Signs & structure", category: "descriptive" },
    ],
  },
  {
    group: "Accounts & content",
    items: [
      {
        id: "arith",
        name: "Accounting & Metrology",
        group: "Accounts & content",
        keywords:
          "accounting balance kuro total metrology fractions klasmatogram numerals units measures denominators dossiers account holder prosopography",
        category: "descriptive",
      },
      { id: "commodities", name: "Commodity Catalog", group: "Accounts & content", category: "descriptive" },
      {
        id: "struct",
        name: "Document Typology",
        group: "Accounts & content",
        keywords:
          "tablet structure document types support tablet roundel nodule sealing vessel libation bar typology classification",
        category: "descriptive",
      },
      { id: "lib", name: "Libation Formulas", group: "Accounts & content", category: "descriptive" },
      { id: "sem", name: "Semantic Classifier", group: "Accounts & content", category: "exploratory" },
    ],
  },
  {
    group: "Hypothesis testing",
    items: [
      {
        id: "comp",
        name: "Cross-Linguistic",
        group: "Hypothesis testing",
        keywords:
          "cross linguistic comparator wordlist manager custom wordlists akkadian hittite luwian hurrian ugaritic mycenaean egyptian",
        category: "exploratory",
      },
      { id: "onomastics", name: "Name Candidates", group: "Hypothesis testing", category: "exploratory" },
      {
        id: "hyp",
        name: "Sound Shift",
        group: "Hypothesis testing",
        keywords:
          "phonetic override hypothesis workspace saved snapshot diff sound shift",
        category: "exploratory",
      },
    ],
  },
  {
    group: "Distribution",
    items: [
      {
        id: "timeline",
        name: "Chronology",
        group: "Distribution",
        keywords:
          "timeline chronology diachronic periods MM LM protopalatial neopalatial dates ceramic phases keyness",
        category: "descriptive",
      },
      {
        id: "constellation",
        name: "Constellation",
        group: "Distribution",
        keywords:
          "constellation map embedding correspondence analysis all tablets scatter overview",
        category: "exploratory",
      },
      {
        id: "map",
        name: "Geography",
        group: "Distribution",
        keywords: "findspot map site distribution geographic jaccard overlay",
        category: "descriptive",
      },
      {
        id: "scribes",
        name: "Scribes",
        group: "Distribution",
        keywords: "scribe comparison scribal network hand site baseline",
        category: "descriptive",
      },
    ],
  },
  {
    group: "Learn",
    items: [
      {
        id: "reader",
        name: "Guided Reader",
        group: "Learn",
        keywords:
          "guided reader learn tutorial walkthrough beginner read tablet step by step teach",
      },
      {
        id: "school",
        name: "Scribe School",
        group: "Learn",
        keywords:
          "scribe school practice exercise balance kuro total compute numerals fractions compose ledger sandbox quiz",
      },
      {
        id: "trainer",
        name: "Sign Trainer",
        group: "Learn",
        keywords:
          "sign trainer flashcards leitner memorize learn signs values practice spaced repetition",
      },
      {
        id: "write",
        name: "Write in Linear A",
        group: "Learn",
        keywords:
          "write your name linear a glyphs syllables transliterate convert render",
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
// a sub-view by its legacy id (e.g. "metrology" → "Accounting & Metrology").
export const MODULE_ALIASES: Partial<Record<ModuleId, ModuleId>> = {
  network: "cooc",
  geo: "map",
  scribenet: "scribes",
  collections: "annot",
  report: "annot",
  lexicon: "annot",
  hypws: "hyp",
  metrology: "arith",
  dossiers: "arith",
  signs: "signref",
  signtrans: "signref",
  signpat: "signref",
  diachronic: "timeline",
  stems: "morph",
  minpairs: "morph",
  roots: "morph",
  doctypes: "struct",
  plates: "browse",
  wlm: "comp",
  pyaegean: "export",
};

// Consolidated tabbed workspaces. Every legacy ModuleId remains routable so
// existing permalinks, Help links, and pivots open directly on the right tab.
const AccountingTabs = lazy(() => import("./AccountingTabs"));
const ChronologyTabs = lazy(() => import("./ChronologyTabs"));
const CooccurrenceTabs = lazy(() => import("./CooccurrenceTabs"));
const CorpusExplorerTabs = lazy(() => import("./CorpusExplorerTabs"));
const CrossLinguisticTabs = lazy(() => import("./CrossLinguisticTabs"));
const DocumentTypologyTabs = lazy(() => import("./DocumentTypologyTabs"));
const ExportTabs = lazy(() => import("./ExportTabs"));
const Geography = lazy(() => import("./Geography"));
const MorphologyTabs = lazy(() => import("./MorphologyTabs"));
const ResearchHub = lazy(() => import("./ResearchHub"));
const Scribes = lazy(() => import("./Scribes"));
const SignsTabs = lazy(() => import("./SignsTabs"));
const SoundShiftTabs = lazy(() => import("./SoundShiftTabs"));

export const MODULE_COMPONENTS: Record<ModuleId, ComponentType> = {
  home: lazy(() => import("./Home")),
  search: lazy(() => import("./CorpusSearch")),
  browse: CorpusExplorerTabs,
  plates: CorpusExplorerTabs,
  freq: lazy(() => import("./WordFrequency")),
  morph: MorphologyTabs,
  stems: MorphologyTabs,
  minpairs: MorphologyTabs,
  roots: MorphologyTabs,
  cooc: CooccurrenceTabs,
  network: CooccurrenceTabs,
  ngram: lazy(() => import("./Ngrams")),
  arith: AccountingTabs,
  metrology: AccountingTabs,
  dossiers: AccountingTabs,
  signref: SignsTabs,
  signs: SignsTabs,
  signtrans: SignsTabs,
  signpat: SignsTabs,
  comp: CrossLinguisticTabs,
  wlm: CrossLinguisticTabs,
  hyp: SoundShiftTabs,
  hypws: SoundShiftTabs,
  sem: lazy(() => import("./SemanticClassifier")),
  pos: lazy(() => import("./PositionalGrammar")),
  struct: DocumentTypologyTabs,
  doctypes: DocumentTypologyTabs,
  lib: lazy(() => import("./LibationFormulas")),
  seqpat: lazy(() => import("./SequencePatterns")),
  geo: Geography,
  map: Geography,
  export: ExportTabs,
  pyaegean: ExportTabs,
  annot: ResearchHub,
  lexicon: ResearchHub,
  collections: ResearchHub,
  report: ResearchHub,
  query: lazy(() => import("./QueryBuilder")),
  compare: lazy(() => import("./CompareInscriptions")),
  similarity: lazy(() => import("./Similarity")),
  kwic: lazy(() => import("./Concordance")),
  scribes: Scribes,
  scribenet: Scribes,
  commodities: lazy(() => import("./Commodities")),
  lexstats: lazy(() => import("./LexicalStats")),
  timeline: ChronologyTabs,
  diachronic: ChronologyTabs,
  onomastics: lazy(() => import("./Onomastics")),
  methodology: lazy(() => import("./Methodology")),
  commentary: lazy(() => import("./CommentaryBrowser")),
  health: lazy(() => import("./CorpusHealth")),
  reader: lazy(() => import("./GuidedReader")),
  school: lazy(() => import("./ScribeSchool")),
  write: lazy(() => import("./WriteLinearA")),
  trainer: lazy(() => import("./SignTrainer")),
  constellation: lazy(() => import("./Constellation")),
  help: lazy(() => import("./Help")),
};
