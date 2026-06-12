import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { InscriptionLink } from "../components/InscriptionLink";
import { WordToken } from "../components/WordToken";
import { Glyph } from "../components/Glyph";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import { csvEscape, downloadFile, normalizeSignLabel } from "../lib/helpers";
import { keynessG2 } from "../lib/algorithms";

interface ScribeProfile {
  scribe: string;
  inscriptionIds: string[];
  sites: Set<string>;
  periods: Set<string>;
  signCounts: Map<string, number>;
  totalSignTokens: number;
  wordCounts: Map<string, number>;
  totalWordTokens: number;
}

// Build a per-scribe profile: which signs they used and how often, plus
// the sites and periods they worked in. Used for both single-scribe view
// and pairwise comparison.
function buildScribeProfiles(
  inscriptions: { id: string; scribe: string; site: string; context: string; words: string[] }[],
): Map<string, ScribeProfile> {
  const map = new Map<string, ScribeProfile>();
  for (const ins of inscriptions) {
    if (!ins.scribe) continue;
    let p = map.get(ins.scribe);
    if (!p) {
      p = {
        scribe: ins.scribe,
        inscriptionIds: [],
        sites: new Set(),
        periods: new Set(),
        signCounts: new Map(),
        totalSignTokens: 0,
        wordCounts: new Map(),
        totalWordTokens: 0,
      };
      map.set(ins.scribe, p);
    }
    p.inscriptionIds.push(ins.id);
    if (ins.site) p.sites.add(ins.site);
    if (ins.context) p.periods.add(ins.context);
    for (const w of ins.words) {
      if (!w.includes("-")) continue;
      p.wordCounts.set(w, (p.wordCounts.get(w) ?? 0) + 1);
      p.totalWordTokens++;
      for (const sign of w.split("-")) {
        const norm = normalizeSignLabel(sign);
        p.signCounts.set(norm, (p.signCounts.get(norm) ?? 0) + 1);
        p.totalSignTokens++;
      }
    }
  }
  return map;
}

// Tally sign frequencies over an arbitrary set of inscriptions (same rule as
// the per-scribe profile: multi-sign words only, normalized signs).
function tallySigns(inscriptions: { words: string[] }[]): {
  signCounts: Map<string, number>;
  totalSignTokens: number;
  wordCounts: Map<string, number>;
  totalWordTokens: number;
} {
  const signCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  let total = 0;
  let wordTotal = 0;
  for (const ins of inscriptions) {
    for (const w of ins.words) {
      if (!w.includes("-")) continue;
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
      wordTotal++;
      for (const sign of w.split("-")) {
        const norm = normalizeSignLabel(sign);
        signCounts.set(norm, (signCounts.get(norm) ?? 0) + 1);
        total++;
      }
    }
  }
  return {
    signCounts,
    totalSignTokens: total,
    wordCounts,
    totalWordTokens: wordTotal,
  };
}

function jaccard(a: Map<string, number>, b: Map<string, number>): number {
  const inter = new Set<string>();
  const union = new Set<string>();
  for (const k of a.keys()) union.add(k);
  for (const k of b.keys()) union.add(k);
  for (const k of union) {
    if (a.has(k) && b.has(k)) inter.add(k);
  }
  return union.size > 0 ? inter.size / union.size : 0;
}

// Per-scribe sign frequency vs. corpus baseline. Compute log-ratio so
// signs over-used and under-used by the scribe are equally visible.
interface SignSignature {
  sign: string;
  scribeFreq: number; // per-thousand sign tokens
  cmpFreq: number; // per-thousand for the comparison side
  logRatio: number;
  g2: number; // Dunning's G² on the raw (unsmoothed) counts
  scribeCount: number;
  cmpCount: number;
}

