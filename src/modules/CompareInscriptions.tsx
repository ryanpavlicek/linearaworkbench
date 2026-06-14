import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { WordToken } from "../components/WordToken";
import { Glyph, GlyphRun } from "../components/Glyph";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { FindingsPanel } from "../components/FindingsPanel";
import {
  csvEscape,
  describeInscription,
  downloadFile,
  normalizeSignLabel,
} from "../lib/helpers";
import type { Finding } from "../lib/types";
import { sequenceDistance } from "../lib/algorithms";
import {
  alignSequences,
  buildCompareReport,
} from "../lib/compareAlign";

const HIGHLIGHT_COLORS = [
  "#5b9eff",
  "#3ddc91",
  "#f0b14b",
  "#9b7cf0",
  "#4ad8d0",
  "#d568b4",
  "#ef9a5a",
  "#7fda5f",
];

// Up to 4 inscriptions side-by-side. Words shared across columns get a stable
// color highlight so the eye can pick out repetition / formula structure.
export default function CompareInscriptions() {
  const inscriptions = useWorkbench((s) => s.corpus.inscriptions);
  const showInscription = useWorkbench((s) => s.showInscription);
  const showWord = useWorkbench((s) => s.showWord);
  const toast = useWorkbench((s) => s.toast_show);
  const savedComparisons = useWorkbench((s) =>
    s.findings.filter((f) => f.module === "compare"),
  );

  // Honor a deep-link from another module — e.g. Tablet Structure's
  // "Compare" per-row pivot (single id), Similarity's "Compare with PIVOT"
  // (comma-separated pair), or any future caller passing focus="HT1,HT5".
  // Up to 4 ids are accepted (the comparator's hard cap).
  const [ids, setIds] = useState<string[]>(() => {
    const focus = useWorkbench.getState().moduleIntent?.focus;
    if (!focus) return [];
    return focus
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
  });
  const [view, setView] = useState<"interlinear" | "columns">("interlinear");
  const [signHL, setSignHL] = useState(false);
  // Builder filter state
  const [idQ, setIdQ] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [scribeFilter, setScribeFilter] = useState("");
  const [wordFilter, setWordFilter] = useState("");

  const sites = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.site).filter(Boolean))].sort(),
    [inscriptions],
  );
  const periods = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.context).filter(Boolean))].sort(),
    [inscriptions],
  );
  const scribes = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.scribe).filter(Boolean))].sort(),
    [inscriptions],
  );

  const candidates = useMemo(() => {
    const idU = idQ.toUpperCase().trim();
    const wordU = wordFilter.toUpperCase().trim();
    return inscriptions.filter((i) => {
      if (idU && !i.id.toUpperCase().includes(idU)) return false;
      if (siteFilter && i.site !== siteFilter) return false;
      if (periodFilter && i.context !== periodFilter) return false;
      if (scribeFilter && i.scribe !== scribeFilter) return false;
      if (wordU && !i.words.some((w) => w.toUpperCase().includes(wordU)))
        return false;
      return true;
    });
  }, [
    inscriptions,
    idQ,
    siteFilter,
    periodFilter,
    scribeFilter,
    wordFilter,
  ]);
  const hasAnyFilter =
    Boolean(idQ || siteFilter || periodFilter || scribeFilter || wordFilter);
  const visibleCandidates = candidates.slice(0, 30);

  function clearFilters() {
    setIdQ("");
    setSiteFilter("");
    setPeriodFilter("");
    setScribeFilter("");
    setWordFilter("");
  }

  const selected = useMemo(
    () =>
      ids
        .map((id) => inscriptions.find((i) => i.id === id))
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    [ids, inscriptions],
  );

  // Compute which multi-sign words appear in ≥2 of the selected inscriptions
  // and assign each one a stable highlight color.
  const sharedColor = useMemo(() => {
    if (selected.length < 2) return new Map<string, string>();
    const wordSets = selected.map(
      (ins) => new Set(ins.words.filter((w) => w.includes("-"))),
    );
    const counts = new Map<string, number>();
    for (const set of wordSets) {
      for (const w of set) counts.set(w, (counts.get(w) || 0) + 1);
    }
    const shared = [...counts.entries()]
      .filter(([, c]) => c >= 2)
      .map(([w]) => w)
      .sort();
    const map = new Map<string, string>();
    shared.forEach((w, i) =>
      map.set(w, HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length]),
    );
    return map;
  }, [selected]);

  // Signs (normalized) attested in ≥2 of the selected inscriptions — used by
  // the sign-level highlight toggle.
  const sharedSigns = useMemo(() => {
    if (selected.length < 2) return new Set<string>();
    const counts = new Map<string, number>();
    for (const ins of selected) {
      const signs = new Set<string>();
      for (const w of ins.words)
        for (const p of w.split("-")) signs.add(normalizeSignLabel(p));
      for (const s of signs) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, c]) => c >= 2).map(([s]) => s),
    );
  }, [selected]);

  // Word-level multiple-sequence alignment of the selected inscriptions.
  const alignment = useMemo(
    () => (selected.length >= 2 ? alignSequences(selected.map((i) => i.words)) : []),
    [selected],
  );

  // With a single inscription there is nothing to align or tab between, so
  // force the per-inscription Columns layout. The interlinear view is driven
  // by `alignment` (empty for <2), so without this a single-id deep-link —
  // the state Tablet Structure's and Query Builder's "Compare" pivots land
  // in — renders an empty table with only a header.
  const effectiveView = selected.length >= 2 ? view : "columns";

  function add(id: string) {
    if (ids.includes(id)) return;
    if (ids.length >= 4) return;
    setIds([...ids, id]);
  }
  function remove(id: string) {
    setIds(ids.filter((x) => x !== id));
  }

  const sharedWords = useMemo(() => [...sharedColor.keys()], [sharedColor]);
  const findingTitle = `Comparison: ${ids.join(" / ")}`;
  const findingSummary =
    `Compared ${ids.join(" · ")}.\n` +
    `Shared multi-sign words (${sharedWords.length}): ${
      sharedWords.join(", ") || "none"
    }.`;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["inscription", "site", "period", "word_count", "shared_words_present", "text"],
    ];
    for (const ins of selected) {
      const present = [...new Set(ins.words.filter((w) => sharedColor.has(w)))];
      rows.push([
        ins.id,
        ins.site,
        ins.context,
        ins.words.filter((w) => w.includes("-")).length,
        present.join(" "),
        ins.words.join(" "),
      ]);
    }
    downloadFile(
      "linear_a_comparison.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
    toast("Comparison exported (CSV)");
  }

  // The interlinear alignment itself, one row per aligned position — the
  // matrix view as data, with a flag column for shared / near-match rows.
  function exportAlignmentCsv() {
    const rows: (string | number)[][] = [
      ["position", ...selected.map((i) => i.id), "flag"],
    ];
    for (let ri = 0; ri < alignment.length; ri++) {
      const pos = alignment[ri];
      const present = pos.filter((w): w is string => Boolean(w));
      const isMatch = present.length >= 2 && new Set(present).size === 1;
      let flag = isMatch ? "shared" : "";
      if (!isMatch && present.length >= 2) {
        const multi = [...new Set(present)].filter((w) => w.includes("-"));
        outer: for (let x = 0; x < multi.length; x++) {
          for (let y = x + 1; y < multi.length; y++) {
            if (
              sequenceDistance(multi[x].split("-"), multi[y].split("-")) === 1
            ) {
              flag = "near-match";
              break outer;
            }
          }
        }
      }
      rows.push([ri + 1, ...pos.map((w) => w ?? ""), flag]);
    }
    downloadFile(
      "linear_a_alignment.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
    toast("Alignment exported (CSV)");
  }

  // Render the sign glyphs of a word, tinting signs shared across the
  // comparison when the sign-highlight toggle is on.
  function glyphsOf(word: string) {
    if (!word.includes("-")) return null;
    return word.split("-").map((p, j) => {
      const hl = signHL && sharedSigns.has(normalizeSignLabel(p));
      return (
        <span
          key={j}
          style={
            hl
              ? { background: "#f0b14b55", borderRadius: 2, padding: "0 1px" }
              : undefined
          }
        >
          <Glyph sign={p} size={14} />
        </span>
      );
    });
  }

  // A single interlinear cell: a word (clickable) or a gap dot.
  function AlnCell({ word }: { word: string | null }) {
    if (word === null)
      return (
        <span className="dim" style={{ opacity: 0.35 }}>
          ·
        </span>
      );
    const color = sharedColor.get(word);
    const inner = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        {glyphsOf(word)}
        <span style={{ font: "500 11px var(--mono)" }}>{word}</span>
      </span>
    );
    return (
      <span
        onClick={() => word.includes("-") && showWord(word)}
        style={{
          display: "inline-flex",
          cursor: word.includes("-") ? "pointer" : "default",
          ...(color
            ? {
                background: color + "22",
                border: `1px solid ${color}88`,
                color,
                padding: "1px 5px",
                borderRadius: 3,
              }
            : {}),
        }}
      >
        {inner}
      </span>
    );
  }

  return (
    <div className="panel">
      <h2>Compare Inscriptions</h2>
      <div className="callout">
        <h4>Interlinear alignment</h4>
        <p>
          Place up to four inscriptions next to each other. The{" "}
          <b>Interlinear</b> view runs a word-level alignment so shared words
          line up in the same row across columns (gaps where a tablet has no
          match) — making formulaic backbones and divergences visible at a
          glance; <b>Columns</b> shows the plain side-by-side texts. Shared
          words are color-coded; toggle <b>highlight shared signs</b> to tint
          individual signs attested across the comparison.
        </p>
      </div>

      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginBottom: 6,
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
            Find inscriptions
          </span>
          <span style={{ flex: 1 }} />
          <span className="dim" style={{ fontSize: 11 }}>
            {ids.length} / 4 selected
          </span>
          {hasAnyFilter && (
            <button
              className="btn btn-outline btn-sm"
              onClick={clearFilters}
              title="Clear all filters"
            >
              Clear filters
            </button>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <input
            className="input"
            placeholder="ID contains…"
            value={idQ}
            onChange={(e) => setIdQ(e.target.value)}
          />
          <select
            className="select"
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            className="select"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          >
            <option value="">All periods</option>
            {periods.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            className="select"
            value={scribeFilter}
            onChange={(e) => setScribeFilter(e.target.value)}
          >
            <option value="">All scribes</option>
            {scribes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Contains word…"
            value={wordFilter}
            onChange={(e) => setWordFilter(e.target.value)}
          />
        </div>

        <div className="dim" style={{ fontSize: 10, marginBottom: 4 }}>
          {candidates.length} match{candidates.length === 1 ? "" : "es"}
          {candidates.length > visibleCandidates.length &&
            ` — showing first ${visibleCandidates.length}, narrow filters to see more`}
        </div>
        <div
          style={{
            maxHeight: 220,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 4,
          }}
        >
          {visibleCandidates.map((s) => {
            const already = ids.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => add(s.id)}
                disabled={already || ids.length >= 4}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 8px",
                  background: already
                    ? "var(--ac-soft)"
                    : "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor:
                    already || ids.length >= 4 ? "default" : "pointer",
                  textAlign: "left",
                  opacity: already || ids.length >= 4 ? 0.7 : 1,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    font: "500 12px var(--mono)",
                    color: already ? "var(--ac)" : "var(--text)",
                    minWidth: 60,
                  }}
                >
                  {already ? "✓" : "+"} {s.id}
                </span>
                <span className="site-text">{s.site}</span>
                {s.context && (
                  <span className="dim" style={{ fontSize: 10 }}>
                    {s.context}
                  </span>
                )}
              </button>
            );
          })}
          {visibleCandidates.length === 0 && (
            <div className="dim" style={{ fontSize: 11, padding: 8 }}>
              No inscriptions match these filters.
            </div>
          )}
        </div>
      </div>

      {ids.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {ids.map((id) => (
            <span
              key={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                background: "var(--surface-1)",
                border: "1px solid var(--border-strong)",
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              <b>{id}</b>
              <button
                className="dim"
                style={{
                  background: "none",
                  padding: 0,
                  color: "var(--rd)",
                }}
                onClick={() => remove(id)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {selected.length >= 2 && (
        <div className="toolbar" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
            <button
              className={`tab-btn${view === "interlinear" ? " active" : ""}`}
              onClick={() => setView("interlinear")}
            >
              Interlinear
            </button>
            <button
              className={`tab-btn${view === "columns" ? " active" : ""}`}
              onClick={() => setView("columns")}
            >
              Columns
            </button>
          </div>
          <label
            className="dim"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title="Tint individual signs that are shared across the compared inscriptions"
          >
            <input
              type="checkbox"
              checked={signHL}
              onChange={(e) => setSignHL(e.target.checked)}
            />
            highlight shared signs
          </label>
          <span style={{ flex: 1 }} />
          <button className="btn btn-outline btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={exportAlignmentCsv}
            disabled={alignment.length === 0}
            title="The interlinear alignment as data: one row per aligned position, one column per inscription, with shared / near-match flags"
          >
            Export alignment CSV
          </button>
          <SaveFindingButton
            module="compare"
            moduleLabel="Compare Inscriptions"
            defaultTitle={findingTitle}
            summary={findingSummary}
            payload={{ ids }}
            reportFn={() => buildCompareReport(selected, alignment, sharedColor)}
          />
        </div>
      )}

      {savedComparisons.length > 0 && (
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
            Saved comparisons ({savedComparisons.length})
          </div>
          <FindingsPanel
            module="compare"
            onLoad={(f: Finding) => {
              const p = f.payload as { ids?: string[] } | undefined;
              if (p?.ids?.length) setIds(p.ids.slice(0, 4));
              toast(`Loaded “${f.title}”`);
            }}
          />
        </div>
      )}

      {selected.length === 0 && (
        <div className="card">
          <div className="dim">
            Pick an inscription above to begin. You can compare up to four.
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <>
          {selected.length === 1 && (
            <div className="dim" style={{ marginBottom: 12, fontSize: 12 }}>
              Showing one inscription. Add another above to align them side by
              side and highlight the words and signs they share.
            </div>
          )}
          {sharedColor.size > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  font: "600 10px var(--sans)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 6,
                }}
              >
                Shared words ({sharedColor.size})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {[...sharedColor.entries()].map(([w, color]) => (
                  <span
                    key={w}
                    style={{
                      background: color + "22",
                      border: `1px solid ${color}88`,
                      color,
                      padding: "2px 6px",
                      borderRadius: 3,
                      font: "500 11px var(--mono)",
                    }}
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {effectiveView === "interlinear" && (
            <div style={{ overflowX: "auto" }}>
              <table className="interlinear-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    {selected.map((ins) => (
                      <th
                        key={ins.id}
                        style={{
                          textAlign: "left",
                          verticalAlign: "top",
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--border-strong)",
                        }}
                      >
                        <button
                          className="word-link"
                          style={{ font: "600 13px var(--mono)" }}
                          onClick={() => showInscription(ins.id)}
                        >
                          {ins.id}
                        </button>
                        <div className="dim" style={{ fontSize: 10 }}>
                          {ins.site}
                          {ins.context && ` · ${ins.context}`}
                        </div>
                        <div className="dim" style={{ fontSize: 10 }}>
                          {ins.scribe || describeInscription(ins)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alignment.map((pos, ri) => {
                    const present = pos.filter((w): w is string => Boolean(w));
                    const isMatch =
                      present.length >= 2 && new Set(present).size === 1;
                    // Near matches within the row: distinct multi-sign words
                    // one sign-edit apart — candidate variants or copy slips
                    // sitting in the same aligned slot.
                    const near = new Set<string>();
                    if (!isMatch && present.length >= 2) {
                      const multi = [...new Set(present)].filter((w) =>
                        w.includes("-"),
                      );
                      for (let x = 0; x < multi.length; x++) {
                        for (let y = x + 1; y < multi.length; y++) {
                          if (
                            sequenceDistance(
                              multi[x].split("-"),
                              multi[y].split("-"),
                            ) === 1
                          ) {
                            near.add(multi[x]);
                            near.add(multi[y]);
                          }
                        }
                      }
                    }
                    return (
                      <tr
                        key={ri}
                        style={
                          isMatch
                            ? { background: "var(--surface-1)" }
                            : undefined
                        }
                      >
                        <td
                          className="dim"
                          style={{ fontSize: 9, textAlign: "right", padding: "2px 4px" }}
                        >
                          {ri + 1}
                        </td>
                        {pos.map((w, ci) => (
                          <td
                            key={ci}
                            style={{
                              padding: "2px 8px",
                              verticalAlign: "top",
                              borderLeft: "1px solid var(--border)",
                              ...(w && near.has(w)
                                ? {
                                    background: "#f0b14b14",
                                    outline: "1px dashed #f0b14b66",
                                    outlineOffset: -1,
                                  }
                                : {}),
                            }}
                            title={
                              w && near.has(w)
                                ? "Near match: one sign apart from the word aligned beside it — a candidate variant spelling or copy slip"
                                : undefined
                            }
                          >
                            <AlnCell word={w} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="dim" style={{ fontSize: 10, marginTop: 6 }}>
                Rows are aligned positions; a shaded row is where the same word
                lines up across columns; a{" "}
                <span
                  style={{
                    background: "#f0b14b14",
                    outline: "1px dashed #f0b14b66",
                    padding: "0 3px",
                  }}
                >
                  dashed amber
                </span>{" "}
                cell is one sign apart from its row-mate — a candidate variant
                or copy slip. <b>·</b> marks a gap (no word in that column at
                that position).
              </div>
            </div>
          )}

          {effectiveView === "columns" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))`,
              gap: 12,
            }}
          >
            {selected.map((ins) => (
              <div
                key={ins.id}
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: 12,
                  minWidth: 0,
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <button
                    className="word-link"
                    style={{ font: "600 14px var(--mono)" }}
                    onClick={() => showInscription(ins.id)}
                  >
                    {ins.id}
                  </button>
                  <div className="dim" style={{ fontSize: 10, marginTop: 2 }}>
                    {ins.site}
                    {ins.context && ` · ${ins.context}`}
                  </div>
                  <div className="dim" style={{ fontSize: 10 }}>
                    {describeInscription(ins)}
                  </div>
                </div>

                {ins.glyphs && (
                  <div style={{ marginBottom: 12 }}>
                    <GlyphRun glyphs={ins.glyphs} size={22} />
                  </div>
                )}

                <div
                  style={{
                    font: "600 9px var(--sans)",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    marginBottom: 4,
                  }}
                >
                  Transliteration
                </div>
                <div style={{ lineHeight: 1.8 }}>
                  {ins.words.map((w, i) => {
                    const color = sharedColor.get(w);
                    if (color) {
                      return (
                        <span
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            background: color + "22",
                            border: `1px solid ${color}88`,
                            color,
                            padding: "1px 5px",
                            borderRadius: 3,
                            margin: "0 2px 2px 0",
                            font: "500 11px var(--mono)",
                          }}
                        >
                          {glyphsOf(w)}
                          {w}
                        </span>
                      );
                    }
                    return <WordToken key={i} word={w} />;
                  })}
                </div>
              </div>
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}
