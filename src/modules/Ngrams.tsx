import { Fragment, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { logLikelihoodRatio2x2 } from "../lib/algorithms";
import { WordToken } from "../components/WordToken";
import { InscriptionLink } from "../components/InscriptionLink";
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const { sort, toggle, sortRows } = useSort("count", "desc");

  // Full bigram/trigram tallies (every sequence attested at least once),
  // plus the marginals needed to test bigram association (how often each
  // word fills the left or right slot of an adjacent pair, and the total
  // number of pairs) and the distinct tablets carrying each sequence (for
  // the expandable rows).
  const { bigrams, trigrams, leftCounts, rightCounts, pairTotal, sources } =
    useMemo(() => {
      const bi = new Map<string, number>();
      const tri = new Map<string, number>();
      const left = new Map<string, number>();
      const right = new Map<string, number>();
      const src = new Map<string, Set<string>>();
      const note = (k: string, id: string) => {
        let s = src.get(k);
        if (!s) {
          s = new Set();
          src.set(k, s);
        }
        s.add(id);
      };
      let pairs = 0;
      for (const ins of inscriptions) {
        const ws = ins.words.filter((w) => w.includes("-"));
        for (let i = 0; i < ws.length - 1; i++) {
          const k = `${ws[i]} ${ws[i + 1]}`;
          bi.set(k, (bi.get(k) ?? 0) + 1);
          note(k, ins.id);
          left.set(ws[i], (left.get(ws[i]) ?? 0) + 1);
          right.set(ws[i + 1], (right.get(ws[i + 1]) ?? 0) + 1);
          pairs++;
        }
        for (let i = 0; i < ws.length - 2; i++) {
          const k = `${ws[i]} ${ws[i + 1]} ${ws[i + 2]}`;
          tri.set(k, (tri.get(k) ?? 0) + 1);
          note(k, ins.id);
        }
      }
      return {
        bigrams: [...bi.entries()] as [string, number][],
        trigrams: [...tri.entries()] as [string, number][],
        leftCounts: left,
        rightCounts: right,
        pairTotal: pairs,
        sources: src,
      };
    }, [inscriptions]);

  // Association stats per bigram: PMI (how much more often than chance,
  // given each word's slot frequency) and Dunning's G² (how strong the
  // evidence is). Trigram association doesn't reduce to one standard 2×2
  // test, so the columns appear in bigram mode only.
  const assoc = useMemo(() => {
    const m = new Map<string, { pmi: number; g2: number }>();
    if (pairTotal === 0) return m;
    for (const [k, joint] of bigrams) {
      const sp = k.indexOf(" ");
      const l = leftCounts.get(k.slice(0, sp)) ?? 0;
      const r = rightCounts.get(k.slice(sp + 1)) ?? 0;
      if (l === 0 || r === 0) continue;
      m.set(k, {
        pmi: Math.log2((joint * pairTotal) / (l * r)),
        g2: logLikelihoodRatio2x2(joint, l, r, pairTotal),
      });
    }
    return m;
  }, [bigrams, leftCounts, rightCounts, pairTotal]);

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
    pmi: ([k]) => assoc.get(k)?.pmi ?? -Infinity,
    g2: ([k]) => assoc.get(k)?.g2 ?? 0,
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
    const rows: (string | number)[][] = [
      mode === "bi"
        ? ["rank", "bigram", "count", "pmi", "g2"]
        : ["rank", unit.slice(0, -1), "count"],
    ];
    sorted.forEach(([k, c], i) => {
      if (mode === "bi") {
        const a = assoc.get(k);
        rows.push([
          i + 1,
          k,
          c,
          a ? a.pmi.toFixed(3) : "",
          a ? a.g2.toFixed(3) : "",
        ]);
      } else {
        rows.push([i + 1, k, c]);
      }
    });
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
        column to sort. Bigrams also carry <b>PMI</b> (how much more often
        than chance the pair sits together, given each word's slot frequency)
        and <b>G²</b> (how strong the evidence is) — a high count alone can
        just mean two common words.
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
              pmi: assoc.get(k)?.pmi,
              g2: assoc.get(k)?.g2,
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
              ...(mode === "bi"
                ? ([
                    {
                      label: "PMI",
                      render: (r) =>
                        r.pmi === undefined ? "—" : esc(r.pmi.toFixed(2)),
                      align: "right",
                    },
                    {
                      label: "G²",
                      render: (r) =>
                        r.g2 === undefined ? "—" : esc(r.g2.toFixed(1)),
                      align: "right",
                    },
                  ] as SnippetColumn<R>[])
                : []),
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
              {mode === "bi" && (
                <>
                  <SortHeader
                    label="PMI"
                    sortKey="pmi"
                    sort={sort}
                    onToggle={toggle}
                    title="Pointwise mutual information (log₂): how much more often than chance these two words are adjacent, given how often each fills its slot"
                  />
                  <SortHeader
                    label="G²"
                    sortKey="g2"
                    sort={sort}
                    onToggle={toggle}
                    title="Dunning's log-likelihood ratio: strength of evidence for the association. 3.84 ≈ p<.05, 6.63 ≈ p<.01, 10.83 ≈ p<.001"
                  />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {display.map(([k, c], i) => {
              const a = mode === "bi" ? assoc.get(k) : undefined;
              const isOpen = expanded === k;
              const ids = isOpen
                ? [...(sources.get(k) ?? [])].sort((x, y) =>
                    x.localeCompare(y),
                  )
                : [];
              return (
                <Fragment key={k}>
                  <tr
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : k)}
                    title="Click to list the tablets carrying this sequence"
                  >
                    <td className="dim">
                      <span
                        style={{ marginRight: 4, color: "var(--text-muted)" }}
                      >
                        {isOpen ? "▾" : "▸"}
                      </span>
                      {i + 1}
                    </td>
                    <td>
                      {k.split(" ").map((w, j) => (
                        <WordToken key={j} word={w} />
                      ))}
                    </td>
                    <td className="numeral">{c}</td>
                    {mode === "bi" && (
                      <>
                        <td className="numeral">
                          {a ? a.pmi.toFixed(2) : "—"}
                        </td>
                        <td
                          className="numeral"
                          style={{
                            color:
                              a && a.g2 >= 3.84
                                ? "var(--gn)"
                                : "var(--text-muted)",
                          }}
                        >
                          {a ? a.g2.toFixed(1) : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                  {isOpen && (
                    <tr>
                      <td
                        colSpan={mode === "bi" ? 5 : 3}
                        style={{ padding: "6px 12px" }}
                      >
                        <span
                          className="dim"
                          style={{ fontSize: 11, marginRight: 8 }}
                        >
                          On {ids.length} tablet{ids.length === 1 ? "" : "s"}:
                        </span>
                        {ids.slice(0, 30).map((id, j) => (
                          <span key={id} style={{ fontSize: 12 }}>
                            {j > 0 ? ", " : ""}
                            <InscriptionLink id={id} />
                          </span>
                        ))}
                        {ids.length > 30 && (
                          <span className="dim"> +{ids.length - 30} more</span>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {display.length === 0 && (
              <tr>
                <td
                  colSpan={mode === "bi" ? 5 : 3}
                  className="dim"
                  style={{ padding: 12 }}
                >
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
