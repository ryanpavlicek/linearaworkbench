import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import { WordToken } from "../components/WordToken";
import { InscriptionLink } from "../components/InscriptionLink";
import { csvEscape, downloadFile } from "../lib/helpers";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import {
  parseAccountLines,
  checkBalances,
  formatValue,
  type AccountLine,
  type BalanceCheck,
} from "../lib/numerals";
import type { Inscription } from "../lib/types";

type Filter = "all" | "balanced" | "discrepant" | "reconciled";

const EPS = 1e-6;

interface TabletResult {
  ins: Inscription;
  lines: AccountLine[];
  checks: BalanceCheck[];
  anyDiscrepant: boolean;
  hasTotal: boolean;
  maxAbsDelta: number;
  // KI-RO reconciliation notes: human-readable statements of which sums
  // a deficit line explains on this tablet (empty when none).
  reconciliations: string[];
}

// Does a KI-RO line explain this tablet's arithmetic? Four checkable
// patterns, all flowing from the literature's reading of KI-RO as
// "deficit / owed":
//   1. A total that looks "off" is off by exactly one KI-RO amount —
//      the items list what was expected, KU-RO what arrived, KI-RO the
//      shortfall (or the mirror image).
//   2. KU-RO + KI-RO equals a LATER stated total on the same tablet —
//      delivered + outstanding restated as the full obligation.
//   3. The per-entry KI-RO amounts sum to the final KI-RO line — the
//      deficit ledger itself balances (the HT 123 pattern).
//   4. A total's gap equals the COMBINED per-entry KI-RO amounts.
function findReconciliations(
  lines: AccountLine[],
  checks: BalanceCheck[],
): string[] {
  const deficits = lines.filter((l) => l.role === "deficit" && l.hasNumber);
  if (deficits.length === 0) return [];
  const out: string[] = [];
  for (const d of deficits) {
    for (const c of checks) {
      if (
        !c.balances &&
        Math.abs(Math.abs(c.difference) - d.value) < EPS &&
        d.value > 0
      ) {
        out.push(
          `${c.marker} is off by exactly the KI-RO amount (${formatValue(d.value)}) — items, total, and deficit reconcile`,
        );
      }
    }
    // delivered + outstanding = a later total
    const totals = lines.filter(
      (l) =>
        (l.role === "total" || l.role === "grand-total") && l.hasNumber,
    );
    for (let i = 0; i < totals.length; i++) {
      for (let j = i + 1; j < totals.length; j++) {
        if (
          Math.abs(totals[i].value + d.value - totals[j].value) < EPS &&
          d.value > 0
        ) {
          out.push(
            `${totals[i].tokens.find((t) => t.includes("-")) ?? "total"} (${formatValue(totals[i].value)}) + KI-RO (${formatValue(d.value)}) = the later total ${formatValue(totals[j].value)}`,
          );
        }
      }
    }
  }
  // The deficit ledger balances against itself: earlier per-entry KI-RO
  // amounts sum to the final KI-RO line.
  if (deficits.length >= 3) {
    const last = deficits[deficits.length - 1];
    const sumPrior = deficits
      .slice(0, -1)
      .reduce((s, d) => s + d.value, 0);
    if (sumPrior > 0 && Math.abs(sumPrior - last.value) < EPS) {
      out.push(
        `the ${deficits.length - 1} per-entry KI-RO amounts sum to the final KI-RO (${formatValue(last.value)}) — the deficit ledger balances`,
      );
    }
  }
  // A total's gap equals the combined deficits.
  if (deficits.length > 1) {
    const sumAll = deficits.reduce((s, d) => s + d.value, 0);
    for (const c of checks) {
      if (
        !c.balances &&
        sumAll > 0 &&
        Math.abs(Math.abs(c.difference) - sumAll) < EPS
      ) {
        out.push(
          `${c.marker} is off by exactly the combined KI-RO amounts (${formatValue(sumAll)})`,
        );
      }
    }
  }
  return [...new Set(out)];
}

