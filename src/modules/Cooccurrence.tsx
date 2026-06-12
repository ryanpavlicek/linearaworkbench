import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import {
  chiSquared2x2,
  chiSquaredPValue,
  cooccurrencePairs,
  fishersExact,
  logLikelihoodRatio2x2,
  pmiInterval,
} from "../lib/algorithms";

type Metric = "pmi" | "count" | "loglik" | "chi2";

interface Pair {
  a: string;
  b: string;
  joint: number;
  countA: number;
  countB: number;
  pmi: number;
  pmiLow: number;
  pmiHigh: number;
  loglik: number;
  chi2: number;
  pValue: number;
}

// Every pair's marginal counts (shared counting core in lib/algorithms)
// plus the four collocation measures: PMI, G² (log-likelihood),
// Yates-corrected χ² (with its associated p-value), and the joint count.
function computePairs(
  inscriptions: { words: string[] }[],
): { pairs: Pair[]; total: number } {
  const { pairs: base, total } = cooccurrencePairs(inscriptions);
  const pairs: Pair[] = base.map(({ a, b, joint, countA, countB, pmi }) => {
    const [pmiLow, pmiHigh] = pmiInterval(joint, countA, countB, total);
    // Dunning (1993) log-likelihood ratio — full 4-cell G², not the
    // single-cell shortcut. Asymptotically χ²(1); more robust than χ² for
    // sparse pairs. See logLikelihoodRatio2x2 in algorithms.ts.
    const loglik = logLikelihoodRatio2x2(joint, countA, countB, total);
    const chi2 = chiSquared2x2(joint, countA, countB, total);
    const pValue = chiSquaredPValue(chi2);
    return {
      a, b, joint, countA, countB,
      pmi, pmiLow, pmiHigh, loglik, chi2, pValue,
    };
  });
  return { pairs, total };
}

function formatP(p: number, corrected: number | null): string {
  // corrected p = p × N (Bonferroni), clamped to 1
  const value = corrected !== null ? Math.min(1, p * corrected) : p;
  if (value < 1e-12) return "<1e-12";
  if (value < 0.001) return value.toExponential(1);
  return value.toFixed(3);
}

function sigClass(p: number, corrected: number | null): string {
  const value = corrected !== null ? Math.min(1, p * corrected) : p;
  if (value < 0.001) return "score-hi";
  if (value < 0.05) return "score-md";
  return "score-lo";
}

// Conventional threshold below which χ²'s normal approximation gets dicey
// (expected cell counts fall below ~5). We flag any pair whose observed joint
// count is at or below this so the user is reminded that the reported
// p-value should be cross-checked against Fisher's exact — and that "high
// PMI" on a 3-tablet co-occurrence is structurally fragile evidence even if
// the p looks impressive.
const LOW_N = 5;
const LOW_N_NOTE =
  "Small-N pair: joint count ≤ 5. χ² / G² are unreliable at this sample size — use the F button for Fisher's exact, and treat the apparent significance with caution.";

