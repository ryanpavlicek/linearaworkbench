import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { useSort, SortHeader } from "../components/sort";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

const DISPLAY_CAP = 200;

export default function Ngrams() {
  const inscriptions = useScopedCorpus().inscriptions;
  const initialIntent = useWorkbench.getState().moduleIntent;
  const [mode, setMode] = useState<"bi" | "tri">(
    initialIntent?.tab === "tri" ? "tri" : "bi",
  );
  const [minCount, setMinCount] = useState(2);
  const [q, setQ] = useState("");
  const { sort, toggle, sortRows } = useSort("count", "desc");

  // Full bigram/trigram tallies (every sequence attested at least once).
  const { bigrams, trigrams } = useMemo(() => {
    const bi = new Map<string, number>();
    const tri = new Map<string, number>();
    for (const ins of inscriptions) {
      const ws = ins.words.filter((w) => w.includes("-"));
      for (let i = 0; i < ws.length - 1; i++) {
        const k = `${ws[i]} ${ws[i + 1]}`;
        bi.set(k, (bi.get(k) ?? 0) + 1);
      }
      for (let i = 0; i < ws.length - 2; i++) {
        const k = `${ws[i]} ${ws[i + 1]} ${ws[i + 2]}`;
        tri.set(k, (tri.get(k) ?? 0) + 1);
      }
    }
    return {
      bigrams: [...bi.entries()] as [string, number][],
      trigrams: [...tri.entries()] as [string, number][],
    };
  }, [inscriptions]);

  const all = mode === "bi" ? bigrams : trigrams;
  const unit = mode === "bi" ? "bigrams" : "trigrams";

  const biCount = useMemo(
    () => bigrams.filter(([, c]) => c >= minCount).length,
    [bigrams, minCount],
  );
  const triCount = useMemo(
    () => trigrams.filter(([, c]) => c >= minCount).length,
    [trigrams, minCount],
  );

  const filtered = useMemo(() => {
    const u = q.toUpperCase();
    return all.filter(
      ([k, c]) => c >= minCount && (!u || k.toUpperCase().includes(u)),
    );
  }, [all, minCount, q]);

  const sorted = sortRows(filtered, {
    count: ([, c]) => c,
    seq: ([k]) => k,
  });
  const display = sorted.slice(0, DISPLAY_CAP);

  const filterDesc = [q && `“${q}”`, `count ≥ ${minCount}`]
    .filter(Boolean)
    .join(", ");
  const findingTitle = `N-grams — ${unit}`;
  const findingSummary =
    `${filtered.length} ${unit} (${filterDesc}).\n` +
    (sorted
      .slice(0, 6)
      .map(([k, c]) => `${k} (${c})`)
      .join("; ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [["rank", unit.slice(0, -1), "count"]];
    sorted.forEach(([k, c], i) => rows.push([i + 1, k, c]));
    downloadFile(
      `linear_a_${unit}.csv`,
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>N-grams</h2>
      <p className="panel-desc">
        Recurring word sequences. Frequent bigrams and trigrams often mark
        formulaic phrasing. Set the minimum count, search a word, or click a
        column to sort.
      </p>
      <div className="tab-row">
        <button
          className={`tab-btn${mode === "bi" ? " active" : ""}`}
          onClick={() => setMode("bi")}
        >
          Bigrams ({biCount})
        </button>
        <button
          className={`tab-btn${mode === "tri" ? " active" : ""}`}
          onClick={() => setMode("tri")}
        >
          Trigrams ({triCount})
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="ngram"
          moduleLabel="N-grams"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ mode, minCount, q }}
          reportFn={() => {
            const cap = 100;
            const slice = display.slice(0, cap).map(([k, c], i) => ({
              rank: i + 1,
              seq: k,
              count: c,
            }));
            type R = (typeof slice)[number];
            const cols: SnippetColumn<R>[] = [
              {
                label: "#",
                render: (r) => `<span style="color:#6b7280;">${r.rank}</span>`,
                align: "right",
              },
              {
                label: "Sequence",
                render: (r) =>
                  r.seq
                    .split(" ")
                    .map(
                      (w) =>
                        `<code style="background:#f3f4f6;padding:1px 5px;border-radius:2px;margin-right:3px;">${esc(w)}</code>`,
                    )
                    .join(""),
                md: (r) => r.seq,
              },
              {
                label: "Count",
                render: (r) => esc(r.count),
                align: "right",
              },
            ];
            const meta = `${filtered.length} ${unit} (${filterDesc}). Showing first ${slice.length}.`;
            const html = snippetWrap(meta, snippetTable(slice, cols));
            const markdown = `_${meta}_\n\n` + snippetTableMd(slice, cols);
            return { html, markdown };
          }}
        />
      </div>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter by word…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 140 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum number of attestations"
        >
          count ≥
          <input
            type="number"
            className="input"
            min={1}
            value={minCount}
            onChange={(e) => setMinCount(Math.max(1, +e.target.value || 1))}
            style={{ width: 56, fontSize: 11, padding: "3px 6px" }}
          />
        </label>
      </div>
      <div className="dim" style={{ fontSize: 11, margin: "6px 0" }}>
        {filtered.length} {unit}
        {sorted.length > DISPLAY_CAP ? ` — showing first ${DISPLAY_CAP}` : ""}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <SortHeader label="Sequence" sortKey="seq" sort={sort} onToggle={toggle} />
              <SortHeader label="Count" sortKey="count" sort={sort} onToggle={toggle} />
            </tr>
          </thead>
          <tbody>
            {display.map(([k, c], i) => (
              <tr key={k}>
                <td className="dim">{i + 1}</td>
                <td>
                  {k.split(" ").map((w, j) => (
                    <WordToken key={j} word={w} />
                  ))}
                </td>
                <td className="numeral">{c}</td>
              </tr>
            ))}
            {display.length === 0 && (
              <tr>
                <td colSpan={3} className="dim" style={{ padding: 12 }}>
                  No {unit} match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
