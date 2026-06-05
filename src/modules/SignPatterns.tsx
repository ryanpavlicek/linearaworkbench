import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedMultiWords } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
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
  SIGN_PATTERN_HELP,
  compileSignPattern,
  matchSignPattern,
} from "../lib/signPattern";

const DISPLAY_CAP = 300;

// Quick-pick patterns to seed exploration. These are the ones that come up
// in real graphotactic work — fixed-length patterns with a wildcard middle,
// suffix searches, prefix searches, internal-position searches.
const EXAMPLES = [
  "JA-SA-**",
  "**-RE",
  "KU-*-RO",
  "*-PA-*",
  "A-**-RE",
];

export default function SignPatterns() {
  const words = useScopedMultiWords();
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const createCollectionWithItems = useWorkbench(
    (s) => s.createCollectionWithItems,
  );
  const toast = useWorkbench((s) => s.toast_show);

  const [pattern, setPattern] = useState("");
  const [minCount, setMinCount] = useState(1);
  const { sort, toggle, sortRows } = useSort("count", "desc");

  const compiled = useMemo(
    () => (pattern.trim() ? compileSignPattern(pattern) : null),
    [pattern],
  );

  const matches = useMemo(() => {
    if (!compiled) return null;
    const out: { word: string; signs: number; count: number; sites: number }[] = [];
    for (const { word, entry } of words) {
      if (!word.includes("-")) continue;
      const signs = word.split("-");
      if (matchSignPattern(signs, compiled)) {
        out.push({
          word,
          signs: signs.length,
          count: entry.count,
          sites: entry.sites.size,
        });
      }
    }
    return out;
  }, [words, compiled]);

  const filtered = useMemo(
    () => (matches ? matches.filter((m) => m.count >= minCount) : null),
    [matches, minCount],
  );

  const sorted = useMemo(
    () =>
      filtered
        ? sortRows(filtered, {
            word: (m) => m.word,
            count: (m) => m.count,
            signs: (m) => m.signs,
            sites: (m) => m.sites,
          })
        : [],
    [filtered, sortRows],
  );
  const display = sorted.slice(0, DISPLAY_CAP);

  const totalAttestations = filtered
    ? filtered.reduce((s, m) => s + m.count, 0)
    : 0;

  const findingTitle = pattern
    ? `Sign pattern: ${pattern}`
    : "Sign pattern search";
  const findingSummary = filtered
    ? `${filtered.length} word${filtered.length === 1 ? "" : "s"} match pattern "${pattern}"${
        minCount > 1 ? ` (count ≥ ${minCount})` : ""
      } · ${totalAttestations} total attestations.\n` +
      `Top: ` +
      (sorted
        .slice(0, 8)
        .map((m) => `${m.word} (${m.count})`)
        .join(", ") || "none") +
      "."
    : "";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["rank", "word", "signs", "count", "sites"],
    ];
    sorted.forEach((m, i) =>
      rows.push([i + 1, m.word, m.signs, m.count, m.sites]),
    );
    downloadFile(
      `linear_a_sign_pattern_${pattern.replace(/[^A-Za-z0-9*-]/g, "_")}.csv`,
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Sign Patterns</h2>
      <div className="callout">
        <h4>Wildcard graphotactic search</h4>
        <p>
          Find every multi-sign word matching a sign-by-sign pattern. Useful
          for hunting morphological skeletons (every word ending in{" "}
          <code>-RE</code>), formulaic fragments (<code>JA-SA-**</code>),
          fixed-length templates (<code>*-KU-*</code> for any 3-sign word
          with KU in the middle), or specific environments (every word where{" "}
          <code>PA</code> sits next to <code>RE</code>).
        </p>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          <b>Syntax:</b> {SIGN_PATTERN_HELP}
        </p>
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Pattern, e.g. KU-*-RO or **-RE…"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          style={{ flex: 1, minWidth: 220, fontFamily: "var(--mono)" }}
        />
        {pattern && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setPattern("")}
            title="Clear the pattern"
          >
            ✕
          </button>
        )}
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum attestation count for matching words"
        >
          count ≥
          <input
            type="number"
            className="input"
            min={1}
            value={minCount}
            onChange={(e) => setMinCount(Math.max(1, +e.target.value || 1))}
            style={{ width: 60, fontSize: 11, padding: "3px 6px" }}
          />
        </label>
        <button
          className="btn btn-outline btn-sm"
          onClick={exportCsv}
          disabled={!filtered || filtered.length === 0}
        >
          Export CSV
        </button>
        <SaveFindingButton
          module="signpat"
          moduleLabel="Sign Patterns"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ pattern, minCount }}
          disabled={!filtered || filtered.length === 0}
          reportFn={() => {
            const cap = 100;
            const slice = sorted.slice(0, cap);
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              {
                label: "Word",
                render: (m) => `<code>${esc(m.word)}</code>`,
              },
              {
                label: "Signs",
                render: (m) => esc(m.signs),
                align: "right",
              },
              {
                label: "Count",
                render: (m) => esc(m.count),
                align: "right",
              },
              {
                label: "Sites",
                render: (m) => esc(m.sites),
                align: "right",
              },
            ];
            const meta = `${filtered!.length} words match pattern "${pattern}"${minCount > 1 ? ` (count ≥ ${minCount})` : ""} · ${totalAttestations} total attestations.${slice.length < sorted.length ? ` Showing top ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
        <button
          className="btn btn-outline btn-sm"
          disabled={!filtered || filtered.length === 0}
          onClick={() => {
            const id = createCollectionWithItems(
              `Sign pattern • ${pattern} (${filtered!.length})`,
              filtered!.map((m) => ({
                kind: "word" as const,
                value: m.word,
              })),
            );
            if (id) {
              toast(
                `Saved ${filtered!.length} matching words as a collection`,
              );
            }
          }}
          title={
            filtered && filtered.length > 0
              ? `Save these ${filtered.length} matching words as a collection`
              : "No matches to save"
          }
        >
          + Save words as collection
        </button>
      </div>

      {!pattern.trim() && (
        <div className="card" style={{ marginTop: 12 }}>
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Try a pattern
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {EXAMPLES.map((p) => (
              <button
                key={p}
                className="btn btn-outline btn-sm"
                onClick={() => setPattern(p)}
                style={{ fontFamily: "var(--mono)" }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered && (
        <div className="dim" style={{ fontSize: 11, margin: "8px 0" }}>
          {filtered.length} match{filtered.length === 1 ? "" : "es"} ·{" "}
          {totalAttestations} total attestation
          {totalAttestations === 1 ? "" : "s"}
          {sorted.length > DISPLAY_CAP
            ? ` — showing top ${DISPLAY_CAP}`
            : ""}
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <SortHeader label="Word" sortKey="word" sort={sort} onToggle={toggle} />
                <SortHeader label="Signs" sortKey="signs" sort={sort} onToggle={toggle} />
                <SortHeader label="Count" sortKey="count" sort={sort} onToggle={toggle} />
                <SortHeader label="Sites" sortKey="sites" sort={sort} onToggle={toggle} />
                <th style={{ width: 1 }}>Open in…</th>
              </tr>
            </thead>
            <tbody>
              {display.map((m, i) => (
                <tr key={m.word}>
                  <td className="dim">{i + 1}</td>
                  <td>
                    <WordToken word={m.word} />
                  </td>
                  <td className="dim">{m.signs}</td>
                  <td className="numeral">{m.count}</td>
                  <td className="dim">{m.sites}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => setActiveModule("kwic", { focus: m.word })}
                      title="Open in KWIC concordance"
                    >
                      KWIC
                    </button>{" "}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => setActiveModule("cooc", { focus: m.word })}
                      title="Open in Co-occurrence (collocates)"
                    >
                      Cooc
                    </button>{" "}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => setActiveModule("comp", { focus: m.word })}
                      title="Open in Cross-Linguistic"
                    >
                      Cross-Ling
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="dim">
            No multi-sign words match{" "}
            <code style={{ fontFamily: "var(--mono)" }}>{pattern}</code>
            {minCount > 1 ? ` at count ≥ ${minCount}` : ""}.
          </div>
        </div>
      )}
    </div>
  );
}