export default function Cooccurrence() {
  const inscriptions = useScopedCorpus().inscriptions;
  const initialIntent = useWorkbench.getState().moduleIntent;
  const initialMetric: Metric =
    initialIntent?.tab === "loglik"
      ? "loglik"
      : initialIntent?.tab === "count"
        ? "count"
        : initialIntent?.tab === "chi2"
          ? "chi2"
          : "pmi";
  const [q, setQ] = useState(initialIntent?.focus ?? "");
  const [metric, setMetric] = useState<Metric>(initialMetric);
  const [minJoint, setMinJoint] = useState(3);
  const [bonferroni, setBonferroni] = useState(true);
  const [sigOnly, setSigOnly] = useState(false);
  const [fisherFor, setFisherFor] = useState<string | null>(null);
  const [showCI, setShowCI] = useState(false);
  const [collocatesOnly, setCollocatesOnly] = useState(false);

  const { pairs, total } = useMemo(
    () => computePairs(inscriptions),
    [inscriptions],
  );

  // Bonferroni-corrected p uses N tests = number of pairs being tested.
  const correctionN = bonferroni ? pairs.length : null;

  // The word filter applies BEFORE the display cap — otherwise "collocates
  // of" a mid-frequency word would silently miss every pair outside the
  // global top-250 by the chosen metric.
  const visible = useMemo(() => {
    const u = q.toUpperCase().trim();
    let filtered = pairs.filter((p) => p.joint >= minJoint);
    if (u) {
      filtered = collocatesOnly
        ? // "Collocates of X" — treat the filter as an exact word and keep
          // only pairs where it is one of the two members (its partners are
          // its collocates).
          filtered.filter(
            (p) => p.a.toUpperCase() === u || p.b.toUpperCase() === u,
          )
        : filtered.filter(
            (p) =>
              p.a.toUpperCase().includes(u) || p.b.toUpperCase().includes(u),
          );
    }
    if (sigOnly) {
      filtered = filtered.filter((p) => {
        const adj = correctionN
          ? Math.min(1, p.pValue * correctionN)
          : p.pValue;
        return adj < 0.05;
      });
    }
    const key =
      metric === "count"
        ? "joint"
        : metric === "pmi"
          ? "pmi"
          : metric === "chi2"
            ? "chi2"
            : "loglik";
    filtered.sort((x, y) => y[key] - x[key]);
    return filtered.slice(0, 250);
  }, [pairs, metric, minJoint, sigOnly, correctionN, q, collocatesOnly]);

  // Fisher's exact is expensive; only compute on demand for one pair.
  const fisherValue = useMemo(() => {
    if (!fisherFor) return null;
    const pair = pairs.find((p) => `${p.a}|${p.b}` === fisherFor);
    if (!pair) return null;
    return fishersExact(pair.joint, pair.countA, pair.countB, total);
  }, [fisherFor, pairs, total]);

  const metricLabel =
    metric === "pmi"
      ? "PMI"
      : metric === "loglik"
        ? "G² (log-likelihood)"
        : metric === "chi2"
          ? "χ²"
          : "raw count";
  const metricVal = (p: (typeof visible)[number]) =>
    metric === "count"
      ? p.joint
      : metric === "pmi"
        ? p.pmi
        : metric === "chi2"
          ? p.chi2
          : p.loglik;
  const findingTitle =
    collocatesOnly && q.trim()
      ? `Collocates of ${q.trim()} — ${metricLabel}`
      : `Co-occurrence — ${metricLabel}`;
  const findingSummary =
    `Word pairs by ${metricLabel} (min joint ${minJoint}` +
    `${sigOnly ? ", significant only" : ""}${bonferroni ? ", Bonferroni" : ""}). ` +
    `${visible.length} pairs shown.\nTop: ` +
    (visible
      .slice(0, 6)
      .map(
        (p) =>
          `${p.a}+${p.b} (${metricVal(p).toFixed(metric === "count" ? 0 : 2)})`,
      )
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["rank", "word_a", "word_b", "joint", "pmi", "loglik_g2", "chi2", "p_value", "count_a", "count_b"],
    ];
    visible.forEach((p, i) =>
      rows.push([
        i + 1,
        p.a,
        p.b,
        p.joint,
        p.pmi.toFixed(4),
        p.loglik.toFixed(4),
        p.chi2.toFixed(4),
        p.pValue.toExponential(3),
        p.countA,
        p.countB,
      ]),
    );
    downloadFile(
      "linear_a_cooccurrence.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Co-occurrence</h2>
      <div className="callout">
        <h4>Statistical word collocation</h4>
        <p>
          <b>PMI</b> measures how often two words co-occur relative to
          chance — high values flag genuine associations. <b>G²</b>{" "}
          (log-likelihood) is similar but tolerates rare pairs better.{" "}
          <b>χ²</b> is the standard test of independence with an associated{" "}
          <b>p-value</b> for significance. <b>Bonferroni correction</b>{" "}
          multiplies each p by the number of tests, controlling
          family-wise error rate over all {pairs.length} pairs. <b>Fisher's
          exact</b> is the gold standard for individual pairs — click{" "}
          <code>F</code> in any row to compute it.
        </p>
        <p style={{ marginTop: 6, fontSize: 12 }}>
          Computed over {total} inscriptions containing multi-sign words.
        </p>
      </div>
      <div className="toolbar">
        <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
          {(
            [
              ["pmi", "PMI"],
              ["loglik", "Log-likelihood"],
              ["chi2", "Chi² (significance)"],
              ["count", "Raw count"],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              className={`tab-btn${metric === k ? " active" : ""}`}
              onClick={() => setMetric(k)}
            >
              {lbl}
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder={collocatesOnly ? "Collocates of word… (exact)" : "Filter pairs…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Treat the filter as an exact word and show only its collocates (its co-occurrence partners)"
        >
          <input
            type="checkbox"
            checked={collocatesOnly}
            onChange={(e) => setCollocatesOnly(e.target.checked)}
          />
          collocates of
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          min joint
          <input
            type="number"
            className="input"
            min={1}
            value={minJoint}
            onChange={(e) => setMinJoint(Math.max(1, +e.target.value || 1))}
            style={{ width: 60 }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Multiply p-values by the number of tests"
        >
          <input
            type="checkbox"
            checked={bonferroni}
            onChange={(e) => setBonferroni(e.target.checked)}
          />
          Bonferroni
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Show only pairs with adjusted p < 0.05"
        >
          <input
            type="checkbox"
            checked={sigOnly}
            onChange={(e) => setSigOnly(e.target.checked)}
          />
          sig only
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Show Wilson 95% confidence interval on PMI"
        >
          <input
            type="checkbox"
            checked={showCI}
            onChange={(e) => setShowCI(e.target.checked)}
          />
          95% CI
        </label>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="cooc"
          moduleLabel="Co-occurrence"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ metric, minJoint, bonferroni, sigOnly, q }}
          reportFn={() => {
            const rows = visible.slice(0, 50);
            type R = (typeof rows)[number];
            const cols: SnippetColumn<R & { _i: number }>[] = [
              {
                label: "#",
                render: (p) => `<span style="color:#6b7280;">${p._i}</span>`,
                align: "right",
              },
              {
                label: "Word A",
                render: (p) => `<code>${esc(p.a)}</code>`,
              },
              {
                label: "Word B",
                render: (p) => `<code>${esc(p.b)}</code>`,
              },
              {
                label: "Joint",
                render: (p) =>
                  p.joint <= LOW_N
                    ? `${esc(p.joint)} <span style="color:#b45309;" title="${esc(LOW_N_NOTE)}">⚠</span>`
                    : esc(p.joint),
                md: (p) => (p.joint <= LOW_N ? `${p.joint} ⚠` : String(p.joint)),
                align: "right",
              },
              { label: "PMI", render: (p) => esc(p.pmi.toFixed(2)), align: "right" },
              {
                label: "G²",
                render: (p) => esc(p.loglik.toFixed(1)),
                align: "right",
              },
              {
                label: "χ²",
                render: (p) => esc(p.chi2.toFixed(1)),
                align: "right",
              },
              {
                label: bonferroni ? "p (adj)" : "p",
                render: (p) => esc(formatP(p.pValue, correctionN)),
                align: "right",
              },
              {
                label: "Count A · B",
                render: (p) => `<span style="color:#6b7280;">${p.countA} · ${p.countB}</span>`,
                align: "right",
              },
            ];
            const ranked = rows.map((p, i) => ({ ...p, _i: i + 1 }));
            const meta = `${visible.length} pairs ranked by ${metricLabel}; showing top ${rows.length}. min joint ${minJoint}${sigOnly ? ", significant only" : ""}${bonferroni ? ", Bonferroni" : ""}.`;
            const html = snippetWrap(meta, snippetTable(ranked, cols));
            const markdown = `_${meta}_\n\n` + snippetTableMd(ranked, cols);
            return { html, markdown };
          }}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Word A</th>
              <th>Word B</th>
              <th>Joint</th>
              <th>PMI</th>
              <th>G²</th>
              <th>χ²</th>
              <th title={bonferroni ? "Bonferroni-corrected p" : "Raw p"}>
                {bonferroni ? "p (adj)" : "p"}
              </th>
              <th>Count A · B</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const key = `${p.a}|${p.b}`;
              return (
                <tr key={key}>
                  <td className="dim">{i + 1}</td>
                  <td>
                    <WordToken word={p.a} />
                  </td>
                  <td>
                    <WordToken word={p.b} />
                  </td>
                  <td className="numeral">
                    {p.joint}
                    {p.joint <= LOW_N && (
                      <span
                        style={{
                          color: "var(--am)",
                          marginLeft: 4,
                          fontSize: 11,
                          cursor: "help",
                        }}
                        title={LOW_N_NOTE}
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td
                    className="numeral"
                    title={
                      showCI
                        ? `95% CI: [${p.pmiLow.toFixed(2)}, ${p.pmiHigh.toFixed(2)}] via Wilson score on the joint probability`
                        : `95% CI: [${p.pmiLow.toFixed(2)}, ${p.pmiHigh.toFixed(2)}]`
                    }
                  >
                    {p.pmi.toFixed(2)}
                    {showCI && (
                      <span
                        className="dim"
                        style={{ fontSize: 10, marginLeft: 4 }}
                      >
                        [{p.pmiLow.toFixed(1)}, {p.pmiHigh.toFixed(1)}]
                      </span>
                    )}
                  </td>
                  <td className="numeral">{p.loglik.toFixed(1)}</td>
                  <td className="numeral">{p.chi2.toFixed(1)}</td>
                  <td>
                    <span
                      className={`score ${sigClass(p.pValue, correctionN)}`}
                    >
                      {formatP(p.pValue, correctionN)}
                    </span>
                  </td>
                  <td className="dim">
                    {p.countA} · {p.countB}
                  </td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() =>
                        setFisherFor(fisherFor === key ? null : key)
                      }
                      title="Compute Fisher's exact p-value for this pair"
                    >
                      F
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.some((p) => p.joint <= LOW_N) && (
        <div
          className="dim"
          style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}
        >
          <span style={{ color: "var(--am)", marginRight: 4 }}>⚠</span>
          Small-N pair (joint count ≤ {LOW_N}). The χ² normal approximation is
          unreliable below ~5 expected per cell; use <b>F</b> for Fisher's exact
          and treat the headline significance with caution.
        </div>
      )}

      {fisherFor && fisherValue !== null && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "var(--surface-1)",
            border: "1px solid var(--ac)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--ac)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 4,
            }}
          >
            Fisher's exact (two-sided)
          </div>
          <div>
            <b>{fisherFor.replace("|", " ↔ ")}</b> — p ={" "}
            <span className={`score ${sigClass(fisherValue, correctionN)}`}>
              {formatP(fisherValue, correctionN)}
            </span>
            {bonferroni && (
              <span className="dim" style={{ marginLeft: 8 }}>
                (Bonferroni applied)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
