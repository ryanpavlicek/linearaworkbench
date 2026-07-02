import { Fragment, useMemo, useState } from "react";
import { csvEscape, downloadFile } from "../lib/helpers";
import { useScopedMultiWords } from "../store/scope";
import { mulberry32 } from "../lib/lexstats";
import { lookupPhonetic } from "../lib/signKeys";
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
type PhonoType = "vowel" | "consonant" | "both" | "opaque";

const PHONO_LABEL: Record<PhonoType, string> = {
  vowel: "V-alternation",
  consonant: "C-alternation",
  both: "CV-alternation",
  opaque: "no AB values",
};

// Decompose a Linear B phonetic value into (consonant onset, vowel
// nucleus). "ku" → ["k","u"], "a" → ["","a"], "kwa"/"dwe" keep their
// complex onsets. Returns null for signs without a usable value —
// subscripted signs (PU₂, RA₂, …) are distinct signs with no attested AB
// value, so they never decompose via their plain series.
function cvOf(sign: string): [string, string] | null {
  const p = lookupPhonetic(sign);
  if (!p) return null;
  const m = /^([^aeiou]*)([aeiou]+)$/.exec(p.toLowerCase());
  return m ? [m[1], m[2]] : null;
}

// What changes phonologically between the two alternating signs — under
// the conventional Linear B values, clearly labeled as such. A pair that
// alternates the VOWEL while keeping the consonant (KU-RO ~ KU-RE: -ro/-re)
// is the classic inflection signature; consonant alternations point at
// phonological variation or sign-confusion instead.
function phonoTypeOf(signX: string, signY: string): {
  type: PhonoType;
  detail: string;
} {
  const a = cvOf(signX);
  const b = cvOf(signY);
  if (!a || !b) return { type: "opaque", detail: "" };
  const [ca, va] = a;
  const [cb, vb] = b;
  if (ca === cb && va !== vb)
    return { type: "vowel", detail: `${ca || "∅"}—: ${va}~${vb}` };
  if (va === vb && ca !== cb)
    return { type: "consonant", detail: `—${va}: ${ca || "∅"}~${cb || "∅"}` };
  return { type: "both", detail: `${ca || "∅"}${va}~${cb || "∅"}${vb}` };
}

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
  const [typeFilter, setTypeFilter] = useState<"any" | PhonoType>("any");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{
    mean: number;
    min: number;
    max: number;
    reps: number;
  } | null>(null);
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
      if (
        typeFilter !== "any" &&
        phonoTypeOf(alt.signX, alt.signY).type !== typeFilter
      )
        return false;
      return true;
    });
  }, [alternations, posFilter, minPairs, q, typeFilter]);

  // Vowel-alternation grid: among same-consonant pairs, which vowel
  // substitutions recur (weighted by word-pair count)? The a~e / a~u cells
  // lighting up in final position is the classic paradigm signature.
  const vowelGrid = useMemo(() => {
    const V = ["a", "e", "i", "o", "u"];
    const grid = new Map<string, number>();
    let max = 0;
    for (const alt of filtered) {
      const t = phonoTypeOf(alt.signX, alt.signY);
      if (t.type !== "vowel") continue;
      const va = cvOf(alt.signX)![1];
      const vb = cvOf(alt.signY)![1];
      if (va.length !== 1 || vb.length !== 1) continue;
      const [x, y] = [va, vb].sort();
      const k = `${x}~${y}`;
      const v = (grid.get(k) ?? 0) + alt.pairs.length;
      grid.set(k, v);
      if (v > max) max = v;
    }
    return { V, grid, max };
  }, [filtered]);

  // Chance baseline (on demand): rebuild the vocabulary K times with the
  // same word-length distribution and the same position-specific sign
  // frequencies, count minimal pairs each time. If the real corpus has far
  // more pairs than the randomized ones, the alternations are structure,
  // not an artifact of a small sign inventory.
  function computeBaseline() {
    const real = lenWords.map((w) => w.word.split("-"));
    // Position-specific sign pools (index capped at 7 so long words share
    // a tail pool rather than each position being nearly unique).
    const pools = new Map<number, string[]>();
    for (const signs of real) {
      signs.forEach((s, i) => {
        const k = Math.min(i, 7);
        let arr = pools.get(k);
        if (!arr) {
          arr = [];
          pools.set(k, arr);
        }
        arr.push(s);
      });
    }
    const reps = 20;
    // Seeded like every other baseline in the workbench, so the envelope a
    // researcher cites is reproducible on reload.
    const rand = mulberry32(1);
    const counts: number[] = [];
    for (let r = 0; r < reps; r++) {
      const fake = new Set<string>();
      for (const signs of real) {
        const w = signs
          .map((_, i) => {
            const pool = pools.get(Math.min(i, 7))!;
            return pool[Math.floor(rand() * pool.length)];
          })
          .join("-");
        fake.add(w);
      }
      counts.push(
        findMinimalPairs([...fake].map((word) => ({ word }))).pairs.length,
      );
    }
    counts.sort((a, b) => a - b);
    setBaseline({
      mean: counts.reduce((s, c) => s + c, 0) / reps,
      min: counts[0],
      max: counts[counts.length - 1],
      reps,
    });
  }

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
      [
        "sign_a",
        "sign_b",
        "word_a",
        "word_b",
        "position",
        "length",
        "role",
        "phono_type",
        "phono_detail",
      ],
    ];
    for (const alt of sorted) {
      const t = phonoTypeOf(alt.signX, alt.signY);
      for (const p of alt.pairs) {
        rows.push([
          p.signA,
          p.signB,
          p.wordA,
          p.wordB,
          p.position + 1,
          p.length,
          p.role,
          PHONO_LABEL[t.type],
          t.detail,
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
        <div
          className="stat-box"
          title={
            baseline
              ? `${baseline.reps} randomized vocabularies with the same word lengths and position-specific sign frequencies yield ${baseline.min}–${baseline.max} minimal pairs (mean ${baseline.mean.toFixed(0)}). The real corpus has ${pairs.length}.`
              : "How many minimal pairs would a random vocabulary produce? Click to find out — rebuilds the vocabulary 20× with the same word lengths and position-specific sign frequencies."
          }
        >
          {baseline ? (
            <>
              <span
                className="val"
                style={{
                  color:
                    pairs.length > baseline.max
                      ? "var(--gn)"
                      : pairs.length < baseline.min
                        ? "var(--am)"
                        : undefined,
                }}
              >
                {baseline.mean.toFixed(0)}
              </span>
              <span className="lbl">
                Chance baseline ({baseline.min}–{baseline.max})
              </span>
            </>
          ) : (
            <button
              className="btn btn-outline btn-sm"
              onClick={computeBaseline}
              style={{ margin: "auto" }}
            >
              Chance baseline?
            </button>
          )}
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
          title="What changes phonologically between the two signs, under the conventional Linear B values: the vowel (the classic inflection signature), the consonant, both, or unknowable (no AB value)"
        >
          type
          <select
            className="select"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as "any" | PhonoType)
            }
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="any">any</option>
            <option value="vowel">V-alternation</option>
            <option value="consonant">C-alternation</option>
            <option value="both">CV-alternation</option>
            <option value="opaque">no AB values</option>
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
                label: "Type",
                render: (a) => {
                  const t = phonoTypeOf(a.signX, a.signY);
                  return `${esc(PHONO_LABEL[t.type])}${t.detail ? ` <span style="color:#6b7280;">${esc(t.detail)}</span>` : ""}`;
                },
                md: (a) => {
                  const t = phonoTypeOf(a.signX, a.signY);
                  return `${PHONO_LABEL[t.type]}${t.detail ? ` (${t.detail})` : ""}`;
                },
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
              <th title="What changes under the conventional Linear B values">
                Type
              </th>
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
                      {(() => {
                        const t = phonoTypeOf(alt.signX, alt.signY);
                        return (
                          <span
                            className={`tag ${t.type === "vowel" ? "tag-success" : t.type === "opaque" ? "" : "tag-domain"}`}
                            title={
                              t.type === "opaque"
                                ? "One or both signs lack a Linear B value — the phonological relationship is unknowable"
                                : `Under the conventional AB values: ${t.detail}${t.type === "vowel" ? " — same consonant, different vowel: the classic inflection signature" : ""}`
                            }
                          >
                            {PHONO_LABEL[t.type]}
                            {t.detail ? ` ${t.detail}` : ""}
                          </span>
                        );
                      })()}
                    </td>
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
                      <td colSpan={5} style={{ background: "var(--surface-0)" }}>
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

      {vowelGrid.max > 0 && (
        <div className="card" style={{ marginTop: 12, maxWidth: 480 }}>
          <h4>Vowel-alternation grid</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            Among same-consonant alternations (under the conventional AB
            values), which vowel substitutions recur — weighted by word-pair
            count, honoring the filters above. Recurring substitutions
            concentrated in final position are paradigm candidates.
          </div>
          <table
            style={{
              borderCollapse: "collapse",
              fontFamily: "var(--mono)",
              fontSize: 11,
            }}
          >
            <thead>
              <tr>
                <th></th>
                {vowelGrid.V.map((v) => (
                  <th
                    key={v}
                    style={{ padding: "2px 6px", color: "var(--text-muted)" }}
                  >
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vowelGrid.V.map((a, i) => (
                <tr key={a}>
                  <th
                    style={{
                      padding: "2px 6px",
                      color: "var(--text-muted)",
                      textAlign: "right",
                    }}
                  >
                    {a}
                  </th>
                  {vowelGrid.V.map((b, j) => {
                    if (j <= i)
                      return (
                        <td key={b} style={{ width: 38, height: 28 }} />
                      );
                    const n = vowelGrid.grid.get(`${a}~${b}`) ?? 0;
                    const t = vowelGrid.max > 0 ? n / vowelGrid.max : 0;
                    return (
                      <td
                        key={b}
                        title={`${a} ~ ${b}: ${n} word pair${n === 1 ? "" : "s"}`}
                        style={{
                          width: 38,
                          height: 28,
                          textAlign: "center",
                          background:
                            n > 0
                              ? `rgba(91, 158, 255, ${0.12 + t * 0.7})`
                              : "transparent",
                          border: "1px solid var(--border)",
                          color: n > 0 ? "var(--text)" : "var(--text-muted)",
                        }}
                      >
                        {n || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
