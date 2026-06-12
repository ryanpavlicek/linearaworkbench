import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus, useScopedMultiWords } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { InscriptionLink } from "../components/InscriptionLink";
import { WordToken } from "../components/WordToken";
import { WordAutocomplete } from "../components/WordAutocomplete";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

type SortMode = "source" | "left" | "right" | "position";

interface Row {
  inscriptionId: string;
  site: string;
  period: string;
  word: string; // the matched word (differs from the input under wildcards)
  position: number; // index in the inscription's word list
  total: number; // the inscription's word-token count (for relative position)
  ordinal: number; // index in the corpus inscription order
  leftCtx: string[];
  rightCtx: string[];
}

// KWIC = Keyword In Context. The standard corpus-linguistics view for
// inspecting how a target term is actually used across the corpus.
//
// Conventional sorting:
//   - left sort  → by reversed-left-context (so the immediate-left token
//                  groups identical neighbors together)
//   - right sort → by right-context (immediate-right token groups first)
//   - source     → by corpus order
export default function Concordance() {
  const inscriptions = useScopedCorpus().inscriptions;
  const words = useScopedMultiWords();
  const setActiveModule = useWorkbench((s) => s.setActiveModule);

  const [target, setTarget] = useState(
    () => useWorkbench.getState().moduleIntent?.focus ?? "",
  );
  const [windowSize, setWindowSize] = useState(4);
  const [sort, setSort] = useState<SortMode>("source");
  const [siteFilter, setSiteFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");

  const sites = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.site).filter(Boolean))].sort(),
    [inscriptions],
  );
  const periods = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.context).filter(Boolean))].sort(),
    [inscriptions],
  );

  // Compute one row per attestation of the target word, with surrounding
  // multi-sign-word context. Non-word tokens (numerals, separators) are
  // included verbatim — they're often part of the formulaic context.
  const rows = useMemo<Row[]>(() => {
    if (!target.trim()) return [];
    const upper = target.toUpperCase().trim();
    // Wildcards: `?` matches one sign, `*` any run of signs —
    // "KU-?-RO" finds every KU-x-RO; "*-RE" every word ending in RE.
    const isPattern = /[?*]/.test(upper);
    let rx: RegExp | null = null;
    if (isPattern) {
      try {
        rx = new RegExp(
          "^" +
            upper
              .replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*/g, ".*")
              .replace(/\?/g, "[^-]+") +
            "$",
        );
      } catch {
        rx = null;
      }
    }
    const out: Row[] = [];
    inscriptions.forEach((ins, idx) => {
      if (siteFilter && ins.site !== siteFilter) return;
      if (periodFilter && ins.context !== periodFilter) return;
      ins.words.forEach((w, i) => {
        const wu = w.toUpperCase();
        if (isPattern ? !(rx && rx.test(wu)) : wu !== upper) return;
        const leftStart = Math.max(0, i - windowSize);
        const rightEnd = Math.min(ins.words.length, i + windowSize + 1);
        out.push({
          inscriptionId: ins.id,
          site: ins.site,
          period: ins.context,
          word: w,
          position: i,
          total: ins.words.length,
          ordinal: idx,
          leftCtx: ins.words.slice(leftStart, i),
          rightCtx: ins.words.slice(i + 1, rightEnd),
        });
      });
    });
    return out;
  }, [inscriptions, target, windowSize, siteFilter, periodFilter]);

  // The most frequent multi-sign companions inside the visible windows —
  // a one-glance summary; the "Collocates →" button gives the
  // significance-tested view.
  const windowCompanions = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      for (const w of [...r.leftCtx, ...r.rightCtx]) {
        if (w.includes("-")) m.set(w, (m.get(w) ?? 0) + 1);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    if (sort === "left") {
      copy.sort((a, b) => {
        const al = a.leftCtx.slice().reverse().join("\t");
        const bl = b.leftCtx.slice().reverse().join("\t");
        return al.localeCompare(bl);
      });
    } else if (sort === "right") {
      copy.sort((a, b) =>
        a.rightCtx.join("\t").localeCompare(b.rightCtx.join("\t")),
      );
    } else if (sort === "position") {
      // Relative position within the inscription: document-openers first.
      const rel = (r: Row) => r.position / Math.max(1, r.total - 1);
      copy.sort((a, b) => rel(a) - rel(b) || a.ordinal - b.ordinal);
    } else {
      copy.sort((a, b) => a.ordinal - b.ordinal || a.position - b.position);
    }
    return copy;
  }, [rows, sort]);

  // Dispersion: position of each attestation along corpus order, 0-1
  const dispersion = useMemo(() => {
    if (rows.length === 0) return null;
    const N = inscriptions.length;
    const points = rows.map((r) => r.ordinal / Math.max(1, N - 1));
    return points;
  }, [rows, inscriptions.length]);

  // Quick-pick suggestions: top 20 most-frequent multi-sign words
  const suggestions = useMemo(
    () => words.slice(0, 20).map((w) => w.word),
    [words],
  );

  const findingTitle = target.trim()
    ? `KWIC: ${target.toUpperCase()}`
    : "Concordance";
  const findingSummary = target.trim()
    ? `Keyword-in-context for ${target.toUpperCase()}: ${rows.length} attestations` +
      (siteFilter ? `, site ${siteFilter}` : "") +
      (periodFilter ? `, period ${periodFilter}` : "") +
      `, ±${windowSize} window, sorted by ${sort}.`
    : "";

  return (
    <div className="panel">
      <h2>Concordance (KWIC)</h2>
      <div className="callout">
        <h4>Keyword-in-context view</h4>
        <p>
          Every attestation of a target word with its surrounding context
          tokens, sortable by the left or right context the way corpus
          linguists conventionally line up these views. Useful for spotting
          recurring fixed phrases, positional preferences, and clusters of
          neighbor words that suggest formulaic usage.
        </p>
      </div>

      <div className="toolbar">
        <WordAutocomplete
          value={target}
          onChange={setTarget}
          placeholder="Target word (e.g. KU-RO)"
          style={{ flex: 1, minWidth: 200 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          window
          <input
            type="number"
            className="input"
            min={1}
            max={12}
            value={windowSize}
            onChange={(e) => setWindowSize(Math.max(1, +e.target.value || 4))}
            style={{ width: 60 }}
          />
        </label>
        <select
          className="select"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="select"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
        >
          <option value="">All periods</option>
          {periods.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className="dim">{rows.length} attestations</span>
        {target.trim() && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() =>
              setActiveModule("cooc", {
                tab: "collocates",
                focus: target.toUpperCase().trim(),
              })
            }
            title="Which words share a tablet with this one more often than chance? Opens Co-occurrence in collocates-of mode."
          >
            Collocates →
          </button>
        )}
        {sortedRows.length > 0 && (
          <>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              const header = [
                "left_context",
                "keyword",
                "right_context",
                "position",
                "of_words",
                "inscription_id",
                "site",
                "period",
              ];
              const rowsCsv = [header.map(csvEscape).join(",")];
              for (const r of sortedRows) {
                rowsCsv.push(
                  [
                    r.leftCtx.join(" "),
                    r.word,
                    r.rightCtx.join(" "),
                    r.position + 1,
                    r.total,
                    r.inscriptionId,
                    r.site,
                    r.period,
                  ]
                    .map(csvEscape)
                    .join(","),
                );
              }
              downloadFile(
                `linear_a_kwic_${target.toUpperCase().replace(/[^A-Z0-9-]/g, "_")}.csv`,
                rowsCsv.join("\n"),
              );
            }}
            title="Download current KWIC view as CSV"
          >
            Export CSV
          </button>
          <SaveFindingButton
            module="kwic"
            moduleLabel="Concordance (KWIC)"
            defaultTitle={findingTitle}
            summary={findingSummary}
            payload={{ target, windowSize, sort, siteFilter, periodFilter }}
            reportFn={() => {
              const cap = 100;
              const slice = sortedRows.slice(0, cap);
              const kw = target.toUpperCase();
              const cols: SnippetColumn<(typeof slice)[number]>[] = [
                {
                  label: "Left",
                  render: (r) =>
                    `<span style="color:#374151;">${esc(r.leftCtx.join(" "))}</span>`,
                  align: "right",
                },
                {
                  label: kw,
                  render: () =>
                    `<b style="color:#b45309;">${esc(kw)}</b>`,
                },
                {
                  label: "Right",
                  render: (r) =>
                    `<span style="color:#374151;">${esc(r.rightCtx.join(" "))}</span>`,
                },
                {
                  label: "Tablet",
                  render: (r) =>
                    `<span style="color:#6b7280;">${esc(r.inscriptionId)}${r.site ? " · " + esc(r.site) : ""}${r.period ? " · " + esc(r.period) : ""}</span>`,
                },
              ];
              const meta = `${sortedRows.length} attestations of ${kw}; ±${windowSize} window; sorted by ${sort}${siteFilter ? `; site ${siteFilter}` : ""}${periodFilter ? `; period ${periodFilter}` : ""}. ${slice.length === sortedRows.length ? "All shown." : `Showing first ${cap}.`}`;
              const html = snippetWrap(meta, snippetTable(slice, cols));
              const markdown = `_${meta}_\n\n` + snippetTableMd(slice, cols);
              return { html, markdown };
            }}
          />
          </>
        )}
      </div>

      {!target.trim() && (
        <div className="card">
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Pick a starting target
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {suggestions.map((w) => (
              <button
                key={w}
                className="btn btn-outline btn-sm"
                onClick={() => setTarget(w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {dispersion && dispersion.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 4,
            }}
          >
            Dispersion across corpus
          </div>
          <div
            style={{
              position: "relative",
              height: 22,
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              overflow: "hidden",
            }}
            title={`${dispersion.length} attestations across ${inscriptions.length} inscriptions`}
          >
            {dispersion.map((p, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${p * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "var(--ac)",
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            <span>corpus start</span>
            <span>corpus end</span>
          </div>
        </div>
      )}

      {target.trim() && rows.length > 0 && (
        <>
          {windowCompanions.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 6,
                fontSize: 11,
              }}
            >
              <span
                className="dim"
                style={{
                  font: "600 9px var(--sans)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
                title="The most frequent multi-sign words inside the visible context windows — raw counts. The Collocates → button gives the significance-tested tablet-level view."
              >
                In-window companions:
              </span>
              {windowCompanions.map(([w, c]) => (
                <span key={w} style={{ whiteSpace: "nowrap" }}>
                  <WordToken word={w} />
                  <span className="dim" style={{ fontSize: 10 }}>
                    ×{c}
                  </span>
                </span>
              ))}
            </div>
          )}
          <div
            className="dim"
            style={{ fontSize: 11, marginBottom: 6 }}
          >
            Click a column header to sort. Wildcards in the target: ? = one
            sign, * = any run (e.g. KU-?-RO, *-RE).
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th
                    onClick={() => setSort("left")}
                    style={{
                      cursor: "pointer",
                      textAlign: "right",
                      borderRight: "1px solid var(--border)",
                      color: sort === "left" ? "var(--ac)" : undefined,
                    }}
                  >
                    Left context {sort === "left" ? "▾" : ""}
                  </th>
                  <th style={{ textAlign: "center", minWidth: 110 }}>
                    Keyword
                  </th>
                  <th
                    onClick={() => setSort("right")}
                    style={{
                      cursor: "pointer",
                      borderLeft: "1px solid var(--border)",
                      color: sort === "right" ? "var(--ac)" : undefined,
                    }}
                  >
                    Right context {sort === "right" ? "▾" : ""}
                  </th>
                  <th
                    onClick={() => setSort("position")}
                    style={{
                      cursor: "pointer",
                      color: sort === "position" ? "var(--ac)" : undefined,
                    }}
                    title="The keyword's slot within its inscription — sort to group document-openers, closers, and everything between"
                  >
                    Pos {sort === "position" ? "▾" : ""}
                  </th>
                  <th
                    onClick={() => setSort("source")}
                    style={{
                      cursor: "pointer",
                      color: sort === "source" ? "var(--ac)" : undefined,
                    }}
                  >
                    Source {sort === "source" ? "▾" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.slice(0, 250).map((r, i) => (
                  <tr key={`${r.inscriptionId}-${r.position}-${i}`}>
                    <td
                      style={{
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        color: "var(--text-dim)",
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        borderRight: "1px solid var(--border)",
                        paddingRight: 8,
                      }}
                    >
                      {r.leftCtx.map((w, j) =>
                        w.includes("-") ? (
                          <WordToken key={j} word={w} />
                        ) : (
                          <span key={j} className="dim">
                            {w}{" "}
                          </span>
                        ),
                      )}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        background: "var(--ac-soft)",
                        fontWeight: 600,
                      }}
                    >
                      <b style={{ color: "var(--ac)" }}>{r.word}</b>
                    </td>
                    <td
                      style={{
                        whiteSpace: "nowrap",
                        color: "var(--text-dim)",
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        borderLeft: "1px solid var(--border)",
                        paddingLeft: 8,
                      }}
                    >
                      {r.rightCtx.map((w, j) =>
                        w.includes("-") ? (
                          <WordToken key={j} word={w} />
                        ) : (
                          <span key={j} className="dim">
                            {w}{" "}
                          </span>
                        ),
                      )}
                    </td>
                    <td
                      className="dim"
                      style={{ fontSize: 10, whiteSpace: "nowrap" }}
                      title={`Word ${r.position + 1} of ${r.total} on ${r.inscriptionId}`}
                    >
                      {r.position + 1}/{r.total}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <InscriptionLink id={r.inscriptionId} />
                      <span
                        className="dim"
                        style={{ marginLeft: 6, fontSize: 10 }}
                      >
                        {r.site}
                        {r.period ? ` · ${r.period}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedRows.length > 250 && (
            <div className="dim" style={{ fontSize: 11, padding: 8 }}>
              Showing 250 of {sortedRows.length} attestations. Narrow the
              filters to see more.
            </div>
          )}
        </>
      )}

      {target.trim() && rows.length === 0 && (
        <div className="card">
          <div className="dim">
            No attestations of <b>{target.toUpperCase()}</b> match the
            current filters.
          </div>
        </div>
      )}
    </div>
  );
}
