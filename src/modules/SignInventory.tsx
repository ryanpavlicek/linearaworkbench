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
import {
  buildLbDivergence,
  linearASignValueCounts,
  parseDamosFrequencies,
  spearmanRho,
  type LbFrequencies,
} from "../lib/linearB";

type Filter = "all" | "shared" | "aOnly" | "unknown";

export default function SignInventory() {
  const signs = useWorkbench((s) => s.corpus.signs);
  const scope = useWorkbench((s) => s.scope);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
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
              <th style={{ width: 1 }}></th>
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
                    <span
                      style={{
                        display: "flex",
                        gap: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10 }}
                        onClick={() =>
                          setActiveModule("signtrans", { focus: s.label })
                        }
                        title={`Which signs precede and follow ${s.label}? Opens Sign Transitions focused on it`}
                      >
                        Transitions
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10 }}
                        onClick={() =>
                          setActiveModule("signs", { focus: s.label })
                        }
                        title={`Positional stats and full word list for ${s.label} — opens the Sign Concordance filtered to it`}
                      >
                        Words
                      </button>
                      <a
                        className="btn btn-outline btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10 }}
                        href={siglaSignListUrl(s.label)}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open SigLA's sign list and scroll to ${s.label} — see how each scribe drew this sign across the corpus`}
                      >
                        ↗ SigLA
                      </a>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <LinearBComparison />
    </div>
  );
}

// Linear A vs Linear B sign-frequency divergence. The Linear B counts
// come from the DAMOS corpus (CC BY-NC-SA), which is NEVER bundled: the
// researcher downloads pyaegean's damos-corpus.json decode and loads it
// here; only the ~50-value aggregate is cached in the browser. GitHub
// release assets don't allow cross-origin fetches, so a download-then-
// load step is also the only way that works without a proxy.
const LB_CACHE_KEY = "linear-a-workbench:lb-sign-frequencies";
const DAMOS_ASSET_URL =
  "https://github.com/ryanpavlicek/pyaegean/releases/download/damos-corpus-v2/damos-corpus.json";

