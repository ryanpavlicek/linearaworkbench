import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { hasValue, parseValue } from "../lib/numerals";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

// Vetting verdicts are stored as ordinary collections, so an accepted name
// list (and a dismissed list) flow straight into the Research Report and the
// Collections module. Named explicitly so we always find-or-reuse the same one.
const ACCEPTED_COLLECTION = "Personal names (accepted)";
const DISMISSED_COLLECTION = "Name candidates (dismissed)";

type Verdict = "accepted" | "dismissed" | "undecided";

// Words that are structural/function terms, not names — excluded from
// candidates. These are among the most securely identified Linear A words.
const FUNCTION_WORDS = new Set([
  "KU-RO",
  "KI-RO",
  "PO-TO-KU-RO",
  "KU-RO₂",
  "SA-RA₂", // recurring transactional term
]);

interface Candidate {
  word: string;
  count: number;
  sites: number;
  tablets: number;
  entryCount: number; // line-initial AND on a line with a number
  beforeNumber: number; // appears before the first numeral on its line
  occLines: number; // total line occurrences considered
  entryRate: number;
  score: number;
}

type SortKey = "score" | "count" | "entryRate" | "sites";

// Heuristic onomastic detector. Personal names on the accounting tablets
// behave distributionally like *counted entries*: they head a line
// (line-initial), that line carries a quantity, and the name tends to be
// local (few sites). This flags such words as candidates — it cannot
// confirm a word is a name, only that it behaves like one.
function findCandidates(
  inscriptions: { id: string; site: string; words: string[]; lines: string[][] }[],
  wordIndex: Map<string, { count: number; sites: Set<string>; inscriptionIds: string[] }>,
): Candidate[] {
  const agg = new Map<
    string,
    { entryCount: number; beforeNumber: number; occLines: number }
  >();

  for (const ins of inscriptions) {
    for (const line of ins.lines) {
      if (!hasValue(line)) continue; // only counted lines matter here
      const firstNumberIdx = line.findIndex((t) => parseValue(t) !== null);
      line.forEach((tok, idx) => {
        if (!tok.includes("-")) return;
        let a = agg.get(tok);
        if (!a) {
          a = { entryCount: 0, beforeNumber: 0, occLines: 0 };
          agg.set(tok, a);
        }
        a.occLines++;
        if (idx === 0) a.entryCount++;
        if (firstNumberIdx >= 0 && idx < firstNumberIdx) a.beforeNumber++;
      });
    }
  }

  const out: Candidate[] = [];
  for (const [word, a] of agg) {
    if (FUNCTION_WORDS.has(word)) continue;
    const entry = wordIndex.get(word);
    if (!entry) continue;
    const count = entry.count;
    const sites = entry.sites.size;
    const tablets = new Set(entry.inscriptionIds).size;
    const entryRate = a.occLines > 0 ? a.entryCount / a.occLines : 0;
    const beforeRate = a.occLines > 0 ? a.beforeNumber / a.occLines : 0;
    // Composite, transparent score: behaves like a counted entry
    // (line-initial + before the number) and is local (few sites).
    const locality = 1 / sites;
    const score = 0.5 * entryRate + 0.3 * beforeRate + 0.2 * locality;
    out.push({
      word,
      count,
      sites,
      tablets,
      entryCount: a.entryCount,
      beforeNumber: a.beforeNumber,
      occLines: a.occLines,
      entryRate,
      score,
    });
  }
  return out;
}

