import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import { WordToken } from "../components/WordToken";
import { InscriptionLink } from "../components/InscriptionLink";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import { useSort, SortHeader } from "../components/sort";
import { csvEscape, downloadFile } from "../lib/helpers";
import { lineValue } from "../lib/numerals";
import {
  COMMODITIES,
  commodityHead,
  isUndecipheredLogogram,
  type CommodityCategory,
} from "../data/commodities";

type AggCategory = CommodityCategory | "undeciphered";

interface CommodityAgg {
  head: string;
  gloss: string;
  category: AggCategory;
  occurrences: number; // token occurrences
  quantity: number; // summed same-line numeric value
  tablets: Set<string>;
  sites: Set<string>;
  periods: Set<string>;
  variants: Map<string, number>; // full token (e.g. OLE+U) → count
  terms: Map<string, number>; // co-occurring transaction terms → count
  lines: number; // lines containing this commodity (for PMI)
  termLines: Map<string, number>; // term → lines containing both (for PMI)
}

const CATEGORY_LABEL: Record<AggCategory, string> = {
  agricultural: "Agricultural",
  livestock: "Livestock",
  people: "People",
  material: "Materials",
  vessel: "Vessels",
  undeciphered: "Undeciphered",
};
const CATEGORY_COLOR: Record<AggCategory, string> = {
  agricultural: "var(--gn)",
  livestock: "var(--am)",
  people: "var(--ac)",
  material: "var(--pu)",
  vessel: "var(--cy)",
  undeciphered: "var(--am)",
};

