import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { extractRoot, sequenceSimilarity } from "../lib/algorithms";
import { csvEscape, downloadFile } from "../lib/helpers";
import { InscriptionLink } from "../components/InscriptionLink";
import { WordToken } from "../components/WordToken";
import { GlyphRun } from "../components/Glyph";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

interface SimResult {
  id: string;
  site: string;
  period: string;
  scribe: string;
  score: number;
  shared: number;
  wordCount: number;
}

// Whole-inscription similarity by token-level Levenshtein over the
// multi-sign-word sequence. Useful for surfacing fragmentary copies,
// formulaic libation tables that share a backbone, or accounting series
// from the same scribe with the same recipients.
type Mode = "exact" | "skeleton";

export default function Similarity() {
  const inscriptions = useScopedCorpus().inscriptions;
  const hypothesis = useWorkbench((s) => s.hypothesis);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const [pivot, setPivot] = useState("");
  const [minWords, setMinWords] = useState(3);
  const [sameSite, setSameSite] = useState(false);
  const [samePeriod, setSamePeriod] = useState(false);
  const [mode, setMode] = useState<Mode>("exact");
  const [picker, setPicker] = useState("");
  const [view, setView] = useState<"pivot" | "clusters">("pivot");
  const [clusterThreshold, setClusterThreshold] = useState(0.5);

  // In skeleton mode, transform every multi-sign word to its consonant
  // skeleton (vowels stripped, signs joined) before comparison. Words like
  // KU-RO and KA-RA both reduce to "kr" and count as a match.
  const transform = (word: string) =>
    mode === "skeleton" ? extractRoot(word, hypothesis) : word;

  const eligible = useMemo(
    () =>
      inscriptions.filter(
        (i) => i.words.filter((w) => w.includes("-")).length >= minWords,
      ),
    [inscriptions, minWords],
  );

  const suggestions = useMemo(() => {
    if (!picker) return eligible.slice(0, 12);
    const u = picker.toUpperCase();
    return eligible.filter((i) => i.id.toUpperCase().includes(u)).slice(0, 12);
  }, [eligible, picker]);

  const pivotIns = pivot ? inscriptions.find((i) => i.id === pivot) : null;

  const results = useMemo<SimResult[]>(() => {
    if (!pivotIns) return [];
    const pivotRaw = pivotIns.words.filter((w) => w.includes("-"));
    if (pivotRaw.length === 0) return [];
    const pivotWords = pivotRaw.map(transform);
    const pivotSet = new Set(pivotWords);
    const out: SimResult[] = [];
    for (const ins of eligible) {
      if (ins.id === pivotIns.id) continue;
      if (sameSite && ins.site !== pivotIns.site) continue;
      if (samePeriod && ins.context !== pivotIns.context) continue;
      const wsRaw = ins.words.filter((w) => w.includes("-"));
      const ws = wsRaw.map(transform);
      const score = sequenceSimilarity(pivotWords, ws);
      let shared = 0;
      for (const w of ws) if (pivotSet.has(w)) shared++;
      out.push({
        id: ins.id,
        site: ins.site,
        period: ins.context,
        scribe: ins.scribe,
        score,
        shared,
        wordCount: wsRaw.length,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pivotIns, eligible, sameSite, samePeriod, mode, hypothesis]);

  // ── Clusters view ──────────────────────────────────────────────────────
  // Group mutually-similar inscriptions via connected components: build the
  // pairwise-similarity graph once, then union inscriptions whose similarity
  // clears the threshold. O(n²) so the pool is capped to the largest tablets.
  const CLUSTER_CAP = 300;
  const wc = (i: { words: string[] }) =>
    i.words.filter((w) => w.includes("-")).length;
  const clusterPool = useMemo(
    () => [...eligible].sort((x, y) => wc(y) - wc(x)).slice(0, CLUSTER_CAP),
    [eligible],
  );

  const graph = useMemo(() => {
    if (view !== "clusters") return null;
    const arr = clusterPool.map((ins) => ({
      ins,
      ws: ins.words.filter((w) => w.includes("-")).map(transform),
    }));
    const edges: { i: number; j: number; s: number }[] = [];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const s = sequenceSimilarity(arr[i].ws, arr[j].ws);
        if (s >= 0.3) edges.push({ i, j, s });
      }
    return { arr, edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, clusterPool, mode, hypothesis]);

  const clusters = useMemo(() => {
    if (!graph) return [];
    const n = graph.arr.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (const e of graph.edges) if (e.s >= clusterThreshold) union(e.i, e.j);
    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      const g = groups.get(r);
      if (g) g.push(i);
      else groups.set(r, [i]);
    }
    return [...groups.values()]
      .filter((g) => g.length >= 2)
      .map((g) => g.map((idx) => graph.arr[idx].ins))
      .sort((a, b) => b.length - a.length);
  }, [graph, clusterThreshold]);

  const clusteredCount = clusters.reduce((s, c) => s + c.length, 0);

  const findingTitle = pivotIns
    ? `Similar to ${pivotIns.id} (${mode})`
    : "Similarity";
  const findingSummary = pivotIns
    ? `Top inscriptions similar to ${pivotIns.id} (${mode} mode` +
      `${sameSite ? ", same site" : ""}${samePeriod ? ", same period" : ""}).\n` +
      (results
        .slice(0, 6)
        .map((r) => `${r.id} ${(r.score * 100).toFixed(0)}%`)
        .join(", ") || "none") +
      "."
    : "";

  return (
    <div className="panel">
      <h2>Similarity Clustering</h2>
      <div className="callout">
        <h4>Whole-inscription Levenshtein</h4>
        <p>
          Pick a pivot inscription. The top 50 most similar inscriptions are
          ranked by token-level edit distance over their multi-sign words.
          Useful for spotting fragmentary copies, accounting series sharing
          recipients, and libation formulae with the same backbone.
        </p>
        <p>
          Two comparison modes: <b>Exact</b> treats words as raw tokens
          (KU-RO ≠ KU-RA). <b>Skeleton</b> reduces each word to its
          consonant skeleton first (KU-RO and KA-RA both become "kr"),
          surfacing morphological and lexical cousins that may share a root.
        </p>
        <p>
          <b>Find similar</b> ranks everything against one pivot;{" "}
          <b>Clusters</b> instead groups mutually-similar inscriptions
          automatically (connected components of the similarity graph) — drag
          the <b>link ≥</b> threshold to make clusters tighter or looser.
        </p>
      </div>

      <div className="tab-row">
        <button
          className={`tab-btn${view === "pivot" ? " active" : ""}`}
          onClick={() => setView("pivot")}
        >
          Find similar
        </button>
        <button
          className={`tab-btn${view === "clusters" ? " active" : ""}`}
          onClick={() => setView("clusters")}
        >
          Clusters
        </button>
      </div>

      <div className="tab-row">
        <button
          className={`tab-btn${mode === "exact" ? " active" : ""}`}
          onClick={() => setMode("exact")}
        >
          Exact tokens
        </button>
        <button
          className={`tab-btn${mode === "skeleton" ? " active" : ""}`}
          onClick={() => setMode("skeleton")}
        >
          Consonant skeleton (fuzzy)
        </button>
      </div>

      {view === "pivot" && (
      <div className="toolbar">
        <input
          className="input"
          placeholder="Pivot inscription (e.g. HT1)…"
          value={picker}
          onChange={(e) => setPicker(e.target.value)}
          style={{ flex: 1 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          min words
          <input
            type="number"
            className="input"
            min={1}
            value={minWords}
            onChange={(e) => setMinWords(Math.max(1, +e.target.value || 1))}
            style={{ width: 60 }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <input
            type="checkbox"
            checked={sameSite}
            onChange={(e) => setSameSite(e.target.checked)}
          />
          same site
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <input
            type="checkbox"
            checked={samePeriod}
            onChange={(e) => setSamePeriod(e.target.checked)}
          />
          same period
        </label>
      </div>
      )}

      {view === "pivot" && !pivotIns && (
        <div>
          <div
            className="dim"
            style={{
              font: "600 10px var(--sans)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Pick a pivot
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 4,
            }}
          >
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setPivot(s.id);
                  setPicker("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 8px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    font: "500 12px var(--mono)",
                    color: "var(--text)",
                    minWidth: 60,
                  }}
                >
                  {s.id}
                </span>
                <span className="site-text">{s.site}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "pivot" && pivotIns && (
        <>
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--ac)",
              borderRadius: 6,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  font: "600 10px var(--sans)",
                  color: "var(--ac)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                Pivot
              </span>
              <span style={{ font: "500 14px var(--mono)" }}>
                <InscriptionLink id={pivotIns.id} />
              </span>
              <span className="site-text">{pivotIns.site}</span>
              {pivotIns.context && (
                <span className="dim">{pivotIns.context}</span>
              )}
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPivot("")}
              >
                Change pivot
              </button>
            </div>
            {pivotIns.glyphs && (
              <GlyphRun glyphs={pivotIns.glyphs.slice(0, 80)} size={18} />
            )}
            <div style={{ marginTop: 4 }}>
              {pivotIns.words.map((w, i) => (
                <WordToken key={i} word={w} />
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span className="dim" style={{ fontSize: 11, flex: 1 }}>
              {results.length} similar inscription
              {results.length === 1 ? "" : "s"} · mode: <b>{mode}</b>
            </span>
            {results.length > 0 && (
              <>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const header = [
                    "rank",
                    "inscription_id",
                    "site",
                    "period",
                    "scribe",
                    "similarity",
                    "shared_words",
                    "word_count",
                    "mode",
                  ];
                  const rowsCsv = [header.map(csvEscape).join(",")];
                  results.forEach((r, i) => {
                    rowsCsv.push(
                      [
                        i + 1,
                        r.id,
                        r.site,
                        r.period,
                        r.scribe,
                        r.score.toFixed(4),
                        r.shared,
                        r.wordCount,
                        mode,
                      ]
                        .map(csvEscape)
                        .join(","),
                    );
                  });
                  downloadFile(
                    `linear_a_similar_to_${pivotIns!.id.replace(/[^A-Z0-9-]/gi, "_")}.csv`,
                    rowsCsv.join("\n"),
                  );
                }}
                title="Download current similarity results as CSV"
              >
                Export CSV
              </button>
              <SaveFindingButton
                module="similarity"
                moduleLabel="Similarity"
                defaultTitle={findingTitle}
                summary={findingSummary}
                payload={{ pivot, mode, minWords, sameSite, samePeriod }}
                reportFn={() => {
                  const cap = 50;
                  const ranked = results.slice(0, cap).map((r, i) => ({
                    ...r,
                    rank: i + 1,
                  }));
                  const cols: SnippetColumn<(typeof ranked)[number]>[] = [
                    {
                      label: "#",
                      render: (r) => `<span style="color:#6b7280;">${r.rank}</span>`,
                      align: "right",
                    },
                    { label: "Inscription", render: (r) => `<code>${esc(r.id)}</code>` },
                    { label: "Site", render: (r) => esc(r.site) },
                    { label: "Period", render: (r) => esc(r.period || "—") },
                    {
                      label: "Similarity",
                      render: (r) => `<b>${(r.score * 100).toFixed(0)}%</b>`,
                      align: "right",
                    },
                    {
                      label: "Shared",
                      render: (r) => esc(r.shared),
                      align: "right",
                    },
                    {
                      label: "Tokens",
                      render: (r) => esc(r.wordCount),
                      align: "right",
                    },
                  ];
                  const meta = `Similarity to ${pivotIns?.id} (${mode}, min words ${minWords}${sameSite ? ", same site" : ""}${samePeriod ? ", same period" : ""}). ${results.length} matches${ranked.length === results.length ? "" : `; showing top ${cap}`}.`;
                  return {
                    html: snippetWrap(meta, snippetTable(ranked, cols)),
                    markdown: `_${meta}_\n\n` + snippetTableMd(ranked, cols),
                  };
                }}
              />
              </>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Inscription</th>
                  <th>Site</th>
                  <th>Period</th>
                  <th>Similarity</th>
                  <th>Shared words</th>
                  <th>Tokens</th>
                  <th style={{ width: 1 }}>Open in</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const cls =
                    r.score >= 0.6
                      ? "score-hi"
                      : r.score >= 0.3
                        ? "score-md"
                        : "score-lo";
                  return (
                    <tr key={r.id}>
                      <td className="dim">{i + 1}</td>
                      <td>
                        <InscriptionLink id={r.id} />
                      </td>
                      <td className="site-text">{r.site}</td>
                      <td className="dim">{r.period || "—"}</td>
                      <td>
                        <span className={`score ${cls}`}>
                          {(r.score * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="numeral">{r.shared}</td>
                      <td className="dim">{r.wordCount}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: "2px 6px", fontSize: 10 }}
                          onClick={() =>
                            // Pass both ids so Compare Inscriptions can open
                            // pre-loaded with the pivot AND this match — the
                            // natural next step from "these two are similar."
                            setActiveModule("compare", {
                              focus: `${pivotIns!.id},${r.id}`,
                            })
                          }
                          title={`Open ${pivotIns?.id} alongside ${r.id} in Compare Inscriptions`}
                        >
                          Compare with {pivotIns?.id} →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "clusters" && (
        <>
          <div className="toolbar" style={{ flexWrap: "wrap" }}>
            <label
              className="dim"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              min words
              <input
                type="number"
                className="input"
                min={1}
                value={minWords}
                onChange={(e) => setMinWords(Math.max(1, +e.target.value || 1))}
                style={{ width: 60 }}
              />
            </label>
            <label
              className="dim"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title="Two inscriptions join a cluster when their similarity clears this"
            >
              link ≥ {clusterThreshold.toFixed(2)}
              <input
                type="range"
                min={0.3}
                max={0.9}
                step={0.05}
                value={clusterThreshold}
                onChange={(e) => setClusterThreshold(+e.target.value)}
                style={{ width: 120 }}
              />
            </label>
            <span style={{ flex: 1 }} />
            <span className="dim" style={{ fontSize: 11 }}>
              {clusters.length} clusters · {clusteredCount} inscriptions grouped
              {clusterPool.length >= CLUSTER_CAP
                ? ` (largest ${CLUSTER_CAP} tablets)`
                : ""}
            </span>
          </div>
          <div className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
            Connected components of the similarity graph: inscriptions link when
            their {mode === "skeleton" ? "consonant-skeleton" : "token"}{" "}
            similarity clears the threshold. Higher threshold → tighter, smaller
            clusters.
          </div>
          {clusters.length === 0 ? (
            <div className="card">
              <div className="dim">
                No clusters at this threshold. Lower <b>link ≥</b> to group more
                loosely.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 8,
              }}
            >
              {clusters.slice(0, 60).map((group, gi) => (
                <div
                  key={gi}
                  className="card"
                  style={{ margin: 0, padding: "10px 12px" }}
                >
                  <div
                    style={{
                      font: "600 10px var(--sans)",
                      color: "var(--ac)",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      marginBottom: 6,
                    }}
                  >
                    Cluster {gi + 1} · {group.length} inscriptions
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {group.map((ins) => (
                      <span
                        key={ins.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                        }}
                      >
                        <InscriptionLink id={ins.id} />
                        <span className="site-text">{ins.site}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
