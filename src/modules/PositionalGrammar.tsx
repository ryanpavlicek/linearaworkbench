import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import { csvEscape, downloadFile } from "../lib/helpers";
import { keynessG2 } from "../lib/algorithms";
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

type Bias = "any" | "first" | "mid" | "last";
const BIAS_LABEL: Record<Exclude<Bias, "any">, string> = {
  first: "initial",
  mid: "medial",
  last: "final",
};

const DISPLAY_CAP = 200;

interface Stat {
  count: number;
  first: number;
  last: number;
  mid: number;
}

function dominant(d: Stat): "first" | "mid" | "last" {
  if (d.first >= d.mid && d.first >= d.last) return "first";
  if (d.last >= d.mid && d.last >= d.first) return "last";
  return "mid";
}

export default function PositionalGrammar() {
  const inscriptions = useScopedCorpus().inscriptions;
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const [q, setQ] = useState("");
  const [minCount, setMinCount] = useState(3);
  const [bias, setBias] = useState<Bias>("any");
  const { sort, toggle, sortRows } = useSort("count", "desc");

  const { all, posTotals } = useMemo(() => {
    const map = new Map<string, Stat>();
    for (const ins of inscriptions) {
      const ws = ins.words.filter((w) => w.includes("-"));
      ws.forEach((w, i) => {
        let s = map.get(w);
        if (!s) {
          s = { count: 0, first: 0, last: 0, mid: 0 };
          map.set(w, s);
        }
        s.count++;
        if (ws.length === 1) {
          s.first++;
          s.last++;
        } else if (i === 0) s.first++;
        else if (i === ws.length - 1) s.last++;
        else s.mid++;
      });
    }
    // Corpus-wide slot totals (over every word, hapax included) — the
    // baseline each word's positional rate is tested against.
    let first = 0;
    let mid = 0;
    let last = 0;
    for (const d of map.values()) {
      first += d.first;
      mid += d.mid;
      last += d.last;
    }
    return {
      all: [...map.entries()].filter(([, d]) => d.count >= 2),
      posTotals: { first, mid, last, grand: first + mid + last },
    };
  }, [inscriptions]);

  // Signed G² for each word's dominant position: does this word sit in
  // that slot more often than the rest of the corpus does? Corrects for
  // medial slots simply being common in long documents — a word can be
  // "mostly medial" yet not medial-biased at all.
  const biasG2 = useMemo(() => {
    const m = new Map<string, number>();
    for (const [w, d] of all) {
      const p = dominant(d);
      const slots = d.first + d.mid + d.last;
      const inPos = p === "first" ? d.first : p === "mid" ? d.mid : d.last;
      const totPos =
        p === "first"
          ? posTotals.first
          : p === "mid"
            ? posTotals.mid
            : posTotals.last;
      const g2 = keynessG2(
        inPos,
        slots,
        totPos - inPos,
        posTotals.grand - slots,
      );
      const rate = slots > 0 ? inPos / slots : 0;
      const rest = posTotals.grand - slots;
      const baseRate = rest > 0 ? (totPos - inPos) / rest : 0;
      m.set(w, rate >= baseRate ? g2 : -g2);
    }
    return m;
  }, [all, posTotals]);

  const filtered = useMemo(() => {
    const u = q.toUpperCase();
    return all.filter(([w, d]) => {
      if (d.count < minCount) return false;
      if (u && !w.toUpperCase().includes(u)) return false;
      if (bias !== "any" && dominant(d) !== bias) return false;
      return true;
    });
  }, [all, q, minCount, bias]);

  const sorted = sortRows(filtered, {
    word: ([w]) => w,
    count: ([, d]) => d.count,
    initial: ([, d]) => d.first,
    medial: ([, d]) => d.mid,
    final: ([, d]) => d.last,
    bias: ([w]) => biasG2.get(w) ?? 0,
  });
  const display = sorted.slice(0, DISPLAY_CAP);

  const filterDesc = [
    q && `“${q}”`,
    `≥${minCount}×`,
    bias !== "any" && `${BIAS_LABEL[bias]}-biased`,
  ]
    .filter(Boolean)
    .join(", ");
  const findingSummary =
    `${filtered.length} words (${filterDesc}) with positional distribution.\n` +
    `Most frequent: ` +
    (sorted
      .slice(0, 8)
      .map(([w, d]) => `${w} (${d.count})`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["word", "count", "initial", "medial", "final", "dominant", "bias_g2"],
    ];
    for (const [w, d] of sorted) {
      rows.push([
        w,
        d.count,
        d.first,
        d.mid,
        d.last,
        BIAS_LABEL[dominant(d)],
        (biasG2.get(w) ?? 0).toFixed(3),
      ]);
    }
    downloadFile(
      "linear_a_positional_grammar.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Positional Grammar</h2>
      <div className="callout">
        <h4>Word position bias</h4>
        <p>
          Where each word tends to sit within an inscription. Strong positional
          preference often signals a grammatical role — auxiliaries, particles,
          or terminal markers. Filter to words dominated by one position to
          isolate candidates. The <b>Bias G²</b> column tests the dominant
          position against the corpus-wide slot baseline — a word that is
          "mostly medial" only because medial slots are common scores near
          zero, while a genuine slot preference scores high.
        </p>
      </div>
      <div className="dim" style={{ margin: "6px 0 12px" }}>
        Legend: <span style={{ color: "var(--gn)" }}>■</span> initial{" "}
        <span style={{ color: "var(--ac)" }}>■</span> medial{" "}
        <span style={{ color: "var(--am)" }}>■</span> final
      </div>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter words…"
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
            min={2}
            value={minCount}
            onChange={(e) => setMinCount(Math.max(2, +e.target.value || 2))}
            style={{ width: 56, fontSize: 11, padding: "3px 6px" }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Show only words whose dominant position is…"
        >
          bias
          <select
            className="select"
            value={bias}
            onChange={(e) => setBias(e.target.value as Bias)}
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="any">any</option>
            <option value="first">initial</option>
            <option value="mid">medial</option>
            <option value="last">final</option>
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="pos"
          moduleLabel="Positional Grammar"
          defaultTitle={
            bias !== "any"
              ? `Positional grammar — ${BIAS_LABEL[bias]}-biased`
              : "Positional grammar"
          }
          summary={findingSummary}
          payload={{ q, minCount, bias }}
          reportFn={() => {
            const cap = 80;
            const slice = display.slice(0, cap);
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              { label: "Word", render: ([w]) => `<code>${esc(w)}</code>` },
              { label: "Count", render: ([, d]) => esc(d.count), align: "right" },
              { label: "Initial", render: ([, d]) => esc(d.first), align: "right" },
              { label: "Medial", render: ([, d]) => esc(d.mid), align: "right" },
              { label: "Final", render: ([, d]) => esc(d.last), align: "right" },
              {
                label: "Dominant",
                render: ([, d]) => {
                  const dom = d.first >= d.mid && d.first >= d.last ? "initial" : d.last >= d.mid && d.last >= d.first ? "final" : "medial";
                  const c = dom === "initial" ? "#16a34a" : dom === "medial" ? "#1d4ed8" : "#b45309";
                  return `<span style="color:${c};">${dom}</span>`;
                },
              },
              {
                label: "Bias G²",
                render: ([w]) => {
                  const g = biasG2.get(w) ?? 0;
                  return `${g >= 0 ? "+" : "−"}${Math.abs(g).toFixed(1)}`;
                },
                align: "right",
              },
            ];
            const meta = `${filtered.length} words with positional distribution (${filterDesc}). ${slice.length < filtered.length ? `Showing first ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>
      <div className="dim" style={{ fontSize: 11, margin: "6px 0" }}>
        {filtered.length} words
        {sorted.length > DISPLAY_CAP ? ` — showing first ${DISPLAY_CAP}` : ""}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortHeader label="Word" sortKey="word" sort={sort} onToggle={toggle} />
              <SortHeader label="Count" sortKey="count" sort={sort} onToggle={toggle} />
              <SortHeader label="Initial" sortKey="initial" sort={sort} onToggle={toggle} />
              <SortHeader label="Medial" sortKey="medial" sort={sort} onToggle={toggle} />
              <SortHeader label="Final" sortKey="final" sort={sort} onToggle={toggle} />
              <SortHeader
                label="Bias G²"
                sortKey="bias"
                sort={sort}
                onToggle={toggle}
                title="Signed Dunning G² for the dominant position vs the corpus-wide slot baseline. + = genuinely over-represented there, − = under-represented despite being the word's most common slot. 3.84 ≈ p<.05, 6.63 ≈ p<.01"
              />
              <th>Distribution</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {display.map(([w, d]) => {
              const t = d.first + d.mid + d.last;
              const pi = t ? (d.first / t) * 100 : 0;
              const pm = t ? (d.mid / t) * 100 : 0;
              const pf = t ? (d.last / t) * 100 : 0;
              const g = biasG2.get(w) ?? 0;
              const dom = dominant(d);
              return (
                <tr key={w}>
                  <td>
                    <WordToken word={w} />
                  </td>
                  <td className="numeral">{d.count}</td>
                  <td className="dim">{d.first}</td>
                  <td className="dim">{d.mid}</td>
                  <td className="dim">{d.last}</td>
                  <td
                    className="numeral"
                    style={{
                      color:
                        g >= 3.84
                          ? dom === "first"
                            ? "var(--gn)"
                            : dom === "mid"
                              ? "var(--ac)"
                              : "var(--am)"
                          : "var(--text-muted)",
                    }}
                    title={`${BIAS_LABEL[dom]}-dominant; G² vs corpus slot baseline = ${g >= 0 ? "+" : "−"}${Math.abs(g).toFixed(2)}`}
                  >
                    {g >= 0 ? "+" : "−"}
                    {Math.abs(g).toFixed(1)}
                  </td>
                  <td>
                    <div className="pos-bar" style={{ width: 120 }}>
                      <div className="pos-first" style={{ width: `${pi}%` }} />
                      <div className="pos-mid" style={{ width: `${pm}%` }} />
                      <div className="pos-last" style={{ width: `${pf}%` }} />
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setActiveModule("kwic", { focus: w })}
                      title="See every occurrence in context (Concordance)"
                    >
                      KWIC
                    </button>
                  </td>
                </tr>
              );
            })}
            {display.length === 0 && (
              <tr>
                <td colSpan={8} className="dim" style={{ padding: 12 }}>
                  No words match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
