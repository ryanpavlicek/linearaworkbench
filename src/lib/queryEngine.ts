// Compound-query predicate engine for the Query Builder: the field registry,
// per-row inscription/word predicates, AND/OR/NOT combination, and the query
// evaluator. Pure (operates on passed-in indices), extracted from
// QueryBuilder.tsx so the component is presentational and this is unit-tested.
import type { Inscription, WordEntry } from "./types";
import { wordMatchesSignPattern } from "./signPattern";
import { phoneticKeyOf } from "./signKeys";

// ---- Field registry ----------------------------------------------------

export type FieldKind =
  | "text"
  | "number"
  | "boolean"
  | "site"
  | "scribe"
  | "period"
  | "support"
  | "word"
  | "sign";

export type FieldId =
  | "id-contains"
  | "site-is"
  | "scribe-is"
  | "period-is"
  | "support-is"
  | "has-image"
  | "has-annotation"
  | "ins-contains-word"
  | "word-contains"
  | "word-prefix"
  | "word-suffix"
  | "word-min-syllables"
  | "word-max-syllables"
  | "word-contains-sign"
  | "word-cooccurs-with"
  | "word-sign-pattern";

export interface FieldDef {
  label: string;
  scope: "inscription" | "word";
  kind: FieldKind;
}

export const FIELDS: Record<FieldId, FieldDef> = {
  "id-contains": { label: "Inscription ID contains", scope: "inscription", kind: "text" },
  "site-is": { label: "Site is", scope: "inscription", kind: "site" },
  "scribe-is": { label: "Scribe is", scope: "inscription", kind: "scribe" },
  "period-is": { label: "Period is", scope: "inscription", kind: "period" },
  "support-is": { label: "Support is", scope: "inscription", kind: "support" },
  "has-image": { label: "Has facsimile image", scope: "inscription", kind: "boolean" },
  "has-annotation": { label: "Has annotation", scope: "inscription", kind: "boolean" },
  "ins-contains-word": { label: "Contains exact word", scope: "inscription", kind: "word" },
  "word-contains": { label: "Word contains text", scope: "word", kind: "text" },
  "word-prefix": { label: "Word starts with", scope: "word", kind: "text" },
  "word-suffix": { label: "Word ends with", scope: "word", kind: "text" },
  "word-min-syllables": { label: "Word has ≥ N signs", scope: "word", kind: "number" },
  "word-max-syllables": { label: "Word has ≤ N signs", scope: "word", kind: "number" },
  "word-contains-sign": { label: "Word contains sign", scope: "word", kind: "sign" },
  "word-cooccurs-with": { label: "Word co-occurs with", scope: "word", kind: "word" },
  "word-sign-pattern": { label: "Word matches sign pattern", scope: "word", kind: "text" },
};

export type Connector = "and" | "or";

export interface FilterRow {
  rid: string;
  field: FieldId;
  value: unknown;
  // How this row joins the running result within its scope (ignored on the
  // first row of a scope). `negate` flips the row's own test (NOT).
  connector?: Connector;
  negate?: boolean;
}

export interface SavedQuery {
  id: string;
  name: string;
  filters: FilterRow[];
  output: "inscriptions" | "words";
}

export function defaultValue(field: FieldId): unknown {
  const k = FIELDS[field].kind;
  if (k === "number") return 2;
  if (k === "boolean") return true;
  return "";
}

// ---- Evaluation --------------------------------------------------------

// Combine a scope's rows left-to-right: result starts at the first row's test,
// then each subsequent row joins with its connector (default AND). An empty
// scope is vacuously true. `negate` flips an individual row's test.
function combineRows(
  rows: FilterRow[],
  test: (f: FilterRow) => boolean,
): boolean {
  let acc: boolean | null = null;
  for (const f of rows) {
    let m = test(f);
    if (f.negate) m = !m;
    if (acc === null) acc = m;
    else acc = f.connector === "or" ? acc || m : acc && m;
  }
  return acc ?? true;
}

// Whether a single inscription-scope row's condition holds. An empty value is
// neutral (true), matching the original behavior.
function inscriptionRowMatch(
  ins: Inscription,
  f: FilterRow,
  annotatedIds: Set<string>,
): boolean {
  const v = f.value;
  switch (f.field) {
    case "id-contains":
      return !v || ins.id.toUpperCase().includes(String(v).toUpperCase());
    case "site-is":
      return !v || ins.site === v;
    case "scribe-is":
      return !v || ins.scribe === v;
    case "period-is":
      return !v || ins.context === v;
    case "support-is":
      return !v || ins.support === v;
    case "has-image": {
      const has = ins.facsimileImages.length > 0 || ins.images.length > 0;
      return v ? has : !has;
    }
    case "has-annotation": {
      const has = annotatedIds.has(ins.id);
      return v ? has : !has;
    }
    case "ins-contains-word":
      return !v || ins.words.includes(String(v));
    default:
      return true;
  }
}