export default function Commodities() {
  const inscriptions = useScopedCorpus().inscriptions;
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const createCollectionWithItems = useWorkbench(
    (s) => s.createCollectionWithItems,
  );
  const setScope = useWorkbench((s) => s.setScope);
  const toast = useWorkbench((s) => s.toast_show);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | CommodityCategory>("all");
  const [termRank, setTermRank] = useState<"count" | "pmi">("count");
  const { sort, toggle, sortRows } = useSort("occ", "desc");

  const { commodities, undeciphered, lineTermCounts, totalLines } =
    useMemo(() => {
      const map = new Map<string, CommodityAgg>();
      const undec = new Map<string, number>();
      const termLineTally = new Map<string, number>(); // term → lines containing it
      let lineCount = 0;

      for (const ins of inscriptions) {
        for (const line of ins.lines) {
          lineCount++;
          const value = lineValue(line);
          const terms = line.filter((t) => t.includes("-"));
          const termSet = new Set(terms);
          for (const t of termSet)
            termLineTally.set(t, (termLineTally.get(t) ?? 0) + 1);
          const headsOnLine = new Set<string>();
          for (const token of line) {
            // Catalog commodities and undeciphered *NNN logograms get the
            // same aggregate, so the detail panel (tablets, terms, PMI,
            // scope/map pivots) works for both.
            const undecip = isUndecipheredLogogram(token);
            if (undecip) undec.set(token, (undec.get(token) ?? 0) + 1);
            const head = undecip ? token : commodityHead(token);
            if (!head) continue;
            let agg = map.get(head);
            if (!agg) {
              agg = {
                head,
                gloss: undecip
                  ? "undeciphered commodity"
                  : COMMODITIES[head].gloss,
                category: undecip
                  ? "undeciphered"
                  : COMMODITIES[head].category,
                occurrences: 0,
                quantity: 0,
                tablets: new Set(),
                sites: new Set(),
                periods: new Set(),
                variants: new Map(),
                terms: new Map(),
                lines: 0,
                termLines: new Map(),
              };
              map.set(head, agg);
            }
            agg.occurrences++;
            agg.quantity += value;
            agg.tablets.add(ins.id);
            if (ins.site) agg.sites.add(ins.site);
            if (ins.context) agg.periods.add(ins.context);
            agg.variants.set(token, (agg.variants.get(token) ?? 0) + 1);
            for (const t of terms)
              agg.terms.set(t, (agg.terms.get(t) ?? 0) + 1);
            headsOnLine.add(head);
          }
          // Line-level joint counts (dedup within a line) — the event space
          // the PMI ranking is computed over.
          for (const head of headsOnLine) {
            const agg = map.get(head)!;
            agg.lines++;
            for (const t of termSet)
              agg.termLines.set(t, (agg.termLines.get(t) ?? 0) + 1);
          }
        }
      }

      const commodities = [...map.values()].sort(
        (a, b) => b.occurrences - a.occurrences,
      );
      const undeciphered = [...undec.entries()].sort((a, b) => b[1] - a[1]);
      return {
        commodities,
        undeciphered,
        lineTermCounts: termLineTally,
        totalLines: lineCount,
      };
    }, [inscriptions]);

  const sel = selected ? commodities.find((c) => c.head === selected) : null;

  const shown = sortRows(
    commodities.filter((c) => {
      // The table lists the curated catalog; undeciphered *NNN logograms
      // live in their own card below (clickable into the same detail).
      if (c.category === "undeciphered") return false;
      if (catFilter !== "all" && c.category !== catFilter) return false;
      if (q) {
        const u = q.toLowerCase();
        if (
          !c.head.toLowerCase().includes(u) &&
          !c.gloss.toLowerCase().includes(u)
        )
          return false;
      }
      return true;
    }),
    {
      head: (c) => c.head,
      gloss: (c) => c.gloss,
      occ: (c) => c.occurrences,
      qty: (c) => c.quantity,
      tablets: (c) => c.tablets.size,
    },
  );

  const findingTitle = sel ? `Commodity: ${sel.head}` : "Commodity catalog";
  const findingSummary = sel
    ? `${sel.head} — ${sel.gloss}. ${sel.occurrences} occurrences, summed quantity ${
        sel.quantity ? sel.quantity.toFixed(0) : "—"
      }, ${sel.tablets.size} tablets, ${sel.sites.size} sites.`
    : `${commodities.length} commodity logograms · ${undeciphered.length} undeciphered.\n` +
      `Top by occurrence: ` +
      ([...commodities]
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 6)
        .map((c) => `${c.head} (${c.occurrences})`)
        .join(", ") || "none") +
      ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["logogram", "gloss", "category", "occurrences", "summed_quantity", "tablets", "sites"],
    ];
    for (const c of shown) {
      rows.push([
        c.head,
        c.gloss,
        c.category,
        c.occurrences,
        c.quantity,
        c.tablets.size,
        [...c.sites].join(";"),
      ]);
    }
    downloadFile(
      "linear_a_commodities.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Commodity Catalog</h2>
      <div className="callout">
        <h4>The logograms that the accounts count</h4>
        <p>
          Linear A administrative tablets record commodities with logograms
          (ideograms) — grain (<code>GRA</code>), olive oil (<code>OLE</code>),
          wine (<code>VIN</code>), figs (<code>NI</code>/<code>FIC</code>),
          cyperus (<code>CYP</code>), livestock, people, and materials —
          often with ligature modifiers (<code>OLE+U</code>,{" "}
          <code>GRA+PA</code>). This module catalogs each commodity: how
          often it's recorded, the summed quantity, where, and which
          transaction terms accompany it.
        </p>
        <p style={{ marginTop: 6, fontSize: 12 }}>
          Quantities are summed from numbers on the <em>same line</em> as the
          logogram. Commodities named only in a tablet header (heading a
          column of unlabeled quantities) won't have those quantities
          attributed — so totals are a lower bound. Glosses are standard
          scholarly readings.
        </p>
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter logogram or gloss…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Filter by commodity category"
        >
          category
          <select
            className="select"
            value={catFilter}
            onChange={(e) =>
              setCatFilter(e.target.value as "all" | CommodityCategory)
            }
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="all">all</option>
            {(
              Object.keys(CATEGORY_LABEL) as CommodityCategory[]
            ).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <span className="dim" style={{ fontSize: 11 }}>
          {shown.length}/{commodities.length} ·{" "}
          {undeciphered.length} undeciphered
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="commodities"
          moduleLabel="Commodity Catalog"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ selected }}
          reportFn={() => {
            const cap = 60;
            const slice = shown.slice(0, cap);
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              {
                label: "Logogram",
                render: (c) => `<b style="color:#1d4ed8;">${esc(c.head)}</b>`,
              },
              { label: "Gloss", render: (c) => esc(c.gloss) },
              { label: "Category", render: (c) => esc(c.category) },
              { label: "Occurrences", render: (c) => esc(c.occurrences), align: "right" },
              {
                label: "Quantity",
                render: (c) => esc(c.quantity ? c.quantity.toFixed(0) : "—"),
                align: "right",
              },
              { label: "Tablets", render: (c) => esc(c.tablets.size), align: "right" },
              { label: "Sites", render: (c) => esc(c.sites.size), align: "right" },
            ];
            const meta = `${shown.length} of ${commodities.length} commodity logograms${catFilter !== "all" ? ` · category ${catFilter}` : ""}${q ? ` matching "${q}"` : ""}.${slice.length < shown.length ? ` Showing first ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>

      <div className="col2">
        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortHeader label="Logogram" sortKey="head" sort={sort} onToggle={toggle} />
                  <SortHeader label="Gloss" sortKey="gloss" sort={sort} onToggle={toggle} />
                  <SortHeader label="Occur." sortKey="occ" sort={sort} onToggle={toggle} />
                  <SortHeader label="Σ qty" sortKey="qty" sort={sort} onToggle={toggle} />
                  <SortHeader label="Tablets" sortKey="tablets" sort={sort} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr
                    key={c.head}
                    style={{
                      cursor: "pointer",
                      background:
                        selected === c.head ? "var(--ac-soft)" : undefined,
                    }}
                    onClick={() =>
                      setSelected(selected === c.head ? null : c.head)
                    }
                  >
                    <td>
                      <b style={{ color: CATEGORY_COLOR[c.category] }}>
                        {c.head}
                      </b>
                    </td>
                    <td style={{ fontSize: 11 }}>{c.gloss}</td>
                    <td className="numeral">{c.occurrences}</td>
                    <td className="numeral">
                      {c.quantity ? c.quantity.toFixed(0) : "—"}
                    </td>
                    <td className="dim">{c.tablets.size}</td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={5} className="dim" style={{ padding: 12 }}>
                      No commodities match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h4>
              Undeciphered logograms{" "}
              <span className="dim">({undeciphered.length})</span>
            </h4>
            <div className="sub" style={{ marginBottom: 6 }}>
              <code>*NNN</code> signs used logographically whose referent is
              unknown. <code>*301</code> is by far the most common. Click
              one for the same detail as a catalog commodity — quantities,
              co-occurring terms, tablets, scope, map.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {undeciphered.slice(0, 40).map(([t, c]) => (
                <button
                  key={t}
                  onClick={() => setSelected(t)}
                  style={{
                    padding: "2px 6px",
                    background:
                      selected === t ? "var(--ac-soft)" : "var(--surface-2)",
                    border: `1px solid ${selected === t ? "var(--ac)" : "var(--border)"}`,
                    borderRadius: 3,
                    fontSize: 11,
                    fontFamily: "var(--mono)",
                    cursor: "pointer",
                  }}
                  title={`Open ${t} in the detail panel`}
                >
                  {t} <span className="dim">×{c}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          {sel ? (
            <div
              style={{
                background: "var(--surface-1)",
                border: `1px solid ${CATEGORY_COLOR[sel.category]}`,
                borderRadius: 6,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    font: "600 18px var(--mono)",
                    color: CATEGORY_COLOR[sel.category],
                  }}
                >
                  {sel.head}
                </span>
                <span style={{ color: "var(--text)" }}>{sel.gloss}</span>
                <span className="tag tag-domain">
                  {CATEGORY_LABEL[sel.category]}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const ids = [...sel.tablets];
                    const id = createCollectionWithItems(
                      `Commodity • ${sel.head} (${ids.length})`,
                      ids.map((v) => ({
                        kind: "inscription" as const,
                        value: v,
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
                      toast(
                        `Scope set to ${ids.length} ${sel.head} tablets`,
                      );
                    }
                  }}
                  title={`Use the ${sel.tablets.size} tablets mentioning ${sel.head} as the global corpus scope — every other module will compute over just these`}
                >
                  ◇ Use as scope
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setActiveModule("map", {
                      tab: "commodity",
                      focus: sel.head,
                    })
                  }
                  title={`Open the Geography map with the ${sel.head} overlay — where this commodity clusters`}
                >
                  View on map
                </button>
              </div>

              <div className="stat-grid" style={{ marginBottom: 8 }}>
                <div className="stat-box">
                  <span className="val">{sel.occurrences}</span>
                  <span className="lbl">Occurrences</span>
                </div>
                <div className="stat-box">
                  <span className="val">
                    {sel.quantity ? sel.quantity.toFixed(0) : "—"}
                  </span>
                  <span className="lbl">Summed quantity</span>
                </div>
                <div className="stat-box">
                  <span className="val">{sel.tablets.size}</span>
                  <span className="lbl">Tablets</span>
                </div>
              </div>

              {sel.variants.size > 1 && (
                <>
                  <div
                    style={{
                      font: "600 9px var(--sans)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      margin: "8px 0 4px",
                    }}
                  >
                    Ligature variants
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {[...sel.variants.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([v, c]) => (
                        <span
                          key={v}
                          style={{
                            padding: "2px 6px",
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            borderRadius: 3,
                            fontSize: 11,
                            fontFamily: "var(--mono)",
                          }}
                        >
                          {v} <span className="dim">×{c}</span>
                        </span>
                      ))}
                  </div>
                </>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  margin: "12px 0 4px",
                }}
              >
                <span
                  style={{
                    font: "600 9px var(--sans)",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  Top co-occurring terms
                </span>
                <select
                  className="select"
                  value={termRank}
                  onChange={(e) =>
                    setTermRank(e.target.value as "count" | "pmi")
                  }
                  style={{ fontSize: 10, padding: "1px 4px" }}
                  title="Rank by raw count, or by PMI — how much more often than chance the term shares a line with this commodity. PMI demotes terms (like KU-RO) that appear with everything; pairs seen on at least 2 lines."
                >
                  <option value="count">by count</option>
                  <option value="pmi">by PMI</option>
                </select>
              </div>
              <div style={{ lineHeight: 1.9 }}>
                {(termRank === "count"
                  ? [...sel.terms.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 24)
                      .map(([t, c]) => ({ t, label: `×${c}` }))
                  : [...sel.termLines.entries()]
                      .filter(([, joint]) => joint >= 2)
                      .map(([t, joint]) => ({
                        t,
                        pmi: Math.log2(
                          (joint * totalLines) /
                            (sel.lines * (lineTermCounts.get(t) ?? joint)),
                        ),
                      }))
                      .sort((a, b) => b.pmi - a.pmi)
                      .slice(0, 24)
                      .map(({ t, pmi }) => ({
                        t,
                        label: `pmi ${pmi.toFixed(1)}`,
                      }))
                ).map(({ t, label }) => (
                  <span key={t} style={{ marginRight: 4 }}>
                    <WordToken word={t} />
                    <span className="dim" style={{ fontSize: 10 }}>
                      {label}
                    </span>
                  </span>
                ))}
                {sel.terms.size === 0 && (
                  <span className="dim">
                    No multi-sign terms share a line with this commodity.
                  </span>
                )}
                {sel.terms.size > 0 &&
                  termRank === "pmi" &&
                  ![...sel.termLines.values()].some((j) => j >= 2) && (
                    <span className="dim">
                      No term shares a line with {sel.head} more than once —
                      too sparse for PMI ranking.
                    </span>
                  )}
              </div>

              <div
                style={{
                  font: "600 9px var(--sans)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  margin: "12px 0 4px",
                }}
              >
                Tablets ({sel.tablets.size})
              </div>
              <div style={{ lineHeight: 1.9, fontSize: 11 }}>
                {[...sel.tablets]
                  .sort((a, b) => a.localeCompare(b))
                  .slice(0, 30)
                  .map((id) => (
                    <span key={id} style={{ marginRight: 6 }}>
                      <InscriptionLink id={id} />
                    </span>
                  ))}
                {sel.tablets.size > 30 && (
                  <span className="dim">
                    +{sel.tablets.size - 30} more — “Use as scope” to work
                    with all of them
                  </span>
                )}
              </div>

              <div className="dim" style={{ fontSize: 11, marginTop: 10 }}>
                Sites:{" "}
                {[...sel.sites].map((s) => (
                  <span className="tag tag-site" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="dim">
                Select a commodity to see its quantity, ligature variants,
                co-occurring transaction terms, tablets, and distribution.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
