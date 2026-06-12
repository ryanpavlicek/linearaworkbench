import { Fragment, useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import { csvEscape, downloadFile } from "../lib/helpers";
import { sequenceDistance } from "../lib/algorithms";
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

  // Canonical anchor order, computed from the data: each formula word's
  // mean relative position across the libation inscriptions. The formula's
  // slot structure (opener … deity … closing pair) emerges from the corpus
  // instead of being asserted.
  const anchors = useMemo(() => {
    const pos = new Map<string, { sum: number; n: number }>();
    for (const ins of hits) {
      const ws = ins.words.filter((w) => w.includes("-"));
      // Single-word inscriptions (the I-DA-MA-TE double-axe dedications)
      // carry no ordering information — they don't vote.
      if (ws.length < 2) continue;
      ws.forEach((w, i) => {
        if (!libSet.has(w)) return;
        const p = pos.get(w) ?? { sum: 0, n: 0 };
        p.sum += i / (ws.length - 1);
        p.n++;
        pos.set(w, p);
      });
    }
    return [...pos.entries()]
      .filter(([, p]) => p.n >= 2)
      .sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)
      .map(([w, p]) => ({ word: w, n: p.n }))
      .slice(0, 6);
  }, [hits, libSet]);

  // Anchored alignment: place each inscription's words into the slots
  // between consecutive canonical anchors. Anchors found out of canonical
  // order fall into a gap as ordinary (visible) fillers — the alignment
  // never silently reorders a text.
  const aligned = useMemo(() => {
    const names = anchors.map((a) => a.word);
    return hits.map((ins) => {
      const ws = ins.words.filter((w) => w.includes("-"));
      const gaps: string[][] = Array.from(
        { length: names.length + 1 },
        () => [],
      );
      const present: boolean[] = new Array(names.length).fill(false);
      let cursor = 0;
      for (const w of ws) {
        const ai = names.indexOf(w);
        if (ai >= 0 && ai >= cursor) {
          present[ai] = true;
          cursor = ai + 1;
        } else {
          gaps[cursor].push(w);
        }
      }
      return { ins, gaps, present };
    });
  }, [hits, anchors]);

  // Slot fillers: what actually occupies each gap, aggregated across the
  // aligned inscriptions — the dedicant names sit between the opener and
  // the deity word, and so on.
  const slotFillers = useMemo(() => {
    const tallies: Map<string, number>[] = Array.from(
      { length: anchors.length + 1 },
      () => new Map(),
    );
    for (const { gaps } of aligned) {
      gaps.forEach((g, i) => {
        for (const w of g) tallies[i].set(w, (tallies[i].get(w) ?? 0) + 1);
      });
    }
    return tallies.map((t) =>
      [...t.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    );
  }, [aligned, anchors]);

  // Candidate spelling variants: corpus words within sign-level edit
  // distance ≤ 2 of a formula word (≥3 signs, not themselves formula
  // words) — JA-SA-SA-RA-MA-NA next to JA-SA-SA-RA-ME, and the like.
  const variants = useMemo(() => {
    const out: {
      formula: string;
      variant: string;
      count: number;
      dist: number;
    }[] = [];
    for (const f of LIB_WORDS) {
      const fSigns = f.split("-");
      // Length-scaled threshold: one sign of slack for short formula
      // words, two for the long ones — otherwise every 3-sign word is
      // "near" TA-NA-TE and the list is noise.
      const maxD = fSigns.length >= 5 ? 2 : 1;
      for (const [w, e] of wordIndex) {
        if (!w.includes("-") || libSet.has(w)) continue;
        const signs = w.split("-");
        if (signs.length < 3) continue;
        const d = sequenceDistance(fSigns, signs);
        if (d > 0 && d <= maxD) {
          out.push({ formula: f, variant: w, count: e.count, dist: d });
        }
      }
    }
    out.sort(
      (a, b) =>
        a.formula.localeCompare(b.formula) ||
        a.dist - b.dist ||
        b.count - a.count,
    );
    return out;
  }, [wordIndex, libSet]);

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
            marginBottom: 4,
          }}
        >
          Anchored alignment
        </h4>
        <div className="sub" style={{ marginBottom: 8 }}>
          Each text aligned on the formula anchors, in the canonical order
          the corpus itself yields (mean relative position). ✓ = the anchor
          is present; the cells between hold whatever fills that slot on
          that vessel — dedicant names, places, additions. Words appearing
          out of canonical order stay visible as slot content; nothing is
          reordered.
        </div>
        <div className="table-wrap">
          <table style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th>Inscription</th>
                <th>Site</th>
                <th className="dim">(pre)</th>
                {anchors.map((a) => (
                  <th
                    key={a.word}
                    style={{ color: "var(--pu)", whiteSpace: "nowrap" }}
                    title={`${a.word} — in ${a.n} of the libation texts`}
                  >
                    {a.word}
                  </th>
                ))}
                <th className="dim">(post)</th>
              </tr>
            </thead>
            <tbody>
              {aligned.slice(0, 80).map(({ ins, gaps, present }) => (
                <tr key={ins.id}>
                  <td>
                    <InscriptionLink id={ins.id} />
                  </td>
                  <td className="site-text">{ins.site}</td>
                  {gaps.map((g, i) => {
                    const gapCell = (
                      <td key={`g${i}`} style={{ maxWidth: 180 }}>
                        {g.slice(0, 3).map((w) => (
                          <WordToken key={w + i} word={w} />
                        ))}
                        {g.length > 3 && (
                          <span className="dim">+{g.length - 3}</span>
                        )}
                      </td>
                    );
                    if (i === gaps.length - 1) return gapCell;
                    return (
                      <Fragment key={i}>
                        {gapCell}
                        <td
                          style={{
                            textAlign: "center",
                            color: present[i]
                              ? "var(--pu)"
                              : "var(--text-faint)",
                          }}
                        >
                          {present[i] ? "✓" : "·"}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="col2" style={{ marginTop: 12, alignItems: "start" }}>
        <div className="card">
          <h4>What fills each slot</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            The non-formula words occupying each gap, aggregated across the
            aligned texts. The slot between the opener and the deity word is
            where the dedicant names live.
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {slotFillers.map((fillers, i) => {
              if (fillers.length === 0) return null;
              const before = i === 0 ? null : anchors[i - 1]?.word;
              const after = i < anchors.length ? anchors[i]?.word : null;
              const label =
                before && after
                  ? `${before} → ${after}`
                  : before
                    ? `after ${before}`
                    : `before ${after}`;
              return (
                <div key={i} style={{ fontSize: 11 }}>
                  <div
                    className="dim"
                    style={{
                      font: "600 9px var(--sans)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 2,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ lineHeight: 1.9 }}>
                    {fillers.map(([w, c]) => (
                      <span key={w} style={{ marginRight: 6 }}>
                        <WordToken word={w} />
                        <span className="dim" style={{ fontSize: 10 }}>
                          ×{c}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h4>
            Candidate variants{" "}
            <span className="dim">({variants.length})</span>
          </h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            Corpus words within sign-level edit distance ≤ 2 of a formula
            word — candidate spellings, inflections, or damaged readings of
            the formula vocabulary. Judge each by eye; proximity is not
            identity.
          </div>
          {variants.length === 0 ? (
            <div className="dim" style={{ fontSize: 12 }}>
              No near-miss words in the current scope.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 3 }}>
              {variants.slice(0, 20).map((v) => (
                <div
                  key={`${v.formula}|${v.variant}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    flexWrap: "wrap",
                  }}
                >
                  <b style={{ color: "var(--pu)", fontFamily: "var(--mono)" }}>
                    {v.formula}
                  </b>
                  <span className="dim">≈</span>
                  <WordToken word={v.variant} />
                  <span className="dim" style={{ fontSize: 10 }}>
                    ×{v.count} · {v.dist} sign{v.dist === 1 ? "" : "s"} apart
                  </span>
                </div>
              ))}
              {variants.length > 20 && (
                <span className="dim" style={{ fontSize: 11 }}>
                  +{variants.length - 20} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
