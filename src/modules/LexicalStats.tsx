import { useMemo, useRef, useState } from "react";
import { csvEscape, downloadFile } from "../lib/helpers";
import type { MultiWordEntry } from "../lib/helpers";
import { useScopedMultiWords, useScopeOptions } from "../store/scope";
import { useWorkbench, buildIndex } from "../store/workbench";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

// Lexical statistics over the multi-sign vocabulary: type/token ratio,
// hapax spectrum, and a Zipf rank–frequency curve. These help assess
// whether the corpus behaves statistically like natural language — an open
// question for a small, mostly-administrative corpus.

interface LexStats {
  types: number;
  tokens: number;
  hapax: number;
  dis: number;
  ttr: number;
  zipf: { rank: number; freq: number; word: string }[];
  spectrum: [number, number][];
}

function computeLexStats(words: MultiWordEntry[]): LexStats {
  const types = words.length;
  let tokens = 0;
  const freqSpectrum = new Map<number, number>(); // frequency → # of words with it
  for (const { entry } of words) {
    tokens += entry.count;
    freqSpectrum.set(entry.count, (freqSpectrum.get(entry.count) ?? 0) + 1);
  }
  const hapax = freqSpectrum.get(1) ?? 0;
  const dis = freqSpectrum.get(2) ?? 0;
  const ttr = tokens > 0 ? types / tokens : 0;
  const zipf = words.map((w, i) => ({
    rank: i + 1,
    freq: w.entry.count,
    word: w.word,
  }));
  const spectrum = [...freqSpectrum.entries()].sort((a, b) => a[0] - b[0]);
  return { types, tokens, hapax, dis, ttr, zipf, spectrum };
}

type CompareMode = "none" | "corpus" | "site" | "period";

