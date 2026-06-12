import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { csvEscape, downloadFile } from "../lib/helpers";
import { wordToPhonetic } from "../lib/algorithms";
import { WordToken } from "../components/WordToken";
import { InscriptionLink } from "../components/InscriptionLink";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { useSort, SortHeader } from "../components/sort";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import type { Annotation, Confidence } from "../lib/types";

// The working glossary a researcher actually accumulates: every annotation,
// aggregated into one sortable, filterable, exportable table — proposed
// meaning, confidence, evidence, and (for words) how widely the form is
// attested. The data already exists; this is the view of it.

const CONF_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
const CONF_COLOR: Record<Confidence, string> = {
  high: "var(--gn)",
  medium: "var(--am)",
  low: "var(--text-muted)",
};

interface Row {
  a: Annotation;
  count: number; // word attestation count (0 for non-word targets)
  sites: number;
}

export default function MyLexicon() {
  const annotations = useWorkbench((s) => s.annotations);
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const hyp = useWorkbench((s) => s.hypothesis);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "word" | "inscription" | "sign">(
    "all",
  );
  const [minConf, setMinConf] = useState<Confidence | "any">("any");
  const { sort, toggle, sortRows } = useSort("updated", "desc");

  const rows = useMemo<Row[]>(
    () =>
      annotations.map((a) => {
        const entry =
          a.target.kind === "word" ? wordIndex.get(a.target.value) : undefined;
        return {
          a,
          count: entry?.count ?? 0,
          sites: entry?.sites.size ?? 0,
        };
      }),
    [annotations, wordIndex],
  );

  const filtered = useMemo(() => {
    const upper = q.toUpperCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.a.target.kind !== kind) return false;
      if (minConf !== "any" && CONF_RANK[r.a.confidence] < CONF_RANK[minConf])
        return false;
      if (
        upper &&
        !r.a.target.value.toUpperCase().includes(upper) &&
        !r.a.proposedMeaning.toUpperCase().includes(upper) &&
        !r.a.notes.toUpperCase().includes(upper)
      )
        return false;
      return true;
    });
  }, [rows, q, kind, minConf]);

  const sorted = sortRows(filtered, {
    entry: (r) => r.a.target.value,
    kind: (r) => r.a.target.kind,
    meaning: (r) => r.a.proposedMeaning,
    confidence: (r) => CONF_RANK[r.a.confidence],
    evidence: (r) => r.a.evidenceIds.length,
    count: (r) => r.count,
    sites: (r) => r.sites,
    updated: (r) => r.a.updatedAt,
  });

  const byConf = (c: Confidence) =>
    rows.filter((r) => r.a.confidence === c).length;

  function exportCsv() {
    const out: (string | number)[][] = [
      [
        "kind", "entry", "phonetic", "proposed_meaning", "confidence",
        "notes", "evidence_ids", "attested_count", "distinct_sites", "updated",
      ],
    ];
    sorted.forEach((r) => {
      out.push([
        r.a.target.kind,
        r.a.target.value,
        r.a.target.kind === "word" ? wordToPhonetic(r.a.target.value, hyp) : "",
        r.a.proposedMeaning,
        r.a.confidence,
        r.a.notes,
        r.a.evidenceIds.join("; "),
        r.count || "",
        r.sites || "",
        r.a.updatedAt,
      ]);
    });
    downloadFile(
      "linear_a_my_lexicon.csv",
      out.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  const findingSummary =
    `${filtered.length} of ${rows.length} entries` +
    ` · ${byConf("high")} high / ${byConf("medium")} medium / ${byConf("low")} low confidence.`;

  if (rows.length === 0) {
    return (
      <div className="panel">
        <h2>My Lexicon</h2>
        <p className="panel-desc">
          Your working glossary — every proposed meaning you record, in one
          table.
        </p>
        <p className="dim" style={{ maxWidth: 560 }}>
          Nothing here yet. Click the quiet ✎ control next to any word (or
          open a word/tablet and annotate it from its detail view) to record
          a proposed meaning with a confidence level. Each one becomes a row
          here, joined with how widely the form is attested — your lexicon
          builds itself as you work.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>My Lexicon</h2>
      <p className="panel-desc">
        Every annotation you've made, aggregated into a working glossary:
        proposed meaning, confidence, evidence, and corpus attestation.
        Filter, sort, export, or compile it into the report.
      </p>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{rows.length}</span>
          <span className="lbl">Entries</span>
        </div>
        <div className="stat-box">
          <span className="val">{byConf("high")}</span>
          <span className="lbl">High confidence</span>
        </div>
        <div className="stat-box">
          <span className="val">{byConf("medium")}</span>
          <span className="lbl">Medium</span>
        </div>
        <div className="stat-box">
          <span className="val">{byConf("low")}</span>
          <span className="lbl">Low</span>
        </div>
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter by entry, meaning, or notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        <select
          className="input"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          title="Annotation target kind"
          style={{ width: 130 }}
        >
          <option value="all">All kinds</option>
          <option value="word">Words</option>
          <option value="inscription">Inscriptions</option>
          <option value="sign">Signs</option>
        </select>
        <select
          className="input"
          value={minConf}
          onChange={(e) => setMinConf(e.target.value as typeof minConf)}
          title="Minimum confidence"
          style={{ width: 150 }}
        >
          <option value="any">Any confidence</option>
          <option value="low">low +</option>
          <option value="medium">medium +</option>
          <option value="high">high only</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="lexicon"
          moduleLabel="My Lexicon"
          defaultTitle="My lexicon"
          summary={findingSummary}
          payload={{ q, kind, minConf }}
          reportFn={() => {
            const cap = 200;
            const slice = sorted.slice(0, cap).map((r) => ({
              entry: r.a.target.value,
              kind: r.a.target.kind,
              meaning: r.a.proposedMeaning,
              confidence: r.a.confidence,
              count: r.count,
              sites: r.sites,
            }));
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              { label: "Entry", render: (r) => `<code>${esc(r.entry)}</code>` },
              { label: "Kind", render: (r) => esc(r.kind) },
              { label: "Proposed meaning", render: (r) => esc(r.meaning) },
              { label: "Confidence", render: (r) => esc(r.confidence) },
              { label: "Count", render: (r) => (r.count ? esc(r.count) : ""), align: "right" },
              { label: "Sites", render: (r) => (r.sites ? esc(r.sites) : ""), align: "right" },
            ];
            const meta = `${findingSummary}${slice.length < sorted.length ? ` Showing first ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>

      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
        {filtered.length === rows.length
          ? `${rows.length} entries`
          : `${filtered.length} of ${rows.length} entries`}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortHeader label="Entry" sortKey="entry" sort={sort} onToggle={toggle} />
              <SortHeader label="Kind" sortKey="kind" sort={sort} onToggle={toggle} />
              <SortHeader label="Proposed meaning" sortKey="meaning" sort={sort} onToggle={toggle} />
              <SortHeader label="Conf." sortKey="confidence" sort={sort} onToggle={toggle} />
              <SortHeader label="Evid." sortKey="evidence" sort={sort} onToggle={toggle} title="Evidence inscriptions attached to the annotation" />
              <SortHeader label="Count" sortKey="count" sort={sort} onToggle={toggle} title="Corpus attestation count (words)" />
              <SortHeader label="Sites" sortKey="sites" sort={sort} onToggle={toggle} />
              <th>Notes</th>
              <SortHeader label="Updated" sortKey="updated" sort={sort} onToggle={toggle} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.a.id}>
                <td>
                  {r.a.target.kind === "word" ? (
                    <WordToken word={r.a.target.value} />
                  ) : r.a.target.kind === "inscription" ? (
                    <InscriptionLink id={r.a.target.value} />
                  ) : (
                    <code>{r.a.target.value}</code>
                  )}
                </td>
                <td className="dim">{r.a.target.kind}</td>
                <td>{r.a.proposedMeaning || <span className="dim">—</span>}</td>
                <td>
                  <span style={{ color: CONF_COLOR[r.a.confidence], fontSize: 11 }}>
                    {r.a.confidence}
                  </span>
                </td>
                <td className="numeral">{r.a.evidenceIds.length || ""}</td>
                <td className="numeral">{r.count || ""}</td>
                <td className="numeral">{r.sites || ""}</td>
                <td
                  className="dim"
                  style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={r.a.notes}
                >
                  {r.a.notes}
                </td>
                <td className="dim" style={{ whiteSpace: "nowrap" }}>
                  {r.a.updatedAt.slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
