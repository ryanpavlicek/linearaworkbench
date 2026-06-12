import { useMemo, useState } from "react";
import { PHONETIC_MAP } from "../data/phoneticMap";
import { languageLabel } from "../data/languages";
import { useWorkbench, getAllLanguages } from "../store/workbench";
import { useMultiWords, csvEscape, downloadFile } from "../lib/helpers";
import { phoneticDistance, wordToPhonetic } from "../lib/algorithms";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

export default function SoundShift() {
  const hyp = useWorkbench((s) => s.hypothesis);
  const evidence = useWorkbench((s) => s.overrideEvidence);
  const setOverride = useWorkbench((s) => s.setOverride);
  const clearOverride = useWorkbench((s) => s.clearOverride);
  const setEvidence = useWorkbench((s) => s.setOverrideEvidence);
  const reset = useWorkbench((s) => s.resetHypothesis);
  const saved = useWorkbench((s) => s.savedHypotheses);
  const save = useWorkbench((s) => s.saveHypothesis);
  const load = useWorkbench((s) => s.loadHypothesis);
  const remove = useWorkbench((s) => s.deleteHypothesis);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const toast = useWorkbench((s) => s.toast_show);
  const words = useMultiWords();
  const custom = useWorkbench((s) => s.customLanguages);
  const allLangs = useMemo(() => getAllLanguages(custom), [custom]);
  const [name, setName] = useState("");

  function saveSnapshot() {
    save(name);
    toast(name.trim() ? `Saved “${name.trim()}”` : "Saved snapshot");
    setName("");
  }

  const signs = useMemo(() => Object.keys(PHONETIC_MAP).sort(), []);
  const modified = Object.keys(hyp).length;
  const modifiedSigns = Object.keys(hyp);

  // Evaluation set: with no overrides, the corpus's top words (a preview of
  // what editing will affect). With overrides, the words that actually
  // CONTAIN a modified sign — evaluating a rare-sign hypothesis against the
  // global top-20 would show all-zero deltas and look broken. Sign lookup
  // strips ₂₃₄* exactly the way wordToPhonetic does.
  const top = useMemo(() => {
    if (modifiedSigns.length === 0) return words.slice(0, 20);
    const touched = new Set(
      modifiedSigns.map((s) => s.replace(/[₂₃₄*]/g, "")),
    );
    return words
      .filter(({ word }) =>
        word.split("-").some((p) => touched.has(p.replace(/[₂₃₄*]/g, ""))),
      )
      .slice(0, 50);
  }, [words, modifiedSigns]);

  // Match-delta: for each top word, the closest reference-language match under
  // the *standard* reading vs the *modified* reading, and the change in score.
  // Answers the core question — does this proposed sign value make the corpus
  // align better with a known language, or worse?
  const deltaRows = useMemo(() => {
    const bestOf = (ph: string) => {
      let best: {
        word: string;
        meaning: string;
        lang: string;
        dist: number;
      } | null = null;
      for (const [ln, entries] of Object.entries(allLangs)) {
        for (const e of entries) {
          const d = phoneticDistance(ph, e.p!);
          if (!best || d < best.dist)
            best = { word: e.w, meaning: e.m, lang: ln, dist: d };
        }
      }
      return best;
    };
    return top.map(({ word }) => {
      const std = wordToPhonetic(word, {});
      const mod = wordToPhonetic(word, hyp);
      const bs = bestOf(std);
      const bm = bestOf(mod);
      const sStd = bs ? 1 - bs.dist : 0;
      const sMod = bm ? 1 - bm.dist : 0;
      return { word, std, mod, bestMod: bm, sStd, sMod, delta: sMod - sStd };
    });
  }, [top, hyp, allLangs]);

  const agg = useMemo(() => {
    if (deltaRows.length === 0) return null;
    const avg = (xs: number[]) =>
      xs.reduce((s, x) => s + x, 0) / xs.length;
    const avgStd = avg(deltaRows.map((r) => r.sStd));
    const avgMod = avg(deltaRows.map((r) => r.sMod));
    const EPS = 0.005;
    const improved = deltaRows.filter((r) => r.delta > EPS).length;
    const worsened = deltaRows.filter((r) => r.delta < -EPS).length;
    return {
      avgStd,
      avgMod,
      net: avgMod - avgStd,
      improved,
      worsened,
      same: deltaRows.length - improved - worsened,
    };
  }, [deltaRows]);

  return (
    <div className="panel">
      <h2>Sound Shift Hypothesis</h2>
      <div className="callout">
        <h4>Test alternative readings</h4>
        <p>
          Edit phonetic values below to test alternative sound correspondences.
          Changes propagate to all comparisons across the workbench. Save named
          snapshots right here as you work; the{" "}
          <code>Hypothesis Workspace</code> compares saved snapshots
          side-by-side.
        </p>
      </div>
      <div className="toolbar">
        <span className="dim">{modified} modified</span>
        <button
          className="btn btn-outline btn-sm"
          onClick={reset}
          disabled={modified === 0}
        >
          Reset all
        </button>
        <span style={{ flex: 1 }} />
        <input
          className="input"
          placeholder="Name this snapshot…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveSnapshot();
          }}
          style={{ width: 180 }}
        />
        <button
          className="btn"
          onClick={saveSnapshot}
          title="Save the current sign values as a named snapshot — without leaving this module"
        >
          Save snapshot
        </button>
        <button
          className="btn btn-outline btn-sm"
          disabled={deltaRows.length === 0}
          onClick={() => {
            const rows: (string | number)[][] = [
              [
                "word",
                "standard_phonetic",
                "modified_phonetic",
                "standard_score",
                "modified_score",
                "delta",
                "best_match",
                "best_match_language",
                "best_match_meaning",
              ],
            ];
            for (const r of deltaRows) {
              rows.push([
                r.word,
                r.std,
                r.mod,
                r.sStd.toFixed(3),
                r.sMod.toFixed(3),
                r.delta.toFixed(3),
                r.bestMod?.word ?? "",
                r.bestMod ? languageLabel(r.bestMod.lang) : "",
                r.bestMod?.meaning ?? "",
              ]);
            }
            downloadFile(
              "linear_a_sound_shift_evaluation.csv",
              rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
            );
          }}
          title="Download the evaluation table (standard vs modified reading, match scores, best matches) as CSV"
        >
          Export CSV
        </button>
        <SaveFindingButton
          module="hyp"
          moduleLabel="Sound Shift"
          defaultTitle={
            modified > 0
              ? `Sound shift: ${modifiedSigns.slice(0, 4).join(", ")}${modifiedSigns.length > 4 ? "…" : ""}`
              : "Sound shift (baseline)"
          }
          summary={
            (modified > 0
              ? `Overrides: ${modifiedSigns.map((s) => `${s}→${hyp[s]}`).join(", ")}.`
              : "No sign overrides (baseline readings).") +
            (agg
              ? `\nAvg match score ${agg.avgStd.toFixed(3)} → ${agg.avgMod.toFixed(3)} (net ${agg.net >= 0 ? "+" : ""}${agg.net.toFixed(3)}); ${agg.improved} improved / ${agg.worsened} worsened / ${agg.same} unchanged of ${deltaRows.length} evaluated words.`
              : "")
          }
          payload={{ overrides: hyp }}
          reportFn={() => {
            const slice = deltaRows.slice(0, 50);
            type R = (typeof slice)[number];
            const cols: SnippetColumn<R>[] = [
              { label: "Word", render: (r) => `<code>${esc(r.word)}</code>` },
              { label: "Standard", render: (r) => esc(`/${r.std}/`) },
              { label: "Modified", render: (r) => esc(`/${r.mod}/`) },
              {
                label: "Best match (modified)",
                render: (r) =>
                  r.bestMod
                    ? `${esc(r.bestMod.word)} <span style="color:#6b7280;">(${esc(languageLabel(r.bestMod.lang))} — ${esc(r.bestMod.meaning)})</span>`
                    : "—",
                md: (r) =>
                  r.bestMod
                    ? `${r.bestMod.word} (${languageLabel(r.bestMod.lang)} — ${r.bestMod.meaning})`
                    : "—",
              },
              {
                label: "Δ score",
                render: (r) =>
                  `<span style="color:${r.delta > 0 ? "#16a34a" : r.delta < 0 ? "#b45309" : "#6b7280"};">${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)}</span>`,
                md: (r) => `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)}`,
                align: "right",
              },
            ];
            const meta =
              (modified > 0
                ? `Overrides ${modifiedSigns.map((s) => `${s}→${hyp[s]}`).join(", ")}. `
                : "Baseline readings. ") +
              (agg
                ? `Avg match ${agg.avgStd.toFixed(3)} → ${agg.avgMod.toFixed(3)} over ${deltaRows.length} words containing the modified sign(s).`
                : "");
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>

      {saved.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Saved snapshots ({saved.length})
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            {saved.map((h, i) => {
              const isActive =
                JSON.stringify(h.overrides) === JSON.stringify(hyp);
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 4px 2px 8px",
                    background: isActive ? "var(--surface-2)" : "var(--surface-1)",
                    border: `1px solid ${isActive ? "var(--ac)" : "var(--border)"}`,
                    borderRadius: 6,
                  }}
                  title={
                    h.notes ? h.notes : "(baseline — no sign overrides)"
                  }
                >
                  <button
                    className="link-btn"
                    onClick={() => {
                      load(i);
                      toast(`Loaded “${h.name}”`);
                    }}
                  >
                    {h.name}
                  </button>
                  <span className="dim" style={{ fontSize: 10 }}>
                    {Object.keys(h.overrides).length}
                  </span>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => remove(i)}
                    title={`Delete “${h.name}”`}
                    style={{ padding: "0 6px", minWidth: 0, color: "var(--rd)" }}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
            <span style={{ flex: 1 }} />
            <button
              className="link-btn"
              onClick={() => setActiveModule("hypws")}
            >
              Compare all →
            </button>
          </div>
        </div>
      )}

      <div className="hyp-grid">
        {signs.map((s) => {
          const isMod = hyp[s] !== undefined;
          const cur = hyp[s] ?? PHONETIC_MAP[s] ?? "?";
          return (
            <div key={s} className={`hyp-cell${isMod ? " modified" : ""}`}>
              <label>{s}</label>
              <input
                className="input"
                value={cur}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === PHONETIC_MAP[s]) clearOverride(s);
                  else setOverride(s, v);
                }}
              />
            </div>
          );
        })}
      </div>

      {modified > 0 && (
        <>
          <div className="panel-section">
            <h4
              style={{
                font: "600 10px var(--sans)",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              Reasoning per modified sign
            </h4>
            {modifiedSigns.map((sign) => {
              const ev = evidence[sign] ?? {
                note: "",
                evidenceWords: [],
                evidenceInscriptionIds: [],
              };
              return (
                <div
                  key={sign}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      minWidth: 110,
                      font: "500 12px var(--mono)",
                    }}
                  >
                    <b style={{ color: "var(--am)" }}>{sign}</b>
                    <span className="dim"> → /{hyp[sign]}/</span>
                  </span>
                  <input
                    className="input"
                    placeholder="Why this reading? Cite evidence inscriptions or words…"
                    value={ev.note}
                    onChange={(e) =>
                      setEvidence(sign, { note: e.target.value })
                    }
                    style={{ flex: 1, fontFamily: "var(--serif)" }}
                  />
                </div>
              );
            })}
          </div>

          {agg && (
            <div className="stat-grid" style={{ margin: "12px 0" }}>
              <div className="stat-box">
                <span className="val">{(agg.avgStd * 100).toFixed(0)}%</span>
                <span className="lbl">Avg best match (standard)</span>
              </div>
              <div className="stat-box">
                <span className="val" style={{ color: "var(--am)" }}>
                  {(agg.avgMod * 100).toFixed(0)}%
                </span>
                <span className="lbl">Avg best match (modified)</span>
              </div>
              <div className="stat-box">
                <span
                  className="val"
                  style={{
                    color:
                      agg.net > 0.0005
                        ? "var(--gn)"
                        : agg.net < -0.0005
                          ? "var(--rd)"
                          : undefined,
                  }}
                >
                  {agg.net >= 0 ? "+" : ""}
                  {(agg.net * 100).toFixed(1)}
                </span>
                <span className="lbl">Net change (pts)</span>
              </div>
              <div className="stat-box">
                <span className="val">
                  <span style={{ color: "var(--gn)" }}>{agg.improved}</span>
                  {" / "}
                  <span style={{ color: "var(--rd)" }}>{agg.worsened}</span>
                </span>
                <span className="lbl">Improved / worsened</span>
              </div>
            </div>
          )}
          <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
            Best cross-linguistic match per word under the standard vs modified
            reading —{" "}
            {modified > 0
              ? `the ${top.length} most frequent words containing a modified sign`
              : `the top ${top.length} corpus words`}
            . Δ &gt; 0 means your change moves the word closer to a
            known-language word.
            {modified > 0 && top.length === 0 && (
              <b> No corpus word contains the modified sign(s).</b>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Standard</th>
                  <th>Modified</th>
                  <th>Δ</th>
                  <th>Best match (modified)</th>
                </tr>
              </thead>
              <tbody>
                {deltaRows.map((r) => {
                  const changed = r.std !== r.mod;
                  return (
                    <tr key={r.word}>
                      <td>
                        <WordToken word={r.word} />
                      </td>
                      <td className="dim">{r.std}</td>
                      <td
                        style={{
                          color: changed ? "var(--am)" : "var(--text-dim)",
                        }}
                      >
                        {r.mod}
                      </td>
                      <td
                        className="numeral"
                        style={{
                          color:
                            r.delta > 0.005
                              ? "var(--gn)"
                              : r.delta < -0.005
                                ? "var(--rd)"
                                : "var(--text-muted)",
                        }}
                        title={`${(r.sStd * 100).toFixed(0)}% → ${(r.sMod * 100).toFixed(0)}%`}
                      >
                        {r.delta > 0.005 ? "+" : ""}
                        {Math.abs(r.delta) < 0.005
                          ? "0"
                          : (r.delta * 100).toFixed(0)}
                      </td>
                      <td>
                        {r.bestMod ? (
                          <>
                            <span
                              className={`score ${
                                r.bestMod.dist < 0.3 ? "score-hi" : "score-md"
                              }`}
                            >
                              {(r.sMod * 100).toFixed(0)}%
                            </span>{" "}
                            {r.bestMod.word} ({languageLabel(r.bestMod.lang)}) —{" "}
                            {r.bestMod.meaning}
                          </>
                        ) : (
                          <span className="dim">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
