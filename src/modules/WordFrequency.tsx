import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import {
  isScopeActive,
  scopeSummary,
  useScopedCorpus,
  useScopedMultiWords,
} from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { wordToPhonetic, griesDP, keynessG2 } from "../lib/algorithms";
import { anchorGloss } from "../lib/anchors";
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

const DISPLAY_CAP = 500;

export default function WordFrequency() {
  const words = useScopedMultiWords();
  const hyp = useWorkbench((s) => s.hypothesis);
  const scope = useWorkbench((s) => s.scope);
  const fullWordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const scoped = useScopedCorpus();
  const sites = scoped.siteIndex.size;
  const scopeOn = isScopeActive(scope);
  const [q, setQ] = useState("");
  const [minCount, setMinCount] = useState(1);
  const [minSites, setMinSites] = useState(1);
  const [minLen, setMinLen] = useState(1);
  const [hapaxOnly, setHapaxOnly] = useState(false);
  const [anchorsOnly, setAnchorsOnly] = useState(false);
  const { sort, toggle, sortRows } = useSort("count", "desc");

  const hapax = useMemo(
    () => words.filter((w) => w.entry.count === 1).length,
    [words],
  );
  // Global maximum (words arrives sorted by count desc) for the distribution bar.
  const max = words[0]?.entry.count || 1;

  // Dispersion (Gries' DP) over find-sites: per-word per-site occurrence
  // counts plus each site's multi-sign token total. 0 = the word is spread
  // exactly as the site sizes predict; near 1 = concentrated in one place.
  const dispersion = useMemo(() => {
    const siteTotals = new Map<string, number>();
    const wordSiteCounts = new Map<string, Map<string, number>>();
    for (const ins of scoped.inscriptions) {
      if (!ins.site) continue;
      for (const w of ins.words) {
        if (!w.includes("-")) continue;
        siteTotals.set(ins.site, (siteTotals.get(ins.site) ?? 0) + 1);
        let m = wordSiteCounts.get(w);
        if (!m) {
          m = new Map();
          wordSiteCounts.set(w, m);
        }
        m.set(ins.site, (m.get(ins.site) ?? 0) + 1);
      }
    }
    const siteNames = [...siteTotals.keys()];
    const partSizes = siteNames.map((s) => siteTotals.get(s)!);
    const dp = new Map<string, number>();
    for (const [w, m] of wordSiteCounts) {
      dp.set(
        w,
        griesDP(
          siteNames.map((s) => m.get(s) ?? 0),
          partSizes,
        ),
      );
    }
    return dp;
  }, [scoped.inscriptions]);

  // Keyness vs the rest of the corpus — only meaningful while a Scope is
  // active. Signed G²: + over-represented in the scope, − depleted.
  const keyness = useMemo(() => {
    if (!scopeOn) return null;
    let scopeTokens = 0;
    for (const { entry } of words) scopeTokens += entry.count;
    let corpusTokens = 0;
    for (const [w, e] of fullWordIndex)
      if (w.includes("-")) corpusTokens += e.count;
    const restTokens = corpusTokens - scopeTokens;
    if (restTokens <= 0) return null;
    const m = new Map<string, number>();
    for (const { word, entry } of words) {
      const inScope = entry.count;
      const outside = (fullWordIndex.get(word)?.count ?? inScope) - inScope;
      const g2 = keynessG2(inScope, scopeTokens, outside, restTokens);
      const rate = inScope / scopeTokens;
      const restRate = outside / restTokens;
      m.set(word, rate >= restRate ? g2 : -g2);
    }
    return m;
  }, [scopeOn, words, fullWordIndex]);

  const filtered = useMemo(() => {
    const upper = q.toUpperCase();
    return words.filter((t) => {
      if (upper && !t.word.toUpperCase().includes(upper)) return false;
      if (hapaxOnly && t.entry.count !== 1) return false;
      if (anchorsOnly && !anchorGloss(t.word)) return false;
      if (t.entry.count < minCount) return false;
      if (t.entry.sites.size < minSites) return false;
      if (t.word.split("-").length < minLen) return false;
      return true;
    });
  }, [words, q, minCount, minSites, minLen, hapaxOnly, anchorsOnly]);

  const sorted = sortRows(filtered, {
    count: (t) => t.entry.count,
    word: (t) => t.word,
    sites: (t) => t.entry.sites.size,
    length: (t) => t.word.split("-").length,
    dp: (t) => dispersion.get(t.word) ?? 0,
    keyness: (t) => keyness?.get(t.word) ?? 0,
  });
  const display = sorted.slice(0, DISPLAY_CAP);

  const filterDesc = [
    q && `“${q}”`,
    minCount > 1 && `count ≥ ${minCount}`,
    minSites > 1 && `sites ≥ ${minSites}`,
    minLen > 1 && `≥ ${minLen} signs`,
    hapaxOnly && "hapax only",
    anchorsOnly && "anchors only",
  ]
    .filter(Boolean)
    .join(", ");
  const findingTitle = filterDesc
    ? `Word frequency — ${filterDesc}`
    : "Word frequency";
  const findingSummary =
    `${filtered.length} of ${words.length} words` +
    (filterDesc ? ` matching ${filterDesc}` : "") +
    ` · ${hapax} hapax overall · max freq ${max}.\nTop: ` +
    (sorted
      .slice(0, 8)
      .map((w) => `${w.word} (${w.entry.count})`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        "rank",
        "word",
        "phonetic",
        "count",
        "distinct_sites",
        "signs",
        "dispersion_dp",
        ...(keyness ? ["keyness_g2"] : []),
        "anchor",
      ],
    ];
    sorted.forEach((t, i) => {
      rows.push([
        i + 1,
        t.word,
        wordToPhonetic(t.word, hyp),
        t.entry.count,
        t.entry.sites.size,
        t.word.split("-").length,
        (dispersion.get(t.word) ?? 0).toFixed(3),
        ...(keyness ? [(keyness.get(t.word) ?? 0).toFixed(3)] : []),
        anchorGloss(t.word) ?? "",
      ]);
    });
    downloadFile(
      "linear_a_word_frequency.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  const numStyle = { width: 56, fontSize: 11, padding: "3px 6px" } as const;

  return (
    <div className="panel">
      <h2>Word Frequency</h2>
      <p className="panel-desc">
        All multi-sign words with attestation count and distribution across
        sites. Filter by count, site spread, length, hapax, or anchor status
        (words with a conventional reading or formulaic role); click a column
        to sort. <b>DP</b> is Gries' dispersion — frequent <em>and</em>{" "}
        evenly-spread words are corpus-wide vocabulary, frequent-but-
        concentrated ones are local. With a Scope active, a{" "}
        <b>Keyness G²</b> column ranks what is over- or under-represented in
        the scope versus the rest of the corpus.
      </p>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{words.length}</span>
          <span className="lbl">Unique words</span>
        </div>
        <div className="stat-box">
          <span className="val">{hapax}</span>
          <span className="lbl">Hapax legomena</span>
        </div>
        <div className="stat-box">
          <span className="val">{max}</span>
          <span className="lbl">Max frequency</span>
        </div>
        <div className="stat-box">
          <span className="val">{sites}</span>
          <span className="lbl">Sites</span>
        </div>
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter words…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 140 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum attestation count"
        >
          count ≥
          <input
            type="number"
            className="input"
            min={1}
            value={minCount}
            onChange={(e) => setMinCount(Math.max(1, +e.target.value || 1))}
            style={numStyle}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum number of distinct find-sites"
        >
          sites ≥
          <input
            type="number"
            className="input"
            min={1}
            value={minSites}
            onChange={(e) => setMinSites(Math.max(1, +e.target.value || 1))}
            style={numStyle}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum number of signs (word length)"
        >
          signs ≥
          <input
            type="number"
            className="input"
            min={1}
            value={minLen}
            onChange={(e) => setMinLen(Math.max(1, +e.target.value || 1))}
            style={numStyle}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Show only words attested exactly once"
        >
          <input
            type="checkbox"
            checked={hapaxOnly}
            onChange={(e) => setHapaxOnly(e.target.checked)}
          />
          hapax
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Show only anchor vocabulary — words with a conventional reading (KU-RO 'total', KI-RO 'deficit', …) or an agreed formulaic role (the libation-formula constituents)"
        >
          <input
            type="checkbox"
            checked={anchorsOnly}
            onChange={(e) => setAnchorsOnly(e.target.checked)}
          />
          anchors
        </label>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="freq"
          moduleLabel="Word Frequency"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ q, minCount, minSites, minLen, hapaxOnly }}
          reportFn={() => {
            const cap = 100;
            const ranked = sorted.slice(0, cap).map((t, i) => ({
              rank: i + 1,
              word: t.word,
              phonetic: wordToPhonetic(t.word, hyp),
              count: t.entry.count,
              sites: t.entry.sites.size,
              signs: t.word.split("-").length,
              dp: dispersion.get(t.word),
              keyness: keyness?.get(t.word),
            }));
            const cols: SnippetColumn<(typeof ranked)[number]>[] = [
              { label: "#", render: (r) => `<span style="color:#6b7280;">${r.rank}</span>`, align: "right" },
              { label: "Word", render: (r) => `<code>${esc(r.word)}</code>` },
              { label: "Phonetic", render: (r) => `<span style="color:#6b7280;">/${esc(r.phonetic)}/</span>` },
              { label: "Count", render: (r) => esc(r.count), align: "right" },
              { label: "Sites", render: (r) => esc(r.sites), align: "right" },
              { label: "Signs", render: (r) => esc(r.signs), align: "right" },
              {
                label: "DP",
                render: (r) => (r.dp === undefined ? "—" : esc(r.dp.toFixed(2))),
                align: "right",
              },
              ...(keyness
                ? ([
                    {
                      label: "Keyness G²",
                      render: (r) =>
                        r.keyness === undefined
                          ? "—"
                          : `${r.keyness >= 0 ? "+" : "−"}${Math.abs(r.keyness).toFixed(1)}`,
                      align: "right",
                    },
                  ] as SnippetColumn<(typeof ranked)[number]>[])
                : []),
            ];
            const meta = `${filtered.length} word${filtered.length === 1 ? "" : "s"}${filterDesc ? ` (${filterDesc})` : ""} of ${words.length} in scope. ${ranked.length < filtered.length ? `Showing top ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(ranked, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(ranked, cols),
            };
          }}
        />
      </div>

      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
        {filtered.length === words.length
          ? `${words.length} words`
          : `${filtered.length} of ${words.length} words`}
        {sorted.length > DISPLAY_CAP ? ` — showing first ${DISPLAY_CAP}` : ""}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <SortHeader label="Word" sortKey="word" sort={sort} onToggle={toggle} />
              <th>Phonetic</th>
              <SortHeader label="Signs" sortKey="length" sort={sort} onToggle={toggle} />
              <SortHeader label="Count" sortKey="count" sort={sort} onToggle={toggle} />
              <SortHeader label="Sites" sortKey="sites" sort={sort} onToggle={toggle} />
              <SortHeader
                label="DP"
                sortKey="dp"
                sort={sort}
                onToggle={toggle}
                title="Gries' deviation of proportions across find-sites: 0 = spread exactly as the site sizes predict, near 1 = concentrated in one place. Frequent AND well-dispersed words are corpus-wide vocabulary; frequent-but-concentrated ones are local."
              />
              {scopeOn && (
                <SortHeader
                  label="Keyness G²"
                  sortKey="keyness"
                  sort={sort}
                  onToggle={toggle}
                  title={`Signed Dunning G²: is the word over-represented in the current scope (${scopeSummary(scope)}) vs the rest of the corpus? 3.84 ≈ p<.05, 6.63 ≈ p<.01`}
                />
              )}
              <th>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {display.map((t, i) => {
              const pct = (t.entry.count / max) * 100;
              const anchor = anchorGloss(t.word);
              const dp = dispersion.get(t.word);
              const key = keyness?.get(t.word) ?? 0;
              return (
                <tr key={t.word}>
                  <td className="dim">{i + 1}</td>
                  <td>
                    <WordToken word={t.word} />
                    {anchor && (
                      <span
                        className="tag tag-success"
                        style={{ marginLeft: 6, cursor: "help" }}
                        title={anchor}
                      >
                        anchor
                      </span>
                    )}
                  </td>
                  <td className="dim">{wordToPhonetic(t.word, hyp)}</td>
                  <td className="dim">{t.word.split("-").length}</td>
                  <td className="numeral">{t.entry.count}</td>
                  <td className="site-text">{t.entry.sites.size}</td>
                  <td
                    className="dim"
                    title={
                      dp === undefined
                        ? "No sited attestations — DP undefined"
                        : `DP = ${dp.toFixed(3)} across the ${sites} in-scope sites`
                    }
                  >
                    {dp === undefined ? "—" : dp.toFixed(2)}
                  </td>
                  {scopeOn && (
                    <td
                      className="numeral"
                      style={{
                        color:
                          key >= 3.84
                            ? "var(--gn)"
                            : key <= -3.84
                              ? "var(--am)"
                              : "var(--text-muted)",
                      }}
                    >
                      {key >= 0 ? "+" : "−"}
                      {Math.abs(key).toFixed(1)}
                    </td>
                  )}
                  <td>
                    <div
                      style={{
                        background: "var(--ac)",
                        height: 8,
                        width: `${pct}%`,
                        borderRadius: 1,
                        opacity: 0.55,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {display.length === 0 && (
              <tr>
                <td
                  colSpan={scopeOn ? 9 : 8}
                  className="dim"
                  style={{ padding: 12 }}
                >
                  No words match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
