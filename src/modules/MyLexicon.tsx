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
  const inscriptions = useWorkbench((s) => s.corpus.inscriptions);
  const upsertAnnotation = useWorkbench((s) => s.upsertAnnotation);
  const hyp = useWorkbench((s) => s.hypothesis);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "word" | "inscription" | "sign">(
    "all",
  );
  const [minConf, setMinConf] = useState<Confidence | "any">("any");
  const [editing, setEditing] = useState<string | null>(null); // target key
  const [draftMeaning, setDraftMeaning] = useState("");
  const [draftConf, setDraftConf] = useState<Confidence>("medium");
  const [previewId, setPreviewId] = useState<string>("");
  const { sort, toggle, sortRows } = useSort("updated", "desc");

  // Glossed words (a non-empty proposed meaning) and the corpus coverage
  // they buy: what share of all multi-sign word TOKENS can you currently
  // read through your own lexicon?
  const glossed = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of annotations) {
      if (a.target.kind === "word" && a.proposedMeaning.trim())
        m.set(a.target.value.toUpperCase(), a.proposedMeaning.trim());
    }
    return m;
  }, [annotations]);

  const coverage = useMemo(() => {
    let coveredTokens = 0;
    let totalTokens = 0;
    let totalTypes = 0;
    for (const [w, e] of wordIndex) {
      if (!w.includes("-")) continue;
      totalTypes++;
      totalTokens += e.count;
      if (glossed.has(w.toUpperCase())) coveredTokens += e.count;
    }
    return {
      coveredTokens,
      totalTokens,
      coveredTypes: glossed.size,
      totalTypes,
      pct: totalTokens > 0 ? (coveredTokens / totalTokens) * 100 : 0,
    };
  }, [wordIndex, glossed]);

  // Gloss preview: the tablets your lexicon reads furthest into, ranked by
  // the share of word tokens you've glossed.
  const previewCandidates = useMemo(() => {
    const scored = inscriptions
      .map((ins) => {
        const ws = ins.words.filter((w) => w.includes("-"));
        if (ws.length < 2) return null;
        const hit = ws.filter((w) => glossed.has(w.toUpperCase())).length;
        return hit > 0
          ? { id: ins.id, hit, total: ws.length, share: hit / ws.length }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.share - a.share || b.hit - a.hit);
    return scored.slice(0, 12);
  }, [inscriptions, glossed]);

  const previewIns = useMemo(() => {
    const id = previewId || previewCandidates[0]?.id;
    return id ? (inscriptions.find((i) => i.id === id) ?? null) : null;
  }, [previewId, previewCandidates, inscriptions]);

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
        <div
          className="stat-box"
          title={`Your ${coverage.coveredTypes} glossed words account for ${coverage.coveredTokens.toLocaleString()} of the corpus's ${coverage.totalTokens.toLocaleString()} multi-sign word tokens (${coverage.coveredTypes} of ${coverage.totalTypes} types)`}
        >
          <span className="val" style={{ color: "var(--ac)" }}>
            {coverage.pct.toFixed(1)}%
          </span>
          <span className="lbl">Token coverage</span>
        </div>
      </div>

      {coverage.totalTokens > 0 && (
        <div
          style={{
            height: 6,
            background: "var(--surface-2)",
            borderRadius: 3,
            marginBottom: 12,
            overflow: "hidden",
          }}
          title={`${coverage.pct.toFixed(1)}% of word tokens are readable through your lexicon`}
        >
          <div
            style={{
              height: "100%",
              width: `${coverage.pct}%`,
              background: "var(--ac)",
              opacity: 0.7,
            }}
          />
        </div>
      )}

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
                {editing === `${r.a.target.kind}|${r.a.target.value}` ? (
                  <td colSpan={2}>
                    <span style={{ display: "flex", gap: 4 }}>
                      <input
                        className="input"
                        autoFocus
                        value={draftMeaning}
                        onChange={(e) => setDraftMeaning(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditing(null);
                          if (e.key === "Enter") {
                            upsertAnnotation(r.a.target, {
                              proposedMeaning: draftMeaning,
                              confidence: draftConf,
                            });
                            setEditing(null);
                          }
                        }}
                        style={{ flex: 1, fontSize: 12 }}
                      />
                      <select
                        className="select"
                        value={draftConf}
                        onChange={(e) =>
                          setDraftConf(e.target.value as Confidence)
                        }
                        style={{ fontSize: 11 }}
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          upsertAnnotation(r.a.target, {
                            proposedMeaning: draftMeaning,
                            confidence: draftConf,
                          });
                          setEditing(null);
                        }}
                      >
                        ✓
                      </button>
                    </span>
                  </td>
                ) : (
                  <>
                    <td
                      onClick={() => {
                        setEditing(`${r.a.target.kind}|${r.a.target.value}`);
                        setDraftMeaning(r.a.proposedMeaning);
                        setDraftConf(r.a.confidence);
                      }}
                      style={{ cursor: "text" }}
                      title="Click to edit the meaning and confidence in place"
                    >
                      {r.a.proposedMeaning || <span className="dim">—</span>}
                    </td>
                    <td>
                      <span
                        style={{
                          color: CONF_COLOR[r.a.confidence],
                          fontSize: 11,
                        }}
                      >
                        {r.a.confidence}
                      </span>
                    </td>
                  </>
                )}
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

      {previewCandidates.length > 0 && previewIns && (
        <div className="card" style={{ marginTop: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <h4 style={{ margin: 0 }}>Read a tablet through your lexicon</h4>
            <select
              className="select"
              value={previewId || previewCandidates[0].id}
              onChange={(e) => setPreviewId(e.target.value)}
              style={{ fontSize: 11, padding: "3px 6px" }}
              title="The tablets your glosses reach furthest into, by share of word tokens glossed"
            >
              {previewCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.hit}/{c.total} words glossed
                </option>
              ))}
            </select>
            <InscriptionLink id={previewIns.id} />
          </div>
          <div className="sub" style={{ marginBottom: 8 }}>
            Interlinear view: your proposed meanings under the words they
            gloss. Unglossed words show “?” — the to-do list, in context.
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {previewIns.lines.map((line, li) => (
              <div
                key={li}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <span
                  className="dim"
                  style={{ font: "10px var(--mono)", minWidth: 16 }}
                >
                  {li + 1}
                </span>
                {line.map((tok, ti) => {
                  const g = tok.includes("-")
                    ? glossed.get(tok.toUpperCase())
                    : undefined;
                  return (
                    <span
                      key={ti}
                      style={{
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      {tok.includes("-") ? (
                        <WordToken word={tok} />
                      ) : (
                        <span className="dim" style={{ fontSize: 12 }}>
                          {tok}
                        </span>
                      )}
                      {tok.includes("-") && (
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--serif)",
                            color: g ? "var(--gn)" : "var(--text-faint)",
                            maxWidth: 110,
                            textAlign: "center",
                          }}
                        >
                          {g ?? "?"}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
