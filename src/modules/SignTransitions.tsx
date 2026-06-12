import { useMemo, useState } from "react";
import {
  csvEscape,
  downloadFile,
  normalizeSignLabel,
  siglaSignListUrl,
} from "../lib/helpers";
import { useScopedMultiWords } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import { Glyph } from "../components/Glyph";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

interface TransitionData {
  outgoing: Map<string, Map<string, number>>; // from → (to → count)
  incoming: Map<string, Map<string, number>>; // to → (from → count)
  initial: Map<string, number>;
  final: Map<string, number>;
  signTotal: Map<string, number>;
  examples: Map<string, string[]>; // "a→b" → example words
  distinctTransitions: number;
  topSigns: string[];
}

// Graphotactics: which signs follow which within multi-sign words. Weighted
// by word attestation count (token frequency) so common words contribute
// proportionally to the observed structure.
function buildTransitions(
  words: { word: string; entry: { count: number } }[],
): TransitionData {
  const outgoing = new Map<string, Map<string, number>>();
  const incoming = new Map<string, Map<string, number>>();
  const initial = new Map<string, number>();
  const final = new Map<string, number>();
  const signTotal = new Map<string, number>();
  const examples = new Map<string, string[]>();

  const bump = (m: Map<string, Map<string, number>>, k: string, k2: string, c: number) => {
    let inner = m.get(k);
    if (!inner) {
      inner = new Map();
      m.set(k, inner);
    }
    inner.set(k2, (inner.get(k2) ?? 0) + c);
  };

  for (const { word, entry } of words) {
    const parts = word.split("-").map(normalizeSignLabel);
    if (parts.length < 2) continue;
    const c = entry.count;
    initial.set(parts[0], (initial.get(parts[0]) ?? 0) + c);
    final.set(parts[parts.length - 1], (final.get(parts[parts.length - 1]) ?? 0) + c);
    for (let i = 0; i < parts.length; i++) {
      signTotal.set(parts[i], (signTotal.get(parts[i]) ?? 0) + c);
      if (i < parts.length - 1) {
        const a = parts[i];
        const b = parts[i + 1];
        bump(outgoing, a, b, c);
        bump(incoming, b, a, c);
        const key = `${a}→${b}`;
        const ex = examples.get(key);
        if (!ex) examples.set(key, [word]);
        else if (ex.length < 6 && !ex.includes(word)) ex.push(word);
      }
    }
  }

  let distinctTransitions = 0;
  for (const inner of outgoing.values()) distinctTransitions += inner.size;

  const topSigns = [...signTotal.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 22)
    .map(([s]) => s);

  return {
    outgoing,
    incoming,
    initial,
    final,
    signTotal,
    examples,
    distinctTransitions,
    topSigns,
  };
}

