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

type Mode = "suf" | "pre";
type Affix = [string, { count: number; words: string[] }];

const DISPLAY_CAP = 200;

export default function Morphology() {
  const words = useScopedMultiWords();
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
  // word must have more signs than the affix length.
  const { suffixes, prefixes } = useMemo(() => {
    const sm = new Map<string, { count: number; words: string[] }>();
    const pm = new Map<string, { count: number; words: string[] }>();
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
    }
    return {
      suffixes: [...sm.entries()] as Affix[],
      prefixes: [...pm.entries()] as Affix[],
    };
  }, [words, afxLen]);

  const all = mode === "suf" ? suffixes : prefixes;
  const unit = mode === "suf" ? "suffixes" : "prefixes";
  const fmt = (s: string) => (mode === "suf" ? `-${s}` : `${s}-`);

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
      [mode === "suf" ? "suffix" : "prefix", "total_count", "distinct_words", "example_words"],
    ];
    for (const [s, d] of sorted) {
      rows.push([fmt(s), d.count, d.words.length, d.words.slice(0, 20).join(" ")]);
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
        row to see its full word family.
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
                    </td>
                    <td className="numeral">{d.count}</td>
                    <td className="dim">{d.words.length}</td>
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
                <td colSpan={4} className="dim" style={{ padding: 12 }}>
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
