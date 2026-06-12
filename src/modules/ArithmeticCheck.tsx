import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
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

type Filter = "all" | "balanced" | "discrepant";

interface TabletResult {
  ins: Inscription;
  lines: AccountLine[];
  checks: BalanceCheck[];
  anyDiscrepant: boolean;
  hasTotal: boolean;
}

export default function ArithmeticCheck() {
  const inscriptions = useScopedCorpus().inscriptions;
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
    return results;
  }, [results, filter]);

  const stats = useMemo(() => {
    let balanced = 0;
    let discrepant = 0;
    let totalChecks = 0;
    for (const r of results) {
      for (const c of r.checks) {
        totalChecks++;
        if (c.balances) balanced++;
        else discrepant++;
      }
    }
    return { balanced, discrepant, totalChecks, tablets: results.length };
  }, [results]);

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
          total).
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
      </div>

      <div className="toolbar">
        <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
          {(
            [
              ["all", "All"],
              ["discrepant", "Discrepant only"],
              ["balanced", "Balanced only"],
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
        <td>
          {result.anyDiscrepant ? (
            <span className="score score-md">discrepant</span>
          ) : (
            <span className="score score-hi">balances</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={4} style={{ background: "var(--surface-0)" }}>
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