export default function ArithmeticCheck() {
  const inscriptions = useScopedCorpus().inscriptions;
  const createCollectionWithItems = useWorkbench(
    (s) => s.createCollectionWithItems,
  );
  const setScope = useWorkbench((s) => s.setScope);
  const toast = useWorkbench((s) => s.toast_show);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const results = useMemo<TabletResult[]>(() => {
    const out: TabletResult[] = [];
    for (const ins of inscriptions) {
      if (!ins.lines.length) continue;
      const lines = parseAccountLines(ins.lines);
      const checks = checkBalances(lines);
      if (checks.length === 0) continue; // no KU-RO / PO-TO-KU-RO total line
      const anyDiscrepant = checks.some((c) => !c.balances);
      out.push({
        ins,
        lines,
        checks,
        anyDiscrepant,
        hasTotal: true,
        maxAbsDelta: Math.max(...checks.map((c) => Math.abs(c.difference))),
        reconciliations: findReconciliations(lines, checks),
      });
    }
    // Balanced first within each, but surface discrepant tablets near the
    // top since those are the interesting ones for a researcher.
    out.sort((a, b) => Number(b.anyDiscrepant) - Number(a.anyDiscrepant));
    return out;
  }, [inscriptions]);

  const filtered = useMemo(() => {
    if (filter === "balanced") return results.filter((r) => !r.anyDiscrepant);
    if (filter === "discrepant") return results.filter((r) => r.anyDiscrepant);
    if (filter === "reconciled")
      return results.filter((r) => r.reconciliations.length > 0);
    return results;
  }, [results, filter]);

  const stats = useMemo(() => {
    let balanced = 0;
    let discrepant = 0;
    let totalChecks = 0;
    let reconciled = 0;
    for (const r of results) {
      for (const c of r.checks) {
        totalChecks++;
        if (c.balances) balanced++;
        else discrepant++;
      }
      if (r.reconciliations.length > 0) reconciled++;
    }
    return { balanced, discrepant, totalChecks, tablets: results.length, reconciled };
  }, [results]);

  // Discrepancy-size distribution: are the misses fraction-sized (the
  // metrological system fighting back) or whole-unit (scribal slips,
  // damage)? Buckets over |Δ| of every non-balancing check.
  const deltaHistogram = useMemo(() => {
    const bins = [
      { label: "< 1 (fractions)", test: (d: number) => d < 1, n: 0 },
      { label: "1 – 2", test: (d: number) => d >= 1 && d <= 2, n: 0 },
      { label: "3 – 9", test: (d: number) => d > 2 && d < 10, n: 0 },
      { label: "10 +", test: (d: number) => d >= 10, n: 0 },
    ];
    for (const r of results) {
      for (const c of r.checks) {
        if (c.balances) continue;
        const d = Math.abs(c.difference);
        const bin = bins.find((b) => b.test(d));
        if (bin) bin.n++;
      }
    }
    const max = Math.max(...bins.map((b) => b.n), 1);
    return { bins, max };
  }, [results]);

  function useAsScope() {
    if (filtered.length === 0) {
      toast("No tablets to scope to", "error");
      return;
    }
    const label =
      filter === "all" ? "accounting" : `${filter} accounting`;
    const id = createCollectionWithItems(
      `Accounting • ${label} (${filtered.length})`,
      filtered.map((r) => ({
        kind: "inscription" as const,
        value: r.ins.id,
      })),
    );
    if (id) {
      setScope({
        site: null,
        period: null,
        scribe: null,
        support: null,
        collectionId: id,
      });
      toast(`Scope set to ${filtered.length} ${label} tablets`);
    }
  }

  const balanceRate =
    stats.totalChecks > 0
      ? ((stats.balanced / stats.totalChecks) * 100).toFixed(0)
      : "0";
  const findingSummary =
    `${stats.tablets} accounting tablets · ${stats.totalChecks} totals checked: ` +
    `${stats.balanced} balance, ${stats.discrepant} don't (${balanceRate}% balance rate).` +
    (filter !== "all" ? ` Filter: ${filter}.` : "");

  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        "inscription",
        "site",
        "marker",
        "stated_total",
        "computed_sum",
        "item_count",
        "difference",
        "balances",
        "kiro_reconciliation",
      ],
    ];
    for (const r of results) {
      for (const c of r.checks) {
        rows.push([
          r.ins.id,
          r.ins.site,
          c.marker,
          c.statedTotal,
          c.computedSum,
          c.itemCount,
          c.difference,
          c.balances ? "yes" : "no",
          r.reconciliations.join("; "),
        ]);
      }
    }
    downloadFile(
      "linear_a_accounting.csv",
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Accounting &amp; Metrology</h2>
      <div className="callout">
        <h4>Quantitative total verification</h4>
        <p>
          Linear A accounting tablets list entries (a term or name, sometimes
          a commodity ideogram, and a quantity) and frequently close with{" "}
          <code>KU-RO</code> ("total") or <code>PO-TO-KU-RO</code> ("grand
          total"). This module parses the decimal numerals and metrological
          fractions (½, ¾, ¹⁄₁₆ …), sums each tablet's line items, and checks
          the result against the stated total — flagging where they balance
          and where they don't. <code>KI-RO</code> ("deficit / owed") lines
          are shown but excluded from the sum.
        </p>
        <p style={{ marginTop: 6, fontSize: 12 }}>
          Discrepancies are genuinely interesting: some reflect scribal
          error, some damaged readings, some unresolved questions about the
          fraction system. Section boundaries are heuristic (reset at each
          total). The <b>KI-RO reconciliation</b> check then asks whether a
          deficit line arithmetically explains the account (a gap equal to
          the KI-RO amount; KU-RO + KI-RO restated as a later total; the
          per-entry deficits summing to the final KI-RO). A zero here is a
          result, not a bug — on tablets like HT 123 the deficit column is
          damaged in the source transcription, so the sums can't be
          completed automatically.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{stats.tablets}</span>
          <span className="lbl">Accounting tablets</span>
        </div>
        <div className="stat-box">
          <span className="val" style={{ color: "var(--gn)" }}>
            {stats.balanced}
          </span>
          <span className="lbl">Totals that balance</span>
        </div>
        <div className="stat-box">
          <span className="val" style={{ color: "var(--am)" }}>
            {stats.discrepant}
          </span>
          <span className="lbl">Totals that don't</span>
        </div>
        <div className="stat-box">
          <span className="val">
            {stats.totalChecks > 0
              ? ((stats.balanced / stats.totalChecks) * 100).toFixed(0)
              : "0"}
            %
          </span>
          <span className="lbl">Balance rate</span>
        </div>
        <div
          className="stat-box"
          title="Tablets where a KI-RO (deficit) line arithmetically explains the account — a seemingly off total is off by exactly the KI-RO amount, or KU-RO + KI-RO equals a later total"
        >
          <span className="val" style={{ color: "var(--cy)" }}>
            {stats.reconciled}
          </span>
          <span className="lbl">KI-RO reconciled</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
          {(
            [
              ["all", "All"],
              ["discrepant", "Discrepant only"],
              ["balanced", "Balanced only"],
              ["reconciled", "KI-RO reconciled"],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              className={`tab-btn${filter === k ? " active" : ""}`}
              onClick={() => setFilter(k)}
            >
              {lbl}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-outline btn-sm"
          onClick={useAsScope}
          disabled={filtered.length === 0}
          title="Use the tablets in the current filter as the global corpus scope — every other module will compute over just these"
        >
          ◇ Use as scope
        </button>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="arith"
          moduleLabel="Accounting & Metrology"
          defaultTitle={
            filter === "discrepant"
              ? "Discrepant accounting tablets"
              : filter === "balanced"
                ? "Balanced accounting tablets"
                : "Accounting balance check"
          }
          summary={findingSummary}
          payload={{ filter }}
          reportFn={() => {
            // Flatten every (tablet × balance-check) row in the filtered view,
            // so a finding with the "discrepant" filter active produces a
            // captured table of exactly the discrepant balance checks — the
            // interesting result for an epigrapher.
            type Row = {
              tabletId: string;
              site: string;
              period: string;
              check: BalanceCheck;
            };
            const flat: Row[] = [];
            for (const r of filtered) {
              for (const c of r.checks) {
                flat.push({
                  tabletId: r.ins.id,
                  site: r.ins.site,
                  period: r.ins.context,
                  check: c,
                });
              }
            }
            const cap = 120;
            const slice = flat.slice(0, cap);
            const cols: SnippetColumn<Row>[] = [
              { label: "Tablet", render: (r) => `<code>${esc(r.tabletId)}</code>` },
              { label: "Site", render: (r) => esc(r.site) },
              { label: "Period", render: (r) => esc(r.period || "—") },
              { label: "Marker", render: (r) => `<code>${esc(r.check.marker)}</code>` },
              {
                label: "Stated",
                render: (r) => esc(formatValue(r.check.statedTotal)),
                align: "right",
              },
              {
                label: "Computed",
                render: (r) => esc(formatValue(r.check.computedSum)),
                align: "right",
              },
              {
                label: "Δ",
                render: (r) => {
                  const d = r.check.computedSum - r.check.statedTotal;
                  if (Math.abs(d) < 1e-6)
                    return `<span style="color:#16a34a;">0</span>`;
                  const sign = d > 0 ? "+" : "";
                  return `<span style="color:#b45309;">${sign}${formatValue(d)}</span>`;
                },
                align: "right",
              },
              {
                label: "Items",
                render: (r) => esc(r.check.itemCount),
                align: "right",
              },
              {
                label: "Status",
                render: (r) =>
                  r.check.balances
                    ? `<span style="color:#16a34a;">✅ balances</span>`
                    : `<span style="color:#b45309;">⚠ off</span>`,
              },
            ];
            const filterDesc =
              filter === "discrepant"
                ? "discrepant only"
                : filter === "balanced"
                  ? "balanced only"
                  : "all";
            const meta = `${flat.length} balance check${flat.length === 1 ? "" : "s"} across ${filtered.length} tablet${filtered.length === 1 ? "" : "s"} (${filterDesc}). ${stats.balanced}/${stats.totalChecks} corpus-wide balance rate ${balanceRate}%.${slice.length === flat.length ? "" : ` Showing first ${cap}.`}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>

      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
        {filtered.length} tablets · click a row to see the itemized arithmetic
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Inscription</th>
              <th>Site</th>
              <th>Totals checked</th>
              <th title="Largest absolute stated-vs-computed gap on the tablet">
                Worst Δ
              </th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((r) => {
              const isOpen = expanded === r.ins.id;
              return (
                <FragRow
                  key={r.ins.id}
                  result={r}
                  isOpen={isOpen}
                  onToggle={() => setExpanded(isOpen ? null : r.ins.id)}
                />
              );
            })}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div className="dim" style={{ fontSize: 11, padding: "6px 4px" }}>
            Showing 200 of {filtered.length} tablets — use the filters to
            narrow, or export CSV for the full set.
          </div>
        )}
      </div>

      {stats.discrepant > 0 && (
        <div className="card" style={{ marginTop: 12, maxWidth: 480 }}>
          <h4>How far off are the misses?</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            |stated − computed| for every non-balancing total.
            Fraction-sized gaps point at the metrological system (rounding,
            unread fraction signs); whole-unit gaps at scribal slips, damage,
            or entries the parser can't see.
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            {deltaHistogram.bins.map((b) => (
              <div
                key={b.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 40px",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 11,
                }}
              >
                <span className="dim" style={{ textAlign: "right" }}>
                  {b.label}
                </span>
                <div
                  style={{
                    height: 10,
                    background: "var(--am)",
                    opacity: 0.55,
                    borderRadius: 1,
                    width: `${(b.n / deltaHistogram.max) * 100}%`,
                    minWidth: b.n > 0 ? 2 : 0,
                  }}
                />
                <span className="numeral">{b.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FragRow({
  result,
  isOpen,
  onToggle,
}: {
  result: TabletResult;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { ins, lines, checks } = result;
  return (
    <>
      <tr style={{ cursor: "pointer" }} onClick={onToggle}>
        <td>
          <span style={{ marginRight: 6, color: "var(--text-muted)" }}>
            {isOpen ? "▾" : "▸"}
          </span>
          <InscriptionLink id={ins.id} />
        </td>
        <td className="site-text">{ins.site}</td>
        <td className="numeral">{checks.length}</td>
        <td className="numeral">
          {result.maxAbsDelta < EPS ? (
            <span style={{ color: "var(--gn)" }}>0</span>
          ) : (
            <span style={{ color: "var(--am)" }}>
              {formatValue(result.maxAbsDelta)}
            </span>
          )}
        </td>
        <td>
          {result.anyDiscrepant ? (
            result.reconciliations.length > 0 ? (
              <span
                className="score score-hi"
                style={{ color: "var(--cy)" }}
                title={result.reconciliations.join("; ")}
              >
                KI-RO reconciled
              </span>
            ) : (
              <span className="score score-md">discrepant</span>
            )
          ) : (
            <span className="score score-hi">balances</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={5} style={{ background: "var(--surface-0)" }}>
            <div style={{ padding: "10px 16px" }}>
              {/* Itemized lines */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: "2px 12px",
                  alignItems: "baseline",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  maxWidth: 640,
                }}
              >
                {lines.map((line) => (
                  <LineRow key={line.index} line={line} />
                ))}
              </div>

              {/* KI-RO reconciliation notes */}
              {result.reconciliations.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {result.reconciliations.map((note, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "6px 10px",
                        marginBottom: 4,
                        borderRadius: 4,
                        background: "#22d3ee0c",
                        border: "1px solid #22d3ee40",
                        fontSize: 12,
                      }}
                    >
                      <b style={{ color: "var(--cy)" }}>KI-RO</b>: {note}
                    </div>
                  ))}
                </div>
              )}

              {/* Balance checks */}
              <div style={{ marginTop: 12 }}>
                {checks.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "6px 10px",
                      marginBottom: 4,
                      borderRadius: 4,
                      background: c.balances
                        ? "#3ddc910c"
                        : "#f0b14b0c",
                      border: `1px solid ${
                        c.balances ? "#3ddc9140" : "#f0b14b40"
                      }`,
                      fontSize: 12,
                    }}
                  >
                    <b style={{ color: "var(--gn)" }}>{c.marker}</b>: sum of{" "}
                    {c.itemCount} item{c.itemCount === 1 ? "" : "s"} ={" "}
                    <b>{formatValue(c.computedSum)}</b> vs stated{" "}
                    <b>{formatValue(c.statedTotal)}</b> —{" "}
                    {c.balances ? (
                      <span style={{ color: "var(--gn)" }}>balances ✓</span>
                    ) : (
                      <span style={{ color: "var(--am)" }}>
                        off by {formatValue(Math.abs(c.difference))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const ROLE_COLOR: Record<string, string> = {
  total: "var(--gn)",
  "grand-total": "var(--cy)",
  deficit: "var(--rd)",
  header: "var(--text-muted)",
  item: "var(--text)",
};

function LineRow({ line }: { line: AccountLine }) {
  return (
    <>
      <div
        style={{
          color: "var(--text-faint)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
        }}
        title={`line ${line.index + 1} · ${line.role}`}
      >
        {line.role === "item" ? "" : line.role}
      </div>
      <div style={{ color: ROLE_COLOR[line.role] }}>
        {line.tokens.map((tk, i) =>
          tk.includes("-") ? (
            <WordToken key={i} word={tk} />
          ) : (
            <span key={i} style={{ marginRight: 4 }}>
              {tk}
            </span>
          ),
        )}
      </div>
      <div className="numeral" style={{ textAlign: "right" }}>
        {line.hasNumber ? formatValue(line.value) : ""}
      </div>
    </>
  );
}