export function inscriptionMatches(
  ins: Inscription,
  filters: FilterRow[],
  annotatedIds: Set<string>,
): boolean {
  const rows = filters.filter((f) => FIELDS[f.field].scope === "inscription");
  return combineRows(rows, (f) => inscriptionRowMatch(ins, f, annotatedIds));
}

function wordRowMatch(
  word: string,
  f: FilterRow,
  cooccurMap: Map<string, Set<string>>,
): boolean {
  const v = f.value;
  const upper = word.toUpperCase();
  const parts = word.split("-");
  switch (f.field) {
    case "word-contains":
      return !v || upper.includes(String(v).toUpperCase());
    case "word-prefix":
      return !v || upper.startsWith(String(v).toUpperCase());
    case "word-suffix":
      return !v || upper.endsWith(String(v).toUpperCase());
    case "word-min-syllables":
      return String(v ?? "").trim() === "" || parts.length >= Number(v);
    case "word-max-syllables":
      return String(v ?? "").trim() === "" || parts.length <= Number(v);
    case "word-contains-sign": {
      if (!v) return true;
      // Both sides share the sign key: only the "*" of unread labels is
      // stripped (so "*301" and "301" both find *301-bearing words) and the
      // query folds to the corpus's uppercase convention. Subscripted signs
      // stay distinct — RA₂ matches only RA₂, never plain RA, and vice versa.
      const target = phoneticKeyOf(String(v)).toUpperCase();
      return parts.some((p) => phoneticKeyOf(p).toUpperCase() === target);
    }
    case "word-cooccurs-with":
      return !v || !!cooccurMap.get(word)?.has(String(v));
    case "word-sign-pattern":
      return !v || wordMatchesSignPattern(word, String(v));
    default:
      return true;
  }
}

export function wordMatches(
  word: string,
  filters: FilterRow[],
  cooccurMap: Map<string, Set<string>>,
): boolean {
  const rows = filters.filter((f) => FIELDS[f.field].scope === "word");
  return combineRows(rows, (f) => wordRowMatch(word, f, cooccurMap));
}

export interface QueryResults {
  inscriptions: Inscription[];
  words: [string, number][];
}

// Run a query (filters + output mode) over the corpus and return the result
// set in canonical shape. Factored out so the diff feature can evaluate a
// second saved query against the same indices.
export function evalQuery(
  filters: FilterRow[],
  output: "inscriptions" | "words",
  inscriptions: Inscription[],
  wordIndex: Map<string, WordEntry>,
  annotatedIds: Set<string>,
  cooccurMap: Map<string, Set<string>>,
): QueryResults {
  const matchingIns = inscriptions.filter((i) =>
    inscriptionMatches(i, filters, annotatedIds),
  );
  const hasWordFilters = filters.some(
    (f) => FIELDS[f.field].scope === "word",
  );
  if (output === "inscriptions") {
    if (!hasWordFilters) return { inscriptions: matchingIns, words: [] };
    return {
      inscriptions: matchingIns.filter((i) =>
        i.words.some(
          (w) => w.includes("-") && wordMatches(w, filters, cooccurMap),
        ),
      ),
      words: [],
    };
  }
  const matchedIds = new Set(matchingIns.map((i) => i.id));
  const wordCounts = new Map<string, number>();
  for (const [w, e] of wordIndex) {
    if (!w.includes("-")) continue;
    if (!wordMatches(w, filters, cooccurMap)) continue;
    let cnt = 0;
    for (const id of e.inscriptionIds) if (matchedIds.has(id)) cnt++;
    if (cnt > 0) wordCounts.set(w, cnt);
  }
  return {
    inscriptions: [],
    words: [...wordCounts.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// One-line label for a filter set — used for finding titles, collection names,
// and diff-view headers.
export function summarizeFilters(filters: FilterRow[]): string {
  const parts = filters
    .map((f) => {
      const def = FIELDS[f.field];
      const v = f.value;
      const valTxt =
        def.kind === "boolean"
          ? v
            ? "yes"
            : "no"
          : String(v ?? "").trim() || "(any)";
      const neg = f.negate ? "NOT " : "";
      return `${neg}${def.label}: ${valTxt}`;
    });
  return parts.join(" · ") || "(no filters)";
}
