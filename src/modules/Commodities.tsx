import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { WordToken } from "../components/WordToken";
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

interface CommodityAgg {
  head: string;
  gloss: string;
  category: CommodityCategory;
  occurrences: number; // token occurrences
  quantity: number; // summed same-line numeric value
  tablets: Set<string>;
  sites: Set<string>;
  periods: Set<string>;
  variants: Map<string, number>; // full token (e.g. OLE+U) → count
  terms: Map<string, number>; // co-occurring transaction terms → count
}

const CATEGORY_LABEL: Record<CommodityCategory, string> = {
  agricultural: "Agricultural",
  livestock: "Livestock",
  people: "People",
  material: "Materials",
  vessel: "Vessels",
};
const CATEGORY_COLOR: Record<CommodityCategory, string> = {
  agricultural: "var(--gn)",
  livestock: "var(--am)",
  people: "var(--ac)",
  material: "var(--pu)",
  vessel: "var(--cy)",
};

export default function Commodities() {
  const inscriptions = useScopedCorpus().inscriptions;
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | CommodityCategory>("all");
  const { sort, toggle, sortRows } = useSort("occ", "desc");

  const { commodities, undeciphered } = useMemo(() => {
    const map = new Map<string, CommodityAgg>();
    const undec = new Map<string, number>();

    for (const ins of inscriptions) {
      for (const line of ins.lines) {
        const value = lineValue(line);
        const terms = line.filter((t) => t.includes("-"));
        for (const token of line) {
          if (isUndecipheredLogogram(token)) {
            undec.set(token, (undec.get(token) ?? 0) + 1);
          }
          const head = commodityHead(token);
          if (!head) continue;
          let agg = map.get(head);
          if (!agg) {
            agg = {
              head,
              gloss: COMMODITIES[head].gloss,
              category: COMMODITIES[head].category,
              occurrences: 0,
              quantity: 0,
              tablets: new Set(),
              sites: new Set(),
              periods: new Set(),
              variants: new Map(),
              terms: new Map(),
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
        }
      }
    }

    const commodities = [...map.values()].sort(
      (a, b) => b.occurrences - a.occurrences,
    );
    const undeciphered = [...undec.entries()].sort((a, b) => b[1] - a[1]);
    return { commodities, undeciphered };
  }, [inscriptions]);

  const sel = selected ? commodities.find((c) => c.head === selected) : null;

  const shown = sortRows(
    commodities.filter((c) => {
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
              unknown. <code>*301</code> is by far the most common.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {undeciphered.slice(0, 40).map(([t, c]) => (
                <span
                  key={t}
                  style={{
                    padding: "2px 6px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    fontSize: 11,
                    fontFamily: "var(--mono)",
                  }}
                >
                  {t} <span className="dim">×{c}</span>
                </span>
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
                  font: "600 9px var(--sans)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  margin: "12px 0 4px",
                }}
              >
                Top co-occurring terms
              </div>
              <div style={{ lineHeight: 1.9 }}>
                {[...sel.terms.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 24)
                  .map(([t, c]) => (
                    <span key={t} style={{ marginRight: 4 }}>
                      <WordToken word={t} />
                      <span className="dim" style={{ fontSize: 10 }}>
                        ×{c}
                      </span>
                    </span>
                  ))}
                {sel.terms.size === 0 && (
                  <span className="dim">
                    No multi-sign terms share a line with this commodity.
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
                co-occurring transaction terms, and distribution.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