function LinearBComparison() {
  const corpus = useWorkbench((s) => s.corpus);
  const [lb, setLb] = useState<LbFrequencies | null>(() => {
    try {
      const raw = localStorage.getItem(LB_CACHE_KEY);
      return raw ? (JSON.parse(raw) as LbFrequencies) : null;
    } catch {
      return null;
    }
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const la = useMemo(() => {
    const words: { word: string; count: number }[] = [];
    for (const [w, e] of corpus.wordIndex)
      words.push({ word: w, count: e.count });
    return linearASignValueCounts(words);
  }, [corpus]);

  const rows = useMemo(() => (lb ? buildLbDivergence(la, lb) : []), [la, lb]);
  const rho = useMemo(
    () =>
      spearmanRho(
        rows.map((r) => r.laPer1000),
        rows.map((r) => r.lbPer1000),
      ),
    [rows],
  );

  async function onFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const payload = JSON.parse(await file.text()) as Parameters<
        typeof parseDamosFrequencies
      >[0];
      if (!payload || !Array.isArray(payload.documents))
        throw new Error(
          "that file has no documents array — expected pyaegean's damos-corpus.json",
        );
      const f = parseDamosFrequencies(payload);
      if (f.totalSigns < 1000)
        throw new Error(
          "parsed, but almost no sign tokens came out — is this the right dataset?",
        );
      setLb(f);
      try {
        localStorage.setItem(LB_CACHE_KEY, JSON.stringify(f));
      } catch {
        // storage quota — the in-memory copy still works this session
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function clearLb() {
    try {
      localStorage.removeItem(LB_CACHE_KEY);
    } catch {
      // ignore
    }
    setLb(null);
  }

  function exportDivergenceCsv() {
    const out: (string | number)[][] = [
      [
        "value",
        "linear_a_signs",
        "la_count",
        "la_per_1000",
        "lb_count",
        "lb_per_1000",
        "log2_ratio_la_over_lb",
      ],
    ];
    for (const r of rows)
      out.push([
        r.value,
        r.labels.join(" "),
        r.laCount,
        r.laPer1000.toFixed(2),
        r.lbCount,
        r.lbPer1000.toFixed(2),
        r.logRatio.toFixed(3),
      ]);
    downloadFile(
      "linear_a_vs_linear_b_sign_frequencies.csv",
      out.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h4>
        Linear A vs Linear B sign frequencies{" "}
        {lb && (
          <span className="dim">
            ({rows.length} shared values · Spearman ρ {rho.toFixed(2)})
          </span>
        )}
      </h4>
      <div className="sub" style={{ marginBottom: 8 }}>
        How differently do the two scripts use the signary they share? Each
        AB sign is matched to its Linear B counterpart by the conventional
        phonetic value — which is precisely the identification under test,
        so a strong divergence can mean a different language behind the
        sign <em>or</em> a wrong value assignment; this table cannot tell
        them apart. Rates are per 1,000 word-internal sign tokens
        (multi-sign words only, both sides).
      </div>
      {!lb ? (
        <div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            The Linear B side comes from the DAMOS corpus (Aurora 2015,
            damos.hf.uio.no), via the <code>damos-corpus.json</code> decode
            published with pyaegean. DAMOS is licensed{" "}
            <b>CC BY-NC-SA 4.0</b>, so the workbench doesn't bundle it —
            load it once and only the small aggregate stays in this
            browser.
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              className="btn btn-outline btn-sm"
              href={DAMOS_ASSET_URL}
              target="_blank"
              rel="noreferrer"
              title="Downloads pyaegean's damos-corpus.json (~3 MB) from its GitHub release"
            >
              1 · Download damos-corpus.json
            </a>
            <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
              2 · Load the downloaded file…
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            {busy && <span className="dim">parsing…</span>}
            {err && (
              <span style={{ color: "var(--rd, #c00)", fontSize: 11 }}>
                {err}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div
            className="dim"
            style={{
              fontSize: 11,
              marginBottom: 8,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>
              DAMOS dataset v{lb.version || "?"}
              {lb.generated ? ` @ ${lb.generated}` : ""} ·{" "}
              {lb.docCount.toLocaleString()} documents ·{" "}
              {lb.wordTokens.toLocaleString()} word tokens ·{" "}
              {lb.totalSigns.toLocaleString()} sign tokens (aggregate cached
              in this browser)
            </span>
            <button className="btn btn-outline btn-sm" onClick={exportDivergenceCsv}>
              Export CSV
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={clearLb}
              title="Remove the cached aggregate from this browser"
            >
              Clear
            </button>
          </div>
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
            <table style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Value</th>
                  <th>Linear A sign</th>
                  <th style={{ textAlign: "right" }}>LA /1000</th>
                  <th style={{ textAlign: "right" }}>LB /1000</th>
                  <th
                    style={{ textAlign: "right" }}
                    title="log₂ of the (smoothed) rate ratio. +1 = the value is used twice as often in Linear A as in Linear B; −1 = half as often."
                  >
                    log₂ A/B
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.value}>
                    <td style={{ fontFamily: "var(--mono)" }}>{r.value}</td>
                    <td>
                      {r.labels.map((l) => (
                        <span key={l} style={{ marginRight: 6 }}>
                          <Glyph sign={l} /> {l}
                        </span>
                      ))}
                    </td>
                    <td className="numeral" title={`${r.laCount} tokens`}>
                      {r.laPer1000.toFixed(1)}
                    </td>
                    <td className="numeral" title={`${r.lbCount} tokens`}>
                      {r.lbPer1000.toFixed(1)}
                    </td>
                    <td
                      className="numeral"
                      style={{
                        color:
                          Math.abs(r.logRatio) >= 1.5
                            ? "var(--am)"
                            : "var(--text-muted)",
                      }}
                    >
                      {r.logRatio >= 0 ? "+" : "−"}
                      {Math.abs(r.logRatio).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
            Sorted by divergence. Beyond the value-assignment circularity,
            remember the corpora differ in scale (~10×), period, and
            administrative tradition — some divergence is expected even if
            every value is right. Linear B data: DAMOS, Aurora, F. (2015),
            CC BY-NC-SA 4.0 — cite DAMOS in published work.
          </div>
        </div>
      )}
    </div>
  );
}
