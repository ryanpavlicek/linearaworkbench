import { useMemo, useState } from "react";
import { csvEscape, downloadFile } from "../lib/helpers";
import { useScopedMultiWords } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import { extractRoot } from "../lib/algorithms";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

type SortKey = "size" | "total" | "root";

const DISPLAY_CAP = 120;

export default function RootCognates() {
  const words = useScopedMultiWords();
  const hyp = useWorkbench((s) => s.hypothesis);
  const [q, setQ] = useState("");
  const [minSize, setMinSize] = useState(2);
  const [minTotal, setMinTotal] = useState(1);
  const [minRootLen, setMinRootLen] = useState(2);
  const [sortKey, setSortKey] = useState<SortKey>("size");

  // All root families with at least 2 members (the minimum for a "family").
  const families = useMemo(() => {
    const map = new Map<
      string,
      { words: { word: string; count: number }[]; totalCount: number }
    >();
    for (const { word, entry } of words) {
      if (word.split("-").length < 2) continue;
      const r = extractRoot(word, hyp);
      if (r.length < 2) continue;
      let f = map.get(r);
      if (!f) {
        f = { words: [], totalCount: 0 };
        map.set(r, f);
      }
      f.words.push({ word, count: entry.count });
      f.totalCount += entry.count;
    }
    return [...map.entries()].filter(([, d]) => d.words.length >= 2);
  }, [words, hyp]);

  const filtered = useMemo(() => {
    const u = q.toLowerCase();
    const rows = families.filter(([r, d]) => {
      if (d.words.length < minSize) return false;
      if (d.totalCount < minTotal) return false;
      if (r.length < minRootLen) return false;
      if (!u) return true;
      return (
        r.toLowerCase().includes(u) ||
        d.words.some((w) => w.word.toLowerCase().includes(u))
      );
    });
    rows.sort((a, b) => {
      if (sortKey === "root") return a[0].localeCompare(b[0]);
      if (sortKey === "total") return b[1].totalCount - a[1].totalCount;
      return b[1].words.length - a[1].words.length;
    });
    return rows;
  }, [families, q, minSize, minTotal, minRootLen, sortKey]);

  const display = filtered.slice(0, DISPLAY_CAP);

  const filterDesc = [
    q && `“${q}”`,
    minSize > 2 && `≥${minSize} words`,
    minTotal > 1 && `≥${minTotal} attestations`,
    minRootLen > 2 && `root ≥${minRootLen}`,
  ]
    .filter(Boolean)
    .join(", ");
  const findingTitle = filterDesc
    ? `Root cognates — ${filterDesc}`
    : "Root cognates";
  const findingSummary =
    `${filtered.length} of ${families.length} root families (≥2 words), ` +
    `${filtered.reduce((s, [, d]) => s + d.words.length, 0)} words covered` +
    (filterDesc ? ` (filter: ${filterDesc})` : "") +
    `.\nLargest: ` +
    (filtered
      .slice(0, 6)
      .map(([r, d]) => `/${r}/ (${d.words.length})`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["root", "word_count", "total_attestations", "words"],
    ];
    for (const [r, d] of filtered) {
      rows.push([
        r,
        d.words.length,
        d.totalCount,
        [...d.words]
          .sort((a, b) => b.count - a.count)
          .map((w) => `${w.word}(×${w.count})`)
          .join(";"),
      ]);
    }
    downloadFile(
      "linear_a_root_cognates.csv",
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
    );
  }

  const numStyle = { width: 56, fontSize: 11, padding: "3px 6px" } as const;

  return (
    <div className="panel">
      <h2>Root Cognates</h2>
      <div className="callout">
        <h4>Consonant skeleton clustering</h4>
        <p>
          Strips vowels (per the active phonetic map) and groups words sharing
          the same root. Potential morphological families may indicate
          inflection or derivation patterns.
        </p>
      </div>
      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{families.length}</span>
          <span className="lbl">Families (≥2 words)</span>
        </div>
        <div className="stat-box">
          <span className="val">
            {families.reduce((s, [, d]) => s + d.words.length, 0)}
          </span>
          <span className="lbl">Words in families</span>
        </div>
        <div className="stat-box">
          <span className="val">{filtered.length}</span>
          <span className="lbl">Matching filters</span>
        </div>
      </div>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter roots…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 140 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum number of words in the family"
        >
          ≥ words
          <input
            type="number"
            className="input"
            min={2}
            value={minSize}
            onChange={(e) => setMinSize(Math.max(2, +e.target.value || 2))}
            style={numStyle}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum total attestations across the family"
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
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum length of the consonant skeleton"
        >
          root len ≥
          <input
            type="number"
            className="input"
            min={2}
            value={minRootLen}
            onChange={(e) => setMinRootLen(Math.max(2, +e.target.value || 2))}
            style={numStyle}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Sort families"
        >
          sort
          <select
            className="select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="size">Family size</option>
            <option value="total">Total attestations</option>
            <option value="root">Root (A→Z)</option>
          </select>
        </label>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="roots"
          moduleLabel="Root Cognates"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ q, minSize, minTotal, minRootLen, sortKey }}
          reportFn={() => {
            const cap = 60;
            const slice = display.slice(0, cap);
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              {
                label: "Root",
                render: ([r]) =>
                  `<code style="color:#6d28d9;font-weight:600;">/${esc(r)}/</code>`,
              },
              {
                label: "Words",
                render: ([, d]) => esc(d.words.length),
                align: "right",
              },
              {
                label: "Total",
                render: ([, d]) => esc(d.totalCount),
                align: "right",
              },
              {
                label: "Members",
                render: ([, d]) =>
                  d.words
                    .slice(0, 8)
                    .map(
                      (w) =>
                        `<code style="background:#f3f4f6;padding:1px 4px;border-radius:2px;margin-right:3px;">${esc(w.word)}<span style="color:#6b7280;font-size:10px;">×${w.count}</span></code>`,
                    )
                    .join("") +
                  (d.words.length > 8
                    ? `<span style="color:#6b7280;font-size:10px;"> +${d.words.length - 8}</span>`
                    : ""),
                md: ([, d]) => d.words.slice(0, 8).map((w) => `${w.word} (×${w.count})`).join(", "),
              },
            ];
            const meta = `${filtered.length} root families${filterDesc ? ` (${filterDesc})` : ""}. ${slice.length < filtered.length ? `Showing first ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>
      <div className="dim" style={{ fontSize: 11, margin: "6px 0" }}>
        {filtered.length === families.length
          ? `${families.length} families`
          : `${filtered.length} of ${families.length} families`}
        {filtered.length > DISPLAY_CAP ? ` — showing first ${DISPLAY_CAP}` : ""}
      </div>
      <div>
        {display.map(([r, d]) => (
          <div key={r} className="card">
            <h4 style={{ color: "var(--pu)" }}>
              /{r}/{" "}
              <span className="dim">
                ({d.words.length} words, {d.totalCount} attestations)
              </span>
            </h4>
            <div style={{ marginTop: 6 }}>
              {[...d.words]
                .sort((a, b) => b.count - a.count)
                .map((e) => (
                  <span key={e.word}>
                    <WordToken word={e.word} />
                    <span className="dim">×{e.count} </span>
                  </span>
                ))}
            </div>
          </div>
        ))}
        {display.length === 0 && (
          <p className="dim" style={{ padding: 12 }}>
            No root families match these filters.
          </p>
        )}
      </div>
    </div>
  );
}
