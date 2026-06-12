import { useCallback, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { isScopeActive, scopeSummary, useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile, siglaSignListUrl } from "../lib/helpers";
import { resolveSignAlias } from "../data/abNumbers";
import { Glyph } from "../components/Glyph";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { useSort, SortHeader } from "../components/sort";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

type Filter = "all" | "shared" | "aOnly" | "unknown";

export default function SignInventory() {
  const signs = useWorkbench((s) => s.corpus.signs);
  const scope = useWorkbench((s) => s.scope);
  // Scope-aware: top words and attestation counts reflect the active Scope
  // (sign metadata — status, confidence, codepoint — stays corpus-wide).
  const wordIndex = useScopedCorpus().wordIndex;
  const scopeOn = isScopeActive(scope);
  const initialIntent = useWorkbench.getState().moduleIntent;
  const initialFilter: Filter =
    initialIntent?.tab === "shared" ||
    initialIntent?.tab === "aOnly" ||
    initialIntent?.tab === "unknown"
      ? initialIntent.tab
      : "all";
  // Deep links (sign annotations, Notes chips) can land here focused on a
  // specific sign.
  const [q, setQ] = useState(initialIntent?.focus ?? "");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [minFreq, setMinFreq] = useState(1);
  const [minConf, setMinConf] = useState(0);
  const { sort, toggle, sortRows } = useSort("total", "desc");

  const { examplesBySign, scopedCounts } = useMemo(() => {
    const map = new Map<string, { word: string; count: number }[]>();
    const counts = new Map<string, number>();
    for (const [w, e] of wordIndex) {
      if (!w.includes("-")) continue;
      const parts = w.split("-").map((p) =>
        p.replace(/[₂₃₄]/g, (c) =>
          ({ "₂": "2", "₃": "3", "₄": "4" })[c] ?? c,
        ),
      );
      const seen = new Set<string>();
      for (const p of parts) {
        if (seen.has(p)) continue;
        seen.add(p);
        let arr = map.get(p);
        if (!arr) {
          arr = [];
          map.set(p, arr);
        }
        arr.push({ word: w, count: e.count });
        counts.set(p, (counts.get(p) ?? 0) + e.count);
      }
    }
    for (const v of map.values()) v.sort((a, b) => b.count - a.count);
    return { examplesBySign: map, scopedCounts: counts };
  }, [wordIndex]);

  // Attestations: the build-time corpus total normally; recomputed from the
  // scoped word index while a Scope is active.
  const attestation = useCallback(
    (s: (typeof signs)[number]) =>
      scopeOn ? (scopedCounts.get(s.label) ?? 0) : s.total,
    [scopeOn, scopedCounts],
  );

  // If the user typed an AB-number or A-only code (e.g. "AB77" or "A301"),
  // resolve it to the GORILA label and use that as the effective query —
  // bridges SigLA's numbering convention to ours so a researcher coming
  // from SigLA's sign list can type the code they have in hand.
  const aliasResolved = useMemo(() => resolveSignAlias(q), [q]);
  const shown = useMemo(() => {
    const effective = (aliasResolved ?? q).toUpperCase();
    return signs.filter((s) => {
      if (filter === "shared" && !s.sharedWithLinearB) return false;
      if (filter === "aOnly" && !s.linearAOnly) return false;
      if (filter === "unknown" && (s.linearAOnly || s.sharedWithLinearB))
        return false;
      if (attestation(s) < minFreq) return false;
      if (s.confidence < minConf) return false;
      if (!effective) return true;
      // When alias-resolved, match the label exactly (the alias gave us the
      // canonical form, no need for substring fuzziness). Otherwise fall
      // back to substring over label/phonetic.
      if (aliasResolved) {
        return s.label.toUpperCase() === effective;
      }
      return (
        s.label.toUpperCase().includes(effective) ||
        (s.phonetic && s.phonetic.toUpperCase().includes(effective))
      );
    });
  }, [signs, q, aliasResolved, filter, minFreq, minConf, attestation]);

  const sorted = sortRows(shown, {
    label: (s) => s.label,
    total: (s) => attestation(s),
    confidence: (s) => s.confidence,
  });

  const sharedCount = signs.filter((s) => s.sharedWithLinearB).length;
  const aOnlyCount = signs.filter((s) => s.linearAOnly).length;
  const unknownCount = signs.length - sharedCount - aOnlyCount;

  const findingTitle = `Sign inventory${filter !== "all" ? ` — ${filter}` : ""}`;
  const findingSummary =
    `${signs.length} signs · ${sharedCount} AB-shared · ${aOnlyCount} Linear A-only · ` +
    `${unknownCount} with no Linear B value.` +
    (filter !== "all" ? ` Filter: ${filter}.` : "") +
    (q ? ` Search “${q}”.` : "") +
    ` ${shown.length} shown.`;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["gorila_label", "unicode", "linear_b_value", "status", "attestations", "confidence"],
    ];
    for (const s of sorted) {
      const status = s.sharedWithLinearB
        ? "AB-shared"
        : s.linearAOnly
          ? "Linear A only"
          : "variant";
      rows.push([
        s.label,
        s.codepoint ? `U+${s.codepoint.toString(16).toUpperCase()}` : "",
        s.phonetic ?? "",
        status,
        attestation(s),
        `${(s.confidence * 100).toFixed(0)}%`,
      ]);
    }
    downloadFile(
      "linear_a_sign_inventory.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Sign Inventory</h2>
      <div className="callout">
        <h4>Linear A signary</h4>
        <p>
          Every sign attested in the corpus, with its Unicode glyph, GORILA
          label, and Linear B phonetic value (where the sign is part of the AB
          series shared between the two scripts). Glyph mapping is empirically
          derived from corpus alignment, not external lookup tables.
        </p>
        <p style={{ marginTop: 8, fontSize: 13 }}>
          <b>For per-scribe sign-shape variants</b>, use the <b>↗ SigLA</b>{" "}
          button on each row.{" "}
          <a
            href="https://sigla.phis.me/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--ac)" }}
          >
            SigLA
          </a>{" "}
          is the canonical paleographic database — it shows you how each scribe
          actually drew the sign on the tablets. The workbench uses
          idealized Unicode glyphs here for legibility; SigLA owns the
          per-hand <em>ductus</em> analysis. The two views are
          complementary, not redundant.
        </p>
      </div>
      {scopeOn && (
        <div
          className="dim"
          style={{ fontSize: 11, marginBottom: 8, color: "var(--ac)" }}
        >
          ◆ Scope: {scopeSummary(scope)} —{" "}
          {signs.filter((s) => (scopedCounts.get(s.label) ?? 0) > 0).length} of{" "}
          {signs.length} signs attested in scope; attestation counts and top
          words reflect the scoped corpus.
        </div>
      )}
      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{signs.length}</span>
          <span className="lbl">Total signs</span>
        </div>
        <div className="stat-box">
          <span className="val">{sharedCount}</span>
          <span className="lbl">AB-shared with Linear B</span>
        </div>
        <div className="stat-box">
          <span className="val">{aOnlyCount}</span>
          <span className="lbl">Linear A only (*)</span>
        </div>
        <div className="stat-box">
          <span className="val">{unknownCount}</span>
          <span className="lbl">No Linear B value</span>
        </div>
      </div>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            className="input"
            placeholder="Filter by label or phonetic value — also accepts AB77 / A301…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%" }}
          />
          {aliasResolved && (
            <span
              className="dim"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 10,
                pointerEvents: "none",
                background: "var(--surface)",
                padding: "1px 6px",
                borderRadius: 3,
                border: "1px solid var(--border)",
              }}
              title={`AB-number / A-code recognized — searching for the canonical GORILA label ${aliasResolved}`}
            >
              → <b style={{ color: "var(--ac)" }}>{aliasResolved}</b>
            </span>
          )}
        </div>
        <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
          {(
            [
              ["all", "All"],
              ["shared", "AB-shared"],
              ["aOnly", "A-only"],
              ["unknown", "Unknown"],
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
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum attestation count"
        >
          freq ≥
          <input
            type="number"
            className="input"
            min={1}
            value={minFreq}
            onChange={(e) => setMinFreq(Math.max(1, +e.target.value || 1))}
            style={{ width: 56, fontSize: 11, padding: "3px 6px" }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum glyph-mapping confidence"
        >
          conf ≥ {minConf.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minConf}
            onChange={(e) => setMinConf(+e.target.value)}
            style={{ width: 90 }}
          />
        </label>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="signref"
          moduleLabel="Sign Inventory"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ q, filter, minFreq, minConf }}
          reportFn={() => {
            const cap = 100;
            const slice = sorted.slice(0, cap);
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              { label: "Sign", render: (s) => `<b>${esc(s.label)}</b>` },
              {
                label: "Linear B",
                render: (s) =>
                  s.phonetic
                    ? `<span style="color:#16a34a;">/${esc(s.phonetic)}/</span>`
                    : "—",
              },
              {
                label: "Status",
                render: (s) =>
                  s.sharedWithLinearB
                    ? "AB shared"
                    : s.linearAOnly
                      ? "Linear A only"
                      : "variant",
              },
              {
                label: "Attestations",
                render: (s) => esc(attestation(s)),
                align: "right",
              },
              {
                label: "Confidence",
                render: (s) => esc(`${(s.confidence * 100).toFixed(0)}%`),
                align: "right",
              },
            ];
            const meta = `${shown.length} of ${signs.length} signs${filter !== "all" ? ` (${filter})` : ""}${q ? ` matching "${q}"` : ""}. ${slice.length < shown.length ? `Showing top ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Glyph</th>
              <SortHeader label="GORILA" sortKey="label" sort={sort} onToggle={toggle} />
              <th>Linear B</th>
              <th>Status</th>
              <SortHeader
                label="Attestations"
                sortKey="total"
                sort={sort}
                onToggle={toggle}
              />
              <SortHeader
                label="Confidence"
                sortKey="confidence"
                sort={sort}
                onToggle={toggle}
              />
              <th>Top words</th>
              <th style={{ width: 1 }}>Paleography</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const ex = examplesBySign.get(s.label)?.slice(0, 4) ?? [];
              return (
                <tr key={s.label}>
                  <td style={{ fontSize: 22 }}>
                    <Glyph sign={s.label} size={26} />
                  </td>
                  <td>
                    <b style={{ color: "var(--text)" }}>{s.label}</b>
                    {s.codepoint && (
                      <span
                        className="dim"
                        style={{ marginLeft: 6, fontSize: 10 }}
                      >
                        U+{s.codepoint.toString(16).toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td>
                    {s.phonetic ? (
                      <b style={{ color: "var(--gn)" }}>/{s.phonetic}/</b>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                  <td>
                    {s.sharedWithLinearB && (
                      <span className="tag tag-success">AB shared</span>
                    )}
                    {s.linearAOnly && (
                      <span className="tag tag-warn">Linear A only</span>
                    )}
                    {!s.sharedWithLinearB && !s.linearAOnly && (
                      <span className="tag tag-domain">variant</span>
                    )}
                  </td>
                  <td className="numeral">{attestation(s)}</td>
                  <td className="dim">{(s.confidence * 100).toFixed(0)}%</td>
                  <td style={{ fontSize: 11 }}>
                    {ex.map((e) => (
                      <span key={e.word}>
                        <WordToken word={e.word} />
                        <span className="dim">×{e.count} </span>
                      </span>
                    ))}
                  </td>
                  <td>
                    <a
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10, whiteSpace: "nowrap" }}
                      href={siglaSignListUrl(s.label)}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open SigLA's sign list and scroll to ${s.label} — see how each scribe drew this sign across the corpus`}
                    >
                      ↗ SigLA
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
