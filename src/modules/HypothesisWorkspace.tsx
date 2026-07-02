import { useMemo, useState } from "react";
import { useWorkbench, getAllLanguages } from "../store/workbench";
import { useMultiWords, csvEscape, downloadFile } from "../lib/helpers";
import { phoneticDistance, wordToPhonetic } from "../lib/algorithms";
import { PHONETIC_MAP } from "../data/phoneticMap";
import { phoneticKeyOf } from "../lib/signKeys";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

export default function HypothesisWorkspace() {
  const hyp = useWorkbench((s) => s.hypothesis);
  const saved = useWorkbench((s) => s.savedHypotheses);
  const save = useWorkbench((s) => s.saveHypothesis);
  const load = useWorkbench((s) => s.loadHypothesis);
  const remove = useWorkbench((s) => s.deleteHypothesis);
  const toast = useWorkbench((s) => s.toast_show);
  const custom = useWorkbench((s) => s.customLanguages);
  const allLangs = useMemo(() => getAllLanguages(custom), [custom]);
  const words = useMultiWords();

  const [name, setName] = useState("");
  const [compare, setCompare] = useState(false);
  const [diff, setDiff] = useState(false);
  const [aIdx, setAIdx] = useState(0);
  const [bIdx, setBIdx] = useState(1);

  // Pairwise diff of two saved snapshots: which sign values differ, and how
  // the affected words' best cross-linguistic match score changes from A to
  // B. The evaluation set is the words that CONTAIN a differing sign (the
  // global top-10 would show all-zero deltas for rare-sign hypotheses);
  // when the snapshots differ in no signs the top-10 stands in. Sign keys
  // strip only the "*" of unread labels — subscripted signs are distinct,
  // so a snapshot differing on RA never pulls in RA₂-only words.
  const diffData = useMemo(() => {
    if (saved.length < 2) return null;
    const A = saved[Math.min(aIdx, saved.length - 1)];
    const B = saved[Math.min(bIdx, saved.length - 1)];
    if (!A || !B || A === B) return null;

    const keys = new Set([
      ...Object.keys(A.overrides),
      ...Object.keys(B.overrides),
    ]);
    const signDiffs: { sign: string; a: string; b: string }[] = [];
    for (const s of keys) {
      const av = A.overrides[s] ?? PHONETIC_MAP[s] ?? "?";
      const bv = B.overrides[s] ?? PHONETIC_MAP[s] ?? "?";
      if (av !== bv) signDiffs.push({ sign: s, a: av, b: bv });
    }
    signDiffs.sort((x, y) => x.sign.localeCompare(y.sign));

    const touched = new Set(signDiffs.map((d) => phoneticKeyOf(d.sign)));
    const evalWords =
      touched.size > 0
        ? words
            .filter(({ word }) =>
              word.split("-").some((p) => touched.has(phoneticKeyOf(p))),
            )
            .slice(0, 25)
        : words.slice(0, 10);

    const bestScore = (ph: string) => {
      let best = Infinity;
      for (const entries of Object.values(allLangs))
        for (const e of entries) {
          const d = phoneticDistance(ph, e.p ?? e.w.toLowerCase());
          if (d < best) best = d;
        }
      return best === Infinity ? 0 : 1 - best;
    };
    const wordDiffs = evalWords.map(({ word }) => {
      const pa = wordToPhonetic(word, A.overrides);
      const pb = wordToPhonetic(word, B.overrides);
      const sa = bestScore(pa);
      const sb = bestScore(pb);
      return { word, pa, pb, sa, sb, delta: sb - sa };
    });
    const avg = (xs: number[]) =>
      xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
    return {
      A,
      B,
      signDiffs,
      wordDiffs,
      avgA: avg(wordDiffs.map((w) => w.sa)),
      avgB: avg(wordDiffs.map((w) => w.sb)),
    };
  }, [saved, aIdx, bIdx, allLangs, words]);

  // "Compare all" evaluates over words containing any sign that any saved
  // snapshot overrides — the words the hypotheses actually disagree about.
  const compareWords = useMemo(() => {
    const touched = new Set<string>();
    for (const h of saved)
      for (const s of Object.keys(h.overrides)) touched.add(phoneticKeyOf(s));
    if (touched.size === 0) return words.slice(0, 10);
    return words
      .filter(({ word }) =>
        word.split("-").some((p) => touched.has(phoneticKeyOf(p))),
      )
      .slice(0, 25);
  }, [saved, words]);

  return (
    <div className="panel">
      <h2>Hypothesis Workspace</h2>
      <div className="callout">
        <h4>Save and compare phonetic readings</h4>
        <p>
          Save multiple sets of sign-value assignments from{" "}
          <code>Sound Shift</code>. Compare how each hypothesis affects
          cross-linguistic match quality on the top words.
        </p>
      </div>
      <div className="toolbar">
        <input
          className="input"
          placeholder="Hypothesis name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          className="btn"
          onClick={() => {
            save(name);
            setName("");
            toast(`Saved hypothesis`);
          }}
        >
          Save current
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setCompare((c) => !c)}
          disabled={saved.length < 2}
        >
          {compare ? "Hide" : "Compare all"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setDiff((d) => !d)}
          disabled={saved.length < 2}
          title="Diff two snapshots — which signs differ and how scores change"
        >
          {diff ? "Hide diff" : "Diff two"}
        </button>
      </div>

      {saved.length === 0 ? (
        <div className="card">
          <div className="dim">
            No saved hypotheses. Modify signs in <b>Sound Shift</b>, then save
            here.
          </div>
        </div>
      ) : (
        <div>
          {saved.map((h, i) => {
            const isActive =
              JSON.stringify(h.overrides) === JSON.stringify(hyp);
            return (
              <div
                key={i}
                className={`hyp-card${isActive ? " active" : ""}`}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h5>{h.name}</h5>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => load(i)}
                    >
                      Load
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: "var(--rd)" }}
                      onClick={() => remove(i)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="sub">
                  {Object.keys(h.overrides).length} changes ·{" "}
                  {h.notes || "(default values)"} ·{" "}
                  {new Date(h.timestamp).toLocaleString()}
                </div>
                {h.evidence && Object.keys(h.evidence).length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 8,
                      background: "var(--surface-0)",
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    <div
                      className="dim"
                      style={{
                        font: "600 9px var(--sans)",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        marginBottom: 4,
                      }}
                    >
                      Reasoning
                    </div>
                    {Object.entries(h.evidence)
                      .filter(([, e]) => e.note?.trim())
                      .map(([sign, e]) => (
                        <div key={sign} style={{ margin: "2px 0" }}>
                          <b style={{ color: "var(--am)" }}>{sign}</b>
                          <span className="dim">
                            {" "}
                            → /{h.overrides[sign]}/:
                          </span>{" "}
                          <span style={{ fontFamily: "var(--serif)" }}>
                            {e.note}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {compare && saved.length >= 2 && (
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
            Top-10 best matches by hypothesis
          </h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Word</th>
                  {saved.map((h, i) => (
                    <th key={i}>{h.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareWords.map(({ word }) => (
                  <tr key={word}>
                    <td>
                      <WordToken word={word} />
                    </td>
                    {saved.map((h, i) => {
                      const ph = wordToPhonetic(word, h.overrides);
                      let best: { w: string; lang: string; dist: number } | null = null;
                      for (const [ln, entries] of Object.entries(allLangs)) {
                        for (const e of entries) {
                          const d = phoneticDistance(ph, e.p ?? e.w.toLowerCase());
                          if (d < 0.5 && (!best || d < best.dist))
                            best = { w: e.w, lang: ln, dist: d };
                        }
                      }
                      return (
                        <td key={i}>
                          <span className="dim">{ph}</span>
                          {best && (
                            <>
                              {" "}
                              →{" "}
                              <span
                                className={`score ${
                                  best.dist < 0.3 ? "score-hi" : "score-md"
                                }`}
                              >
                                {((1 - best.dist) * 100).toFixed(0)}%
                              </span>{" "}
                              {best.w}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {diff && saved.length >= 2 && (
        <div className="panel-section">
          <div
            className="toolbar"
            style={{ flexWrap: "wrap", alignItems: "center" }}
          >
            <span
              className="dim"
              style={{
                font: "600 9px var(--sans)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Diff
            </span>
            <select
              className="select"
              value={aIdx}
              onChange={(e) => setAIdx(+e.target.value)}
              style={{ fontSize: 11, padding: "3px 6px" }}
            >
              {saved.map((h, i) => (
                <option key={i} value={i}>
                  A: {h.name}
                </option>
              ))}
            </select>
            <span className="dim">vs</span>
            <select
              className="select"
              value={bIdx}
              onChange={(e) => setBIdx(+e.target.value)}
              style={{ fontSize: 11, padding: "3px 6px" }}
            >
              {saved.map((h, i) => (
                <option key={i} value={i}>
                  B: {h.name}
                </option>
              ))}
            </select>
          </div>

          {!diffData ? (
            <div className="dim" style={{ fontSize: 12, padding: 8 }}>
              Pick two different snapshots to compare.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  margin: "10px 0 6px",
                }}
              >
                <span
                  style={{
                    font: "600 10px var(--sans)",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  Sign differences ({diffData.signDiffs.length})
                </span>
                <span style={{ flex: 1 }} />
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const rows: (string | number)[][] = [
                      ["kind", "item", diffData.A.name, diffData.B.name, "delta"],
                    ];
                    for (const d of diffData.signDiffs)
                      rows.push(["sign", d.sign, d.a, d.b, ""]);
                    for (const w of diffData.wordDiffs)
                      rows.push([
                        "word",
                        w.word,
                        `${w.pa} (${w.sa.toFixed(3)})`,
                        `${w.pb} (${w.sb.toFixed(3)})`,
                        w.delta.toFixed(3),
                      ]);
                    downloadFile(
                      `linear_a_hypothesis_diff_${diffData.A.name.replace(/\W+/g, "_")}_vs_${diffData.B.name.replace(/\W+/g, "_")}.csv`,
                      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
                    );
                  }}
                  title="Download the sign differences and per-word match deltas as CSV"
                >
                  Export CSV
                </button>
                <SaveFindingButton
                  module="hypws"
                  moduleLabel="Hypothesis Workspace"
                  defaultTitle={`${diffData.A.name} vs ${diffData.B.name}`}
                  summary={
                    `Snapshots ${diffData.A.name} vs ${diffData.B.name}: ${diffData.signDiffs.length} sign value(s) differ` +
                    (diffData.signDiffs.length > 0
                      ? ` (${diffData.signDiffs
                          .slice(0, 6)
                          .map((d) => `${d.sign}: ${d.a}→${d.b}`)
                          .join(", ")}${diffData.signDiffs.length > 6 ? ", …" : ""})`
                      : "") +
                    `.\nAvg best-match score ${(diffData.avgA * 100).toFixed(0)}% → ${(diffData.avgB * 100).toFixed(0)}% over ${diffData.wordDiffs.length} affected words.`
                  }
                  payload={{ a: diffData.A.name, b: diffData.B.name }}
                  reportFn={() => {
                    const slice = diffData.wordDiffs;
                    type R = (typeof slice)[number];
                    const cols: SnippetColumn<R>[] = [
                      {
                        label: "Word",
                        render: (r) => `<code>${esc(r.word)}</code>`,
                      },
                      {
                        label: diffData.A.name,
                        render: (r) => esc(`/${r.pa}/ (${r.sa.toFixed(2)})`),
                      },
                      {
                        label: diffData.B.name,
                        render: (r) => esc(`/${r.pb}/ (${r.sb.toFixed(2)})`),
                      },
                      {
                        label: "Δ",
                        render: (r) =>
                          `<span style="color:${r.delta > 0 ? "#16a34a" : r.delta < 0 ? "#b45309" : "#6b7280"};">${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)}</span>`,
                        md: (r) =>
                          `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)}`,
                        align: "right",
                      },
                    ];
                    const meta = `${diffData.A.name} vs ${diffData.B.name}: ${diffData.signDiffs.length} differing sign(s) — ${diffData.signDiffs.map((d) => `${d.sign} ${d.a}→${d.b}`).join(", ") || "none"}. Avg best-match ${(diffData.avgA * 100).toFixed(0)}% → ${(diffData.avgB * 100).toFixed(0)}%.`;
                    return {
                      html: snippetWrap(meta, snippetTable(slice, cols)),
                      markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
                    };
                  }}
                />
              </div>
              {diffData.signDiffs.length === 0 ? (
                <div className="dim" style={{ fontSize: 12 }}>
                  These two snapshots assign the same value to every sign.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {diffData.signDiffs.map((d) => (
                    <span
                      key={d.sign}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        background: "var(--surface-1)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                      }}
                    >
                      <b style={{ color: "var(--text)" }}>{d.sign}</b>
                      <span className="dim">{d.a}</span>
                      <span className="dim">→</span>
                      <span style={{ color: "var(--am)" }}>{d.b}</span>
                    </span>
                  ))}
                </div>
              )}

              <div
                style={{
                  font: "600 10px var(--sans)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  margin: "12px 0 6px",
                }}
              >
                Top-word match: {diffData.A.name} ({(diffData.avgA * 100).toFixed(0)}%)
                → {diffData.B.name} ({(diffData.avgB * 100).toFixed(0)}%)
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Word</th>
                      <th>{diffData.A.name}</th>
                      <th>{diffData.B.name}</th>
                      <th>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffData.wordDiffs.map((w) => (
                      <tr key={w.word}>
                        <td>
                          <WordToken word={w.word} />
                        </td>
                        <td className="dim">
                          {w.pa}{" "}
                          <span className="score score-md">
                            {(w.sa * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td style={{ color: w.pa !== w.pb ? "var(--am)" : undefined }}>
                          {w.pb}{" "}
                          <span className="score score-md">
                            {(w.sb * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td
                          className="numeral"
                          style={{
                            color:
                              w.delta > 0.005
                                ? "var(--gn)"
                                : w.delta < -0.005
                                  ? "var(--rd)"
                                  : "var(--text-muted)",
                          }}
                        >
                          {w.delta > 0.005 ? "+" : ""}
                          {Math.abs(w.delta) < 0.005
                            ? "0"
                            : (w.delta * 100).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
