import { useMemo, useRef, useState } from "react";
import { csvEscape, downloadFile } from "../lib/helpers";
import type { MultiWordEntry } from "../lib/helpers";
import {
  useScopedCorpus,
  useScopedMultiWords,
  useScopeOptions,
} from "../store/scope";
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
  yuleK: number;
  herdanC: number;
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
  // Yule's K — repeat-rate of vocabulary, much less sensitive to corpus
  // size than raw TTR: K = 10⁴ · (Σ m²·V(m) − N) / N², where V(m) is the
  // number of types occurring m times. Higher = more repetitive.
  let m2v = 0;
  for (const [m, v] of freqSpectrum) m2v += m * m * v;
  const yuleK = tokens > 0 ? (10_000 * (m2v - tokens)) / (tokens * tokens) : 0;
  // Herdan's C — log-scaled type-token ratio (log V / log N), the classic
  // size-robust vocabulary-richness constant.
  const herdanC =
    tokens > 1 && types > 0 ? Math.log(types) / Math.log(tokens) : 0;
  const zipf = words.map((w, i) => ({
    rank: i + 1,
    freq: w.entry.count,
    word: w.word,
  }));
  const spectrum = [...freqSpectrum.entries()].sort((a, b) => a[0] - b[0]);
  return { types, tokens, hapax, dis, ttr, yuleK, herdanC, zipf, spectrum };
}

// Zipf–Mandelbrot fit: log f = log C − s·log(rank + β). For each candidate
// β on a small grid, the best s and intercept come from ordinary least
// squares in log space; keep the β with the highest R². β=0 reduces to a
// plain Zipf power-law fit, so the fit can only match or beat it.
function fitZipfMandelbrot(
  zipf: { rank: number; freq: number }[],
): { s: number; beta: number; r2: number; logC: number } | null {
  if (zipf.length < 5) return null;
  let best: { s: number; beta: number; r2: number; logC: number } | null =
    null;
  for (let beta = 0; beta <= 10; beta += 0.25) {
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    const n = zipf.length;
    for (const p of zipf) {
      const x = Math.log(p.rank + beta);
      const y = Math.log(p.freq);
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
      syy += y * y;
    }
    const denom = n * sxx - sx * sx;
    if (denom === 0) continue;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    const ssTot = syy - (sy * sy) / n;
    const ssRes = ssTot - (slope * (n * sxy - sx * sy)) / n;
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    if (!best || r2 > best.r2)
      best = { s: -slope, beta, r2, logC: intercept };
  }
  return best;
}

type CompareMode = "none" | "corpus" | "site" | "period";

