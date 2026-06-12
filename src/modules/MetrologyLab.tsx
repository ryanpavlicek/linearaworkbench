import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { parseValue } from "../lib/numerals";
import { commodityHead, isUndecipheredLogogram, COMMODITIES } from "../data/commodities";
import { InscriptionLink } from "../components/InscriptionLink";
import { useSort, SortHeader } from "../components/sort";

// The number system as the scribes used it: which fraction values occur,
// with which commodities, and which goods are COUNTED in whole numbers
// versus MEASURED in fractional units. One caveat governs everything
// here and is stated in the callout: the source transcription has
// already resolved the Linear A fraction signs (the klasmatograms J, E,
// …) into numeric values following the conventional readings — the
// workbench sees ¾, not the sign that wrote it, so this module analyzes
// the VALUE system, and cannot re-litigate sign-value assignments.

interface FractionRow {
  value: number;
  display: string;
  count: number;
  commodities: Map<string, number>;
  exampleIds: string[];
}

interface CommodityProfile {
  head: string;
  gloss: string;
  entries: number;
  fractionalPct: number;
  denominators: string;
  median: number;
  max: number;
}

function approxFraction(v: number): string {
  // Display helper: recover a clean n/d for the values that occur.
  for (let d = 2; d <= 16; d++) {
    const n = v * d;
    if (Math.abs(n - Math.round(n)) < 1e-9 && Math.round(n) >= 1)
      return `${Math.round(n)}/${d}`;
  }
  return v.toFixed(3);
}

function denominatorOf(v: number): number | null {
  for (let d = 2; d <= 16; d++) {
    const n = v * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return d;
  }
  return null;
}

