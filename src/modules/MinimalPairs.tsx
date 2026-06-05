import { Fragment, useMemo, useState } from "react";
import { csvEscape, downloadFile } from "../lib/helpers";
import { useScopedMultiWords } from "../store/scope";
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

type PositionFilter = "any" | "initial" | "medial" | "final";
type LenFilter = "any" | "2" | "3" | "4" | "5plus";

interface PairInstance {
  wordA: string;
  wordB: string;
  signA: string;
  signB: string;
  position: number;
  length: number;
  role: "initial" | "medial" | "final";
}

interface Alternation {
  key: string; // "X~Y" with X<Y lexicographically
  signX: string;
  signY: string;
  roles: Set<string>;
  pairs: PairInstance[];
}

// Minimal pairs: two multi-sign words of equal length that differ in exactly
// one sign position. Found efficiently by bucketing each word under a
// wildcard key (signs with one position blanked) — words sharing a key and
// differing at the blanked position form minimal pairs. O(W·L).
function findMinimalPairs(
  words: { word: string }[],
): { pairs: PairInstance[]; alternations: Alternation[] } {
  const buckets = new Map<string, { word: string; sign: string; pos: number; len: number }[]>();
  for (const { word } of words) {
    const signs = word.split("-");
    const L = signs.length;
    if (L < 2) continue;
    for (let p = 0; p < L; p++) {
      const key =
        signs.map((s, i) => (i === p ? "·" : s)).join("-") + `#${p}#${L}`;
      let arr = buckets.get(key);
      if (!arr) {
        arr = [];
        buckets.set(key, arr);
      }
      arr.push({ word, sign: signs[p], pos: p, len: L });
    }
  }

  const pairs: PairInstance[] = [];
  const altMap = new Map<string, Alternation>();
  const roleOf = (p: number, L: number): PairInstance["role"] =>
    p === 0 ? "initial" : p === L - 1 ? "final" : "medial";

  for (const arr of buckets.values()) {
    if (arr.length < 2) continue;
    // distinct signs at the blanked position
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i].sign === arr[j].sign) continue; // same word repeated? skip
        if (arr[i].word === arr[j].word) continue;
        const role = roleOf(arr[i].pos, arr[i].len);
        const inst: PairInstance = {
          wordA: arr[i].word,
          wordB: arr[j].word,
          signA: arr[i].sign,
          signB: arr[j].sign,
          position: arr[i].pos,
          length: arr[i].len,
          role,
        };
        pairs.push(inst);
        const [x, y] = [arr[i].sign, arr[j].sign].sort();
        const key = `${x}~${y}`;
        let alt = altMap.get(key);
        if (!alt) {
          alt = { key, signX: x, signY: y, roles: new Set(), pairs: [] };
          altMap.set(key, alt);
        }
        alt.roles.add(role);
        alt.pairs.push(inst);
      }
    }
  }

  const alternations = [...altMap.values()].sort(
    (a, b) => b.pairs.length - a.pairs.length,
  );
  return { pairs, alternations };
}