export default function SignTransitions() {
  const words = useScopedMultiWords();
  // Pivots from other modules (e.g. a Sign Inventory row) open straight to
  // a sign's in/out profile.
  const initialIntent = useWorkbench.getState().moduleIntent;
  const [selected, setSelected] = useState<string | null>(
    initialIntent?.focus ? normalizeSignLabel(initialIntent.focus) : null,
  );
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const [probMode, setProbMode] = useState(false);

  const data = useMemo(() => buildTransitions(words), [words]);
  const signCount = data.signTotal.size;
  const possible = signCount * signCount;
  const density =
    possible > 0 ? (data.distinctTransitions / possible) * 100 : 0;

  // Max transition weight among top signs for heatmap scaling (log).
  const maxCell = useMemo(() => {
    let max = 0;
    for (const a of data.topSigns) {
      const inner = data.outgoing.get(a);
      if (!inner) continue;
      for (const b of data.topSigns) {
        const v = inner.get(b) ?? 0;
        if (v > max) max = v;
      }
    }
    return max;
  }, [data]);

  const allTransitions = useMemo(() => {
    const out: { a: string; b: string; c: number }[] = [];
    for (const [a, inner] of data.outgoing)
      for (const [b, c] of inner) out.push({ a, b, c });
    out.sort((x, y) => y.c - x.c);
    return out;
  }, [data]);

  // Row totals = total outgoing weight from each sign, the denominator for the
  // forward conditional probability P(next = b | current = a).
  const rowTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const [a, inner] of data.outgoing) {
      let s = 0;
      for (const c of inner.values()) s += c;
      m.set(a, s);
    }
    return m;
  }, [data]);

  const sel = selected;
  const outList = sel
    ? [...(data.outgoing.get(sel)?.entries() ?? [])].sort((a, b) => b[1] - a[1])
    : [];
  const inList = sel
    ? [...(data.incoming.get(sel)?.entries() ?? [])].sort((a, b) => b[1] - a[1])
    : [];

  function cellColor(v: number, rowTotal: number): string {
    if (v === 0) return "transparent";
    // In probability mode, color by the row-normalized conditional
    // probability P(next | row sign); otherwise by log-scaled raw count.
    const t = probMode
      ? rowTotal > 0
        ? v / rowTotal
        : 0
      : Math.log(1 + v) / Math.log(1 + maxCell);
    return `rgba(91, 158, 255, ${0.12 + t * 0.78})`;
  }

  const outSum = sel ? (rowTotals.get(sel) ?? 0) : 0;
  const inSum = inList.reduce((s, [, c]) => s + c, 0);
  const pct = (c: number, total: number) =>
    total > 0 ? `${((c / total) * 100).toFixed(0)}%` : "—";

  const findingSummary =
    `${signCount} signs · ${data.distinctTransitions} attested transitions · ` +
    `${density.toFixed(1)}% matrix density.\nMost frequent transitions: ` +
    (allTransitions
      .slice(0, 6)
      .map((t) => `${t.a}→${t.b} (${t.c})`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [["from_sign", "to_sign", "count"]];
    for (const t of allTransitions) rows.push([t.a, t.b, t.c]);
    downloadFile(
      "linear_a_sign_transitions.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 1500 }}>
      <h2>Sign Transitions</h2>
      <div className="callout">
        <h4>Graphotactics — which signs follow which</h4>
        <p>
          Within multi-sign words, which signs can precede or follow a given
          sign? Strong directional preferences and — just as telling — the{" "}
          <em>gaps</em> (sign pairs that never occur) reveal the structural
          constraints of the script: syllable-shape rules, signs restricted
          to word edges, and recurring sign clusters. Transitions are
          weighted by word attestation count.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{signCount}</span>
          <span className="lbl">Signs in words</span>
        </div>
        <div className="stat-box">
          <span className="val">{data.distinctTransitions}</span>
          <span className="lbl">Attested transitions</span>
        </div>
        <div className="stat-box">
          <span className="val">{density.toFixed(1)}%</span>
          <span className="lbl">Matrix density</span>
        </div>
        <div className="stat-box">
          <span className="val">{(100 - density).toFixed(1)}%</span>
          <span className="lbl">Never-occurring pairs</span>
        </div>
      </div>

      <div className="toolbar">
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Show conditional probabilities P(next | current) instead of raw transition counts"
        >
          <input
            type="checkbox"
            checked={probMode}
            onChange={(e) => setProbMode(e.target.checked)}
          />
          conditional probability
        </label>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="signtrans"
          moduleLabel="Sign Transitions"
          defaultTitle="Sign transitions"
          summary={findingSummary}
          reportFn={() => {
            const cap = 60;
            const slice = allTransitions.slice(0, cap).map((t, i) => ({
              ...t,
              rank: i + 1,
              p: (rowTotals.get(t.a) ?? 0) > 0
                ? t.c / (rowTotals.get(t.a) ?? 1)
                : 0,
              ex: (data.examples.get(`${t.a}→${t.b}`) ?? []).slice(0, 3),
            }));
            type R = (typeof slice)[number];
            const cols: SnippetColumn<R>[] = [
              {
                label: "#",
                render: (t) => `<span style="color:#6b7280;">${t.rank}</span>`,
                align: "right",
              },
              {
                label: "Transition",
                render: (t) =>
                  `<b style="font-family:ui-monospace,Menlo,monospace;">${esc(t.a)}</b>` +
                  ` <span style="color:#6b7280;">→</span> ` +
                  `<b style="font-family:ui-monospace,Menlo,monospace;color:#1d4ed8;">${esc(t.b)}</b>`,
                md: (t) => `${t.a} → ${t.b}`,
              },
              { label: "Count", render: (t) => esc(t.c), align: "right" },
              {
                label: "P(next|current)",
                render: (t) => esc((t.p * 100).toFixed(1) + "%"),
                align: "right",
              },
              {
                label: "Example words",
                render: (t) =>
                  t.ex
                    .map(
                      (w) =>
                        `<code style="background:#f3f4f6;padding:1px 4px;border-radius:2px;margin-right:4px;">${esc(w)}</code>`,
                    )
                    .join(""),
                md: (t) => t.ex.join(", "),
              },
            ];
            const meta = `${signCount} signs, ${data.distinctTransitions} attested transitions (${density.toFixed(1)}% matrix density). Showing top ${slice.length} by count.`;
            const html = snippetWrap(meta, snippetTable(slice, cols));
            const markdown = `_${meta}_\n\n` + snippetTableMd(slice, cols);
            return { html, markdown };
          }}
        />
      </div>

      <div className="col2">
        {/* Heatmap of top signs */}
        <div>
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Top-{data.topSigns.length} transition heatmap (row → column)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                fontFamily: "var(--mono)",
                fontSize: 9,
              }}
            >
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0 }}></th>
                  {data.topSigns.map((b) => (
                    <th
                      key={b}
                      style={{
                        padding: 1,
                        color: hoverCell?.endsWith(`→${b}`)
                          ? "var(--ac)"
                          : "var(--text-muted)",
                        writingMode: "vertical-rl",
                        height: 44,
                        fontSize: 8,
                      }}
                    >
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topSigns.map((a) => {
                  const inner = data.outgoing.get(a);
                  const rowTotal = rowTotals.get(a) ?? 0;
                  return (
                    <tr key={a}>
                      <th
                        style={{
                          padding: "1px 4px",
                          textAlign: "right",
                          position: "sticky",
                          left: 0,
                          background: "var(--bg)",
                          color: "var(--text-dim)",
                          fontSize: 9,
                        }}
                      >
                        {a}
                      </th>
                      {data.topSigns.map((b) => {
                        const v = inner?.get(b) ?? 0;
                        const key = `${a}→${b}`;
                        return (
                          <td
                            key={b}
                            title={
                              v > 0
                                ? probMode
                                  ? `${a} → ${b}: ${pct(v, rowTotal)} (${v})`
                                  : `${a} → ${b}: ${v}`
                                : `${a} → ${b}: never`
                            }
                            onMouseEnter={() => setHoverCell(key)}
                            onMouseLeave={() => setHoverCell(null)}
                            onClick={() => setSelected(a)}
                            style={{
                              width: 16,
                              height: 16,
                              background: cellColor(v, rowTotal),
                              border:
                                hoverCell === key
                                  ? "1px solid var(--ac)"
                                  : "1px solid var(--border)",
                              cursor: "pointer",
                            }}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="dim" style={{ fontSize: 10, marginTop: 6 }}>
            {probMode
              ? "Darker = higher P(column | row) — each row is normalized to its own outgoing total."
              : "Darker = more frequent transition (log-scaled)."}{" "}
            Blank = the pair never occurs adjacently. Click a row label or cell
            to inspect a sign.
          </div>
        </div>

        {/* Sign inspector */}
        <div>
          <div className="toolbar">
            <span
              style={{
                font: "600 10px var(--sans)",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Inspect sign
            </span>
            <select
              className="select"
              value={sel ?? ""}
              onChange={(e) => setSelected(e.target.value || null)}
            >
              <option value="">— pick a sign —</option>
              {[...data.signTotal.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([s, c]) => (
                  <option key={s} value={s}>
                    {s} ({c})
                  </option>
                ))}
            </select>
          </div>

          {!sel && (
            <div className="card">
              <div className="dim">
                Pick a sign (or click the heatmap) to see what precedes and
                follows it, and its word-edge behavior.
              </div>
            </div>
          )}

          {sel && (
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Glyph sign={sel} size={28} />
                <b style={{ font: "600 16px var(--mono)" }}>{sel}</b>
                <span className="dim">
                  {data.signTotal.get(sel)} occurrences ·{" "}
                  {data.initial.get(sel) ?? 0} word-initial ·{" "}
                  {data.final.get(sel) ?? 0} word-final
                </span>
              </div>

              <div className="col2" style={{ gap: 12 }}>
                <div>
                  <div
                    style={{
                      font: "600 9px var(--sans)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      marginBottom: 4,
                    }}
                  >
                    Precedes → ({outList.length})
                  </div>
                  {outList.slice(0, 14).map(([b, c]) => (
                    <div
                      key={b}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        padding: "1px 0",
                      }}
                      title={(data.examples.get(`${sel}→${b}`) ?? []).join(", ")}
                    >
                      <span style={{ minWidth: 44, fontFamily: "var(--mono)" }}>
                        {sel}-{b}
                      </span>
                      <div
                        style={{
                          height: 7,
                          background: "var(--ac)",
                          opacity: 0.5,
                          borderRadius: 1,
                          width: `${(c / outList[0][1]) * 100}%`,
                          minWidth: 2,
                        }}
                      />
                      <span
                        className="numeral"
                        style={{ fontSize: 10 }}
                        title={probMode ? `${c} occurrences` : undefined}
                      >
                        {probMode ? pct(c, outSum) : c}
                      </span>
                      <a
                        href={siglaSignListUrl(b)}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open SigLA for ${b} — per-scribe variant drawings`}
                        style={{
                          fontSize: 9,
                          color: "var(--text-dim)",
                          textDecoration: "none",
                        }}
                      >
                        ↗
                      </a>
                    </div>
                  ))}
                  {outList.length === 0 && (
                    <span className="dim" style={{ fontSize: 11 }}>
                      never word-medial/initial before another sign
                    </span>
                  )}
                </div>

                <div>
                  <div
                    style={{
                      font: "600 9px var(--sans)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      marginBottom: 4,
                    }}
                  >
                    ← Follows ({inList.length})
                  </div>
                  {inList.slice(0, 14).map(([a, c]) => (
                    <div
                      key={a}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        padding: "1px 0",
                      }}
                      title={(data.examples.get(`${a}→${sel}`) ?? []).join(", ")}
                    >
                      <span style={{ minWidth: 44, fontFamily: "var(--mono)" }}>
                        {a}-{sel}
                      </span>
                      <div
                        style={{
                          height: 7,
                          background: "var(--pu)",
                          opacity: 0.5,
                          borderRadius: 1,
                          width: `${(c / inList[0][1]) * 100}%`,
                          minWidth: 2,
                        }}
                      />
                      <span
                        className="numeral"
                        style={{ fontSize: 10 }}
                        title={probMode ? `${c} occurrences` : undefined}
                      >
                        {probMode ? pct(c, inSum) : c}
                      </span>
                      <a
                        href={siglaSignListUrl(a)}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open SigLA for ${a} — per-scribe variant drawings`}
                        style={{
                          fontSize: 9,
                          color: "var(--text-dim)",
                          textDecoration: "none",
                        }}
                      >
                        ↗
                      </a>
                    </div>
                  ))}
                  {inList.length === 0 && (
                    <span className="dim" style={{ fontSize: 11 }}>
                      never word-medial/final after another sign
                    </span>
                  )}
                </div>
              </div>

              {outList.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div
                    style={{
                      font: "600 9px var(--sans)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      marginBottom: 4,
                    }}
                  >
                    Example words ({sel} →{" "}
                    {outList[0][0]})
                  </div>
                  <div>
                    {(data.examples.get(`${sel}→${outList[0][0]}`) ?? []).map(
                      (w) => (
                        <WordToken key={w} word={w} />
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
