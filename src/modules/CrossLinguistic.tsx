import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkbench, getAllLanguages } from "../store/workbench";
import { useMultiWords } from "../lib/helpers";
import {
  alignPhonetic,
  phoneticDistance,
  wordToPhonetic,
  buildPhoneticClasses,
  referenceKey,
  describePhoneticScheme,
  DEFAULT_WEIGHTS,
  DEFAULT_PHONETIC_SCHEME,
  CONSERVATIVE_PHONETIC_SCHEME,
  type AlignCell,
  type AlignOp,
  type PhoneticWeights,
  type PhoneticScheme,
} from "../lib/algorithms";
import type { Confidence, MatchResult, ComparisonEntry } from "../lib/types";
import { languageLabel } from "../data/languages";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { WordAutocomplete } from "../components/WordAutocomplete";
import { useSort, SortHeader } from "../components/sort";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

// Render one column of an alignment as an inline-styled chip pair —
// Linear-A token on top, compared-language token below, color-coded by op.
function alignChipHtml(c: AlignCell): string {
  const palette: Record<AlignOp, { bg: string; fg: string }> = {
    match: { bg: "#3ddc9128", fg: "#16a34a" },
    "sub-vowel": { bg: "#f0b14b22", fg: "#b45309" },
    "sub-class": { bg: "#9b7cf022", fg: "#6d28d9" },
    "sub-far": { bg: "#ef5a5a18", fg: "#b91c1c" },
    ins: { bg: "#5b9eff14", fg: "#1d4ed8" },
    del: { bg: "#ffffff05", fg: "#9ca3af" },
  };
  const p = palette[c.op];
  return (
    `<span style="display:inline-flex;flex-direction:column;align-items:center;` +
    `min-width:22px;padding:1px 4px;margin-right:2px;background:${p.bg};` +
    `border:1px solid ${p.fg}33;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;">` +
    `<span>${esc(c.a || "·")}</span>` +
    `<span style="color:${p.fg};">${esc(c.b || "·")}</span>` +
    `</span>`
  );
}

function scoreClass(d: number) {
  if (d < 0.3) return "score-hi";
  if (d < 0.45) return "score-md";
  return "score-lo";
}

const OP_BG: Record<AlignOp, string> = {
  match: "#3ddc9128",
  "sub-vowel": "#f0b14b22",
  "sub-class": "#9b7cf022",
  "sub-far": "#ef5a5a18",
  ins: "#5b9eff14",
  del: "#ffffff05",
};
const OP_FG: Record<AlignOp, string> = {
  match: "var(--gn)",
  "sub-vowel": "var(--am)",
  "sub-class": "var(--pu)",
  "sub-far": "var(--rd)",
  ins: "var(--ac)",
  del: "var(--text-faint)",
};