export default function MinimalPairs() {
  const words = useScopedMultiWords();
  const [posFilter, setPosFilter] = useState<PositionFilter>("any");
  const [lenFilter, setLenFilter] = useState<LenFilter>("any");
  const [minPairs, setMinPairs] = useState(1);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { sort, toggle, sortRows } = useSort("pairs", "desc");

  // Restrict the words considered to a chosen length (minimal pairs are always
  // equal-length, so filtering the input restricts the whole analysis).
  const lenWords = useMemo(() => {
    if (lenFilter === "any") return words;
    return words.filter((w) => {
      const L = w.word.split("-").length;
      return lenFilter === "5plus" ? L >= 5 : L === +lenFilter;
    });
  }, [words, lenFilter]);

  const { pairs, alternations } = useMemo(
    () => findMinimalPairs(lenWords),
    [lenWords],
  );

  const filtered = useMemo(() => {
    const u = q.toUpperCase();
    return alternations.filter((alt) => {
      if (posFilter !== "any" && !alt.roles.has(posFilter)) return false;
      if (alt.pairs.length < minPairs) return false;
      if (u && !alt.signX.includes(u) && !alt.signY.includes(u)) return false;
      return true;
    });
  }, [alternations, posFilter, minPairs, q]);

  const sorted = sortRows(filtered, {
    alt: (a) => a.key,
    pairs: (a) => a.pairs.length,
    positions: (a) => a.roles.size,
  });

  const lenLabel =
    lenFilter === "any"
      ? ""
      : lenFilter === "5plus"
        ? "5+ signs"
        : `${lenFilter} signs`;
  const findingTitle =
    `Minimal pairs` +
    (posFilter !== "any" ? ` — ${posFilter}` : "") +
    (lenLabel ? ` — ${lenLabel}` : "") +
    (q ? ` — “${q}”` : "");
  const findingSummary =
    `${pairs.length} minimal pairs · ${alternations.length} distinct alternations` +
    (posFilter !== "any" ? ` (${posFilter} position)` : "") +
    (lenLabel ? ` · ${lenLabel}` : "") +
    (minPairs > 1 ? ` · ≥${minPairs} pairs` : "") +
    (q ? ` · filter “${q}”` : "") +
    `.\nTop: ` +
    (sorted
      .slice(0, 6)
      .map((a) => `${a.signX}~${a.signY} (${a.pairs.length})`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["sign_a", "sign_b", "word_a", "word_b", "position", "length", "role"],
    ];
    for (const alt of sorted) {
      for (const p of alt.pairs) {
        rows.push([
          p.signA,
          p.signB,
          p.wordA,
          p.wordB,
          p.position + 1,
          p.length,
          p.role,
        ]);
      }
    }
    downloadFile(
      "linear_a_minimal_pairs.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Minimal Pairs</h2>
      <div className="callout">
        <h4>Words differing by a single sign</h4>
        <p>
          Two words of the same length that differ in exactly one sign
          position form a minimal pair (e.g. <code>KU-RO</code> /{" "}
          <code>KU-RE</code>). The recurring <em>alternations</em> — which
          signs substitute for which, and where in the word — are a classic
          handle on morphology (inflectional endings), phonological
          variation, and sign-value hypotheses. A sign pair that alternates
          productively in word-final position is a strong candidate for an
          inflectional contrast.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{pairs.length}</span>
          <span className="lbl">Minimal pairs</span>
        </div>
        <div className="stat-box">
          <span className="val">{alternations.length}</span>
          <span className="lbl">Distinct alternations</span>
        </div>
        <div className="stat-box">
          <span className="val">
            {alternations.filter((a) => a.roles.has("final")).length}
          </span>
          <span className="lbl">Final-position alternations</span>
        </div>
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter by sign (e.g. RO)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
          {(
            [
              ["any", "Any position"],
              ["initial", "Initial"],
              ["medial", "Medial"],
              ["final", "Final"],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              className={`tab-btn${posFilter === k ? " active" : ""}`}
              onClick={() => setPosFilter(k)}
            >
              {lbl}
            </button>
          ))}
        </div>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Restrict to words of a given sign-length"
        >
          length
          <select
            className="select"
            value={lenFilter}
            onChange={(e) => setLenFilter(e.target.value as LenFilter)}
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="any">any</option>
            <option value="2">2 signs</option>
            <option value="3">3 signs</option>
            <option value="4">4 signs</option>
            <option value="5plus">5+ signs</option>
          </select>
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum number of word pairs for the alternation"
        >
          ≥ pairs
          <input
            type="number"
            className="input"
            min={1}
            value={minPairs}
            onChange={(e) => setMinPairs(Math.max(1, +e.target.value || 1))}
            style={{ width: 56, fontSize: 11, padding: "3px 6px" }}
          />
        </label>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="minpairs"
          moduleLabel="Minimal Pairs"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ posFilter, lenFilter, minPairs, q }}
          reportFn={() => {
            const cap = 100;
            const slice = sorted.slice(0, cap);
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              {
                label: "Alternation",
                render: (a) =>
                  `<b style="color:#1d4ed8;font-family:ui-monospace,Menlo,monospace;">${esc(a.signX)}</b>` +
                  ` <span style="color:#6b7280;">~</span> ` +
                  `<b style="color:#6d28d9;font-family:ui-monospace,Menlo,monospace;">${esc(a.signY)}</b>`,
                md: (a) => `${a.signX} ~ ${a.signY}`,
              },
              {
                label: "Pairs",
                render: (a) => esc(a.pairs.length),
                align: "right",
              },
              {
                label: "Positions",
                render: (a) => esc([...a.roles].sort().join(", ")),
              },
              {
                label: "Examples",
                render: (a) =>
                  a.pairs
                    .slice(0, 4)
                    .map(
                      (p) =>
                        `<code style="background:#f3f4f6;padding:1px 4px;border-radius:2px;margin-right:4px;">${esc(p.wordA)}/${esc(p.wordB)}</code>`,
                    )
                    .join("") +
                  (a.pairs.length > 4
                    ? `<span style="color:#6b7280;font-size:10px;"> +${a.pairs.length - 4} more</span>`
                    : ""),
                md: (a) => a.pairs.slice(0, 4).map((p) => `${p.wordA}/${p.wordB}`).join(", "),
              },
            ];
            const meta = `${sorted.length} alternations${slice.length === sorted.length ? "" : `; showing first ${cap}`}.`;
            const html = snippetWrap(meta, snippetTable(slice, cols));
            const markdown = `_${meta}_\n\n` + snippetTableMd(slice, cols);
            return { html, markdown };
          }}
        />
      </div>

      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
        {filtered.length} alternations · click a row to see the word pairs
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortHeader label="Alternation" sortKey="alt" sort={sort} onToggle={toggle} />
              <SortHeader label="Word pairs" sortKey="pairs" sort={sort} onToggle={toggle} />
              <SortHeader label="Positions" sortKey="positions" sort={sort} onToggle={toggle} />
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 250).map((alt) => {
              const isOpen = expanded === alt.key;
              return (
                <Fragment key={alt.key}>
                  <tr
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : alt.key)}
                  >
                    <td>
                      <span style={{ marginRight: 6, color: "var(--text-muted)" }}>
                        {isOpen ? "▾" : "▸"}
                      </span>
                      <b style={{ color: "var(--ac)", fontFamily: "var(--mono)" }}>
                        {alt.signX}
                      </b>
                      <span className="dim"> ~ </span>
                      <b style={{ color: "var(--pu)", fontFamily: "var(--mono)" }}>
                        {alt.signY}
                      </b>
                    </td>
                    <td className="numeral">{alt.pairs.length}</td>
                    <td style={{ fontSize: 11 }}>
                      {[...alt.roles].map((r) => (
                        <span key={r} className="tag tag-domain">
                          {r}
                        </span>
                      ))}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {alt.pairs.slice(0, 2).map((p, i) => (
                        <span key={i} className="dim">
                          {p.wordA}/{p.wordB}
                          {i === 0 && alt.pairs.length > 1 ? ", " : ""}
                        </span>
                      ))}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={4} style={{ background: "var(--surface-0)" }}>
                        <div
                          style={{
                            padding: "8px 16px",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          {alt.pairs.map((p, i) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                background: "var(--surface-1)",
                                border: "1px solid var(--border)",
                                borderRadius: 4,
                                fontSize: 11,
                              }}
                            >
                              <WordToken word={p.wordA} />
                              <span className="dim">/</span>
                              <WordToken word={p.wordB} />
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
