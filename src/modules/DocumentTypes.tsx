import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { isNumeralToken } from "../lib/algorithms";
import { heuristicCategory } from "../lib/corpusExport";
import { InscriptionLink } from "../components/InscriptionLink";
import { WordToken } from "../components/WordToken";
import { useSort, SortHeader } from "../components/sort";

// The corpus by physical document type: what kinds of objects carry
// Linear A, what each kind was for in the administration, and how the
// writing differs across them. Groups on the `support` field
// (case-folded — the source has stray case variants), with curated
// function notes for the major classes.

// What each document class IS — standard Aegean-administration readings,
// hedged where the function is genuinely debated. Keyed by the folded
// support name.
const TYPE_NOTES: Record<string, string> = {
  Tablet:
    "Page-shaped clay accounting documents — the core archive medium. Lists of entries with commodity logograms and numerals, often closed by a KU-RO total.",
  Nodule:
    "Small sealed clay lumps, usually carrying a seal impression and at most a sign or two. They authenticated and tracked goods or documents rather than recording text — most of the corpus by count, least of it by writing.",
  Roundel:
    "Clay disks with seal impressions around the rim and typically a single word or logogram. Generally read as receipts: each rim impression one unit acknowledged.",
  "Stone vessel":
    "Mostly libation tables and ladles from peak sanctuaries and shrines — the religious corpus. These carry the formulaic dedication sequence (the libation formula), not accounts.",
  "Clay vessel":
    "Pots inscribed before or after firing — ownership, contents, or dedication marks.",
  "Lames (short thin tablet)":
    "Thin strip tablets — compact single-transaction records.",
  Sealing:
    "Clay sealings pressed over cords or pegs; writing is incidental to the sealing function.",
  "Inked inscription":
    "Signs written in ink (mostly on vessels) rather than incised — rare, and evidence that pen-and-ink writing existed alongside incision.",
  "3-sided bar": "Prism-shaped bars written on multiple faces.",
  "4-sided bar": "Four-faced bars; the format is shared with Cretan Hieroglyphic.",
  "Metal object": "Inscribed metal items, including gold and silver pins.",
  "Stone object": "Inscribed stone items outside the vessel series.",
  Architecture: "Signs on built stone — masons' marks shading into writing.",
  Graffito: "Scratched informal inscriptions.",
  Label: "Small pierced tags attached to goods.",
  "Loom weight": "An inscribed loom weight.",
  Triton: "An inscribed triton shell.",
  "ivory object": "Inscribed ivory items.",
};

const fold = (s: string) => {
  const t = s.trim();
  // Fold stray case variants onto the dominant capitalization.
  const norm = t.charAt(0).toUpperCase() + t.slice(1);
  return TYPE_NOTES[t] ? t : TYPE_NOTES[norm] ? norm : t || "(unrecorded)";
};

