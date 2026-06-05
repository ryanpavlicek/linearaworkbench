import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus, useScopedMultiWords } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { wordToPhonetic } from "../lib/algorithms";
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
  const sites = useScopedCorpus().siteIndex.size;
  const [q, setQ] = useState("");
  const [minCount, setMinCount] = useState(1);
  const [minSites, setMinSites] = useState(1);
  const [minLen, setMinLen] = useState(1);
  const [hapaxOnly, setHapaxOnly] = useState(false);
  const { sort, toggle, sortRows } = useSort("count", "desc");

  const hapax = useMemo(
    () => words.filter((w) => w.entry.count === 1).length,
    [words],
  );
  // Global maximum (words arrives sorted by count desc) for the distribution bar.
  const max = words[0]?.entry.count || 1;

  const filtered = useMemo(() => {
    const upper = q.toUpperCase();
    return words.filter((t) => {
      if (upper && !t.word.toUpperCase().includes(upper)) return false;
      if (hapaxOnly && t.entry.count !== 1) return false;
      if (t.entry.count < minCount) return false;
      if (t.entry.sites.size < minSites) return false;
      if (t.word.split("-").length < minLen) return false;
      return true;
    });
  }, [words, q, minCount, minSites, minLen, hapaxOnly]);

  const sorted = sortRows(filtered, {
    count: (t) => t.entry.count,
    word: (t) => t.word,
    sites: (t) => t.entry.sites.size,
    length: (t) => t.word.split("-").length,
  });
  const display = sorted.slice(0, DISPLAY_CAP);

  const filterDesc = [
    q && `“${q}”`,
    minCount > 1 && `count ≥ ${minCount}`,
    minSites > 1 && `sites ≥ ${minSites}`,
    minLen > 1 && `≥ ${minLen} signs`,
    hapaxOnly && "hapax only",
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
      ["rank", "word", "phonetic", "count", "distinct_sites", "signs"],
    ];
    sorted.forEach((t, i) => {
      rows.push([
        i + 1,
        t.word,
        wordToPhonetic(t.word, hyp),
        t.entry.count,
        t.entry.sites.size,
        t.word.split("-").length,
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
        sites. Filter by count, site spread, length, or hapax; click a column
        to sort.
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
            }));
            const cols: SnippetColumn<(typeof ranked)[number]>[] = [
              { label: "#", render: (r) => `<span style="color:#6b7280;">${r.rank}</span>`, align: "right" },
              { label: "Word", render: (r) => `<code>${esc(r.word)}</code>` },
              { label: "Phonetic", render: (r) => `<span style="color:#6b7280;">/${esc(r.phonetic)}/</span>` },
              { label: "Count", render: (r) => esc(r.count), align: "right" },
              { label: "Sites", render: (r) => esc(r.sites), align: "right" },
              { label: "Signs", render: (r) => esc(r.signs), align: "right" },
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
              <th>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {display.map((t, i) => {
              const pct = (t.entry.count / max) * 100;
              return (
                <tr key={t.word}>
                  <td className="dim">{i + 1}</td>
                  <td>
                    <WordToken word={t.word} />
                  </td>
                  <td className="dim">{wordToPhonetic(t.word, hyp)}</td>
                  <td className="dim">{t.word.split("-").length}</td>
                  <td className="numeral">{t.entry.count}</td>
                  <td className="site-text">{t.entry.sites.size}</td>
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
                <td colSpan={7} className="dim" style={{ padding: 12 }}>
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
