import { Fragment, useMemo, useState } from "react";
import { csvEscape, downloadFile } from "../lib/helpers";
import { useScopedMultiWords } from "../store/scope";
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
import { useWorkbench } from "../store/workbench";
import { keynessG2 } from "../lib/algorithms";

type Mode = "suf" | "pre";
type Affix = [string, { count: number; words: string[] }];

const DISPLAY_CAP = 200;

export default function Morphology() {
  const words = useScopedMultiWords();
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const initialIntent = useWorkbench.getState().moduleIntent;
  const [mode, setMode] = useState<Mode>(
    initialIntent?.tab === "pre" ? "pre" : "suf",
  );
  const [afxLen, setAfxLen] = useState(1);
  const [minDistinct, setMinDistinct] = useState(2);
  const [minTotal, setMinTotal] = useState(1);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { sort, toggle, sortRows } = useSort("total", "desc");

  // Affixes of the chosen length (in signs). Requires a remaining stem, so a
  // word must have more signs than the affix length. Alongside the edge
  // tallies, count every length-n window (token-weighted) so each affix can
  // be tested for *edge bias*: does this sequence occur at the word edge
  // more often than its interior rate predicts?
  const { suffixes, prefixes, windowStats } = useMemo(() => {
    const sm = new Map<string, { count: number; words: string[] }>();
    const pm = new Map<string, { count: number; words: string[] }>();
    const aw = new Map<string, number>(); // every window position, token-weighted
    let edgeTotal = 0; // one edge slot per word token (same for both modes)
    let windowTotal = 0;
    for (const { word, entry } of words) {
      const parts = word.split("-");
      if (parts.length <= afxLen) continue;
      const suf = parts.slice(parts.length - afxLen).join("-");
      const pre = parts.slice(0, afxLen).join("-");
      const s = sm.get(suf) ?? { count: 0, words: [] };
      s.count += entry.count;
      s.words.push(word);
      sm.set(suf, s);
      const p = pm.get(pre) ?? { count: 0, words: [] };
      p.count += entry.count;
      p.words.push(word);
      pm.set(pre, p);
      edgeTotal += entry.count;
      for (let i = 0; i + afxLen <= parts.length; i++) {
        const win = parts.slice(i, i + afxLen).join("-");
        aw.set(win, (aw.get(win) ?? 0) + entry.count);
        windowTotal += entry.count;
      }
    }
    return {
      suffixes: [...sm.entries()] as Affix[],
      prefixes: [...pm.entries()] as Affix[],
      windowStats: { all: aw, edgeTotal, interiorTotal: windowTotal - edgeTotal },
    };
  }, [words, afxLen]);

  const all = mode === "suf" ? suffixes : prefixes;
  const unit = mode === "suf" ? "suffixes" : "prefixes";
  const fmt = (s: string) => (mode === "suf" ? `-${s}` : `${s}-`);

  // Edge bias per affix: Dunning's G² comparing the sequence's rate in the
  // edge slot (final for suffixes, initial for prefixes) against its rate
  // across all other window positions. Signed: + edge-leaning (affix-like),
  // − interior-leaning.
  const edgeBias = useMemo(() => {
    const m = new Map<string, { interior: number; signed: number }>();
    const { all: aw, edgeTotal, interiorTotal } = windowStats;
    for (const [s, d] of all) {
      const interior = Math.max(0, (aw.get(s) ?? 0) - d.count);
      const g2 = keynessG2(d.count, edgeTotal, interior, interiorTotal);
      const edgeRate = edgeTotal > 0 ? d.count / edgeTotal : 0;
      const intRate = interiorTotal > 0 ? interior / interiorTotal : 0;
      m.set(s, { interior, signed: edgeRate >= intRate ? g2 : -g2 });
    }
    return m;
  }, [all, windowStats]);

  const filtered = useMemo(() => {
    const u = q.toUpperCase();
    return all.filter(
      ([s, d]) =>
        d.words.length >= minDistinct &&
        d.count >= minTotal &&
        (!u || s.toUpperCase().includes(u)),
    );
  }, [all, minDistinct, minTotal, q]);

  const sorted = sortRows(filtered, {
    total: ([, d]) => d.count,
    distinct: ([, d]) => d.words.length,
    affix: ([s]) => s,
    bias: ([s]) => edgeBias.get(s)?.signed ?? 0,
  });
  const display = sorted.slice(0, DISPLAY_CAP);

  const findingTitle =
    `Morphology — ${afxLen}-sign ${unit}` +
    (minDistinct > 1 ? ` (≥${minDistinct} words)` : "");
  const findingSummary =
    `${filtered.length} ${unit} of length ${afxLen} sign${afxLen === 1 ? "" : "s"}` +
    (minDistinct > 1 ? `, attested across ≥${minDistinct} distinct words` : "") +
    `.\nMost common: ` +
    (sorted
      .slice(0, 8)
      .map(([s, d]) => `${fmt(s)} (${d.count}, ${d.words.length}w)`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        mode === "suf" ? "suffix" : "prefix",
        "total_count",
        "distinct_words",
        "interior_count",
        "edge_bias_g2",
        "example_words",
      ],
    ];
    for (const [s, d] of sorted) {
      const b = edgeBias.get(s);
      rows.push([
        fmt(s),
        d.count,
        d.words.length,
        b?.interior ?? 0,
        (b?.signed ?? 0).toFixed(3),
        d.words.slice(0, 20).join(" "),
      ]);
    }
    downloadFile(
      `linear_a_morphology_${unit}_${afxLen}sign.csv`,
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  const numStyle = { width: 56, fontSize: 11, padding: "3px 6px" } as const;

  return (
    <div className="panel">
      <h2>Morphology</h2>
      <p className="panel-desc">
        Recurring word edges — candidates for inflection or derivation. Choose
        affix length, set a minimum distinct-word count, and sort or expand any
        row to see its full word family. The <b>Edge G²</b> column tests
        whether a sequence is genuinely edge-leaning (over-represented at the
        word edge versus interior positions) — a stronger affix signal than
        raw frequency.
      </p>

      <div className="tab-row">
        <button
          className={`tab-btn${mode === "suf" ? " active" : ""}`}
          onClick={() => setMode("suf")}
        >
          Suffixes
        </button>
        <button
          className={`tab-btn${mode === "pre" ? " active" : ""}`}
          onClick={() => setMode("pre")}
        >
          Prefixes
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="morph"
          moduleLabel="Morphology"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ mode, afxLen, minDistinct, minTotal, q }}
          reportFn={() => {
            const cap = 80;
            const slice = display.slice(0, cap).map(([s, d], i) => ({
              rank: i + 1,
              affix: s,
              count: d.count,
              distinct: d.words.length,
              bias: edgeBias.get(s)?.signed ?? 0,
              words: d.words,
            }));
            type R = (typeof slice)[number];
            const cols: SnippetColumn<R>[] = [
              {
                label: "#",
                render: (a) => `<span style="color:#6b7280;">${a.rank}</span>`,
                align: "right",
              },
              {
                label: mode === "suf" ? "Suffix" : "Prefix",
                render: (a) =>
                  `<code style="color:#1d4ed8;font-weight:600;">${esc(fmt(a.affix))}</code>`,
                md: (a) => fmt(a.affix),
              },
              {
                label: "Total",
                render: (a) => esc(a.count),
                align: "right",
              },
              {
                label: "Distinct words",
                render: (a) => esc(a.distinct),
                align: "right",
              },
              {
                label: "Edge G²",
                render: (a) => {
                  const c = a.bias >= 0 ? "#16a34a" : "#b45309";
                  return `<span style="color:${c};">${a.bias >= 0 ? "+" : "−"}${Math.abs(a.bias).toFixed(1)}</span>`;
                },
                md: (a) => `${a.bias >= 0 ? "+" : "−"}${Math.abs(a.bias).toFixed(1)}`,
                align: "right",
              },
              {
                label: "Examples",
                render: (a) =>
                  a.words
                    .slice(0, 8)
                    .map(
                      (w) =>
                        `<code style="background:#f3f4f6;padding:1px 4px;border-radius:2px;margin-right:3px;">${esc(w)}</code>`,
                    )
                    .join("") +
                  (a.words.length > 8
                    ? `<span style="color:#6b7280;font-size:10px;"> +${a.words.length - 8}</span>`
                    : ""),
                md: (a) => a.words.slice(0, 8).join(", "),
              },
            ];
            const meta = `${filtered.length} ${unit} of length ${afxLen} sign${afxLen === 1 ? "" : "s"}${minDistinct > 1 ? `, ≥${minDistinct} distinct words` : ""}${minTotal > 1 ? `, ≥${minTotal} total` : ""}. Showing first ${slice.length}.`;
            const html = snippetWrap(meta, snippetTable(slice, cols));
            const markdown = `_${meta}_\n\n` + snippetTableMd(slice, cols);
            return { html, markdown };
          }}
        />
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter affix…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 120 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Affix length in signs"
        >
          length
          <select
            className="select"
            value={afxLen}
            onChange={(e) => setAfxLen(+e.target.value)}
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value={1}>1 sign</option>
            <option value={2}>2 signs</option>
            <option value={3}>3 signs</option>
          </select>
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum number of distinct words sharing the affix"
        >
          ≥ words
          <input
            type="number"
            className="input"
            min={1}
            value={minDistinct}
            onChange={(e) => setMinDistinct(Math.max(1, +e.target.value || 1))}
            style={numStyle}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum total attestations"
        >
          ≥ total
          <input
            type="number"
            className="input"
            min={1}
            value={minTotal}
            onChange={(e) => setMinTotal(Math.max(1, +e.target.value || 1))}
            style={numStyle}
          />
        </label>
      </div>

      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
        {filtered.length} {unit}
        {sorted.length > DISPLAY_CAP ? ` — showing first ${DISPLAY_CAP}` : ""} ·
        click a row to expand
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortHeader
                label={mode === "suf" ? "Suffix" : "Prefix"}
                sortKey="affix"
                sort={sort}
                onToggle={toggle}
              />
              <SortHeader label="Total" sortKey="total" sort={sort} onToggle={toggle} />
              <SortHeader
                label="Distinct words"
                sortKey="distinct"
                sort={sort}
                onToggle={toggle}
              />
              <SortHeader
                label="Edge G²"
                sortKey="bias"
                sort={sort}
                onToggle={toggle}
                title="Signed Dunning G²: is this sequence over-represented in the edge slot vs interior positions? + = edge-leaning (affix-like), − = interior-leaning. 3.84 ≈ p<.05, 6.63 ≈ p<.01"
              />
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            {display.map(([s, d]) => {
              const isOpen = expanded === s;
              const shown = isOpen ? d.words : d.words.slice(0, 6);
              return (
                <Fragment key={s}>
                  <tr
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : s)}
                  >
                    <td>
                      <span style={{ marginRight: 6, color: "var(--text-muted)" }}>
                        {isOpen ? "▾" : "▸"}
                      </span>
                      <b
                        style={{
                          color: mode === "suf" ? "var(--am)" : "var(--gn)",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {fmt(s)}
                      </b>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{
                          padding: "0 6px",
                          fontSize: 10,
                          marginLeft: 8,
                          minWidth: 0,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveModule("stems", { focus: s });
                        }}
                        title={`Stem families touching ${fmt(s)} — words that appear to share a stem and differ by a productive suffix`}
                      >
                        Stems
                      </button>
                    </td>
                    <td className="numeral">{d.count}</td>
                    <td className="dim">{d.words.length}</td>
                    <td
                      className="numeral"
                      style={{
                        color:
                          (edgeBias.get(s)?.signed ?? 0) >= 3.84
                            ? "var(--gn)"
                            : (edgeBias.get(s)?.signed ?? 0) <= -3.84
                              ? "var(--am)"
                              : "var(--text-muted)",
                      }}
                      title={`${fmt(s)} at the ${mode === "suf" ? "final" : "initial"} slot: ${d.count}/${windowStats.edgeTotal} tokens vs ${edgeBias.get(s)?.interior ?? 0}/${windowStats.interiorTotal} interior windows`}
                    >
                      {(edgeBias.get(s)?.signed ?? 0) >= 0 ? "+" : "−"}
                      {Math.abs(edgeBias.get(s)?.signed ?? 0).toFixed(1)}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {shown.map((w) => (
                        <WordToken key={w} word={w} />
                      ))}
                      {!isOpen && d.words.length > 6 ? (
                        <span className="dim">+{d.words.length - 6}</span>
                      ) : null}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {display.length === 0 && (
              <tr>
                <td colSpan={5} className="dim" style={{ padding: 12 }}>
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