function signSignature(
  a: ScribeProfile,
  b: { signCounts: Map<string, number>; totalSignTokens: number },
): SignSignature[] {
  const all = new Set<string>([
    ...a.signCounts.keys(),
    ...b.signCounts.keys(),
  ]);
  const out: SignSignature[] = [];
  for (const sign of all) {
    const aCount = a.signCounts.get(sign) ?? 0;
    const bCount = b.signCounts.get(sign) ?? 0;
    // Add-one smoothing so log-ratios don't blow up at zero
    const aFreq = ((aCount + 1) / (a.totalSignTokens + all.size)) * 1000;
    const bFreq = ((bCount + 1) / (b.totalSignTokens + all.size)) * 1000;
    out.push({
      sign,
      scribeFreq: aFreq,
      cmpFreq: bFreq,
      logRatio: Math.log2(aFreq / bFreq),
      g2: keynessG2(aCount, a.totalSignTokens, bCount, b.totalSignTokens),
      scribeCount: aCount,
      cmpCount: bCount,
    });
  }
  return out;
}

export default function ScribeComparison() {
  const inscriptions = useScopedCorpus().inscriptions;
  const initialIntent = useWorkbench.getState().moduleIntent;
  const [scribeA, setScribeA] = useState(initialIntent?.focus ?? "");
  const [scribeB, setScribeB] = useState("");
  const [bySignificance, setBySignificance] = useState(false);

  const profiles = useMemo(
    () => buildScribeProfiles(inscriptions),
    [inscriptions],
  );

  // All scribes ranked by inscription count
  const scribesRanked = useMemo(
    () =>
      [...profiles.values()].sort(
        (a, b) => b.inscriptionIds.length - a.inscriptionIds.length,
      ),
    [profiles],
  );

  const a = scribeA ? profiles.get(scribeA) : null;
  // scribeB can be a real scribe id, "" (corpus baseline), or "__site__"
  // (average of the selected scribe's own site(s)).
  const b = scribeB && scribeB !== "__site__" ? profiles.get(scribeB) : null;

  // Corpus-wide baseline: all OTHER scribed inscriptions combined — scribe
  // A's own tablets are excluded so "over/under-used vs corpus" means vs
  // the rest of the corpus (the standard keyness contrast), not vs a pool
  // A dilutes.
  const corpusBaseline = useMemo(() => {
    const signCounts = new Map<string, number>();
    const wordCounts = new Map<string, number>();
    let total = 0;
    let wordTotal = 0;
    for (const p of profiles.values()) {
      if (a && p.scribe === a.scribe) continue;
      for (const [s, c] of p.signCounts) {
        signCounts.set(s, (signCounts.get(s) ?? 0) + c);
        total += c;
      }
      for (const [w, c] of p.wordCounts) {
        wordCounts.set(w, (wordCounts.get(w) ?? 0) + c);
        wordTotal += c;
      }
    }
    return {
      signCounts,
      totalSignTokens: total,
      wordCounts,
      totalWordTokens: wordTotal,
    };
  }, [profiles, a]);

  // Site-average baseline: the OTHER scribed inscriptions at the selected
  // scribe's site(s). Controls for regional vocabulary so a scribe's
  // "distinctive" signs reflect the hand, not just where they worked —
  // again excluding A's own tablets from the average they're compared to.
  const siteBaseline = useMemo(() => {
    if (!a || a.sites.size === 0) return null;
    const sset = a.sites;
    return tallySigns(
      inscriptions.filter(
        (i) =>
          i.scribe && i.scribe !== a.scribe && i.site && sset.has(i.site),
      ),
    );
  }, [a, inscriptions]);

  const usingSite = scribeB === "__site__" && !!siteBaseline;
  const comparison = b ?? (usingSite ? siteBaseline! : corpusBaseline);
  const signature = useMemo(
    () => (a ? signSignature(a, comparison) : []),
    [a, comparison],
  );

  // Top "distinctive" signs — by absolute log-ratio (most divergent usage)
  // or, when ranked by significance, by Dunning's G² (strongest evidence).
  const distinctive = useMemo(
    () =>
      [...signature]
        .filter((s) => s.scribeCount + s.cmpCount >= 3)
        .sort((x, y) =>
          bySignificance
            ? y.g2 - x.g2
            : Math.abs(y.logRatio) - Math.abs(x.logRatio),
        )
        .slice(0, 20),
    [signature, bySignificance],
  );

  // Top-frequency signs for the primary scribe
  const topSigns = useMemo(() => {
    if (!a) return [];
    return [...a.signCounts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 20);
  }, [a]);

  // Word-level distinctiveness against the same comparison side — which
  // WORDS (names, terms) the scribe writes more or less than expected.
  // Vocabulary is the hand's subject matter, where sign frequencies are
  // its habits; the two views answer different questions.
  const distinctiveWords = useMemo(() => {
    if (!a) return [];
    const all = new Set<string>([
      ...a.wordCounts.keys(),
      ...comparison.wordCounts.keys(),
    ]);
    const out: {
      word: string;
      aCount: number;
      cmpCount: number;
      logRatio: number;
      g2: number;
    }[] = [];
    for (const w of all) {
      const aC = a.wordCounts.get(w) ?? 0;
      const cC = comparison.wordCounts.get(w) ?? 0;
      if (aC + cC < 2) continue;
      const aF = ((aC + 1) / (a.totalWordTokens + all.size)) * 1000;
      const cF = ((cC + 1) / (comparison.totalWordTokens + all.size)) * 1000;
      out.push({
        word: w,
        aCount: aC,
        cmpCount: cC,
        logRatio: Math.log2(aF / cF),
        g2: keynessG2(
          aC,
          a.totalWordTokens,
          cC,
          comparison.totalWordTokens,
        ),
      });
    }
    out.sort((x, y) =>
      bySignificance
        ? y.g2 - x.g2
        : Math.abs(y.logRatio) - Math.abs(x.logRatio),
    );
    return out.slice(0, 15);
  }, [a, comparison, bySignificance]);

  const sim = a && b ? jaccard(a.signCounts, b.signCounts) : null;

  const cmpLabelTxt = b
    ? scribeB
    : usingSite
      ? `${[...(a?.sites ?? [])].join("/")} site average`
      : "corpus baseline";
  const findingTitle = scribeA
    ? `Scribe ${scribeA} vs ${cmpLabelTxt}`
    : "Scribe comparison";
  const findingSummary = a
    ? `Scribe ${scribeA} (${a.inscriptionIds.length} inscriptions) vs ${cmpLabelTxt}` +
      (sim !== null
        ? `; vocabulary overlap (Jaccard) ${(sim * 100).toFixed(1)}%`
        : "") +
      `.\nMost distinctive signs: ` +
      (distinctive
        .slice(0, 8)
        .map((s) => s.sign)
        .join(", ") || "none") +
      "."
    : "";

  return (
    <div className="panel">
      <h2>Scribe Comparison</h2>
      <div className="callout">
        <h4>Sign-frequency profile per scribe</h4>
        <p>
          For each of the {profiles.size} attested scribes, compare which signs they
          used and how often. Strong divergence between two scribes
          (especially in their distinctive signs) suggests different
          scribal training or specialization. This is a quantitative
          proxy for paleography — for actual per-scribe sign-shape
          analysis, use the <b>Paleography ↗</b> button on any
          inscription to open its SigLA record.
        </p>
      </div>

      <div className="toolbar">
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          Scribe
          <select
            className="select"
            value={scribeA}
            onChange={(e) => setScribeA(e.target.value)}
            style={{ minWidth: 200 }}
          >
            <option value="">— pick a scribe —</option>
            {scribesRanked.map((p) => (
              <option key={p.scribe} value={p.scribe}>
                {p.scribe} ({p.inscriptionIds.length})
              </option>
            ))}
          </select>
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          Compare with
          <select
            className="select"
            value={scribeB}
            onChange={(e) => setScribeB(e.target.value)}
            style={{ minWidth: 200 }}
            disabled={!scribeA}
          >
            <option value="">(vs. corpus baseline)</option>
            <option value="__site__" disabled={!a || a.sites.size === 0}>
              (vs. this scribe's site average)
            </option>
            {scribesRanked
              .filter((p) => p.scribe !== scribeA)
              .map((p) => (
                <option key={p.scribe} value={p.scribe}>
                  {p.scribe} ({p.inscriptionIds.length})
                </option>
              ))}
          </select>
        </label>
        {a && (
          <label
            className="dim"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title="Rank distinctive signs by Dunning's G² (strength of evidence) instead of raw |log-ratio| — rare-sign flukes stop outranking well-attested divergences"
          >
            <input
              type="checkbox"
              checked={bySignificance}
              onChange={(e) => setBySignificance(e.target.checked)}
            />
            rank by significance (G²)
          </label>
        )}
        {sim !== null && (
          <span
            className="dim"
            title="Jaccard similarity over the two scribes' sign vocabularies (intersection / union)"
          >
            Vocabulary overlap (Jaccard):{" "}
            <b style={{ color: "var(--ac)" }}>{(sim * 100).toFixed(1)}%</b>
          </span>
        )}
        {a && (
          <>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              const cmpLabel = cmpLabelTxt;
              const header = [
                "sign",
                "scribe",
                "comparison",
                "scribe_count",
                "comparison_count",
                "scribe_freq_per_1k_smoothed",
                "comparison_freq_per_1k_smoothed",
                "log2_ratio",
                "g2",
              ];
              const rowsCsv = [header.map(csvEscape).join(",")];
              for (const s of signature) {
                rowsCsv.push(
                  [
                    s.sign,
                    scribeA,
                    cmpLabel,
                    s.scribeCount,
                    s.cmpCount,
                    s.scribeFreq.toFixed(2),
                    s.cmpFreq.toFixed(2),
                    s.logRatio.toFixed(3),
                    s.g2.toFixed(3),
                  ]
                    .map(csvEscape)
                    .join(","),
                );
              }
              downloadFile(
                `linear_a_scribe_${scribeA.replace(/\W+/g, "_")}_vs_${cmpLabel.replace(/\W+/g, "_")}.csv`,
                rowsCsv.join("\n"),
              );
            }}
            title="Download per-sign comparison data as CSV"
          >
            Export CSV
          </button>
          <SaveFindingButton
            module="scribes"
            moduleLabel="Scribe Comparison"
            defaultTitle={findingTitle}
            summary={findingSummary}
            payload={{ scribeA, scribeB }}
            reportFn={() => {
              const cols: SnippetColumn<(typeof distinctive)[number]>[] = [
                {
                  label: "Sign",
                  render: (s) =>
                    `<b style="font-family:ui-monospace,Menlo,monospace;">${esc(s.sign)}</b>`,
                },
                {
                  label: `${scribeA} count`,
                  render: (s) => esc(s.scribeCount),
                  align: "right",
                },
                {
                  label: `${cmpLabelTxt} count`,
                  render: (s) => esc(s.cmpCount),
                  align: "right",
                },
                {
                  label: "log₂ ratio",
                  render: (s) => {
                    const c = s.logRatio > 0 ? "#16a34a" : "#b45309";
                    const sign = s.logRatio > 0 ? "+" : "";
                    return `<span style="color:${c};">${sign}${s.logRatio.toFixed(2)}</span>`;
                  },
                  align: "right",
                },
                {
                  label: "G²",
                  render: (s) => esc(s.g2.toFixed(2)),
                  align: "right",
                },
              ];
              const meta = `Scribe ${scribeA} vs ${cmpLabelTxt}.${sim !== null ? ` Jaccard overlap ${(sim * 100).toFixed(1)}%.` : ""} Top ${distinctive.length} distinctive signs by ${bySignificance ? "G² significance" : "|log-ratio|"}.`;
              return {
                html: snippetWrap(meta, snippetTable(distinctive, cols)),
                markdown: `_${meta}_\n\n` + snippetTableMd(distinctive, cols),
              };
            }}
          />
          </>
        )}
      </div>

      {!a && (
        <div className="card">
          <div
            className="dim"
            style={{
              font: "600 10px var(--sans)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Top scribes by inscription count
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 4,
            }}
          >
            {scribesRanked.slice(0, 24).map((p) => (
              <button
                key={p.scribe}
                onClick={() => setScribeA(p.scribe)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 12,
                }}
              >
                <span style={{ flex: 1 }}>{p.scribe}</span>
                <span className="numeral">{p.inscriptionIds.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {a && (
        <>
          <div className="stat-grid">
            <div className="stat-box">
              <span className="val">{a.inscriptionIds.length}</span>
              <span className="lbl">Inscriptions</span>
            </div>
            <div className="stat-box">
              <span className="val">{a.signCounts.size}</span>
              <span className="lbl">Distinct signs</span>
            </div>
            <div className="stat-box">
              <span className="val">{a.totalSignTokens}</span>
              <span className="lbl">Total sign tokens</span>
            </div>
            <div className="stat-box">
              <span className="val">{a.sites.size}</span>
              <span className="lbl">Sites</span>
            </div>
          </div>

          <div className="col2">
            <div className="card">
              <h4>
                {b ? "Most distinctive signs" : "Most over/under-used vs corpus"}
              </h4>
              <div className="sub" style={{ marginBottom: 8 }}>
                {bySignificance ? (
                  <>
                    Ranked by G² — strength of evidence that {scribeA}'s use
                    differs from{" "}
                  </>
                ) : (
                  <>
                    Sorted by absolute log-ratio of {scribeA}'s sign
                    frequency vs.{" "}
                  </>
                )}
                <b>{cmpLabelTxt}</b>. Add-one smoothing so zero-count signs
                don't dominate the ratio.
              </div>
              <div style={{ display: "grid", gap: 3 }}>
                {distinctive.map((s) => {
                  const max = 4; // clamp log-ratio for bar display
                  const pct = Math.min(
                    1,
                    Math.abs(s.logRatio) / max,
                  );
                  const over = s.logRatio > 0;
                  return (
                    <div
                      key={s.sign}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "32px 50px 1fr 60px",
                        gap: 6,
                        alignItems: "center",
                        fontSize: 11,
                      }}
                    >
                      <Glyph sign={s.sign} size={16} />
                      <span
                        style={{
                          font: "500 11px var(--mono)",
                          color: "var(--text)",
                        }}
                      >
                        {s.sign}
                      </span>
                      <div
                        style={{
                          height: 10,
                          background: "var(--surface-2)",
                          borderRadius: 2,
                          position: "relative",
                          display: "flex",
                        }}
                      >
                        {/* center marker */}
                        <div
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: -2,
                            bottom: -2,
                            width: 1,
                            background: "var(--border-strong)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: over ? "50%" : `${50 - pct * 50}%`,
                            width: `${pct * 50}%`,
                            top: 0,
                            bottom: 0,
                            background: over
                              ? "var(--gn)"
                              : "var(--am)",
                            borderRadius: 2,
                          }}
                        />
                      </div>
                      <span
                        className="dim"
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          textAlign: "right",
                        }}
                        title={`log2 ratio ${s.logRatio > 0 ? "+" : ""}${s.logRatio.toFixed(2)} · Dunning G² = ${s.g2.toFixed(2)} (3.84 ≈ p<.05, 6.63 ≈ p<.01)`}
                      >
                        {s.scribeCount}/{s.cmpCount}
                        {bySignificance && (
                          <span style={{ marginLeft: 5, opacity: 0.75 }}>
                            G²{s.g2.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                className="dim"
                style={{ fontSize: 10, marginTop: 6 }}
              >
                <span style={{ color: "var(--gn)" }}>■</span>{" "}
                {scribeA} uses more &nbsp;{" "}
                <span style={{ color: "var(--am)" }}>■</span>{" "}
                {cmpLabelTxt} uses more
              </div>
            </div>

            <div className="card">
              <h4>Top signs by raw count for {scribeA}</h4>
              <div className="sub" style={{ marginBottom: 8 }}>
                Their workhorse signs — most frequently used regardless of
                comparison.
              </div>
              <div style={{ display: "grid", gap: 3 }}>
                {topSigns.map(([sign, count]) => {
                  const max = topSigns[0]?.[1] ?? 1;
                  const pct = count / max;
                  return (
                    <div
                      key={sign}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "32px 50px 1fr 40px",
                        gap: 6,
                        alignItems: "center",
                        fontSize: 11,
                      }}
                    >
                      <Glyph sign={sign} size={16} />
                      <span
                        style={{
                          font: "500 11px var(--mono)",
                          color: "var(--text)",
                        }}
                      >
                        {sign}
                      </span>
                      <div
                        style={{
                          height: 8,
                          background: "var(--ac)",
                          width: `${pct * 100}%`,
                          borderRadius: 1,
                          opacity: 0.55,
                        }}
                      />
                      <span className="numeral" style={{ fontSize: 11 }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {distinctiveWords.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <h4>Distinctive vocabulary</h4>
              <div className="sub" style={{ marginBottom: 8 }}>
                Which <em>words</em> {scribeA} writes more or less than{" "}
                <b>{cmpLabelTxt}</b> predicts — the hand's subject matter,
                where the sign profile above is its habits. Counts shown{" "}
                {scribeA}/{cmpLabelTxt}; ranked by{" "}
                {bySignificance ? "G² significance" : "|log-ratio|"}.
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px 12px",
                }}
              >
                {distinctiveWords.map((w) => (
                  <span
                    key={w.word}
                    style={{ whiteSpace: "nowrap", fontSize: 11 }}
                    title={`log2 ratio ${w.logRatio > 0 ? "+" : ""}${w.logRatio.toFixed(2)} · G² ${w.g2.toFixed(2)}`}
                  >
                    <WordToken word={w.word} />
                    <span
                      className="dim"
                      style={{ fontFamily: "var(--mono)", fontSize: 10 }}
                    >
                      {w.aCount}/{w.cmpCount}
                      <span
                        style={{
                          marginLeft: 4,
                          color:
                            w.logRatio > 0 ? "var(--gn)" : "var(--am)",
                        }}
                      >
                        {w.logRatio > 0 ? "+" : ""}
                        {w.logRatio.toFixed(1)}
                      </span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: 12 }}>
            <h4>
              Inscriptions by {scribeA}{" "}
              <span className="dim">({a.inscriptionIds.length})</span>
            </h4>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 6,
              }}
            >
              {a.inscriptionIds.slice(0, 80).map((id) => (
                <span
                  key={id}
                  style={{
                    padding: "2px 6px",
                    background: "var(--surface-2)",
                    borderRadius: 3,
                    fontSize: 11,
                  }}
                >
                  <InscriptionLink id={id} />
                </span>
              ))}
              {a.inscriptionIds.length > 80 && (
                <span className="dim">
                  +{a.inscriptionIds.length - 80} more
                </span>
              )}
            </div>
            <div
              className="dim"
              style={{ fontSize: 11, marginTop: 6 }}
            >
              Sites:{" "}
              {[...a.sites].map((s) => (
                <span className="tag tag-site" key={s}>
                  {s}
                </span>
              ))}
              {a.periods.size > 0 && (
                <>
                  &nbsp; Periods:{" "}
                  {[...a.periods].map((p) => (
                    <span className="tag tag-domain" key={p}>
                      {p}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