export default function DocumentTypes() {
  const scoped = useScopedCorpus();
  const setScope = useWorkbench((s) => s.setScope);
  const [selected, setSelected] = useState<string | null>(null);
  const { sort, toggle, sortRows } = useSort("count", "desc");

  const types = useMemo(() => {
    const m = new Map<
      string,
      {
        count: number;
        wordTokens: number;
        withNumerals: number;
        sites: Map<string, number>;
        categories: Map<string, number>;
        rawSupports: Map<string, number>;
        ids: string[];
        words: Map<string, number>;
      }
    >();
    for (const ins of scoped.inscriptions) {
      const key = fold(ins.support || "");
      let t = m.get(key);
      if (!t) {
        t = {
          count: 0,
          wordTokens: 0,
          withNumerals: 0,
          sites: new Map(),
          categories: new Map(),
          rawSupports: new Map(),
          ids: [],
          words: new Map(),
        };
        m.set(key, t);
      }
      t.count++;
      if (ins.support)
        t.rawSupports.set(ins.support, (t.rawSupports.get(ins.support) ?? 0) + 1);
      if (ins.site) t.sites.set(ins.site, (t.sites.get(ins.site) ?? 0) + 1);
      const cat = heuristicCategory(ins);
      t.categories.set(cat, (t.categories.get(cat) ?? 0) + 1);
      if (t.ids.length < 30) t.ids.push(ins.id);
      let hasNum = false;
      for (const w of ins.words) {
        if (w.includes("-")) {
          t.wordTokens++;
          t.words.set(w, (t.words.get(w) ?? 0) + 1);
        }
        // Require an actual digit/fraction character: isNumeralToken also
        // matches the 𐄁 separator dot, which libation texts use densely —
        // counting that would make dedications look like accounts.
        if (isNumeralToken(w) && /[0-9¹²³⁴⁵⁶⁷⁸⁹⁰⅟₁₂₃₄₅₆₇₈₉₀]/.test(w))
          hasNum = true;
      }
      if (hasNum) t.withNumerals++;
    }
    return m;
  }, [scoped.inscriptions]);

  const rows = useMemo(
    () =>
      [...types.entries()].map(([type, t]) => ({
        type,
        count: t.count,
        wordsPerDoc: t.count > 0 ? t.wordTokens / t.count : 0,
        numeralPct: t.count > 0 ? (100 * t.withNumerals) / t.count : 0,
        topSites: [...t.sites.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([s]) => s),
      })),
    [types],
  );

  const total = scoped.inscriptions.length;
  const sorted = sortRows(rows, {
    type: (r) => r.type,
    count: (r) => r.count,
    words: (r) => r.wordsPerDoc,
    numerals: (r) => r.numeralPct,
  });

  const sel = selected ? types.get(selected) : null;

  function exportCsv() {
    const out: (string | number)[][] = [
      ["type", "count", "share_pct", "words_per_doc", "with_numerals_pct", "top_sites"],
    ];
    for (const r of sorted)
      out.push([
        r.type,
        r.count,
        ((100 * r.count) / Math.max(1, total)).toFixed(1),
        r.wordsPerDoc.toFixed(2),
        r.numeralPct.toFixed(1),
        r.topSites.join(" / "),
      ]);
    downloadFile(
      "linear_a_document_types.csv",
      out.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Document Types</h2>
      <div className="callout">
        <h4>What kinds of objects carry Linear A</h4>
        <p>
          The script lives on very different objects with very different
          jobs: page tablets that hold the accounts, sealed nodules and
          roundels that moved with goods, libation vessels that carry the
          religious formula. Most of the corpus by <em>count</em> is
          nodules; most of the <em>writing</em> is on tablets. Click a type
          for its profile, examples, and a one-click Scope.
        </p>
      </div>

      <div className="toolbar">
        <span className="dim" style={{ fontSize: 12 }}>
          {rows.length} types · {total.toLocaleString()} inscriptions
          {scoped.inscriptions.length !== total ? " (scoped)" : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      <div className="col2">
        <div className="table-wrap">
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <SortHeader label="Type" sortKey="type" sort={sort} onToggle={toggle} />
                <SortHeader label="Count" sortKey="count" sort={sort} onToggle={toggle} />
                <SortHeader
                  label="Words/doc"
                  sortKey="words"
                  sort={sort}
                  onToggle={toggle}
                  title="Mean multi-sign word tokens per document — how much writing this kind of object carries"
                />
                <SortHeader
                  label="Numerals %"
                  sortKey="numerals"
                  sort={sort}
                  onToggle={toggle}
                  title="Share of documents containing at least one numeral — a proxy for accounting function"
                />
                <th>Top sites</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.type}
                  onClick={() => setSelected(r.type === selected ? null : r.type)}
                  style={{
                    cursor: "pointer",
                    background:
                      selected === r.type ? "var(--surface-1)" : undefined,
                  }}
                >
                  <td>
                    <b>{r.type}</b>
                  </td>
                  <td className="numeral">
                    {r.count}{" "}
                    <span className="dim">
                      ({((100 * r.count) / Math.max(1, total)).toFixed(0)}%)
                    </span>
                  </td>
                  <td className="numeral">{r.wordsPerDoc.toFixed(1)}</td>
                  <td className="numeral">{r.numeralPct.toFixed(0)}%</td>
                  <td className="dim" style={{ fontSize: 11 }}>
                    {r.topSites.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {sel && selected ? (
            <div className="card">
              <h4>{selected}</h4>
              {TYPE_NOTES[selected] && (
                <p className="sub" style={{ marginBottom: 8 }}>
                  {TYPE_NOTES[selected]}
                </p>
              )}
              <div className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
                {sel.count} documents · {sel.wordTokens.toLocaleString()} word
                tokens ·{" "}
                {[...sel.categories.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([c, n]) => `${c} ${n}`)
                  .join(" · ")}
              </div>
              <button
                className="btn btn-outline btn-sm"
                style={{ marginBottom: 10 }}
                onClick={() => {
                  const raw = [...sel.rawSupports.entries()].sort(
                    (a, b) => b[1] - a[1],
                  )[0]?.[0];
                  if (raw)
                    setScope({
                      site: null,
                      period: null,
                      scribe: null,
                      support: raw,
                      collectionId: null,
                    });
                }}
                title="Set the global Scope to this support type so every module analyzes only these documents"
              >
                ◇ Use as Scope
              </button>
              {sel.words.size > 0 && (
                <>
                  <div
                    style={{
                      font: "600 10px var(--sans)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      marginBottom: 4,
                    }}
                  >
                    Most frequent words on this type
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    {[...sel.words.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 15)
                      .map(([w, c]) => (
                        <span key={w}>
                          <WordToken word={w} />
                          <span className="dim" style={{ fontSize: 10 }}>
                            ×{c}{" "}
                          </span>
                        </span>
                      ))}
                  </div>
                </>
              )}
              <div
                style={{
                  font: "600 10px var(--sans)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 4,
                }}
              >
                Examples
              </div>
              <div style={{ fontSize: 12 }}>
                {sel.ids.slice(0, 15).map((id) => (
                  <span key={id} style={{ marginRight: 8 }}>
                    <InscriptionLink id={id} />
                  </span>
                ))}
                {sel.count > 15 && (
                  <span className="dim">+{sel.count - 15} more</span>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="dim">
                Select a document type to see what it was for, its writing
                profile, top vocabulary, and examples — and to adopt it as
                the global Scope.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