export default function LexicalStats() {
  const words = useScopedMultiWords();
  const corpus = useWorkbench((s) => s.corpus);
  const options = useScopeOptions();
  // Ref to the rendered Zipf SVG so reportFn can serialize and inline it
  // into the captured-report HTML.
  const zipfSvgRef = useRef<SVGSVGElement>(null);

  const [compareMode, setCompareMode] = useState<CompareMode>("none");
  const [compareSite, setCompareSite] = useState("");
  const [comparePeriod, setComparePeriod] = useState("");

  const stats = useMemo(() => computeLexStats(words), [words]);

  // Comparison set B: an independently-filtered slice of the *full* corpus
  // (so it's unaffected by the active scope) selected by the controls below.
  const compWords = useMemo<MultiWordEntry[] | null>(() => {
    if (compareMode === "none") return null;
    let ins = corpus.inscriptions;
    if (compareMode === "site") {
      if (!compareSite) return null;
      ins = ins.filter((i) => i.site === compareSite);
    } else if (compareMode === "period") {
      if (!comparePeriod) return null;
      ins = ins.filter((i) => i.context === comparePeriod);
    }
    const idx = buildIndex(ins, corpus.signs);
    const list: MultiWordEntry[] = [];
    for (const [word, entry] of idx.wordIndex)
      if (word.includes("-")) list.push({ word, entry });
    list.sort((a, b) => b.entry.count - a.entry.count);
    return list;
  }, [compareMode, compareSite, comparePeriod, corpus]);

  const compStats = useMemo(
    () => (compWords ? computeLexStats(compWords) : null),
    [compWords],
  );

  const compareLabel =
    compareMode === "corpus"
      ? "whole corpus"
      : compareMode === "site"
        ? compareSite || "site…"
        : compareMode === "period"
          ? comparePeriod || "period…"
          : "";

  // Zipf chart with optional overlay; shared log-log scales span both series.
  const chart = useMemo(() => {
    const A = stats.zipf;
    if (A.length < 2) return null;
    const B = compStats && compStats.zipf.length >= 2 ? compStats.zipf : null;
    const W = 560;
    const H = 320;
    const PAD = 40;
    const maxRank = Math.max(A.length, B?.length ?? 0);
    const maxFreq = Math.max(A[0].freq, B?.[0]?.freq ?? 0);
    const maxLogRank = Math.log10(maxRank) || 1;
    const maxLogFreq = Math.log10(maxFreq) || 1;
    const x = (rank: number) =>
      PAD + (Math.log10(rank) / maxLogRank) * (W - 2 * PAD);
    const y = (freq: number) =>
      H - PAD - (Math.log10(freq) / maxLogFreq) * (H - 2 * PAD);
    const pathFor = (pts: { rank: number; freq: number }[]) => {
      const step = Math.max(1, Math.floor(pts.length / 400));
      const sampled = pts.filter(
        (_, i) => i % step === 0 || i === pts.length - 1,
      );
      return sampled
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"}${x(p.rank).toFixed(1)},${y(p.freq).toFixed(1)}`,
        )
        .join(" ");
    };
    const idealStart = `M${x(1).toFixed(1)},${y(A[0].freq).toFixed(1)}`;
    const idealEnd = `L${x(A.length).toFixed(1)},${y(Math.max(1, A[0].freq / A.length)).toFixed(1)}`;
    return {
      W,
      H,
      PAD,
      dA: pathFor(A),
      dB: B ? pathFor(B) : null,
      ideal: `${idealStart} ${idealEnd}`,
    };
  }, [stats.zipf, compStats]);

  const maxSpectrum = Math.max(...stats.spectrum.map(([, c]) => c), 1);

  const hapaxPct =
    stats.types > 0 ? ((stats.hapax / stats.types) * 100).toFixed(0) : "0";
  const findingSummary =
    `${stats.types.toLocaleString()} types · ${stats.tokens.toLocaleString()} tokens · ` +
    `TTR ${stats.ttr.toFixed(3)} · ${hapaxPct}% hapax.\n` +
    `Spectrum: ${stats.hapax.toLocaleString()} words occur once, ${stats.dis.toLocaleString()} twice.` +
    (compStats
      ? `\nvs ${compareLabel}: ${compStats.types.toLocaleString()} types · TTR ${compStats.ttr.toFixed(3)}.`
      : "");

  function exportCsv() {
    const rows: (string | number)[][] = [["frequency", "num_words"]];
    for (const [freq, count] of stats.spectrum) rows.push([freq, count]);
    downloadFile(
      "linear_a_frequency_spectrum.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  const selStyle = { fontSize: 11, padding: "3px 6px" } as const;

  return (
    <div className="panel">
      <h2>Lexical Statistics</h2>
      <div className="callout">
        <h4>Does the corpus behave like a language?</h4>
        <p>
          Type-token ratio, the frequency spectrum (how many words occur
          once, twice, …), and a Zipf rank–frequency curve. Natural-language
          corpora follow Zipf's law (frequency roughly inversely
          proportional to rank, a straight line on log-log axes) and carry a
          large tail of hapax legomena. A small administrative corpus like
          Linear A's only partly fits — these plots make the shape visible.
          Use <b>Compare with</b> to overlay a second slice.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{stats.types.toLocaleString()}</span>
          <span className="lbl">Types (distinct words)</span>
        </div>
        <div className="stat-box">
          <span className="val">{stats.tokens.toLocaleString()}</span>
          <span className="lbl">Tokens (occurrences)</span>
        </div>
        <div className="stat-box">
          <span className="val">{stats.ttr.toFixed(3)}</span>
          <span className="lbl">Type–token ratio</span>
        </div>
        <div className="stat-box">
          <span className="val">{hapaxPct}%</span>
          <span className="lbl">Hapax legomena</span>
        </div>
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Overlay a second slice of the corpus for comparison"
        >
          Compare with
          <select
            className="select"
            value={compareMode}
            onChange={(e) => setCompareMode(e.target.value as CompareMode)}
            style={selStyle}
          >
            <option value="none">none</option>
            <option value="corpus">whole corpus</option>
            <option value="site">a site…</option>
            <option value="period">a period…</option>
          </select>
        </label>
        {compareMode === "site" && (
          <select
            className="select"
            value={compareSite}
            onChange={(e) => setCompareSite(e.target.value)}
            style={selStyle}
          >
            <option value="">pick a site…</option>
            {options.sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {compareMode === "period" && (
          <select
            className="select"
            value={comparePeriod}
            onChange={(e) => setComparePeriod(e.target.value)}
            style={selStyle}
          >
            <option value="">pick a period…</option>
            {options.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV (spectrum)
        </button>
        <SaveFindingButton
          module="lexstats"
          moduleLabel="Lexical Statistics"
          defaultTitle="Lexical statistics"
          summary={findingSummary}
          reportFn={() => {
            // Serialize the live Zipf SVG so the captured report carries the
            // most visually arresting result in the whole tool — the rank-
            // frequency curve against the ideal Zipf line — not just numbers.
            // We rewrite CSS-variable colors to concrete hex so the SVG
            // renders correctly outside the app's CSS context.
            let svgHtml = "";
            if (zipfSvgRef.current) {
              const clone = zipfSvgRef.current.cloneNode(true) as SVGSVGElement;
              const concretize = (s: string) =>
                s
                  .replace(/var\(--ac\)/g, "#1d4ed8")
                  .replace(/var\(--pu\)/g, "#6d28d9")
                  .replace(/var\(--border-strong\)/g, "#9ca3af")
                  .replace(/var\(--border\)/g, "#e2e5ea")
                  .replace(/var\(--text-dim\)/g, "#6b7280")
                  .replace(/var\(--text-muted\)/g, "#9ca3af")
                  .replace(/var\(--text\)/g, "#1f2937");
              clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
              clone.setAttribute("style", "width:100%;max-width:640px;height:auto;");
              svgHtml = concretize(
                new XMLSerializer().serializeToString(clone),
              );
            }
            // Two-column stats table, with comparison side when present.
            type StatRow = {
              label: string;
              a: string;
              b?: string;
            };
            const statRows: StatRow[] = [
              { label: "Types (distinct words)", a: stats.types.toLocaleString(), b: compStats?.types.toLocaleString() },
              { label: "Tokens (occurrences)", a: stats.tokens.toLocaleString(), b: compStats?.tokens.toLocaleString() },
              { label: "Type–token ratio", a: stats.ttr.toFixed(3), b: compStats?.ttr.toFixed(3) },
              { label: "Hapax legomena", a: `${stats.hapax.toLocaleString()} (${hapaxPct}%)`, b: compStats ? `${compStats.hapax.toLocaleString()} (${compStats.types > 0 ? ((compStats.hapax / compStats.types) * 100).toFixed(0) : "0"}%)` : undefined },
              { label: "Dis legomena (×2)", a: stats.dis.toLocaleString(), b: compStats?.dis.toLocaleString() },
            ];
            const statCols: SnippetColumn<StatRow>[] = [
              { label: "Measure", render: (r) => esc(r.label) },
              { label: "Current view", render: (r) => `<b>${esc(r.a)}</b>`, align: "right" },
            ];
            if (compStats) {
              statCols.push({
                label: compareLabel,
                render: (r) => esc(r.b ?? ""),
                align: "right",
              });
            }
            // Top 15 spectrum entries
            const specRows = stats.spectrum.slice(0, 15);
            const specCols: SnippetColumn<(typeof specRows)[number]>[] = [
              { label: "Frequency", render: ([f]) => esc(f), align: "right" },
              { label: "# of words at this frequency", render: ([, c]) => esc(c), align: "right" },
            ];
            const meta = `Type–token ratio ${stats.ttr.toFixed(3)} · ${hapaxPct}% hapax · ${stats.types.toLocaleString()} types / ${stats.tokens.toLocaleString()} tokens${compStats ? ` (compared against ${compareLabel})` : ""}.`;
            const html =
              snippetWrap(meta, snippetTable(statRows, statCols)) +
              (svgHtml
                ? `<div style="margin:12px 0;text-align:center;background:#fafbfc;border:1px solid #e2e5ea;border-radius:4px;padding:8px;">${svgHtml}<div style="font-size:11px;color:#6b7280;margin-top:4px;">Zipf rank–frequency, log–log; dashed line is ideal Zipf (freq ∝ 1/rank).</div></div>`
                : "") +
              `<div style="margin-top:10px;font-size:11px;color:#6b7280;">Top 15 of frequency spectrum:</div>` +
              snippetTable(specRows, specCols);
            const markdown =
              `_${meta}_\n\n` +
              snippetTableMd(statRows, statCols) +
              "\n\n_Frequency spectrum (top 15):_\n\n" +
              snippetTableMd(specRows, specCols);
            return { html, markdown };
          }}
        />
      </div>

      {compStats && (
        <div className="table-wrap" style={{ marginBottom: 12 }}>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>
                  <span style={{ color: "var(--ac)" }}>● Current view</span>
                </th>
                <th>
                  <span style={{ color: "var(--pu)" }}>● {compareLabel}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="dim">Types</td>
                <td className="numeral">{stats.types.toLocaleString()}</td>
                <td className="numeral">{compStats.types.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="dim">Tokens</td>
                <td className="numeral">{stats.tokens.toLocaleString()}</td>
                <td className="numeral">{compStats.tokens.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="dim">Type–token ratio</td>
                <td className="numeral">{stats.ttr.toFixed(3)}</td>
                <td className="numeral">{compStats.ttr.toFixed(3)}</td>
              </tr>
              <tr>
                <td className="dim">Hapax %</td>
                <td className="numeral">
                  {stats.types > 0
                    ? ((stats.hapax / stats.types) * 100).toFixed(0)
                    : 0}
                  %
                </td>
                <td className="numeral">
                  {compStats.types > 0
                    ? ((compStats.hapax / compStats.types) * 100).toFixed(0)
                    : 0}
                  %
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="col2">
        <div className="card">
          <h4>Zipf rank–frequency (log–log)</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            <span style={{ color: "var(--ac)" }}>Blue</span>: current view.{" "}
            {compStats ? (
              <>
                <span style={{ color: "var(--pu)" }}>Purple</span>:{" "}
                {compareLabel}.{" "}
              </>
            ) : null}
            Dashed: ideal Zipf (freq ∝ 1/rank). A straight-ish line parallel to
            the dashed reference means Zipfian behavior.
          </div>
          {chart ? (
            <svg
              ref={zipfSvgRef}
              viewBox={`0 0 ${chart.W} ${chart.H}`}
              style={{ width: "100%", height: "auto" }}
              role="img"
              aria-label="Zipf rank–frequency chart on log–log axes: word frequency against frequency rank for the current view, with a dashed ideal-Zipf reference line"
            >
              {/* axes */}
              <line
                x1={chart.PAD}
                y1={chart.H - chart.PAD}
                x2={chart.W - chart.PAD}
                y2={chart.H - chart.PAD}
                stroke="var(--border-strong)"
              />
              <line
                x1={chart.PAD}
                y1={chart.PAD}
                x2={chart.PAD}
                y2={chart.H - chart.PAD}
                stroke="var(--border-strong)"
              />
              <text
                x={chart.W / 2}
                y={chart.H - 6}
                fill="var(--text-muted)"
                fontSize={10}
                textAnchor="middle"
                fontFamily="var(--sans)"
              >
                log₁₀ rank →
              </text>
              <text
                x={12}
                y={chart.H / 2}
                fill="var(--text-muted)"
                fontSize={10}
                textAnchor="middle"
                fontFamily="var(--sans)"
                transform={`rotate(-90 12 ${chart.H / 2})`}
              >
                log₁₀ frequency →
              </text>
              <path
                d={chart.ideal}
                stroke="var(--text-muted)"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="none"
              />
              {chart.dB && (
                <path
                  d={chart.dB}
                  stroke="var(--pu)"
                  strokeWidth={1.5}
                  fill="none"
                  opacity={0.85}
                />
              )}
              <path
                d={chart.dA}
                stroke="var(--ac)"
                strokeWidth={1.5}
                fill="none"
              />
            </svg>
          ) : (
            <div className="dim">Not enough data.</div>
          )}
        </div>

        <div className="card">
          <h4>Frequency spectrum</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            How many distinct words occur exactly N times. The tall bar at
            N=1 is the hapax legomena. (Current view.)
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            {stats.spectrum.slice(0, 12).map(([freq, count]) => (
              <div
                key={freq}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 50px",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 11,
                }}
              >
                <span className="dim" style={{ textAlign: "right" }}>
                  {freq}×
                </span>
                <div
                  style={{
                    height: 10,
                    background: freq === 1 ? "var(--am)" : "var(--ac)",
                    opacity: 0.55,
                    borderRadius: 1,
                    width: `${(count / maxSpectrum) * 100}%`,
                    minWidth: 2,
                  }}
                />
                <span className="numeral">{count}</span>
              </div>
            ))}
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            {stats.hapax.toLocaleString()} words occur once,{" "}
            {stats.dis.toLocaleString()} twice. A high hapax fraction is
            expected in small corpora and for proper-name-rich texts.
          </div>
        </div>
      </div>
    </div>
  );
}