export default function LexicalStats() {
  const words = useScopedMultiWords();
  const scoped = useScopedCorpus();
  const corpus = useWorkbench((s) => s.corpus);
  const options = useScopeOptions();
  // Ref to the rendered Zipf SVG so reportFn can serialize and inline it
  // into the captured-report HTML.
  const zipfSvgRef = useRef<SVGSVGElement>(null);

  const [compareMode, setCompareMode] = useState<CompareMode>("none");
  const [compareSite, setCompareSite] = useState("");
  const [comparePeriod, setComparePeriod] = useState("");

  const stats = useMemo(() => computeLexStats(words), [words]);
  const zipfFit = useMemo(() => fitZipfMandelbrot(stats.zipf), [stats.zipf]);

  // Vocabulary growth: distinct types observed as tokens accumulate in
  // corpus document order. A flattening curve means the vocabulary is
  // saturating; a still-climbing one means much remains unobserved.
  const growth = useMemo(() => {
    const seen = new Set<string>();
    const points: { tokens: number; types: number }[] = [{ tokens: 0, types: 0 }];
    let tok = 0;
    for (const ins of scoped.inscriptions) {
      for (const w of ins.words) {
        if (!w.includes("-")) continue;
        tok++;
        seen.add(w);
      }
      points.push({ tokens: tok, types: seen.size });
    }
    return points;
  }, [scoped.inscriptions]);

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
    // Fitted Zipf–Mandelbrot curve, clamped to the plotted frequency range.
    let fitted: string | null = null;
    if (zipfFit) {
      const pts: string[] = [];
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const r = Math.pow(A.length, i / steps); // log-spaced ranks 1..N
        const f = Math.exp(zipfFit.logC - zipfFit.s * Math.log(r + zipfFit.beta));
        if (f < 0.8 || f > maxFreq * 1.5) continue;
        pts.push(
          `${pts.length === 0 ? "M" : "L"}${x(r).toFixed(1)},${y(Math.max(1, f)).toFixed(1)}`,
        );
      }
      fitted = pts.length >= 2 ? pts.join(" ") : null;
    }
    return {
      W,
      H,
      PAD,
      dA: pathFor(A),
      dB: B ? pathFor(B) : null,
      ideal: `${idealStart} ${idealEnd}`,
      fitted,
    };
  }, [stats.zipf, compStats, zipfFit]);

  const maxSpectrum = Math.max(...stats.spectrum.map(([, c]) => c), 1);

  const hapaxPct =
    stats.types > 0 ? ((stats.hapax / stats.types) * 100).toFixed(0) : "0";
  const findingSummary =
    `${stats.types.toLocaleString()} types · ${stats.tokens.toLocaleString()} tokens · ` +
    `TTR ${stats.ttr.toFixed(3)} · ${hapaxPct}% hapax · Yule's K ${stats.yuleK.toFixed(0)} · Herdan's C ${stats.herdanC.toFixed(3)}.` +
    (zipfFit
      ? `\nZipf–Mandelbrot fit: s=${zipfFit.s.toFixed(2)}, β=${zipfFit.beta.toFixed(2)}, R²=${zipfFit.r2.toFixed(3)}.`
      : "") +
    `\nSpectrum: ${stats.hapax.toLocaleString()} words occur once, ${stats.dis.toLocaleString()} twice.` +
    (compStats
      ? `\nvs ${compareLabel}: ${compStats.types.toLocaleString()} types · TTR ${compStats.ttr.toFixed(3)} · K ${compStats.yuleK.toFixed(0)}.`
      : "");

  function exportCsv() {
    const rows: (string | number)[][] = [["frequency", "num_words"]];
    for (const [freq, count] of stats.spectrum) rows.push([freq, count]);
    downloadFile(
      "linear_a_frequency_spectrum.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  function exportGrowthCsv() {
    const rows: (string | number)[][] = [["tokens_seen", "distinct_types"]];
    for (const p of growth) rows.push([p.tokens, p.types]);
    downloadFile(
      "linear_a_vocabulary_growth.csv",
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
        <div
          className="stat-box"
          title="Yule's K = 10⁴·(Σ m²·V(m) − N)/N² — vocabulary repeat-rate, far less sensitive to corpus size than raw TTR. Higher = more repetitive vocabulary. Literary Greek runs ~60–100; administrative text runs higher."
        >
          <span className="val">{stats.yuleK.toFixed(0)}</span>
          <span className="lbl">Yule's K</span>
        </div>
        <div
          className="stat-box"
          title="Herdan's C = log(types)/log(tokens) — size-robust vocabulary richness; natural-language corpora typically fall around 0.85–0.95."
        >
          <span className="val">{stats.herdanC.toFixed(3)}</span>
          <span className="lbl">Herdan's C</span>
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
        <button
          className="btn btn-outline btn-sm"
          onClick={exportGrowthCsv}
          title="Tokens-seen vs distinct-types curve, one row per inscription in corpus order"
        >
          Export CSV (growth)
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
              { label: "Yule's K", a: stats.yuleK.toFixed(0), b: compStats?.yuleK.toFixed(0) },
              { label: "Herdan's C", a: stats.herdanC.toFixed(3), b: compStats?.herdanC.toFixed(3) },
              ...(zipfFit
                ? [
                    {
                      label: "Zipf–Mandelbrot fit",
                      a: `s=${zipfFit.s.toFixed(2)}, β=${zipfFit.beta.toFixed(2)}, R²=${zipfFit.r2.toFixed(3)}`,
                    } as StatRow,
                  ]
                : []),
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
            Dashed: ideal Zipf (freq ∝ 1/rank).{" "}
            {zipfFit && (
              <>
                <span style={{ color: "var(--gn)" }}>Green</span>: fitted
                Zipf–Mandelbrot{" "}
                <span
                  style={{ fontFamily: "var(--mono)" }}
                  title="f(r) ∝ 1/(r+β)^s, fitted by least squares in log space over a β grid. s near 1 with high R² = Zipfian; β shifts the head of the curve."
                >
                  s={zipfFit.s.toFixed(2)}, β={zipfFit.beta.toFixed(2)}, R²=
                  {zipfFit.r2.toFixed(3)}
                </span>
                .
              </>
            )}
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
              {chart.fitted && (
                <path
                  d={chart.fitted}
                  stroke="var(--gn)"
                  strokeWidth={1.25}
                  fill="none"
                  opacity={0.8}
                />
              )}
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

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Vocabulary growth</h4>
        <div className="sub" style={{ marginBottom: 8 }}>
          Distinct words observed as tokens accumulate, walking the corpus in
          document order. A flattening curve means the vocabulary is
          saturating — most of what the scribes wrote, we've seen; a curve
          still climbing at the right edge means more excavation would keep
          yielding new words. The dashed diagonal is the every-token-new
          ceiling.
        </div>
        <GrowthChart points={growth} />
      </div>
    </div>
  );
}

// Linear-scale types-vs-tokens curve with an every-token-new reference
// diagonal. Kept simple on purpose: one series, the shape is the message.
function GrowthChart({
  points,
}: {
  points: { tokens: number; types: number }[];
}) {
  const last = points[points.length - 1];
  if (!last || last.tokens < 2) {
    return <div className="dim">Not enough data.</div>;
  }
  const W = 560;
  const H = 260;
  const PAD = 40;
  const x = (t: number) => PAD + (t / last.tokens) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - (v / last.tokens) * (H - 2 * PAD);
  // Sample to ~300 segments so the path stays light.
  const step = Math.max(1, Math.floor(points.length / 300));
  const sampled = points.filter(
    (_, i) => i % step === 0 || i === points.length - 1,
  );
  const d = sampled
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(p.tokens).toFixed(1)},${y(p.types).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", maxWidth: 640 }}
      role="img"
      aria-label={`Vocabulary growth curve: ${last.types.toLocaleString()} distinct words after ${last.tokens.toLocaleString()} tokens in corpus order, against an every-token-new reference diagonal`}
    >
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="var(--border-strong)"
      />
      <line
        x1={PAD}
        y1={PAD}
        x2={PAD}
        y2={H - PAD}
        stroke="var(--border-strong)"
      />
      <text
        x={W / 2}
        y={H - 6}
        fill="var(--text-muted)"
        fontSize={10}
        textAnchor="middle"
        fontFamily="var(--sans)"
      >
        tokens seen (corpus order) →
      </text>
      <text
        x={12}
        y={H / 2}
        fill="var(--text-muted)"
        fontSize={10}
        textAnchor="middle"
        fontFamily="var(--sans)"
        transform={`rotate(-90 12 ${H / 2})`}
      >
        distinct words →
      </text>
      {/* every-token-new ceiling */}
      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(last.tokens)}
        y2={y(last.tokens)}
        stroke="var(--text-muted)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <path d={d} stroke="var(--ac)" strokeWidth={1.5} fill="none" />
      <text
        x={x(last.tokens) - 4}
        y={y(last.types) - 6}
        fill="var(--text)"
        fontSize={10}
        textAnchor="end"
        fontFamily="var(--mono)"
      >
        {last.types.toLocaleString()} types / {last.tokens.toLocaleString()}{" "}
        tokens
      </text>
    </svg>
  );
}
