import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
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
import { heuristicCategory } from "../lib/corpusExport";
import type { Inscription } from "../lib/types";

const CATEGORIES = [
  {
    key: "accounting",
    label: "Accounting",
    color: "var(--am)",
    desc: "Contains numerals and/or KU-RO (total markers)",
  },
  {
    key: "libation",
    label: "Libation",
    color: "var(--pu)",
    desc: "Contains known libation formula words",
  },
  {
    key: "list",
    label: "Lists",
    color: "var(--cy)",
    desc: "Multiple separator marks, no numerals",
  },
  {
    key: "text",
    label: "Text / Other",
    color: "var(--ac)",
    desc: "Extended text without numerals",
  },
  {
    key: "other",
    label: "Unclassified",
    color: "var(--text-muted)",
    desc: "Short or ambiguous inscriptions",
  },
] as const;

type Key = (typeof CATEGORIES)[number]["key"];

const PREVIEW = 24;

// The heuristic category comes from the SHARED classifier in
// lib/corpusExport (fraction-aware numerals, the full libation word list)
// — one implementation for this module, the exports, and the map overlay,
// so they can never disagree. A researcher can override it per tablet
// (tabletCategories in the store).
const heuristicKey = (ins: Inscription): Key => heuristicCategory(ins);

export default function TabletStructure() {
  const inscriptions = useScopedCorpus().inscriptions;
  const tabletCategories = useWorkbench((s) => s.tabletCategories);
  const setTabletCategory = useWorkbench((s) => s.setTabletCategory);
  const clearTabletCategory = useWorkbench((s) => s.clearTabletCategory);
  const clearAllTabletCategories = useWorkbench(
    (s) => s.clearAllTabletCategories,
  );
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const createCollectionWithItems = useWorkbench(
    (s) => s.createCollectionWithItems,
  );
  const setScope = useWorkbench((s) => s.setScope);
  const toast = useWorkbench((s) => s.toast_show);
  // Inline "save as collection" prompt — one per category, plus one for the
  // top-level "all filtered" action. Keyed by category key, or "__all__" for
  // the aggregate prompt.
  const [collPromptFor, setCollPromptFor] = useState<string | null>(null);
  const [collName, setCollName] = useState("");
  // Which categories are expanded to their full list.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Single filter builder. The text narrows results; `appliesTo` picks which
  // categories the filter actually applies to (default: all). Categories not
  // in `appliesTo` show their full unfiltered list — useful when the
  // researcher wants e.g. "all libation tablets, plus accounting tablets
  // containing KU-RO."
  const [globalFilter, setGlobalFilter] = useState("");
  const [appliesTo, setAppliesTo] = useState<Set<Key>>(
    () => new Set(CATEGORIES.map((c) => c.key) as Key[]),
  );
  function matchesQuery(ins: Inscription, q: string): boolean {
    if (!q) return true;
    const u = q.toUpperCase();
    return (
      ins.id.toUpperCase().includes(u) ||
      ins.site.toUpperCase().includes(u) ||
      (ins.context || "").toUpperCase().includes(u) ||
      (ins.scribe || "").toUpperCase().includes(u) ||
      ins.words.some((w) => w.toUpperCase().includes(u))
    );
  }
  function toggleAppliesTo(key: Key) {
    setAppliesTo((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const { classified, heuristicOf, reclassifiedCount } = useMemo(() => {
    const buckets: Record<Key, Inscription[]> = {
      accounting: [],
      libation: [],
      list: [],
      text: [],
      other: [],
    };
    const heuristicOf = new Map<string, Key>();
    let reclassifiedCount = 0;
    for (const ins of inscriptions) {
      const hk = heuristicKey(ins);
      heuristicOf.set(ins.id, hk);
      const override = tabletCategories[ins.id] as Key | undefined;
      const eff = override && buckets[override] ? override : hk;
      if (override && override !== hk) reclassifiedCount++;
      buckets[eff].push(ins);
    }
    return { classified: buckets, heuristicOf, reclassifiedCount };
  }, [inscriptions, tabletCategories]);

  // Category × site cross-tab over the biggest sites: where does each
  // document type live? Libation texts at the peak sanctuaries vs
  // accounting at the palatial archives is the corpus's basic geography.
  const crossTab = useMemo(() => {
    const siteCounts = new Map<string, number>();
    for (const ins of inscriptions)
      if (ins.site) siteCounts.set(ins.site, (siteCounts.get(ins.site) ?? 0) + 1);
    const topSites = [...siteCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([s]) => s);
    const cell = new Map<string, number>();
    let restRow = false;
    for (const c of CATEGORIES) {
      for (const ins of classified[c.key]) {
        const site = ins.site && topSites.includes(ins.site) ? ins.site : "(other sites)";
        if (site === "(other sites)") restRow = true;
        cell.set(`${site}|${c.key}`, (cell.get(`${site}|${c.key}`) ?? 0) + 1);
      }
    }
    return {
      sites: restRow ? [...topSites, "(other sites)"] : topSites,
      cell,
    };
  }, [inscriptions, classified]);

  // Review queue: unclassified tablets with the most linguistic content —
  // the ones where a human call is most worth making. One click files the
  // tablet under a category (a persistent override, like the per-row
  // dropdowns below).
  const reviewQueue = useMemo(
    () =>
      [...classified.other]
        .sort(
          (a, b) =>
            b.words.filter((w) => w.includes("-")).length -
            a.words.filter((w) => w.includes("-")).length,
        )
        .slice(0, 10),
    [classified],
  );

  // Shared CSV export — dumps the given (category, inscription[]) buckets in
  // one file. Called either with the full classification (the corpus-wide
  // export) OR with a single category's effective set (per-card Export CSV)
  // OR with all the filtered categories combined (the top-level aggregate).
  function exportBucketsCsv(
    buckets: { key: Key; label: string; inscriptions: Inscription[] }[],
    filename: string,
  ) {
    const rows: (string | number)[][] = [
      ["inscription", "category", "heuristic", "reclassified", "site", "period", "scribe", "word_count", "text"],
    ];
    for (const b of buckets) {
      for (const ins of b.inscriptions) {
        const hk = heuristicOf.get(ins.id) ?? "";
        rows.push([
          ins.id,
          b.key,
          hk,
          b.key !== hk ? "yes" : "",
          ins.site,
          ins.context,
          ins.scribe,
          ins.words.filter((w) => w.includes("-")).length,
          ins.words.join(" "),
        ]);
      }
    }
    downloadFile(
      filename,
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }
  function exportFullCsv() {
    exportBucketsCsv(
      CATEGORIES.map((c) => ({
        key: c.key,
        label: c.label,
        inscriptions: classified[c.key],
      })),
      "linear_a_tablet_structure.csv",
    );
  }

  return (
    <div className="panel">
      <h2>Tablet Structure</h2>
      <p className="panel-desc">
        Heuristic classification by content shape — accounting, libation,
        lists, or open text. Disagree with a call? Re-classify any tablet with
        the dropdown on its row; your overrides persist and flow into the
        research report.
      </p>
      {/* Compute effective per category once — every count, button label,
          and aggregate action below reads from this. A category is
          "filter-included" if `appliesTo` contains it; excluded categories
          show their full unfiltered list regardless of the query. */}
      {(() => null)()}

      <div className="stat-grid">
        {CATEGORIES.map((c) => {
          const total = classified[c.key].length;
          const included = appliesTo.has(c.key);
          const eff =
            globalFilter && included
              ? classified[c.key].filter((ins) => matchesQuery(ins, globalFilter))
                  .length
              : total;
          return (
            <div key={c.key} className="stat-box">
              <span className="val" style={{ color: c.color }}>
                {globalFilter && included && eff !== total ? (
                  <>
                    {eff}
                    <span className="dim" style={{ fontSize: 11, marginLeft: 4 }}>
                      / {total}
                    </span>
                  </>
                ) : (
                  total
                )}
              </span>
              <span className="lbl">{c.label}</span>
            </div>
          );
        })}
      </div>

      <div className="col2" style={{ marginBottom: 12, alignItems: "start" }}>
        <div className="card">
          <h4>Category × site</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            Where each document type lives (effective classification,
            overrides included).
          </div>
          <div className="table-wrap">
            <table style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Site</th>
                  {CATEGORIES.map((c) => (
                    <th
                      key={c.key}
                      style={{ color: c.color, textAlign: "right" }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crossTab.sites.map((s) => (
                  <tr key={s}>
                    <td className="site-text">{s}</td>
                    {CATEGORIES.map((c) => {
                      const n = crossTab.cell.get(`${s}|${c.key}`) ?? 0;
                      return (
                        <td
                          key={c.key}
                          className="numeral"
                          style={{
                            textAlign: "right",
                            color: n === 0 ? "var(--text-faint)" : undefined,
                          }}
                        >
                          {n || "·"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h4>
            Review queue{" "}
            <span className="dim">({classified.other.length} unclassified)</span>
          </h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            The unclassified tablets with the most content — the ones most
            worth a human call. One click files the tablet (it becomes a
            persistent override, undoable from its row below).
          </div>
          {reviewQueue.length === 0 ? (
            <div className="dim" style={{ fontSize: 12 }}>
              Nothing left to review — every tablet is classified.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {reviewQueue.map((ins) => (
                <div
                  key={ins.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    flexWrap: "wrap",
                  }}
                >
                  <InscriptionLink id={ins.id} />
                  <span className="dim">
                    {ins.site}
                    {" · "}
                    {ins.words.filter((w) => w.includes("-")).length} words
                  </span>
                  <span style={{ flex: 1 }} />
                  {CATEGORIES.filter((c) => c.key !== "other").map((c) => (
                    <button
                      key={c.key}
                      className="btn btn-outline btn-sm"
                      style={{
                        padding: "0 6px",
                        fontSize: 10,
                        minWidth: 0,
                        color: c.color,
                      }}
                      onClick={() => {
                        setTabletCategory(ins.id, c.key);
                        toast(`${ins.id} filed under ${c.label}`);
                      }}
                      title={`Classify ${ins.id} as ${c.label}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter builder ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 12px",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            className="dim"
            style={{
              font: "600 10px var(--sans)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Filter
          </span>
          <input
            className="input"
            placeholder="Match ID / site / period / scribe / word…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />
          {globalFilter && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setGlobalFilter("")}
              title="Clear the filter"
            >
              ✕
            </button>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          <span
            className="dim"
            style={{
              font: "600 10px var(--sans)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
            title="Toggle which categories the filter applies to. Categories not in the set show their full unfiltered list."
          >
            Apply to
          </span>
          {CATEGORIES.map((c) => {
            const on = appliesTo.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleAppliesTo(c.key)}
                title={
                  on
                    ? `${c.label} is included in the filter — click to exclude`
                    : `${c.label} is excluded from the filter — click to include`
                }
                style={{
                  padding: "3px 10px",
                  fontSize: 11,
                  borderRadius: 12,
                  border: `1px solid ${on ? c.color : "var(--border)"}`,
                  background: on
                    ? `color-mix(in srgb, ${c.color} 12%, transparent)`
                    : "transparent",
                  color: on ? c.color : "var(--text-dim)",
                  cursor: "pointer",
                  fontWeight: on ? 600 : 400,
                }}
              >
                {on ? "● " : "○ "}
                {c.label}
              </button>
            );
          })}
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setAppliesTo(new Set(CATEGORIES.map((c) => c.key)))}
            disabled={appliesTo.size === CATEGORIES.length}
            title="Include every category in the filter"
          >
            all
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setAppliesTo(new Set())}
            disabled={appliesTo.size === 0}
            title="Exclude every category from the filter (filter has no effect anywhere)"
          >
            none
          </button>
        </div>
      </div>

      {/* ── Aggregate "all filtered" action row ─────────────────────────
          Only shown when the filter is active AND narrows the result —
          otherwise the per-card actions are sufficient. Operates on the
          UNION of every filter-included category's filtered results. */}
      {(() => {
        if (!globalFilter) return null;
        // Collect filtered results across the included categories.
        const allFiltered: Inscription[] = [];
        const includedLabels: string[] = [];
        for (const c of CATEGORIES) {
          if (!appliesTo.has(c.key)) continue;
          includedLabels.push(c.label);
          for (const ins of classified[c.key])
            if (matchesQuery(ins, globalFilter)) allFiltered.push(ins);
        }
        if (allFiltered.length === 0) return null;
        const baseTitle = `Tablet structure — “${globalFilter}” across ${
          includedLabels.length === CATEGORIES.length
            ? "all categories"
            : includedLabels.join(" + ").toLowerCase()
        } (${allFiltered.length})`;
        return (
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              padding: "8px 12px",
              background: "var(--ac-soft, color-mix(in srgb, var(--ac) 8%, transparent))",
              border: "1px solid color-mix(in srgb, var(--ac) 40%, transparent)",
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            <span
              className="dim"
              style={{
                font: "600 10px var(--sans)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: "var(--ac)",
              }}
            >
              All filtered
            </span>
            <span style={{ fontSize: 12 }}>
              <b>{allFiltered.length}</b> tablet
              {allFiltered.length === 1 ? "" : "s"} across{" "}
              {includedLabels.length} categor
              {includedLabels.length === 1 ? "y" : "ies"}
            </span>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const id = createCollectionWithItems(
                  baseTitle,
                  allFiltered.map((i) => ({
                    kind: "inscription" as const,
                    value: i.id,
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
                    `Scope set to ${allFiltered.length} tablets across ${includedLabels.length} ${includedLabels.length === 1 ? "category" : "categories"}`,
                  );
                }
              }}
              title="Use the combined filtered set across every included category as the global corpus scope"
            >
              ◇ Use as scope ({allFiltered.length})
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                setCollPromptFor(collPromptFor === "__all__" ? null : "__all__")
              }
              title="Save the combined filtered set as one named collection"
            >
              + Save as collection
            </button>
            <SaveFindingButton
              module="struct"
              moduleLabel="Tablet Structure"
              defaultTitle={baseTitle}
              summary={
                `${allFiltered.length} tablets matching "${globalFilter}" across ${includedLabels.length} ${includedLabels.length === 1 ? "category" : "categories"} (${includedLabels.join(", ")}).`
              }
              payload={{
                globalFilter,
                appliesTo: [...appliesTo],
                mode: "aggregate",
              }}
              reportFn={() => {
                const cap = 100;
                const ranked = allFiltered.slice(0, cap).map((i) => ({
                  ins: i,
                  category:
                    (tabletCategories[i.id] as Key | undefined) ??
                    heuristicOf.get(i.id) ??
                    "other",
                }));
                const cols: SnippetColumn<(typeof ranked)[number]>[] = [
                  { label: "ID", render: (r) => `<code>${esc(r.ins.id)}</code>` },
                  {
                    label: "Category",
                    render: (r) => {
                      const c = CATEGORIES.find((x) => x.key === r.category);
                      return `<span style="color:${c?.color || "#6b7280"};">${esc(c?.label || r.category)}</span>`;
                    },
                  },
                  { label: "Site", render: (r) => esc(r.ins.site) },
                  { label: "Period", render: (r) => esc(r.ins.context || "—") },
                  { label: "Scribe", render: (r) => esc(r.ins.scribe || "—") },
                  {
                    label: "Words",
                    render: (r) =>
                      esc(r.ins.words.filter((w) => w.includes("-")).length),
                    align: "right",
                  },
                ];
                const meta = `${allFiltered.length} tablets matching "${globalFilter}" across ${includedLabels.join(", ")}.${ranked.length < allFiltered.length ? ` Showing first ${cap}.` : ""}`;
                return {
                  html: snippetWrap(meta, snippetTable(ranked, cols)),
                  markdown: `_${meta}_\n\n` + snippetTableMd(ranked, cols),
                };
              }}
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                exportBucketsCsv(
                  CATEGORIES.filter((c) => appliesTo.has(c.key)).map((c) => ({
                    key: c.key,
                    label: c.label,
                    inscriptions: classified[c.key].filter((ins) =>
                      matchesQuery(ins, globalFilter),
                    ),
                  })),
                  `linear_a_tablet_structure_filtered.csv`,
                )
              }
              title="Download just the filtered results as CSV"
            >
              Export CSV
            </button>
          </div>
        );
      })()}

      {/* Top-of-module CSV: the unrestricted whole-corpus dump, kept
          separate from the filtered-aggregate CSV so a researcher can
          always get the full data without clearing the filter. */}
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        {reclassifiedCount > 0 && (
          <>
            <span className="dim" style={{ fontSize: 11 }}>
              {reclassifiedCount} reclassified by you
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (
                  window.confirm(
                    `Revert all ${reclassifiedCount} of your tablet reclassifications back to the automatic categories? This can't be undone.`,
                  )
                ) {
                  clearAllTabletCategories();
                  toast("All reclassifications reverted to auto.");
                }
              }}
              title="Revert every tablet you've reclassified back to its automatic category"
            >
              ↺ Reset all reclassifications
            </button>
          </>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportFullCsv}>
          Export full CSV ({inscriptions.length} tablets, all categories)
        </button>
      </div>

      {/* Inline "save as collection" prompt for the aggregate action. */}
      {collPromptFor === "__all__" && (() => {
        const allFiltered: Inscription[] = [];
        for (const c of CATEGORIES) {
          if (!appliesTo.has(c.key)) continue;
          for (const ins of classified[c.key])
            if (matchesQuery(ins, globalFilter)) allFiltered.push(ins);
        }
        return (
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginBottom: 12,
              padding: "6px 8px",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          >
            <span className="dim" style={{ fontSize: 11 }}>
              Collection name:
            </span>
            <input
              className="input"
              autoFocus
              value={collName}
              onChange={(e) => setCollName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setCollPromptFor(null);
                  setCollName("");
                }
                if (e.key === "Enter" && collName.trim()) {
                  createCollectionWithItems(
                    collName.trim(),
                    allFiltered.map((i) => ({
                      kind: "inscription" as const,
                      value: i.id,
                    })),
                  );
                  toast(`Saved "${collName.trim()}" (${allFiltered.length} tablets)`);
                  setCollName("");
                  setCollPromptFor(null);
                }
              }}
              placeholder={`e.g. "All tablets matching '${globalFilter}'"`}
              style={{ flex: 1, fontSize: 12 }}
            />
            <button
              className="btn btn-sm"
              disabled={!collName.trim()}
              onClick={() => {
                createCollectionWithItems(
                  collName.trim(),
                  allFiltered.map((i) => ({
                    kind: "inscription" as const,
                    value: i.id,
                  })),
                );
                toast(`Saved "${collName.trim()}" (${allFiltered.length} tablets)`);
                setCollName("");
                setCollPromptFor(null);
              }}
            >
              Save ({allFiltered.length})
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setCollPromptFor(null);
                setCollName("");
              }}
            >
              Cancel
            </button>
          </div>
        );
      })()}

      {CATEGORIES.map((c) => {
        const all = classified[c.key];
        const isOpen = expanded[c.key];
        // Effective set: filter applies only if this category is in
        // `appliesTo`. Otherwise the card shows its full unfiltered list.
        const filterApplies = !!globalFilter && appliesTo.has(c.key);
        const effective = filterApplies
          ? all.filter((ins) => matchesQuery(ins, globalFilter))
          : all;
        const isFiltered = effective.length !== all.length;
        const shown = isOpen ? effective : effective.slice(0, PREVIEW);
        // Default name for the auto-generated collection / finding —
        // self-describing when a filter is active.
        const sliceLabel = filterApplies
          ? `${c.label} matching “${globalFilter}”`
          : c.label;
        return (
          <div key={c.key} className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h4 style={{ color: c.color, margin: 0 }}>
                {c.label}{" "}
                <span className="dim">
                  {isFiltered ? `(${effective.length} / ${all.length})` : `(${all.length})`}
                </span>
                {!appliesTo.has(c.key) && globalFilter && (
                  <span
                    className="dim"
                    style={{ fontSize: 10, marginLeft: 6, fontStyle: "italic" }}
                    title="The filter doesn't apply to this category (toggle it in 'Apply to' above)"
                  >
                    · filter excluded
                  </span>
                )}
              </h4>
              <span style={{ flex: 1 }} />
              {effective.length > PREVIEW && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setExpanded((s) => ({ ...s, [c.key]: !s[c.key] }))
                  }
                >
                  {isOpen ? "Show fewer" : `Show all ${effective.length}`}
                </button>
              )}
            </div>
            <div className="sub">{c.desc}</div>
            {/* Per-category action row. Counts and titles always reflect the
                effective filtered set so the researcher knows exactly what
                "Save / Use as scope" will act on. */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
                marginBottom: 4,
              }}
            >
              <button
                className="btn btn-outline btn-sm"
                disabled={effective.length === 0}
                onClick={() => {
                  const collLabel = isFiltered
                    ? `Tablet structure • ${sliceLabel} (${effective.length})`
                    : `Tablet structure • ${c.label} (${effective.length})`;
                  const id = createCollectionWithItems(
                    collLabel,
                    effective.map((ins) => ({
                      kind: "inscription" as const,
                      value: ins.id,
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
                      `Scope set to ${effective.length} ${sliceLabel.toLowerCase()} ${effective.length === 1 ? "tablet" : "tablets"}`,
                    );
                  }
                }}
                title={`Use the ${effective.length} ${sliceLabel.toLowerCase()} ${effective.length === 1 ? "tablet" : "tablets"} as the global corpus scope`}
              >
                ◇ Use as scope ({effective.length})
              </button>
              <button
                className="btn btn-outline btn-sm"
                disabled={effective.length === 0}
                onClick={() =>
                  setCollPromptFor(collPromptFor === c.key ? null : c.key)
                }
                title={`Save these ${effective.length} ${sliceLabel.toLowerCase()} tablets as a named collection`}
              >
                + Save as collection
              </button>
              <SaveFindingButton
                module="struct"
                moduleLabel="Tablet Structure"
                defaultTitle={`Tablet structure — ${sliceLabel} (${effective.length})`}
                summary={
                  `${effective.length} ${sliceLabel.toLowerCase()} ${effective.length === 1 ? "tablet" : "tablets"}` +
                  (isFiltered ? ` (filtered from ${all.length})` : ` (of ${inscriptions.length} in current scope)`) +
                  `. ` + c.desc + "."
                }
                payload={{
                  category: c.key,
                  globalFilter: filterApplies ? globalFilter : "",
                }}
                disabled={effective.length === 0}
                reportFn={() => {
                  const cap = 100;
                  const slice = effective.slice(0, cap);
                  const cols: SnippetColumn<(typeof slice)[number]>[] = [
                    { label: "ID", render: (i) => `<code>${esc(i.id)}</code>` },
                    { label: "Site", render: (i) => esc(i.site) },
                    { label: "Period", render: (i) => esc(i.context || "—") },
                    { label: "Scribe", render: (i) => esc(i.scribe || "—") },
                    {
                      label: "Words",
                      render: (i) =>
                        esc(i.words.filter((w) => w.includes("-")).length),
                      align: "right",
                    },
                    {
                      label: "Excerpt",
                      render: (i) =>
                        esc(
                          i.words.slice(0, 8).join(" ") +
                            (i.words.length > 8 ? " …" : ""),
                        ),
                    },
                  ];
                  const meta = `${effective.length} ${sliceLabel.toLowerCase()} ${effective.length === 1 ? "tablet" : "tablets"}${isFiltered ? ` (filtered from ${all.length})` : ""} · ${c.desc}.${slice.length === effective.length ? "" : ` Showing first ${cap}.`}`;
                  return {
                    html: snippetWrap(meta, snippetTable(slice, cols)),
                    markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
                  };
                }}
              />
              <button
                className="btn btn-outline btn-sm"
                disabled={effective.length === 0}
                onClick={() => {
                  const slug = filterApplies
                    ? `${c.key}_${globalFilter.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30)}`
                    : c.key;
                  exportBucketsCsv(
                    [
                      {
                        key: c.key,
                        label: c.label,
                        inscriptions: effective,
                      },
                    ],
                    `linear_a_tablet_structure_${slug}.csv`,
                  );
                }}
                title={`Download these ${effective.length} ${c.label} tablets as CSV`}
              >
                Export CSV ({effective.length})
              </button>
            </div>
            {collPromptFor === c.key && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginTop: 6,
                  padding: "6px 8px",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                }}
              >
                <span className="dim" style={{ fontSize: 11 }}>
                  Collection name:
                </span>
                <input
                  className="input"
                  autoFocus
                  value={collName}
                  onChange={(e) => setCollName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setCollPromptFor(null);
                      setCollName("");
                    }
                    if (e.key === "Enter" && collName.trim()) {
                      createCollectionWithItems(
                        collName.trim(),
                        effective.map((ins) => ({
                          kind: "inscription" as const,
                          value: ins.id,
                        })),
                      );
                      toast(`Saved "${collName.trim()}" (${effective.length} tablets)`);
                      setCollName("");
                      setCollPromptFor(null);
                    }
                  }}
                  placeholder={
                    isFiltered
                      ? `e.g. "${sliceLabel}"`
                      : `e.g. "All ${c.label} tablets"`
                  }
                  style={{ flex: 1, fontSize: 12 }}
                />
                <button
                  className="btn btn-sm"
                  disabled={!collName.trim()}
                  onClick={() => {
                    createCollectionWithItems(
                      collName.trim(),
                      effective.map((ins) => ({
                        kind: "inscription" as const,
                        value: ins.id,
                      })),
                    );
                    toast(`Saved "${collName.trim()}" (${effective.length} tablets)`);
                    setCollName("");
                    setCollPromptFor(null);
                  }}
                >
                  Save ({effective.length})
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setCollPromptFor(null);
                    setCollName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            <div
              style={{
                marginTop: 8,
                maxHeight: isOpen ? "60vh" : 240,
                overflowY: "auto",
              }}
            >
              {shown.map((ins) => {
                const hk = heuristicOf.get(ins.id);
                const overridden =
                  !!tabletCategories[ins.id] && tabletCategories[ins.id] !== hk;
                return (
                  <div
                    key={ins.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      margin: "2px 0",
                      fontSize: 11,
                    }}
                  >
                    <InscriptionLink id={ins.id} />
                    <span className="site-text">{ins.site}</span>
                    <span
                      className="dim"
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ins.words.slice(0, 8).join(" ")}
                      {ins.words.length > 8 ? " …" : ""}
                    </span>
                    {overridden && (
                      <>
                        <span
                          className="tag tag-warn"
                          title={`Reclassified from “${hk}”`}
                          style={{ fontSize: 9 }}
                        >
                          ✎
                        </span>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: "1px 5px", fontSize: 9, flex: "none" }}
                          onClick={() => clearTabletCategory(ins.id)}
                          title={`Revert ${ins.id} to its automatic category (${hk})`}
                        >
                          ↺ Revert
                        </button>
                      </>
                    )}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "1px 5px", fontSize: 9, flex: "none" }}
                      onClick={() =>
                        setActiveModule("compare", { focus: ins.id })
                      }
                      title={`Open ${ins.id} in Compare Inscriptions`}
                    >
                      Compare
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "1px 5px", fontSize: 9, flex: "none" }}
                      onClick={() =>
                        setActiveModule("browse", { focus: ins.id })
                      }
                      title={`Open ${ins.id} in Corpus Browser`}
                    >
                      Browse
                    </button>
                    <select
                      className="select"
                      value={c.key}
                      onChange={(e) => {
                        const v = e.target.value as Key;
                        if (v === hk) clearTabletCategory(ins.id);
                        else setTabletCategory(ins.id, v);
                      }}
                      title="Re-classify this tablet"
                      style={{ fontSize: 10, padding: "1px 4px", flex: "none" }}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                          {cat.key === hk ? " (auto)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {!isOpen && effective.length > PREVIEW && (
                <div className="dim" style={{ marginTop: 4 }}>
                  … {effective.length - PREVIEW} more — use “Show all” above
                </div>
              )}
              {isFiltered && effective.length === 0 && (
                <div className="dim" style={{ marginTop: 4 }}>
                  No tablets match “{globalFilter}” in this category.
                </div>
              )}
              {isFiltered && effective.length > 0 && (
                <div className="dim" style={{ marginTop: 4 }}>
                  {effective.length} of {all.length} match “{globalFilter}”.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
