import { useMemo, useState } from "react";
import { csvEscape, downloadFile } from "../lib/helpers";
import { useScopedMultiWords } from "../store/scope";
import { findMorphologicalClusters } from "../lib/algorithms";
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

// Heuristic lemmatization for an undeciphered script. Algorithm:
//   1. Find suffixes attested across many distinct words ("productive").
//   2. For each word W, if W = stem + productive-suffix AND stem itself
//      is a corpus word, link W ↔ stem.
//   3. Union-Find over those links yields connected components.
//   4. The shortest word in each component is the candidate stem; the
//      rest are candidate inflected/derived forms.
//
// We don't know Linear A's grammar so "stem family" is the most honest
// label — we're not committing to lemma identity, just surfacing
// candidate morphological relationships for closer inspection.
export default function StemFamilies() {
  const words = useScopedMultiWords();
  const wordsForCluster = useMemo(
    () => words.map((w) => ({ word: w.word, count: w.entry.count })),
    [words],
  );

  const [minSuffixProd, setMinSuffixProd] = useState(5);
  const [minClusterSize, setMinClusterSize] = useState(2);
  const [maxSuffixLen, setMaxSuffixLen] = useState(2);
  const [q, setQ] = useState("");
  const [expandedStem, setExpandedStem] = useState<string | null>(null);
  const { sort, toggle, sortRows } = useSort("members", "desc");

  const clusters = useMemo(
    () =>
      findMorphologicalClusters(wordsForCluster, {
        minSuffixProductivity: minSuffixProd,
        minClusterSize,
        maxSuffixLen,
      }),
    [wordsForCluster, minSuffixProd, minClusterSize, maxSuffixLen],
  );

  const filtered = useMemo(() => {
    const u = q.toUpperCase();
    if (!u) return clusters;
    return clusters.filter(
      (c) =>
        c.stem.toUpperCase().includes(u) ||
        c.members.some((m) => m.word.toUpperCase().includes(u)),
    );
  }, [clusters, q]);

  const sorted = sortRows(filtered, {
    stem: (c) => c.stem,
    members: (c) => c.members.length,
    suffixes: (c) => c.suffixes.length,
    total: (c) => c.totalCount,
  });

  const totalWordsCovered = useMemo(
    () => clusters.reduce((s, c) => s + c.members.length, 0),
    [clusters],
  );

  const coverage =
    words.length > 0
      ? ((totalWordsCovered / words.length) * 100).toFixed(0)
      : "0";
  const findingTitle = `Stem families (prod≥${minSuffixProd}, size≥${minClusterSize}, suffix≤${maxSuffixLen})`;
  const findingSummary =
    `${clusters.length} stem families covering ${totalWordsCovered} words ` +
    `(${coverage}% of vocabulary). Params: min productivity ${minSuffixProd}, ` +
    `min family size ${minClusterSize}, max suffix length ${maxSuffixLen}.\n` +
    `Largest: ` +
    (sorted
      .slice(0, 6)
      .map((c) => `${c.stem} (${c.members.length})`)
      .join(", ") || "none") +
    ".";

  return (
    <div className="panel">
      <h2>Stem Families</h2>
      <div className="callout">
        <h4>Heuristic morphological clustering</h4>
        <p>
          Groups multi-sign words that appear to share a stem and differ
          only by a <em>productive</em> suffix — one attested across many
          distinct words in the corpus. Because Linear A is undeciphered,
          this is not lemmatization in the strict sense: we can't tell
          which suffix patterns are inflectional, derivational, or just
          phonological accidents. Each cluster is a <b>candidate</b>{" "}
          morphological family for closer inspection, not a definitive
          paradigm.
        </p>
        <p style={{ marginTop: 6, fontSize: 12 }}>
          Algorithm: find suffixes ending ≥ <b>min suffix productivity</b>{" "}
          distinct words, then for every word <code>W</code>, if{" "}
          <code>W = stem + productive-suffix</code> and <code>stem</code> is
          itself attested as a corpus word, link them. Connected components
          are reported as stem families. The shortest member of each
          component is treated as the candidate stem.
        </p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Filter by stem or member word…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          title="A suffix must end at least this many distinct words to count as productive"
        >
          min suffix productivity
          <input
            type="number"
            className="input"
            min={2}
            max={50}
            value={minSuffixProd}
            onChange={(e) =>
              setMinSuffixProd(Math.max(2, +e.target.value || 5))
            }
            style={{ width: 60 }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          min family size
          <input
            type="number"
            className="input"
            min={2}
            max={20}
            value={minClusterSize}
            onChange={(e) =>
              setMinClusterSize(Math.max(2, +e.target.value || 2))
            }
            style={{ width: 60 }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          title="Maximum suffix length in signs"
        >
          max suffix length
          <input
            type="number"
            className="input"
            min={1}
            max={4}
            value={maxSuffixLen}
            onChange={(e) =>
              setMaxSuffixLen(Math.max(1, +e.target.value || 2))
            }
            style={{ width: 60 }}
          />
        </label>
        <button
          className="btn btn-outline btn-sm"
          disabled={sorted.length === 0}
          onClick={() => {
            const header = [
              "stem",
              "member_count",
              "total_attestations",
              "suffixes",
              "members",
            ];
            const rowsCsv = [header.map(csvEscape).join(",")];
            for (const c of sorted) {
              rowsCsv.push(
                [
                  c.stem,
                  c.members.length,
                  c.totalCount,
                  c.suffixes.join(";"),
                  c.members
                    .map((m) => `${m.word}(×${m.count})`)
                    .join(";"),
                ]
                  .map(csvEscape)
                  .join(","),
              );
            }
            downloadFile(
              "linear_a_stem_families.csv",
              rowsCsv.join("\n"),
            );
          }}
          title="Download all current stem families as CSV"
        >
          Export CSV
        </button>
        <SaveFindingButton
          module="stems"
          moduleLabel="Stem Families"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ minSuffixProd, minClusterSize, maxSuffixLen, q }}
          reportFn={() => {
            const cap = 60;
            const slice = sorted.slice(0, cap).map((c, i) => ({ ...c, rank: i + 1 }));
            type R = (typeof slice)[number];
            const cols: SnippetColumn<R>[] = [
              {
                label: "#",
                render: (c) => `<span style="color:#6b7280;">${c.rank}</span>`,
                align: "right",
              },
              {
                label: "Stem",
                render: (c) =>
                  `<code style="color:#1d4ed8;font-weight:600;">${esc(c.stem)}</code>`,
              },
              {
                label: "Members",
                render: (c) => esc(c.members.length),
                align: "right",
              },
              {
                label: "Suffixes",
                render: (c) =>
                  c.suffixes
                    .slice(0, 8)
                    .map(
                      (s) =>
                        `<code style="background:#f3f4f6;padding:1px 4px;border-radius:2px;margin-right:3px;color:#6d28d9;">-${esc(s)}</code>`,
                    )
                    .join("") +
                  (c.suffixes.length > 8
                    ? `<span style="color:#6b7280;font-size:10px;"> +${c.suffixes.length - 8}</span>`
                    : ""),
                md: (c) => c.suffixes.slice(0, 8).map((s) => `-${s}`).join(", "),
              },
              {
                label: "Total",
                render: (c) => esc(c.totalCount),
                align: "right",
              },
              {
                label: "Members",
                render: (c) =>
                  c.members
                    .slice(0, 6)
                    .map(
                      (m) =>
                        `<code style="background:#f3f4f6;padding:1px 4px;border-radius:2px;margin-right:3px;">${esc(m.word)}<span style="color:#6b7280;font-size:10px;">×${m.count}</span></code>`,
                    )
                    .join("") +
                  (c.members.length > 6
                    ? `<span style="color:#6b7280;font-size:10px;"> +${c.members.length - 6}</span>`
                    : ""),
                md: (c) =>
                  c.members.slice(0, 6).map((m) => `${m.word} (×${m.count})`).join(", "),
              },
            ];
            const meta = `${clusters.length} stem families covering ${totalWordsCovered} words (${coverage}% of vocabulary). Showing top ${slice.length} by ${sort.key}.`;
            const html = snippetWrap(meta, snippetTable(slice, cols));
            const markdown = `_${meta}_\n\n` + snippetTableMd(slice, cols);
            return { html, markdown };
          }}
        />
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{clusters.length}</span>
          <span className="lbl">Stem families</span>
        </div>
        <div className="stat-box">
          <span className="val">{totalWordsCovered}</span>
          <span className="lbl">Words in families</span>
        </div>
        <div className="stat-box">
          <span className="val">{words.length}</span>
          <span className="lbl">Multi-sign words total</span>
        </div>
        <div className="stat-box">
          <span className="val">
            {words.length > 0
              ? ((totalWordsCovered / words.length) * 100).toFixed(0)
              : "0"}
            %
          </span>
          <span className="lbl">Vocabulary coverage</span>
        </div>
      </div>

      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
        Click a row to expand and see member forms.
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <SortHeader label="Candidate stem" sortKey="stem" sort={sort} onToggle={toggle} />
              <SortHeader label="Members" sortKey="members" sort={sort} onToggle={toggle} />
              <SortHeader label="Suffixes attested" sortKey="suffixes" sort={sort} onToggle={toggle} />
              <SortHeader label="Total attestations" sortKey="total" sort={sort} onToggle={toggle} />
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 250).map((c, i) => {
              const isOpen = expandedStem === c.stem;
              return (
                <FragRow
                  key={c.stem}
                  index={i + 1}
                  cluster={c}
                  isOpen={isOpen}
                  onToggle={() =>
                    setExpandedStem(isOpen ? null : c.stem)
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length > 250 && (
        <div className="dim" style={{ fontSize: 11, padding: 8 }}>
          Showing first 250 of {filtered.length}. Narrow the filters to see
          more.
        </div>
      )}
    </div>
  );
}

function FragRow({
  index,
  cluster,
  isOpen,
  onToggle,
}: {
  index: number;
  cluster: ReturnType<typeof findMorphologicalClusters>[number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr style={{ cursor: "pointer" }} onClick={onToggle}>
        <td className="dim">{index}</td>
        <td>
          <span style={{ marginRight: 6, color: "var(--text-muted)" }}>
            {isOpen ? "▾" : "▸"}
          </span>
          <WordToken word={cluster.stem} />
        </td>
        <td className="numeral">{cluster.members.length}</td>
        <td style={{ fontSize: 11 }}>
          {cluster.suffixes.length === 0 ? (
            <span className="dim">—</span>
          ) : (
            cluster.suffixes.slice(0, 6).map((s) => (
              <span
                key={s}
                style={{
                  display: "inline-block",
                  padding: "1px 6px",
                  marginRight: 4,
                  background: "#f0b14b14",
                  color: "var(--am)",
                  border: "1px solid #f0b14b30",
                  borderRadius: 3,
                  font: "500 11px var(--mono)",
                }}
              >
                -{s}
              </span>
            ))
          )}
          {cluster.suffixes.length > 6 && (
            <span className="dim">+{cluster.suffixes.length - 6}</span>
          )}
        </td>
        <td className="numeral">{cluster.totalCount}</td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={5} style={{ background: "var(--surface-0)" }}>
            <div style={{ padding: "8px 16px" }}>
              <div
                className="dim"
                style={{
                  font: "600 9px var(--sans)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 6,
                }}
              >
                Member forms
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 4,
                }}
              >
                {cluster.members.map((m) => (
                  <div
                    key={m.word}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 6px",
                      background:
                        m.word === cluster.stem
                          ? "var(--ac-soft)"
                          : "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 3,
                      fontSize: 11,
                    }}
                  >
                    <WordToken word={m.word} />
                    {m.suffix && m.suffix !== "≠" && (
                      <span
                        className="dim"
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                        }}
                      >
                        +{m.suffix}
                      </span>
                    )}
                    {m.suffix === "≠" && (
                      <span
                        title="Linked indirectly — doesn't share the literal stem prefix"
                        className="dim"
                        style={{ fontSize: 10 }}
                      >
                        ≠
                      </span>
                    )}
                    {m.word === cluster.stem && (
                      <span
                        style={{
                          font: "600 9px var(--sans)",
                          color: "var(--ac)",
                          marginLeft: "auto",
                        }}
                      >
                        STEM
                      </span>
                    )}
                    <span
                      className="numeral"
                      style={{ marginLeft: "auto", fontSize: 11 }}
                    >
                      ×{m.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