export default function MetrologyLab() {
  const scoped = useScopedCorpus();
  const [selFraction, setSelFraction] = useState<number | null>(null);
  const { sort, toggle, sortRows } = useSort("entries", "desc");

  const lab = useMemo(() => {
    const fractions = new Map<number, FractionRow>();
    const profiles = new Map<
      string,
      { values: number[]; fractional: number; denoms: Set<number> }
    >();
    let numeralTokens = 0;
    let fractionTokens = 0;
    let integerTokens = 0;
    for (const ins of scoped.inscriptions) {
      for (const line of ins.lines) {
        const com = line
          .map((t) => commodityHead(t) ?? (isUndecipheredLogogram(t) ? t : null))
          .find(Boolean);
        // Per-line quantity: integers + fractions after the commodity.
        let lineValueSum = 0;
        let lineHasValue = false;
        let lineHasFraction = false;
        for (const t of line) {
          const v = parseValue(t);
          if (v === null) continue;
          numeralTokens++;
          lineValueSum += v;
          lineHasValue = true;
          if (v < 1 || !Number.isInteger(v)) {
            fractionTokens++;
            const frac = v - Math.floor(v);
            const key = frac > 0 ? frac : v;
            if (key > 0 && key < 1) {
              lineHasFraction = true;
              let row = fractions.get(key);
              if (!row) {
                row = {
                  value: key,
                  display: approxFraction(key),
                  count: 0,
                  commodities: new Map(),
                  exampleIds: [],
                };
                fractions.set(key, row);
              }
              row.count++;
              if (com)
                row.commodities.set(com, (row.commodities.get(com) ?? 0) + 1);
              if (row.exampleIds.length < 12 && !row.exampleIds.includes(ins.id))
                row.exampleIds.push(ins.id);
            }
          } else {
            integerTokens++;
          }
        }
        if (com && lineHasValue) {
          let p = profiles.get(com);
          if (!p) {
            p = { values: [], fractional: 0, denoms: new Set() };
            profiles.set(com, p);
          }
          p.values.push(lineValueSum);
          if (lineHasFraction) {
            p.fractional++;
            const frac = lineValueSum - Math.floor(lineValueSum);
            const d = frac > 0 ? denominatorOf(frac) : null;
            if (d) p.denoms.add(d);
          }
        }
      }
    }
    const fractionRows = [...fractions.values()].sort(
      (a, b) => b.count - a.count,
    );
    const commodityProfiles: CommodityProfile[] = [...profiles.entries()]
      .filter(([, p]) => p.values.length >= 3)
      .map(([head, p]) => {
        const sortedV = [...p.values].sort((a, b) => a - b);
        return {
          head,
          gloss: COMMODITIES[head]?.gloss ?? "undeciphered",
          entries: p.values.length,
          fractionalPct: (100 * p.fractional) / p.values.length,
          denominators: [...p.denoms].sort((a, b) => a - b).join(" "),
          median: sortedV[Math.floor(sortedV.length / 2)],
          max: sortedV[sortedV.length - 1],
        };
      });
    return {
      fractionRows,
      commodityProfiles,
      numeralTokens,
      fractionTokens,
      integerTokens,
    };
  }, [scoped.inscriptions]);

  const sortedProfiles = sortRows(lab.commodityProfiles, {
    head: (r) => r.head,
    entries: (r) => r.entries,
    fractional: (r) => r.fractionalPct,
    median: (r) => r.median,
    max: (r) => r.max,
  });

  const sel = selFraction !== null
    ? lab.fractionRows.find((r) => r.value === selFraction)
    : null;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["commodity", "gloss", "counted_entries", "fractional_pct", "denominators", "median_qty", "max_qty"],
    ];
    for (const r of sortedProfiles)
      rows.push([
        r.head,
        r.gloss,
        r.entries,
        r.fractionalPct.toFixed(1),
        r.denominators,
        r.median.toFixed(3),
        r.max,
      ]);
    downloadFile(
      "linear_a_metrology_profiles.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Metrology Lab</h2>
      <div className="callout">
        <h4>Counted or measured?</h4>
        <p>
          Linear A numbers are decimal and non-positional; quantities below
          one whole unit are written with fraction signs (the
          klasmatograms). <b>Read this first:</b> the source transcription
          has already resolved those signs into numeric values following
          the conventional readings — the workbench sees <code>¾</code>,
          not the sign that wrote it. So this module analyzes the{" "}
          <em>value system</em>: which fractions occur, with which goods,
          and which commodities are counted whole (sheep, people) versus
          measured in fractional units (oil, wine, grain) — it cannot test
          alternative sign-value assignments.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{lab.numeralTokens.toLocaleString()}</span>
          <span className="lbl">Numeral tokens</span>
        </div>
        <div className="stat-box">
          <span className="val">{lab.integerTokens.toLocaleString()}</span>
          <span className="lbl">Whole numbers</span>
        </div>
        <div className="stat-box">
          <span className="val">{lab.fractionTokens.toLocaleString()}</span>
          <span className="lbl">With a fractional part</span>
        </div>
        <div className="stat-box">
          <span className="val">{lab.fractionRows.length}</span>
          <span className="lbl">Distinct fraction values</span>
        </div>
      </div>

      <div className="col2">
        <div className="card">
          <h4>Fraction census</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            Every fractional value attested, by frequency. The denominator
            families are the signal: a system built on halves (2·4·8)
            versus thirds (3·6) suggests different unit structures for
            different goods. Click a value for its commodities and tablets.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {lab.fractionRows.map((r) => (
              <button
                key={r.value}
                onClick={() =>
                  setSelFraction(r.value === selFraction ? null : r.value)
                }
                title={`value ${r.value} — ${r.count} occurrences`}
                style={{
                  padding: "2px 8px",
                  background:
                    selFraction === r.value
                      ? "var(--surface-1)"
                      : "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "var(--text)",
                }}
              >
                {r.display}{" "}
                <span className="dim" style={{ fontSize: 10 }}>
                  ×{r.count}
                </span>
              </button>
            ))}
          </div>
          {sel && (
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <div className="dim" style={{ marginBottom: 4 }}>
                {sel.display} ({sel.value}) · {sel.count} occurrences ·
                with:{" "}
                {[...sel.commodities.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([c, n]) => `${c} ${n}`)
                  .join(" · ") || "no commodity on the line"}
              </div>
              <div>
                {sel.exampleIds.map((id) => (
                  <span key={id} style={{ marginRight: 8 }}>
                    <InscriptionLink id={id} />
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h4>Counted vs measured, by commodity</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            Per commodity with ≥3 counted entries: how often its
            quantities carry a fractional part, which denominators appear,
            and the magnitude profile. Livestock and people should sit at
            0% fractional; oils and grains should not — departures from
            that are worth a look.
          </div>
          <div className="table-wrap" style={{ maxHeight: 380, overflowY: "auto" }}>
            <table style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <SortHeader label="Commodity" sortKey="head" sort={sort} onToggle={toggle} />
                  <SortHeader label="Entries" sortKey="entries" sort={sort} onToggle={toggle} />
                  <SortHeader
                    label="Fractional %"
                    sortKey="fractional"
                    sort={sort}
                    onToggle={toggle}
                    title="Share of this commodity's counted lines whose quantity has a fractional part — measured goods score high, counted goods zero"
                  />
                  <th title="Denominators attested in this commodity's fractional quantities">Denoms</th>
                  <SortHeader label="Median" sortKey="median" sort={sort} onToggle={toggle} />
                  <SortHeader label="Max" sortKey="max" sort={sort} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sortedProfiles.map((r) => (
                  <tr key={r.head}>
                    <td>
                      <b style={{ fontFamily: "var(--mono)" }}>{r.head}</b>{" "}
                      <span className="dim" style={{ fontSize: 10 }}>
                        {r.gloss}
                      </span>
                    </td>
                    <td className="numeral">{r.entries}</td>
                    <td
                      className="numeral"
                      style={{
                        color:
                          r.fractionalPct === 0
                            ? "var(--text-muted)"
                            : r.fractionalPct >= 50
                              ? "var(--gn)"
                              : "var(--text)",
                      }}
                    >
                      {r.fractionalPct.toFixed(0)}%
                    </td>
                    <td className="dim" style={{ fontFamily: "var(--mono)" }}>
                      {r.denominators}
                    </td>
                    <td className="numeral">
                      {r.median.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="numeral">{r.max.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar" style={{ marginTop: 6 }}>
            <span style={{ flex: 1 }} />
            <button className="btn btn-outline btn-sm" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
