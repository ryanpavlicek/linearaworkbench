import { useEffect, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { InscriptionLink } from "../components/InscriptionLink";
import { WordToken } from "../components/WordToken";
import { WordAutocomplete } from "../components/WordAutocomplete";
import { Glyph } from "../components/Glyph";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { KEYS, loadJson, saveJson } from "../lib/persistence";
import type { Inscription, ModuleId, WordEntry } from "../lib/types";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import { wordMatchesSignPattern } from "../lib/signPattern";

// ---- Field registry ----------------------------------------------------

type FieldKind =
  | "text"
  | "number"
  | "boolean"
  | "site"
  | "scribe"
  | "period"
  | "support"
  | "word"
  | "sign";

type FieldId =
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

interface FieldDef {
  label: string;
  scope: "inscription" | "word";
  kind: FieldKind;
}

const FIELDS: Record<FieldId, FieldDef> = {
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

type Connector = "and" | "or";

interface FilterRow {
  rid: string;
  field: FieldId;
  value: unknown;
  // How this row joins the running result within its scope (ignored on the
  // first row of a scope). `negate` flips the row's own test (NOT).
  connector?: Connector;
  negate?: boolean;
}

interface SavedQuery {
  id: string;
  name: string;
  filters: FilterRow[];
  output: "inscriptions" | "words";
}

function defaultValue(field: FieldId): unknown {
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

function inscriptionMatches(
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
      return parts.length >= Number(v);
    case "word-max-syllables":
      return parts.length <= Number(v);
    case "word-contains-sign": {
      if (!v) return true;
      const target = String(v).toUpperCase();
      return parts.some(
        (p) => p.replace(/[₂₃₄*]/g, "").toUpperCase() === target,
      );
    }
    case "word-cooccurs-with":
      return !v || !!cooccurMap.get(word)?.has(String(v));
    case "word-sign-pattern":
      return !v || wordMatchesSignPattern(word, String(v));
    default:
      return true;
  }
}

function wordMatches(
  word: string,
  filters: FilterRow[],
  cooccurMap: Map<string, Set<string>>,
): boolean {
  const rows = filters.filter((f) => FIELDS[f.field].scope === "word");
  return combineRows(rows, (f) => wordRowMatch(word, f, cooccurMap));
}

interface QueryResults {
  inscriptions: Inscription[];
  words: [string, number][];
}

// Run a query (filters + output mode) over the corpus and return the result
// set in canonical shape. Factored out so the diff feature can evaluate a
// second saved query against the same indices.
function evalQuery(
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
function summarizeFilters(filters: FilterRow[]): string {
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

// ---- UI ---------------------------------------------------------------

export default function QueryBuilder() {
  const inscriptions = useWorkbench((s) => s.corpus.inscriptions);
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const annotations = useWorkbench((s) => s.annotations);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const createCollectionWithItems = useWorkbench(
    (s) => s.createCollectionWithItems,
  );
  const setScope = useWorkbench((s) => s.setScope);
  const toast = useWorkbench((s) => s.toast_show);

  const [filters, setFilters] = useState<FilterRow[]>([
    { rid: "1", field: "site-is", value: "" },
  ]);
  const [output, setOutput] = useState<"inscriptions" | "words">(
    "inscriptions",
  );
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(
    () => loadJson<SavedQuery[]>(KEYS.savedQueries, []),
  );
  const [name, setName] = useState("");
  const [showResults, setShowResults] = useState(true);
  // Diff mode: when set, results split into Only-in-A / Both / Only-in-B
  // against the chosen saved query.
  const [diffWithId, setDiffWithId] = useState<string | null>(null);
  // Which diff slice the table is currently showing.
  type DiffTab = "onlyA" | "both" | "onlyB";
  const [diffTab, setDiffTab] = useState<DiffTab>("onlyA");
  // Inline "Save as collection" prompt visibility + name.
  const [collectionPromptOpen, setCollectionPromptOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");

  useEffect(() => {
    saveJson(KEYS.savedQueries, savedQueries);
  }, [savedQueries]);

  // Lookup data
  const sites = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.site).filter(Boolean))].sort(),
    [inscriptions],
  );
  const scribes = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.scribe).filter(Boolean))].sort(),
    [inscriptions],
  );
  const periods = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.context).filter(Boolean))].sort(),
    [inscriptions],
  );
  const supports = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.support).filter(Boolean))].sort(),
    [inscriptions],
  );
  const annotatedInscriptionIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of annotations)
      if (a.target.kind === "inscription") set.add(a.target.value);
    return set;
  }, [annotations]);

  const cooccurMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const ins of inscriptions) {
      const ws = ins.words.filter((w) => w.includes("-"));
      for (const w of ws) {
        let set = map.get(w);
        if (!set) {
          set = new Set();
          map.set(w, set);
        }
        for (const other of ws) if (other !== w) set.add(other);
      }
    }
    return map;
  }, [inscriptions]);

  // Evaluate the current query.
  const results = useMemo(
    () =>
      evalQuery(
        filters,
        output,
        inscriptions,
        wordIndex,
        annotatedInscriptionIds,
        cooccurMap,
      ),
    [
      inscriptions,
      wordIndex,
      filters,
      output,
      annotatedInscriptionIds,
      cooccurMap,
    ],
  );

  // Diff target (a saved query selected for set-difference comparison).
  const diffWith = useMemo(
    () => savedQueries.find((q) => q.id === diffWithId) ?? null,
    [savedQueries, diffWithId],
  );
  // Only meaningful when the diff target's output type matches the current one
  // (you can't set-diff inscriptions against words).
  const diffMismatch = !!diffWith && diffWith.output !== output;
  const diffResults = useMemo(() => {
    if (!diffWith || diffMismatch) return null;
    return evalQuery(
      diffWith.filters,
      diffWith.output,
      inscriptions,
      wordIndex,
      annotatedInscriptionIds,
      cooccurMap,
    );
  }, [
    diffWith,
    diffMismatch,
    inscriptions,
    wordIndex,
    annotatedInscriptionIds,
    cooccurMap,
  ]);
  // Three set slices for the diff view, keyed by the result type.
  const diffSlices = useMemo(() => {
    if (!diffResults) return null;
    if (output === "inscriptions") {
      const aIds = new Set(results.inscriptions.map((i) => i.id));
      const bIds = new Set(diffResults.inscriptions.map((i) => i.id));
      return {
        onlyA: results.inscriptions.filter((i) => !bIds.has(i.id)),
        onlyB: diffResults.inscriptions.filter((i) => !aIds.has(i.id)),
        both: results.inscriptions.filter((i) => bIds.has(i.id)),
      };
    }
    const aMap = new Map(results.words);
    const bMap = new Map(diffResults.words);
    const aWords = new Set(aMap.keys());
    const bWords = new Set(bMap.keys());
    return {
      onlyA: results.words.filter(([w]) => !bWords.has(w)),
      onlyB: diffResults.words.filter(([w]) => !aWords.has(w)),
      both: results.words.filter(([w]) => bWords.has(w)),
    };
  }, [results, diffResults, output]);

  // Active result list — either the plain query results or the chosen diff slice.
  const activeInscriptions: Inscription[] =
    diffSlices && output === "inscriptions"
      ? (diffSlices[diffTab] as Inscription[])
      : results.inscriptions;
  const activeWords: [string, number][] =
    diffSlices && output === "words"
      ? (diffSlices[diffTab] as [string, number][])
      : results.words;
  const activeCount =
    output === "inscriptions" ? activeInscriptions.length : activeWords.length;

  function addFilter() {
    setFilters((f) => [
      ...f,
      {
        rid: Math.random().toString(36).slice(2),
        field: "word-suffix",
        value: "",
        connector: "and",
        negate: false,
      },
    ]);
  }
  function removeFilter(rid: string) {
    setFilters((f) => f.filter((x) => x.rid !== rid));
  }
  function updateFilter(rid: string, patch: Partial<FilterRow>) {
    setFilters((f) =>
      f.map((x) => (x.rid === rid ? { ...x, ...patch } : x)),
    );
  }

  function saveCurrent() {
    if (!name.trim()) return;
    const sq: SavedQuery = {
      id: Math.random().toString(36).slice(2),
      name: name.trim(),
      filters,
      output,
    };
    setSavedQueries((q) => [...q, sq]);
    setName("");
  }

  function loadSaved(sq: SavedQuery) {
    setFilters(
      sq.filters.map((f) => ({
        ...f,
        rid: Math.random().toString(36).slice(2),
      })),
    );
    setOutput(sq.output);
    // Loading a saved query while a diff was active is confusing; clear it.
    setDiffWithId(null);
  }

  // Build a SaveFindingButton-compatible title + summary that respects whichever
  // diff slice is currently visible (so "save to findings" captures what you see).
  const sliceLabel =
    diffSlices && diffWith
      ? diffTab === "onlyA"
        ? `Only in current query`
        : diffTab === "onlyB"
          ? `Only in “${diffWith.name}”`
          : `In both`
      : null;
  const baseTitle = `Query: ${name.trim() || summarizeFilters(filters).slice(0, 60)}`;
  const findingTitle = sliceLabel ? `${baseTitle} — ${sliceLabel}` : baseTitle;
  const findingSummary =
    `${activeCount} ${output}${sliceLabel ? ` (${sliceLabel.toLowerCase()})` : ""}.\n` +
    `Filters: ${summarizeFilters(filters)}` +
    (diffWith && !diffMismatch
      ? `\nDiffed against: ${diffWith.name} (${summarizeFilters(diffWith.filters)})`
      : "");

  // Turn the active result set into a collection. For inscription mode, items
  // are { kind: "inscription", value: id }; for word mode, { kind: "word", value: word }.
  function activeItemsAsCollection(): {
    kind: "word" | "inscription";
    value: string;
  }[] {
    if (output === "inscriptions") {
      return activeInscriptions.map((i) => ({
        kind: "inscription" as const,
        value: i.id,
      }));
    }
    return activeWords.map(([w]) => ({ kind: "word" as const, value: w }));
  }

  function saveAsCollection() {
    const n = collectionName.trim();
    if (!n) return;
    const items = activeItemsAsCollection();
    if (items.length === 0) {
      toast("No results to save as a collection", "error");
      return;
    }
    const id = createCollectionWithItems(n, items);
    if (id) {
      toast(`Saved “${n}” (${items.length} ${output})`);
      setCollectionName("");
      setCollectionPromptOpen(false);
    }
  }

  // "Use as scope": only meaningful for inscription results — the global scope
  // filters which inscriptions every other module sees. We materialize an
  // auto-named collection and then point the scope at it.
  function useAsScope() {
    if (output !== "inscriptions") {
      toast("Switch to Inscriptions output to use the result as a scope", "error");
      return;
    }
    if (activeInscriptions.length === 0) {
      toast("No inscriptions to scope to", "error");
      return;
    }
    const auto = `Query • ${activeInscriptions.length} inscriptions${name.trim() ? ` (${name.trim()})` : ""}`;
    const id = createCollectionWithItems(
      auto,
      activeInscriptions.map((i) => ({
        kind: "inscription" as const,
        value: i.id,
      })),
    );
    if (id) {
      setScope({
        site: null,
        period: null,
        scribe: null,
        support: null,
        collectionId: id,
      });
      toast(
        `Scope set to ${activeInscriptions.length} inscriptions from this query`,
      );
    }
  }

  // Pivot helpers — open another module with this row as its focus.
  function openInModule(module: ModuleId, focus?: string, tab?: string) {
    setActiveModule(module, focus || tab ? { focus, tab } : null);
  }

  function renderValueInput(row: FilterRow) {
    const def = FIELDS[row.field];
    const v = row.value;
    const set = (val: unknown) => updateFilter(row.rid, { value: val });
    switch (def.kind) {
      case "word":
        // Exact corpus word → typeahead from the vocabulary.
        return (
          <WordAutocomplete
            value={String(v ?? "")}
            onChange={(val) => set(val)}
            placeholder="e.g. KU-RO"
            style={{ flex: 1 }}
          />
        );
      case "text":
      case "sign":
        return (
          <input
            className="input"
            placeholder={def.kind === "sign" ? "e.g. KA, *301" : "text"}
            value={String(v ?? "")}
            onChange={(e) => set(e.target.value)}
            style={{ flex: 1 }}
          />
        );
      case "number":
        return (
          <input
            type="number"
            className="input"
            value={Number(v ?? 0)}
            min={1}
            onChange={(e) => set(Number(e.target.value))}
            style={{ width: 80 }}
          />
        );
      case "boolean":
        return (
          <select
            className="select"
            value={String(v)}
            onChange={(e) => set(e.target.value === "true")}
          >
            <option value="true">yes</option>
            <option value="false">no</option>
          </select>
        );
      case "site":
        return (
          <select
            className="select"
            value={String(v ?? "")}
            onChange={(e) => set(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">(any)</option>
            {sites.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        );
      case "scribe":
        return (
          <select
            className="select"
            value={String(v ?? "")}
            onChange={(e) => set(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">(any)</option>
            {scribes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        );
      case "period":
        return (
          <select
            className="select"
            value={String(v ?? "")}
            onChange={(e) => set(e.target.value)}
          >
            <option value="">(any)</option>
            {periods.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        );
      case "support":
        return (
          <select
            className="select"
            value={String(v ?? "")}
            onChange={(e) => set(e.target.value)}
          >
            <option value="">(any)</option>
            {supports.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        );
    }
  }

  return (
    <div className="panel">
      <h2>Query Builder</h2>
      <div className="callout">
        <h4>Stackable filters across the corpus</h4>
        <p>
          Build compound queries combining inscription-level filters (site,
          scribe, dating period, presence of facsimile, annotation status) with
          word-level filters (prefix, suffix, sign content, syllable count,
          co-occurrence). Each row joins with <b>and</b> / <b>or</b> and can be
          negated with <b>not</b>, evaluated left-to-right within its group.
          Save useful queries to revisit them later.
        </p>
      </div>

      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 12,
          marginBottom: 12,
        }}
      >
        {filters.map((row, i) => (
          <div
            key={row.rid}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            {i === 0 ? (
              <span
                className="dim"
                style={{
                  minWidth: 52,
                  fontSize: 10,
                  textTransform: "uppercase",
                }}
              >
                where
              </span>
            ) : (
              <select
                className="select"
                value={row.connector ?? "and"}
                onChange={(e) =>
                  updateFilter(row.rid, {
                    connector: e.target.value as Connector,
                  })
                }
                title="How this row combines with the rows above (within its inscription/word group)"
                style={{
                  minWidth: 52,
                  fontSize: 10,
                  padding: "3px 4px",
                  color: row.connector === "or" ? "var(--ac)" : undefined,
                }}
              >
                <option value="and">and</option>
                <option value="or">or</option>
              </select>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => updateFilter(row.rid, { negate: !row.negate })}
              title="Negate this condition (NOT)"
              style={{
                minWidth: 36,
                color: row.negate ? "var(--rd)" : "var(--text-muted)",
                borderColor: row.negate ? "var(--rd)" : undefined,
              }}
            >
              not
            </button>
            <select
              className="select"
              value={row.field}
              onChange={(e) =>
                updateFilter(row.rid, {
                  field: e.target.value as FieldId,
                  value: defaultValue(e.target.value as FieldId),
                })
              }
              style={{ minWidth: 220 }}
            >
              <optgroup label="Inscription">
                {(Object.entries(FIELDS) as [FieldId, FieldDef][])
                  .filter(([, d]) => d.scope === "inscription")
                  .map(([id, d]) => (
                    <option key={id} value={id}>
                      {d.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Word">
                {(Object.entries(FIELDS) as [FieldId, FieldDef][])
                  .filter(([, d]) => d.scope === "word")
                  .map(([id, d]) => (
                    <option key={id} value={id}>
                      {d.label}
                    </option>
                  ))}
              </optgroup>
            </select>
            {renderValueInput(row)}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => removeFilter(row.rid)}
              title="Remove filter"
            >
              ✕
            </button>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
            alignItems: "center",
          }}
        >
          <button className="btn btn-outline btn-sm" onClick={addFilter}>
            + Add filter
          </button>
          <span style={{ flex: 1 }} />
          <span className="dim" style={{ fontSize: 10 }}>
            Show
          </span>
          <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
            <button
              className={`tab-btn${output === "inscriptions" ? " active" : ""}`}
              onClick={() => setOutput("inscriptions")}
            >
              Inscriptions
            </button>
            <button
              className={`tab-btn${output === "words" ? " active" : ""}`}
              onClick={() => setOutput("words")}
            >
              Words
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Save current query as…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-sm"
          onClick={saveCurrent}
          disabled={!name.trim()}
        >
          Save query
        </button>
        <span className="dim">
          {output === "inscriptions"
            ? `${results.inscriptions.length} inscriptions`
            : `${results.words.length} words`}
        </span>
      </div>

      {savedQueries.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>Saved queries</span>
            <span style={{ flex: 1 }} />
            <label
              className="dim"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                textTransform: "none",
                letterSpacing: 0,
                fontWeight: 400,
              }}
              title="Compare the current query's results against another saved query: only-in-current, in-both, only-in-other"
            >
              diff against
              <select
                className="select"
                value={diffWithId ?? ""}
                onChange={(e) => {
                  setDiffWithId(e.target.value || null);
                  setDiffTab("onlyA");
                }}
                style={{ fontSize: 11, padding: "2px 4px", minWidth: 140 }}
              >
                <option value="">(none)</option>
                {savedQueries.map((sq) => (
                  <option key={sq.id} value={sq.id}>
                    {sq.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {savedQueries.map((sq) => (
              <span
                key={sq.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  background:
                    diffWithId === sq.id
                      ? "var(--surface-2)"
                      : "var(--surface-1)",
                  border: `1px solid ${diffWithId === sq.id ? "var(--ac)" : "var(--border)"}`,
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                <button
                  className="word-link"
                  onClick={() => loadSaved(sq)}
                  style={{ font: "11px var(--mono)" }}
                  title="Load this query into the builder"
                >
                  {sq.name}
                </button>
                <button
                  className="dim"
                  style={{
                    background: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--rd)",
                  }}
                  onClick={() => {
                    setSavedQueries((q) => q.filter((x) => x.id !== sq.id));
                    if (diffWithId === sq.id) setDiffWithId(null);
                  }}
                  title="Delete saved query"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {diffMismatch && (
        <div
          className="callout"
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--surface-2)",
            border: "1px solid var(--am)",
          }}
        >
          Can't diff: <b>“{diffWith?.name}”</b> outputs{" "}
          <b>{diffWith?.output}</b>, but the current query is showing{" "}
          <b>{output}</b>. Switch outputs or pick a different saved query.
        </div>
      )}

      {diffSlices && diffWith && !diffMismatch && (
        <div
          className="tab-row"
          style={{ marginBottom: 8, border: "1px solid var(--border)", borderRadius: 4 }}
        >
          {(
            [
              ["onlyA", `Only in current (${diffSlices.onlyA.length})`],
              ["both", `In both (${diffSlices.both.length})`],
              ["onlyB", `Only in “${diffWith.name}” (${diffSlices.onlyB.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`tab-btn${diffTab === key ? " active" : ""}`}
              onClick={() => setDiffTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Result-set actions: act on the active slice (or full results if no diff). */}
      <div
        className="toolbar"
        style={{ flexWrap: "wrap", marginBottom: 8 }}
      >
        <span className="dim" style={{ fontSize: 11 }}>
          {activeCount} {output}
          {sliceLabel ? ` · ${sliceLabel}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-outline btn-sm"
          onClick={useAsScope}
          disabled={output !== "inscriptions" || activeCount === 0}
          title="Use this result set as the global corpus scope — every other module will compute over just these inscriptions"
        >
          ◇ Use as scope
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setCollectionPromptOpen((o) => !o)}
          disabled={activeCount === 0}
          title="Save this result set as a named collection of inscriptions or words"
        >
          + Save as collection
        </button>
        <SaveFindingButton
          module="query"
          moduleLabel="Query Builder"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{
            filters,
            output,
            diffWith: diffWith?.id ?? null,
            diffTab: diffSlices ? diffTab : null,
          }}
          disabled={activeCount === 0}
          reportFn={() => {
            if (output === "inscriptions") {
              const slice = activeInscriptions.slice(0, 100);
              const cols: SnippetColumn<(typeof slice)[number]>[] = [
                { label: "ID", render: (i) => `<code>${esc(i.id)}</code>` },
                { label: "Site", render: (i) => esc(i.site) },
                { label: "Period", render: (i) => esc(i.context || "—") },
                { label: "Scribe", render: (i) => esc(i.scribe || "—") },
                {
                  label: "Words",
                  render: (i) =>
                    esc(i.words.filter((w) => w.includes("-")).length),
                  align: "right",
                },
              ];
              const meta = `${activeInscriptions.length} inscriptions${sliceLabel ? ` · ${sliceLabel.toLowerCase()}` : ""}${slice.length < activeInscriptions.length ? ` · showing first ${slice.length}` : ""}.`;
              return {
                html: snippetWrap(meta, snippetTable(slice, cols)),
                markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
              };
            }
            const slice = activeWords.slice(0, 100);
            const cols: SnippetColumn<[string, number]>[] = [
              {
                label: "Word",
                render: ([w]) => `<code>${esc(w)}</code>`,
              },
              {
                label: "In matches",
                render: ([, c]) => esc(c),
                align: "right",
              },
              {
                label: "Total in corpus",
                render: ([w]) => esc(wordIndex.get(w)?.count ?? 0),
                align: "right",
              },
            ];
            const meta = `${activeWords.length} words${sliceLabel ? ` · ${sliceLabel.toLowerCase()}` : ""}${slice.length < activeWords.length ? ` · showing first ${slice.length}` : ""}.`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>

      {collectionPromptOpen && (
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginBottom: 8,
            padding: "6px 8px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          <span className="dim" style={{ fontSize: 11 }}>
            Collection name:
          </span>
          <input
            className="input"
            autoFocus
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveAsCollection();
              if (e.key === "Escape") setCollectionPromptOpen(false);
            }}
            placeholder={`e.g. ${output === "inscriptions" ? "LMIB tablets with KU-RO" : "Words ending in -RE"}`}
            style={{ flex: 1, fontSize: 12 }}
          />
          <button
            className="btn btn-sm"
            onClick={saveAsCollection}
            disabled={!collectionName.trim()}
          >
            Save ({activeCount} {output})
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setCollectionPromptOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {showResults && output === "inscriptions" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Site</th>
                <th>Period</th>
                <th>Scribe</th>
                <th>Words</th>
                <th>Glyphs</th>
                <th style={{ width: 1 }}>Open in…</th>
              </tr>
            </thead>
            <tbody>
              {activeInscriptions.slice(0, 200).map((ins) => (
                <tr key={ins.id}>
                  <td>
                    <InscriptionLink id={ins.id} />
                  </td>
                  <td className="site-text">{ins.site}</td>
                  <td className="dim">{ins.context || "—"}</td>
                  <td className="dim">{ins.scribe || "—"}</td>
                  <td className="numeral">
                    {ins.words.filter((w) => w.includes("-")).length}
                  </td>
                  <td style={{ fontFamily: "var(--glyph)", fontSize: 16 }}>
                    {ins.glyphs.slice(0, 24)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => openInModule("compare", ins.id)}
                      title="Open in Compare Inscriptions with this tablet preselected"
                    >
                      Compare
                    </button>{" "}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => openInModule("browse", ins.id)}
                      title="Open in Corpus Browser"
                    >
                      Browse
                    </button>{" "}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => openInModule("struct", ins.id)}
                      title="Open in Tablet Structure"
                    >
                      Structure
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showResults && output === "words" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Glyph</th>
                <th>Word</th>
                <th>Count in matching inscriptions</th>
                <th>Total attestations</th>
                <th style={{ width: 1 }}>Open in…</th>
              </tr>
            </thead>
            <tbody>
              {activeWords.slice(0, 200).map(([w, c], i) => (
                <tr key={w}>
                  <td className="dim">{i + 1}</td>
                  <td>
                    {w.split("-").map((p, j) => (
                      <Glyph key={j} sign={p} size={18} />
                    ))}
                  </td>
                  <td>
                    <WordToken word={w} />
                  </td>
                  <td className="numeral">{c}</td>
                  <td className="dim">{wordIndex.get(w)?.count ?? 0}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => openInModule("kwic", w)}
                      title="Open in KWIC concordance with this word as the target"
                    >
                      KWIC
                    </button>{" "}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => openInModule("cooc", w)}
                      title="Open in Co-occurrence to see this word's collocates"
                    >
                      Cooc
                    </button>{" "}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => openInModule("comp", w)}
                      title="Open in Cross-Linguistic with this word"
                    >
                      Cross-Ling
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeCount > 200 && (
        <div className="dim" style={{ padding: 8, fontSize: 11 }}>
          Showing first 200. Narrow the filters to see more.
        </div>
      )}
      {!showResults && (
        <button className="btn btn-outline" onClick={() => setShowResults(true)}>
          Show results
        </button>
      )}
    </div>
  );
}