export default function Onomastics() {
  const scoped = useScopedCorpus();
  const inscriptions = scoped.inscriptions;
  const wordIndex = scoped.wordIndex;
  const collections = useWorkbench((s) => s.collections);
  const createCollection = useWorkbench((s) => s.createCollection);
  const addToCollection = useWorkbench((s) => s.addToCollection);
  const removeFromCollection = useWorkbench((s) => s.removeFromCollection);
  const toast = useWorkbench((s) => s.toast_show);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [minOcc, setMinOcc] = useState(2);
  const [localOnly, setLocalOnly] = useState(false);
  const [q, setQ] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "all">("all");

  const candidates = useMemo(
    () => findCandidates(inscriptions, wordIndex),
    [inscriptions, wordIndex],
  );

  const filtered = useMemo(() => {
    const u = q.toUpperCase();
    let rows = candidates.filter(
      (c) => c.occLines >= minOcc && c.entryCount > 0,
    );
    if (localOnly) rows = rows.filter((c) => c.sites <= 2);
    if (u) rows = rows.filter((c) => c.word.toUpperCase().includes(u));
    rows.sort((a, b) => {
      if (sortKey === "count") return b.count - a.count;
      if (sortKey === "entryRate") return b.entryRate - a.entryRate;
      if (sortKey === "sites") return a.sites - b.sites;
      return b.score - a.score;
    });
    return rows;
  }, [candidates, minOcc, localOnly, q, sortKey]);

  // ── Vetting (accept / dismiss) ──────────────────────────────────────
  const acceptColl = collections.find((c) => c.name === ACCEPTED_COLLECTION);
  const dismissColl = collections.find((c) => c.name === DISMISSED_COLLECTION);
  const accepted = useMemo(
    () =>
      new Set(
        (acceptColl?.items ?? [])
          .filter((i) => i.kind === "word")
          .map((i) => i.value),
      ),
    [acceptColl],
  );
  const dismissed = useMemo(
    () =>
      new Set(
        (dismissColl?.items ?? [])
          .filter((i) => i.kind === "word")
          .map((i) => i.value),
      ),
    [dismissColl],
  );
  const verdictOf = (w: string): Verdict =>
    accepted.has(w) ? "accepted" : dismissed.has(w) ? "dismissed" : "undecided";

  const shown =
    verdictFilter === "all"
      ? filtered
      : filtered.filter((c) => verdictOf(c.word) === verdictFilter);

  const counts = { accepted: 0, dismissed: 0, undecided: 0 };
  for (const c of filtered) counts[verdictOf(c.word)]++;

  function applyVerdict(word: string, v: "accept" | "dismiss" | "clear") {
    const all = useWorkbench.getState().collections;
    const idByName = (n: string) => all.find((c) => c.name === n)?.id ?? null;
    const ensure = (n: string) => idByName(n) ?? createCollection(n);
    if (v === "accept") {
      addToCollection(ensure(ACCEPTED_COLLECTION), { kind: "word", value: word });
      const d = idByName(DISMISSED_COLLECTION);
      if (d) removeFromCollection(d, { kind: "word", value: word });
      toast(`Accepted "${word}" as a name candidate`);
    } else if (v === "dismiss") {
      addToCollection(ensure(DISMISSED_COLLECTION), { kind: "word", value: word });
      const a = idByName(ACCEPTED_COLLECTION);
      if (a) removeFromCollection(a, { kind: "word", value: word });
      toast(`Dismissed "${word}"`);
    } else {
      const a = idByName(ACCEPTED_COLLECTION);
      if (a) removeFromCollection(a, { kind: "word", value: word });
      const d = idByName(DISMISSED_COLLECTION);
      if (d) removeFromCollection(d, { kind: "word", value: word });
    }
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["word", "verdict", "count", "sites", "tablets", "line_initial", "before_number", "counted_lines", "entry_rate", "score"],
    ];
    for (const c of shown) {
      rows.push([
        c.word,
        verdictOf(c.word),
        c.count,
        c.sites,
        c.tablets,
        c.entryCount,
        c.beforeNumber,
        c.occLines,
        c.entryRate.toFixed(3),
        c.score.toFixed(3),
      ]);
    }
    downloadFile(
      "linear_a_name_candidates.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Name Candidates</h2>
      <div className="callout">
        <h4>Onomastic detection by distribution</h4>
        <p>
          Many Linear A words — especially on the Haghia Triada "people"
          tablets — are believed to be personal names. This module flags
          words that <em>behave</em> like names by their distribution: they
          head a line (line-initial), that line carries a quantity (the
          entry is counted), and the word tends to be local to one or two
          sites. Known transaction terms (<code>KU-RO</code>,{" "}
          <code>KI-RO</code>, <code>PO-TO-KU-RO</code>) are excluded.
        </p>
        <p style={{ marginTop: 6, fontSize: 12 }}>
          This is a <b>heuristic</b>: it surfaces words that pattern like
          counted entries — candidates for personal names, but also possibly
          place names, titles, or commodity terms. It can't confirm a word
          is a name. The feature columns let you judge each case — then{" "}
          <b>accept</b> (<span style={{ color: "var(--gn)" }}>✓</span>) or{" "}
          <b>dismiss</b> (<span style={{ color: "var(--rd)" }}>✕</span>) each
          one to build a vetted list. Your verdicts are saved as collections
          ("{ACCEPTED_COLLECTION}" / "{DISMISSED_COLLECTION}") and flow into the
          Research Report.
        </p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Filter words…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          min counted lines
          <input
            type="number"
            className="input"
            min={1}
            value={minOcc}
            onChange={(e) => setMinOcc(Math.max(1, +e.target.value || 2))}
            style={{ width: 56 }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Restrict to words attested at no more than two sites"
        >
          <input
            type="checkbox"
            checked={localOnly}
            onChange={(e) => setLocalOnly(e.target.checked)}
          />
          local (≤2 sites)
        </label>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="onomastics"
          moduleLabel="Name Candidates"
          defaultTitle={
            verdictFilter === "accepted"
              ? "Name candidates — accepted"
              : verdictFilter === "dismissed"
                ? "Name candidates — dismissed"
                : "Name candidates (ranking snapshot)"
          }
          summary={
            `${shown.length} candidate${shown.length === 1 ? "" : "s"} (${verdictFilter})` +
            (q ? ` matching "${q}"` : "") +
            ` · ${counts.accepted} accepted, ${counts.dismissed} dismissed, ${counts.undecided} undecided.`
          }
          payload={{ sortKey, minOcc, localOnly, q, verdictFilter }}
          disabled={shown.length === 0}
          reportFn={() => {
            const cap = 60;
            const slice = shown.slice(0, cap);
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              { label: "Word", render: (c) => `<code>${esc(c.word)}</code>` },
              {
                label: "Verdict",
                render: (c) => {
                  const v = verdictOf(c.word);
                  const color =
                    v === "accepted"
                      ? "#16a34a"
                      : v === "dismissed"
                        ? "#b45309"
                        : "#6b7280";
                  return `<span style="color:${color};">${v}</span>`;
                },
              },
              { label: "Count", render: (c) => esc(c.count), align: "right" },
              {
                label: "Entry rate",
                render: (c) => esc(`${(c.entryRate * 100).toFixed(0)}%`),
                align: "right",
              },
              { label: "Sites", render: (c) => esc(c.sites), align: "right" },
              {
                label: "Score",
                render: (c) => `<b>${c.score.toFixed(2)}</b>`,
                align: "right",
              },
            ];
            const meta = `${shown.length} name candidate${shown.length === 1 ? "" : "s"} (${verdictFilter}). Verdicts: ${counts.accepted} accepted, ${counts.dismissed} dismissed, ${counts.undecided} undecided.${slice.length < shown.length ? ` Showing top ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <div className="tab-row" style={{ marginBottom: 0, border: 0, gap: 4 }}>
          {([
            ["all", `All ${filtered.length}`],
            ["undecided", `Undecided ${counts.undecided}`],
            ["accepted", `Accepted ${counts.accepted}`],
            ["dismissed", `Dismissed ${counts.dismissed}`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`tab-btn${verdictFilter === key ? " active" : ""}`}
              onClick={() => setVerdictFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <span className="dim" style={{ fontSize: 11 }}>
          Accept / dismiss save to collections → Research Report
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th
                onClick={() => setSortKey("score")}
                style={{ cursor: "pointer", color: sortKey === "score" ? "var(--ac)" : undefined }}
              >
                Word {sortKey === "score" ? "▾" : ""}
              </th>
              <th
                onClick={() => setSortKey("count")}
                style={{ cursor: "pointer", color: sortKey === "count" ? "var(--ac)" : undefined }}
              >
                Count {sortKey === "count" ? "▾" : ""}
              </th>
              <th
                onClick={() => setSortKey("entryRate")}
                style={{ cursor: "pointer", color: sortKey === "entryRate" ? "var(--ac)" : undefined }}
                title="Fraction of counted-line occurrences where the word is line-initial"
              >
                Entry rate {sortKey === "entryRate" ? "▾" : ""}
              </th>
              <th
                onClick={() => setSortKey("sites")}
                style={{ cursor: "pointer", color: sortKey === "sites" ? "var(--ac)" : undefined }}
              >
                Sites {sortKey === "sites" ? "▾" : ""}
              </th>
              <th title="Line-initial occurrences on counted lines">Initial</th>
              <th title="Heuristic name-likeness score">Score</th>
              <th title="Your verdict — accept as a name, or dismiss">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 250).map((c) => {
              const v = verdictOf(c.word);
              return (
              <tr
                key={c.word}
                style={{ opacity: v === "dismissed" ? 0.5 : 1 }}
              >
                <td
                  style={{
                    borderLeft:
                      v === "accepted"
                        ? "2px solid var(--gn)"
                        : "2px solid transparent",
                  }}
                >
                  <WordToken word={c.word} />
                </td>
                <td className="numeral">{c.count}</td>
                <td>
                  <span
                    style={{
                      display: "inline-block",
                      width: 60,
                      height: 8,
                      background: "var(--surface-2)",
                      borderRadius: 1,
                      position: "relative",
                      verticalAlign: "middle",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${c.entryRate * 100}%`,
                        background: "var(--gn)",
                        opacity: 0.6,
                        borderRadius: 1,
                      }}
                    />
                  </span>
                  <span className="dim" style={{ marginLeft: 6, fontSize: 10 }}>
                    {(c.entryRate * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="dim">{c.sites}</td>
                <td className="dim">
                  {c.entryCount}/{c.occLines}
                </td>
                <td className="numeral">{c.score.toFixed(2)}</td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      className={`btn btn-sm ${v === "accepted" ? "" : "btn-outline"}`}
                      onClick={() =>
                        applyVerdict(c.word, v === "accepted" ? "clear" : "accept")
                      }
                      title={
                        v === "accepted"
                          ? "Accepted — click to undo"
                          : "Accept as a personal-name candidate"
                      }
                      style={{
                        padding: "0 7px",
                        minWidth: 0,
                        color: v === "accepted" ? undefined : "var(--gn)",
                      }}
                    >
                      ✓
                    </button>
                    <button
                      className={`btn btn-sm ${v === "dismissed" ? "" : "btn-outline"}`}
                      onClick={() =>
                        applyVerdict(c.word, v === "dismissed" ? "clear" : "dismiss")
                      }
                      title={
                        v === "dismissed"
                          ? "Dismissed — click to undo"
                          : "Dismiss — does not behave like a name"
                      }
                      style={{
                        padding: "0 7px",
                        minWidth: 0,
                        color: v === "dismissed" ? undefined : "var(--rd)",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
