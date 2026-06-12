import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import { csvEscape, downloadFile } from "../lib/helpers";
import { WordToken } from "../components/WordToken";
import { InscriptionLink } from "../components/InscriptionLink";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import { LIBATION_WORDS as LIB_WORDS } from "../data/libation";

export default function LibationFormulas() {
  const scoped = useScopedCorpus();
  const inscriptions = scoped.inscriptions;
  const wordIndex = scoped.wordIndex;
  const libSet = useMemo(() => new Set(LIB_WORDS), []);
  const createCollectionWithItems = useWorkbench(
    (s) => s.createCollectionWithItems,
  );
  const setScope = useWorkbench((s) => s.setScope);
  const toast = useWorkbench((s) => s.toast_show);
  const [collPromptOpen, setCollPromptOpen] = useState(false);
  const [collName, setCollName] = useState("");

  const hits = useMemo(
    () => inscriptions.filter((i) => i.words.some((w) => libSet.has(w))),
    [inscriptions, libSet],
  );

  const findingSummary =
    `${hits.length} libation inscriptions sharing formula words.\n` +
    `Formula word counts: ` +
    LIB_WORDS.map((w) => `${w} (${wordIndex.get(w)?.count ?? 0})`).join(", ") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["inscription", "site", "period", "formula_words_present", "text"],
    ];
    for (const ins of hits) {
      const present = [...new Set(ins.words.filter((w) => libSet.has(w)))];
      rows.push([
        ins.id,
        ins.site,
        ins.context,
        present.join(" "),
        ins.words.join(" "),
      ]);
    }
    downloadFile(
      "linear_a_libation_formulas.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Libation Formulas</h2>
      <div className="callout">
        <h4>Peak-sanctuary recitation</h4>
        <p>
          Libation tables show recurring formulaic text. Key candidates:{" "}
          <code>A-TA-I-*301-WA-JA</code> (dedicatory?),{" "}
          <code>JA-SA-SA-RA-ME</code> (deity/epithet?),{" "}
          <code>A-DI-KI-TE-TE-DU</code> (ritual verb?).
        </p>
      </div>
      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{hits.length}</span>
          <span className="lbl">Libation inscriptions</span>
        </div>
        <div className="stat-box">
          <span className="val">{LIB_WORDS.length}</span>
          <span className="lbl">Formula words</span>
        </div>
      </div>

      <div className="toolbar">
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-outline btn-sm"
          disabled={hits.length === 0}
          onClick={() => {
            const id = createCollectionWithItems(
              `Libation tablets (${hits.length})`,
              hits.map((i) => ({
                kind: "inscription" as const,
                value: i.id,
              })),
            );
            if (id) {
              setScope({
                site: null,
                period: null,
                scribe: null,
                support: null,
                collectionId: id,
              });
              toast(
                `Scope set to ${hits.length} libation tablets — every other module will compute over just these`,
              );
            }
          }}
          title={`Use these ${hits.length} libation tablets as the global corpus scope`}
        >
          ◇ Use as scope
        </button>
        <button
          className="btn btn-outline btn-sm"
          disabled={hits.length === 0}
          onClick={() => setCollPromptOpen((o) => !o)}
          title="Save these tablets as a named collection"
        >
          + Save as collection
        </button>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="lib"
          moduleLabel="Libation Formulas"
          defaultTitle="Libation formulas"
          summary={findingSummary}
          reportFn={() => {
            // Top-level formula-word counts + the matching inscriptions
            type Row = {
              insId: string;
              site: string;
              period: string;
              formulas: string[];
              excerpt: string;
            };
            const rows: Row[] = hits.map((ins) => ({
              insId: ins.id,
              site: ins.site,
              period: ins.context,
              formulas: [...new Set(ins.words.filter((w) => libSet.has(w)))],
              excerpt:
                ins.words.slice(0, 10).join(" ") +
                (ins.words.length > 10 ? " …" : ""),
            }));
            const cap = 100;
            const slice = rows.slice(0, cap);
            const insCols: SnippetColumn<Row>[] = [
              { label: "Inscription", render: (r) => `<code>${esc(r.insId)}</code>` },
              { label: "Site", render: (r) => esc(r.site) },
              { label: "Period", render: (r) => esc(r.period || "—") },
              {
                label: "Formulas present",
                render: (r) =>
                  r.formulas
                    .map(
                      (f) =>
                        `<code style="background:#ede9fe;color:#6d28d9;padding:1px 4px;border-radius:2px;margin-right:3px;">${esc(f)}</code>`,
                    )
                    .join(""),
                md: (r) => r.formulas.join(", "),
              },
              { label: "Excerpt", render: (r) => esc(r.excerpt) },
            ];
            // Formula-counts header table
            const counts = LIB_WORDS.map((w) => ({
              word: w,
              count: wordIndex.get(w)?.count ?? 0,
            }));
            const countCols: SnippetColumn<(typeof counts)[number]>[] = [
              { label: "Formula word", render: (c) => `<code>${esc(c.word)}</code>` },
              { label: "Attestations", render: (c) => esc(c.count), align: "right" },
            ];
            const meta = `${hits.length} libation inscriptions sharing ${LIB_WORDS.length} known formula words.${slice.length < hits.length ? ` Showing first ${cap}.` : ""}`;
            const html =
              snippetWrap(meta, snippetTable(counts, countCols)) +
              `<div style="margin-top:10px;font-size:11px;color:#6b7280;">Inscriptions:</div>` +
              snippetTable(slice, insCols);
            const markdown =
              `_${meta}_\n\n` +
              snippetTableMd(counts, countCols) +
              "\n\n_Inscriptions:_\n\n" +
              snippetTableMd(slice, insCols);
            return { html, markdown };
          }}
        />
      </div>

      {collPromptOpen && (
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            margin: "0 0 12px",
            padding: "6px 8px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          <span className="dim" style={{ fontSize: 11 }}>
            Collection name:
          </span>
          <input
            className="input"
            autoFocus
            value={collName}
            onChange={(e) => setCollName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setCollPromptOpen(false);
                setCollName("");
              }
              if (e.key === "Enter" && collName.trim()) {
                createCollectionWithItems(
                  collName.trim(),
                  hits.map((i) => ({
                    kind: "inscription" as const,
                    value: i.id,
                  })),
                );
                toast(`Saved "${collName.trim()}" (${hits.length} tablets)`);
                setCollName("");
                setCollPromptOpen(false);
              }
            }}
            placeholder='e.g. "Libation tablets — formula corpus"'
            style={{ flex: 1, fontSize: 12 }}
          />
          <button
            className="btn btn-sm"
            disabled={!collName.trim()}
            onClick={() => {
              createCollectionWithItems(
                collName.trim(),
                hits.map((i) => ({
                  kind: "inscription" as const,
                  value: i.id,
                })),
              );
              toast(`Saved "${collName.trim()}" (${hits.length} tablets)`);
              setCollName("");
              setCollPromptOpen(false);
            }}
          >
            Save ({hits.length})
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setCollPromptOpen(false);
              setCollName("");
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="card">
        <h4>Formula words</h4>
        <div style={{ marginTop: 4 }}>
          {LIB_WORDS.map((w) => {
            const e = wordIndex.get(w);
            return (
              <span key={w} style={{ marginRight: 16 }}>
                <WordToken word={w} />{" "}
                <span className="dim">×{e?.count ?? 0}</span>
              </span>
            );
          })}
        </div>
      </div>

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
          Structural alignment
        </h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Inscription</th>
                <th>Site</th>
                <th>Slot 1</th>
                <th>Slot 2</th>
                <th>Slot 3</th>
                <th>Slot 4+</th>
              </tr>
            </thead>
            <tbody>
              {hits.slice(0, 80).map((ins) => {
                const ws = ins.words.filter((w) => w.includes("-"));
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < 4; i++) {
                  const w = ws[i];
                  if (!w) {
                    cells.push(
                      <td key={i} className="dim">
                        —
                      </td>,
                    );
                  } else if (libSet.has(w)) {
                    cells.push(
                      <td key={i}>
                        <b style={{ color: "var(--pu)" }}>{w}</b>
                      </td>,
                    );
                  } else {
                    cells.push(
                      <td key={i}>
                        <WordToken word={w} />
                      </td>,
                    );
                  }
                }
                return (
                  <tr key={ins.id}>
                    <td>
                      <InscriptionLink id={ins.id} />
                    </td>
                    <td className="site-text">{ins.site}</td>
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