export default function CrossLinguistic() {
  const hyp = useWorkbench((s) => s.hypothesis);
  const custom = useWorkbench((s) => s.customLanguages);
  const allLangs = useMemo(() => getAllLanguages(custom), [custom]);
  const words = useMultiWords();
  const upsertAnnotation = useWorkbench((s) => s.upsertAnnotation);
  const toast = useWorkbench((s) => s.toast_show);

  const [word, setWord] = useState(
    () => useWorkbench.getState().moduleIntent?.focus ?? "",
  );
  const [lang, setLang] = useState("");
  const [th, setTh] = useState(0.55);
  const [weights, setWeights] = useState<PhoneticWeights>({
    ...DEFAULT_WEIGHTS,
  });
  // Researcher-configurable phonetic class scheme (the genuinely-ambiguous
  // groupings). Default reproduces the audited behavior exactly.
  const [scheme, setScheme] = useState<PhoneticScheme>({
    ...DEFAULT_PHONETIC_SCHEME,
  });
  const classes = useMemo(() => buildPhoneticClasses(scheme), [scheme]);
  // Comparison key for a reference entry, honoring the strip-notation toggle.
  // Fast path: the precomputed `.p` is already the strip-on key, so we only
  // recompute when the researcher turns stripping off.
  const refKey = useCallback(
    (e: ComparisonEntry) =>
      scheme.stripNotation
        ? (e.p ?? referenceKey(e.w, true))
        : referenceKey(e.w, false),
    [scheme.stripNotation],
  );
  // Provenance string stamped into saved findings/reports so a match ranking
  // is reproducible — it records the exact weights, threshold, and phonetic
  // scheme the ranking was produced under.
  const provenance = useMemo(
    () =>
      `weights v${weights.vowel.toFixed(2)}/c${weights.sameClass.toFixed(2)}/` +
      `f${weights.far.toFixed(2)}/i${weights.indel.toFixed(2)}, ` +
      `threshold ${th.toFixed(2)}; scheme: ${describePhoneticScheme(scheme)}`,
    [weights, th, scheme],
  );
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [bulk, setBulk] = useState<
    { la: string; count: number; match: MatchResult }[] | null
  >(null);
  // Honor a deep-link intent from the Help system (e.g. "open with the
  // alignment matrix selected"). Read once at mount via getState so we
  // don't subscribe to intent changes.
  const initialIntent = useWorkbench.getState().moduleIntent;
  const [view, setView] = useState<"ranked" | "matrix">(
    initialIntent?.tab === "matrix" ? "matrix" : "ranked",
  );

  // Opened with a focused word (e.g. "Open in Cross-Linguistic" from a word's
  // detail)? Pre-fill it and run the comparison immediately.
  useEffect(() => {
    if (initialIntent?.focus) single(initialIntent.focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function single(override?: string) {
    const upper = (override ?? word).toUpperCase().trim();
    if (!upper) return;
    const ph = wordToPhonetic(upper, hyp);
    const rows: MatchResult[] = [];
    const langs = lang ? { [lang]: allLangs[lang] } : allLangs;
    for (const [ln, entries] of Object.entries(langs)) {
      if (!entries) continue;
      for (const e of entries) {
        const key = refKey(e);
        const d = phoneticDistance(ph, key, weights, classes);
        if (d <= th)
          rows.push({
            word: e.w,
            meaning: e.m,
            domain: e.d,
            lang: ln,
            dist: d,
            linearPhonetic: ph,
            comparePhonetic: key,
          });
      }
    }
    rows.sort((a, b) => a.dist - b.dist);
    setMatches(rows);
    setBulk(null);
  }

  // For matrix view: best match in EACH reference language
  const matrixRows = useMemo(() => {
    if (view !== "matrix") return null;
    const w = word.toUpperCase().trim();
    if (!w) return [];
    const ph = wordToPhonetic(w, hyp);
    const rows: {
      lang: string;
      match: { word: string; meaning: string; domain: string; phon: string };
      dist: number;
      cells: AlignCell[];
    }[] = [];
    for (const [ln, entries] of Object.entries(allLangs)) {
      let best: {
        word: string;
        meaning: string;
        domain: string;
        phon: string;
        dist: number;
      } | null = null;
      for (const e of entries) {
        const key = refKey(e);
        const d = phoneticDistance(ph, key, weights, classes);
        if (!best || d < best.dist)
          best = { word: e.w, meaning: e.m, domain: e.d, phon: key, dist: d };
      }
      if (best) {
        rows.push({
          lang: ln,
          match: best,
          dist: best.dist,
          cells: alignPhonetic(ph, best.phon, weights, classes),
        });
      }
    }
    rows.sort((a, b) => a.dist - b.dist);
    return rows;
  }, [view, word, hyp, allLangs, weights, classes, refKey]);

  // One sort hook per table. Default direction is "desc" with score-based
  // accessors returning (1 - dist), so the highest-score rows naturally land
  // at the top and the visual ▾ indicator means "best first".
  const matrixSort = useSort("score", "desc");
  const rankedSort = useSort("score", "desc");
  const bulkSort = useSort("score", "desc");

  const sortedMatrixRows = useMemo(
    () =>
      matrixRows
        ? matrixSort.sortRows(matrixRows, {
            language: (r) => languageLabel(r.lang),
            score: (r) => 1 - r.dist,
            match: (r) => r.match.word,
            meaning: (r) => r.match.meaning,
          })
        : null,
    [matrixRows, matrixSort],
  );
  const sortedMatches = useMemo(
    () =>
      matches
        ? rankedSort.sortRows(matches, {
            score: (m) => 1 - m.dist,
            word: (m) => m.word,
            language: (m) => languageLabel(m.lang),
            meaning: (m) => m.meaning,
            domain: (m) => m.domain,
            phonetic: (m) => m.comparePhonetic,
          })
        : null,
    [matches, rankedSort],
  );
  const sortedBulk = useMemo(
    () =>
      bulk
        ? bulkSort.sortRows(bulk, {
            linearA: (r) => r.la,
            freq: (r) => r.count,
            score: (r) => 1 - r.match.dist,
            match: (r) => r.match.word,
            language: (r) => languageLabel(r.match.lang),
            meaning: (r) => r.match.meaning,
          })
        : null,
    [bulk, bulkSort],
  );

  function runBulk() {
    const langs = lang ? { [lang]: allLangs[lang] } : allLangs;
    const top = words.slice(0, 50);
    const out: { la: string; count: number; match: MatchResult }[] = [];
    for (const { word: w, entry } of top) {
      const ph = wordToPhonetic(w, hyp);
      let best: MatchResult | null = null;
      for (const [ln, entries] of Object.entries(langs)) {
        if (!entries) continue;
        for (const e of entries) {
          const key = refKey(e);
          const d = phoneticDistance(ph, key, weights, classes);
          if (d <= th && (!best || d < best.dist))
            best = {
              word: e.w,
              meaning: e.m,
              domain: e.d,
              lang: ln,
              dist: d,
              linearPhonetic: ph,
              comparePhonetic: key,
            };
        }
      }
      if (best) out.push({ la: w, count: entry.count, match: best });
    }
    out.sort((a, b) => a.match.dist - b.match.dist);
    setBulk(out);
    setMatches(null);
  }

  // Re-run the active ranked/bulk computation live as the weights, threshold,
  // or phonetic scheme change, so the controls feel dynamic. (The matrix view
  // is already a memo keyed on the same inputs.)
  useEffect(() => {
    if (matches) single();
    else if (bulk) runBulk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights, th, scheme]);

  // Confidence scales with phonetic closeness of the match.
  function confFromDist(d: number): Confidence {
    return d < 0.3 ? "high" : d < 0.5 ? "medium" : "low";
  }
  // One-click: record a comparison match as the proposed-meaning annotation on
  // the Linear A word, citing the source language/word/score. Flows into the
  // Annotations list and Research Report like any other hypothesis.
  function saveMatch(
    la: string,
    m: { word: string; meaning: string; lang: string; dist: number },
  ) {
    const laU = la.toUpperCase().trim();
    if (!laU || !m.meaning) return;
    upsertAnnotation(
      { kind: "word", value: laU },
      {
        proposedMeaning: m.meaning,
        confidence: confFromDist(m.dist),
        notes: `cf. ${languageLabel(m.lang)} "${m.word}" — ${m.meaning} (phonetic match ${(
          (1 - m.dist) *
          100
        ).toFixed(0)}%)`,
      },
    );
    toast(`Saved “${m.meaning}” as a hypothesis for ${laU}`);
  }

  return (
    <div className="panel">
      <h2>Cross-Linguistic Comparator</h2>
      <div className="callout">
        <h4>Phonetic distance matcher</h4>
        <p>
          Compares Linear A phonetic readings against {Object.keys(allLangs).length}{" "}
          reference languages by weighted phonetic edit distance. Tune the
          substitution / indel costs and the match threshold with the{" "}
          <b>Tuning</b> sliders below — results re-rank live (defaults: vowel
          0.30, same-class consonant 0.50, far 1.0). Active sign overrides from{" "}
          <code>Sound Shift</code> are applied.
        </p>
        <p
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px dashed var(--border)",
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--text-dim)",
            fontWeight: 700,
          }}
        >
          <b style={{ color: "var(--am)" }}>Read this before trusting a match.</b>{" "}
          Linear A is undeciphered. Sign phonetic values follow the Linear B
          convention for AB-shared signs — a working assumption, not a fact —
          and the bundled reference wordlists are short editorial samples
          (~340 entries total) that have <b>not</b> been peer-reviewed by
          specialists in each language. Mycenaean Greek is the only genuinely
          apples-to-apples comparison (same syllabic values); the rest are
          phonetic systems being forced into a common edit-distance metric.
          Treat ranked matches as exploratory leads against a noisy null
          model, not as evidence of language affinity. The full methodology
          and limitations are in the{" "}
          <a
            href="#cross-linguistic-distance"
            onClick={(e) => {
              e.preventDefault();
              useWorkbench
                .getState()
                .setActiveModule("methodology", { focus: "cross-linguistic-distance" });
            }}
            style={{ color: "var(--ac)", cursor: "pointer" }}
          >
            Methodology
          </a>{" "}
          page.
        </p>
      </div>
      <div className="tab-row">
        <button
          className={`tab-btn${view === "ranked" ? " active" : ""}`}
          onClick={() => setView("ranked")}
        >
          Ranked matches
        </button>
        <button
          className={`tab-btn${view === "matrix" ? " active" : ""}`}
          onClick={() => setView("matrix")}
        >
          Alignment matrix
        </button>
      </div>
      <div className="toolbar">
        <WordAutocomplete
          value={word}
          onChange={setWord}
          onSelect={(w) => {
            setWord(w);
            if (view === "ranked") single(w);
          }}
          placeholder="Enter Linear A word (e.g. KU-RO)…"
          style={{ flex: 2 }}
        />
        <select
          className="select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="">All languages</option>
          {Object.keys(allLangs).map((l) => (
            <option key={l} value={l}>
              {languageLabel(l)}
            </option>
          ))}
        </select>
        {view === "ranked" && (
          <>
            <button className="btn" onClick={() => single()}>
              Compare
            </button>
            <button className="btn btn-secondary" onClick={runBulk}>
              Bulk (top 50)
            </button>
          </>
        )}
      </div>

      <div
        className="toolbar"
        style={{ flexWrap: "wrap", gap: 14, fontSize: 11 }}
      >
        <span
          className="dim"
          style={{
            font: "600 9px var(--sans)",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Tuning
        </span>
        {(
          [
            ["vowel", "vowel↔vowel", "Cost of substituting one vowel for another (lower = treat vowel shifts as cheap)"],
            ["sameClass", "same-class cons.", "Cost of substituting a consonant for one in the same articulatory class"],
            ["far", "far sub.", "Cost of any other (unrelated) substitution"],
            ["indel", "insert/delete", "Cost of inserting or deleting a phoneme"],
          ] as const
        ).map(([key, label, title]) => (
          <label
            key={key}
            className="dim"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title={title}
          >
            {label}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weights[key]}
              onChange={(e) =>
                setWeights((w) => ({ ...w, [key]: +e.target.value }))
              }
              style={{ width: 84 }}
            />
            <span style={{ fontFamily: "var(--mono)", minWidth: 26 }}>
              {weights[key].toFixed(2)}
            </span>
          </label>
        ))}
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Maximum distance for a row to count as a match (higher = more, looser matches)"
        >
          threshold
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={th}
            onChange={(e) => setTh(+e.target.value)}
            style={{ width: 84 }}
          />
          <span style={{ fontFamily: "var(--mono)", minWidth: 26 }}>
            {th.toFixed(2)}
          </span>
        </label>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            setWeights({ ...DEFAULT_WEIGHTS });
            setTh(0.55);
            setScheme({ ...DEFAULT_PHONETIC_SCHEME });
          }}
          title="Restore default weights, threshold, and phonetic scheme"
        >
          Reset
        </button>
      </div>

      <PhoneticSchemeControls scheme={scheme} setScheme={setScheme} />

      {view === "matrix" && matrixRows && word && (
        <>
          <div
            style={{
              margin: "8px 0",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>
              <b>{word.toUpperCase()}</b> →{" "}
              <span className="dim">
                /{wordToPhonetic(word.toUpperCase(), hyp)}/
              </span>
            </span>
            <span style={{ flex: 1 }} />
            <SaveFindingButton
              module="comp"
              moduleLabel="Cross-Linguistic"
              defaultTitle={`Cross-linguistic: ${word.toUpperCase()} (matrix)`}
              summary={
                `${word.toUpperCase()} → /${wordToPhonetic(word.toUpperCase(), hyp)}/. Best match per language: ` +
                (matrixRows
                  .slice(0, 6)
                  .map(
                    (r) =>
                      `${languageLabel(r.lang)} ${r.match.word} (${((1 - r.dist) * 100).toFixed(0)}%)`,
                  )
                  .join("; ") || "none") +
                `. [${provenance}]`
              }
              payload={{ word: word.toUpperCase() }}
              reportFn={() => {
                type R = (typeof matrixRows)[number];
                const cols: SnippetColumn<R>[] = [
                  {
                    label: "Language",
                    render: (r) => esc(languageLabel(r.lang)),
                  },
                  {
                    label: "Score",
                    render: (r) =>
                      `<b>${((1 - r.dist) * 100).toFixed(0)}%</b>`,
                    align: "right",
                  },
                  { label: "Match", render: (r) => `<code>${esc(r.match.word)}</code> <span style="color:#6b7280;font-size:10px;">${esc(r.match.domain)}</span>` },
                  { label: "Meaning", render: (r) => esc(r.match.meaning) },
                  {
                    label: "Alignment",
                    render: (r) =>
                      `<span style="display:inline-flex;">${r.cells.map(alignChipHtml).join("")}</span>`,
                    md: (r) =>
                      r.cells
                        .map((c) => `${c.a || "·"}/${c.b || "·"}`)
                        .join(" "),
                  },
                ];
                const meta = `${word.toUpperCase()} → /${wordToPhonetic(word.toUpperCase(), hyp)}/ · best match per language (${matrixRows.length}). ${provenance}`;
                const html = snippetWrap(meta, snippetTable(matrixRows, cols));
                const markdown = `_${meta}_\n\n` + snippetTableMd(matrixRows, cols);
                return { html, markdown };
              }}
            />
          </div>
          <div className="dim" style={{ fontSize: 10, marginBottom: 8 }}>
            <span
              style={{ background: OP_BG.match, color: OP_FG.match, padding: "1px 4px", borderRadius: 2 }}
            >
              exact
            </span>{" "}
            <span
              style={{
                background: OP_BG["sub-vowel"],
                color: OP_FG["sub-vowel"],
                padding: "1px 4px",
                borderRadius: 2,
              }}
            >
              vowel shift
            </span>{" "}
            <span
              style={{
                background: OP_BG["sub-class"],
                color: OP_FG["sub-class"],
                padding: "1px 4px",
                borderRadius: 2,
              }}
            >
              same-class consonant
            </span>{" "}
            <span
              style={{
                background: OP_BG["sub-far"],
                color: OP_FG["sub-far"],
                padding: "1px 4px",
                borderRadius: 2,
              }}
            >
              far substitution
            </span>{" "}
            <span
              style={{
                background: OP_BG.ins,
                color: OP_FG.ins,
                padding: "1px 4px",
                borderRadius: 2,
              }}
            >
              insertion
            </span>{" "}
            <span
              style={{
                background: OP_BG.del,
                color: OP_FG.del,
                padding: "1px 4px",
                borderRadius: 2,
              }}
            >
              deletion
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortHeader label="Language" sortKey="language" sort={matrixSort.sort} onToggle={matrixSort.toggle} />
                  <SortHeader label="Score" sortKey="score" sort={matrixSort.sort} onToggle={matrixSort.toggle} title="Sort by phonetic-similarity score (higher = better)" />
                  <SortHeader label="Match" sortKey="match" sort={matrixSort.sort} onToggle={matrixSort.toggle} />
                  <SortHeader label="Meaning" sortKey="meaning" sort={matrixSort.sort} onToggle={matrixSort.toggle} />
                  <th></th>
                  <th>Position-by-position alignment</th>
                </tr>
              </thead>
              <tbody>
                {(sortedMatrixRows ?? matrixRows).map((r) => (
                  <tr key={r.lang}>
                    <td className="site-text">{languageLabel(r.lang)}</td>
                    <td>
                      <span className={`score ${scoreClass(r.dist)}`}>
                        {((1 - r.dist) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td>
                      <b>{r.match.word}</b>{" "}
                      <span className="tag tag-domain">{r.match.domain}</span>
                    </td>
                    <td>{r.match.meaning}</td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          saveMatch(word, {
                            word: r.match.word,
                            meaning: r.match.meaning,
                            lang: r.lang,
                            dist: r.dist,
                          })
                        }
                        title={`Record “${r.match.meaning}” as your proposed meaning for ${word.toUpperCase()}`}
                      >
                        ✎ Use
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", gap: 2 }}>
                        {r.cells.map((c, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              minWidth: 22,
                              alignItems: "center",
                              padding: "2px 4px",
                              background: OP_BG[c.op],
                              border: `1px solid ${OP_FG[c.op]}33`,
                              borderRadius: 3,
                              fontFamily: "var(--mono)",
                              fontSize: 11,
                            }}
                            title={c.op}
                          >
                            <span style={{ color: "var(--text)" }}>
                              {c.a || "·"}
                            </span>
                            <span
                              style={{
                                color: OP_FG[c.op],
                                fontSize: 10,
                              }}
                            >
                              {c.b || "·"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {matches && (
        <>
          <div
            style={{
              margin: "8px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>
              <b>{word.toUpperCase()}</b> → /
              {wordToPhonetic(word.toUpperCase(), hyp)}/ — {matches.length}{" "}
              matches
            </span>
            <span style={{ flex: 1 }} />
            <SaveFindingButton
              module="comp"
              moduleLabel="Cross-Linguistic"
              defaultTitle={`Cross-linguistic: ${word.toUpperCase()}`}
              summary={
                `${word.toUpperCase()} → /${wordToPhonetic(word.toUpperCase(), hyp)}/. Top matches: ` +
                (matches
                  .slice(0, 6)
                  .map(
                    (m) =>
                      `${m.word} (${languageLabel(m.lang)}, ${m.meaning}, ${((1 - m.dist) * 100).toFixed(0)}%)`,
                  )
                  .join("; ") || "none") +
                `. [${provenance}]`
              }
              payload={{ word: word.toUpperCase() }}
              reportFn={() => {
                const cap = 50;
                const slice = matches.slice(0, cap);
                const cols: SnippetColumn<(typeof slice)[number]>[] = [
                  {
                    label: "Score",
                    render: (m) => `<b>${((1 - m.dist) * 100).toFixed(0)}%</b>`,
                    align: "right",
                  },
                  { label: "Word", render: (m) => `<code>${esc(m.word)}</code>` },
                  { label: "Language", render: (m) => esc(languageLabel(m.lang)) },
                  { label: "Meaning", render: (m) => esc(m.meaning) },
                  {
                    label: "Domain",
                    render: (m) =>
                      `<span style="color:#6b7280;font-size:10px;">${esc(m.domain)}</span>`,
                  },
                  {
                    label: "Phonetic",
                    render: (m) =>
                      `<span style="color:#6b7280;">/${esc(m.comparePhonetic)}/</span>`,
                  },
                ];
                const meta = `${word.toUpperCase()} → /${wordToPhonetic(word.toUpperCase(), hyp)}/ · ${matches.length} matches${slice.length === matches.length ? " (all shown)" : `, showing top ${cap}`}. ${provenance}`;
                const html = snippetWrap(meta, snippetTable(slice, cols));
                const markdown = `_${meta}_\n\n` + snippetTableMd(slice, cols);
                return { html, markdown };
              }}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortHeader label="Score" sortKey="score" sort={rankedSort.sort} onToggle={rankedSort.toggle} title="Sort by phonetic-similarity score (higher = better)" />
                  <SortHeader label="Word" sortKey="word" sort={rankedSort.sort} onToggle={rankedSort.toggle} />
                  <SortHeader label="Language" sortKey="language" sort={rankedSort.sort} onToggle={rankedSort.toggle} />
                  <SortHeader label="Meaning" sortKey="meaning" sort={rankedSort.sort} onToggle={rankedSort.toggle} />
                  <SortHeader label="Domain" sortKey="domain" sort={rankedSort.sort} onToggle={rankedSort.toggle} />
                  <SortHeader label="Phonetic" sortKey="phonetic" sort={rankedSort.sort} onToggle={rankedSort.toggle} title="Sort by the comparison-language phonetic form" />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(sortedMatches ?? matches).map((m, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`score ${scoreClass(m.dist)}`}>
                        {((1 - m.dist) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td>
                      <b>{m.word}</b>
                    </td>
                    <td className="site-text">{languageLabel(m.lang)}</td>
                    <td>{m.meaning}</td>
                    <td>
                      <span className="tag tag-domain">{m.domain}</span>
                    </td>
                    <td className="dim">
                      {m.linearPhonetic} ↔ {m.comparePhonetic}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => saveMatch(word, m)}
                        title={`Record “${m.meaning}” as your proposed meaning for ${word.toUpperCase()}`}
                      >
                        ✎ Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {bulk && (
        <>
          <div style={{ margin: "8px 0" }}>{bulk.length} matches from top 50 words</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortHeader label="Linear A" sortKey="linearA" sort={bulkSort.sort} onToggle={bulkSort.toggle} />
                  <SortHeader label="Freq" sortKey="freq" sort={bulkSort.sort} onToggle={bulkSort.toggle} title="Sort by corpus attestation count" />
                  <SortHeader label="Score" sortKey="score" sort={bulkSort.sort} onToggle={bulkSort.toggle} title="Sort by phonetic-similarity score (higher = better)" />
                  <SortHeader label="Match" sortKey="match" sort={bulkSort.sort} onToggle={bulkSort.toggle} />
                  <SortHeader label="Language" sortKey="language" sort={bulkSort.sort} onToggle={bulkSort.toggle} />
                  <SortHeader label="Meaning" sortKey="meaning" sort={bulkSort.sort} onToggle={bulkSort.toggle} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(sortedBulk ?? bulk).map((r) => (
                  <tr key={r.la}>
                    <td>
                      <WordToken word={r.la} />
                    </td>
                    <td className="numeral">{r.count}</td>
                    <td>
                      <span className={`score ${scoreClass(r.match.dist)}`}>
                        {((1 - r.match.dist) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td>
                      <b>{r.match.word}</b>
                    </td>
                    <td className="site-text">{languageLabel(r.match.lang)}</td>
                    <td>
                      {r.match.meaning}{" "}
                      <span className="tag tag-domain">{r.match.domain}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => saveMatch(r.la, r.match)}
                        title={`Record “${r.match.meaning}” as your proposed meaning for ${r.la}`}
                      >
                        ✎ Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Researcher-facing controls for the four genuinely-ambiguous phoneme
// groupings. Defaults reproduce the audited behavior; a linguist who
// disagrees with a grouping can re-rank live. Lives inline in the module
// (next to the weight sliders) rather than in a separate settings surface.
function PhoneticSchemeControls({
  scheme,
  setScheme,
}: {
  scheme: PhoneticScheme;
  setScheme: (s: PhoneticScheme) => void;
}) {
  const [open, setOpen] = useState(false);
  const isDefault =
    describePhoneticScheme(scheme) ===
    describePhoneticScheme(DEFAULT_PHONETIC_SCHEME);
  const isConservative =
    describePhoneticScheme(scheme) ===
    describePhoneticScheme(CONSERVATIVE_PHONETIC_SCHEME);
  const presetLabel = isDefault
    ? "Extended (default)"
    : isConservative
      ? "Conservative"
      : "Custom";

  return (
    <div
      style={{
        margin: "4px 0 8px",
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--surface-0)",
        fontSize: 12,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "6px 10px",
          background: "transparent",
          border: "none",
          color: "var(--text-dim)",
          cursor: "pointer",
          font: "inherit",
        }}
        title="Choose how the genuinely-ambiguous phonemes are grouped for the distance metric"
      >
        <span style={{ transform: open ? "rotate(90deg)" : "none" }}>▸</span>
        <b style={{ color: "var(--text)" }}>Phonetic scheme</b>
        <span
          style={{
            font: "11px var(--mono)",
            padding: "1px 6px",
            borderRadius: 10,
            background: isDefault ? "var(--surface-1)" : "var(--ac-soft)",
            color: isDefault ? "var(--text-dim)" : "var(--ac)",
            border: `1px solid ${isDefault ? "var(--border)" : "var(--ac)"}`,
          }}
        >
          {presetLabel}
        </span>
        <span style={{ flex: 1 }} />
        <span className="dim" style={{ fontSize: 11 }}>
          {open ? "hide" : "how phonemes are grouped"}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "4px 12px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <p className="dim" style={{ margin: "2px 0 4px", lineHeight: 1.5 }}>
            A few cross-language sound correspondences are genuine judgment
            calls rather than settled facts. The defaults are linguistically
            defensible starting points — change any of them to see how the
            match rankings shift. These settings affect only this module's
            distance and alignment, and the scheme you choose is recorded
            alongside anything you save.
          </p>

          <SchemeRow
            label="Interdentals ṯ ḏ (θ/ð)"
            hint="Where these dental fricatives get near-miss credit"
            value={scheme.interdentals}
            onChange={(v) =>
              setScheme({ ...scheme, interdentals: v as PhoneticScheme["interdentals"] })
            }
            options={[
              ["dental", "Dental stops {t,d}"],
              ["sibilant", "Sibilants {s,z,š}"],
              ["off", "Full mismatch"],
            ]}
          />
          <SchemeRow
            label="Pharyngeal ḥ"
            hint="The pharyngeal fricative ḥ (Semitic)"
            value={scheme.pharyngealH}
            onChange={(v) =>
              setScheme({ ...scheme, pharyngealH: v as PhoneticScheme["pharyngealH"] })
            }
            options={[
              ["velar", "Velars {k,g,q,…}"],
              ["off", "Full mismatch"],
            ]}
          />
          <SchemeRow
            label="Voiced postalveolar ž"
            hint="The voiced counterpart of š"
            value={scheme.voicedPostalveolar}
            onChange={(v) =>
              setScheme({
                ...scheme,
                voicedPostalveolar: v as PhoneticScheme["voicedPostalveolar"],
              })
            }
            options={[
              ["sibilant", "Sibilants {s,z,š,ṣ}"],
              ["off", "Full mismatch"],
            ]}
          />

          <label
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            title="Strip reconstruction asterisks, PIE subscripts, ʷ/ʰ modifiers, and the syllabic ring from reference forms before comparing (e.g. *ǵʰésr̥ → ǵésr)"
          >
            <input
              type="checkbox"
              checked={scheme.stripNotation}
              onChange={(e) =>
                setScheme({ ...scheme, stripNotation: e.target.checked })
              }
            />
            <span>
              Strip reconstruction / notation marks (<code>* ₁₂₃ ʷ ʰ ◌̥</code>)
              from reference forms
            </span>
          </label>

          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setScheme({ ...DEFAULT_PHONETIC_SCHEME })}
              disabled={isDefault}
              title="The default groupings: each ambiguous phoneme gets near-miss credit with its nearest articulatory neighbor"
            >
              Extended (default)
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setScheme({ ...CONSERVATIVE_PHONETIC_SCHEME })}
              disabled={isConservative}
              title="Grant no near-miss credit beyond the core classes — every ambiguous phoneme scores as a full mismatch"
            >
              Conservative
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SchemeRow({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
      title={hint}
    >
      <span style={{ minWidth: 168, fontFamily: "var(--mono)", fontSize: 11 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        {options.map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => onChange(val)}
            style={{
              font: "11px var(--sans)",
              padding: "2px 8px",
              borderRadius: 12,
              border: `1px solid ${value === val ? "var(--ac)" : "var(--border)"}`,
              background: value === val ? "var(--ac)" : "transparent",
              color: value === val ? "var(--bg)" : "var(--text-dim)",
              cursor: "pointer",
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
