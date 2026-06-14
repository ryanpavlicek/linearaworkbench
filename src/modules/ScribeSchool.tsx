import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import {
  TOTAL_MARKERS,
  lineValue,
  parseValue,
} from "../lib/numerals";
import { COMMODITIES } from "../data/commodities";
import { Glyph } from "../components/Glyph";
import { InscriptionLink } from "../components/InscriptionLink";

// Do a Minoan scribe's job. Drill: a real accounting tablet with its
// KU-RO figure hidden — add the entries (fractions and all) and write
// the total. Grading knows two right answers: the scribe's own figure,
// and the true arithmetic sum when the scribe was off — getting the sum
// "wrong" the same way the scribe did is the lesson, not a failure.
// Sandbox: compose your own ledger in proper archive form and watch the
// KU-RO write itself.

type Tab = "drill" | "compose";

interface Exercise {
  id: string;
  itemLines: string[][];
  headingLines: string[][];
  kuroLine: string[];
  scribeTotal: number;
  itemSum: number;
}

// Fraction buttons offered for answers — the values actually attested.
const FRACTIONS: { label: string; value: number }[] = [
  { label: "½", value: 1 / 2 },
  { label: "⅓", value: 1 / 3 },
  { label: "¼", value: 1 / 4 },
  { label: "¾", value: 3 / 4 },
  { label: "⅕", value: 1 / 5 },
  { label: "⅛", value: 1 / 8 },
  { label: "¹⁄₁₆", value: 1 / 16 },
];

export default function ScribeSchool() {
  const corpus = useWorkbench((s) => s.corpus);
  const [tab, setTab] = useState<Tab>("drill");

  // ── Drill state ────────────────────────────────────────────────────────
  const exercises = useMemo<Exercise[]>(() => {
    const out: Exercise[] = [];
    for (const ins of corpus.inscriptions) {
      // Damaged tablets (lacuna marks, bracketed losses) make the drill a
      // trick question — the entries that would balance the total are
      // physically missing. Only intact, checkable accounts qualify.
      if (ins.lines.some((l) => l.some((t) => /[𐝫[\]]/.test(t)))) continue;
      const kuroIdx = ins.lines.findIndex((l) =>
        l.some((t) => TOTAL_MARKERS.has(t)),
      );
      if (kuroIdx < 1) continue;
      const kuroLine = ins.lines[kuroIdx];
      const scribeTotal = lineValue(kuroLine);
      if (scribeTotal <= 0) continue;
      const before = ins.lines.slice(0, kuroIdx);
      const itemLines = before.filter((l) => l.some((t) => parseValue(t) !== null));
      if (itemLines.length < 2 || itemLines.length > 9) continue;
      const itemSum = itemLines.reduce((s, l) => s + lineValue(l), 0);
      if (itemSum <= 0) continue;
      // Keep genuinely checkable accounts: balanced, or off by a small
      // scribal-discrepancy margin (HT13's famous half unit stays in).
      if (Math.abs(itemSum - scribeTotal) > Math.max(1, scribeTotal * 0.1))
        continue;
      out.push({
        id: ins.id,
        itemLines,
        headingLines: before.filter((l) => !l.some((t) => parseValue(t) !== null)),
        kuroLine,
        scribeTotal,
        itemSum,
      });
    }
    out.sort((a, b) => a.itemLines.length - b.itemLines.length || a.id.localeCompare(b.id));
    return out;
  }, [corpus]);

  const [exIdx, setExIdx] = useState(0);
  const [whole, setWhole] = useState("");
  const [fracs, setFracs] = useState<number[]>([]);
  const [result, setResult] = useState<null | "scribe" | "sum" | "wrong">(null);
  const [score, setScore] = useState({ right: 0, tried: 0 });

  const ex = exercises.length > 0 ? exercises[exIdx % exercises.length] : null;
  const answer = (parseInt(whole, 10) || 0) + fracs.reduce((s, f) => s + f, 0);
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

  function grade() {
    if (!ex) return;
    // Already graded this exercise — don't double-count the score on a
    // repeat Check click (result is cleared by Next or an answer edit).
    if (result) return;
    const r = close(answer, ex.scribeTotal)
      ? "scribe"
      : close(answer, ex.itemSum)
        ? "sum"
        : "wrong";
    setResult(r);
    setScore((s) => ({ right: s.right + (r === "wrong" ? 0 : 1), tried: s.tried + 1 }));
  }

  function nextExercise() {
    setExIdx((i) => i + 1);
    setWhole("");
    setFracs([]);
    setResult(null);
  }

  // ── Compose state ──────────────────────────────────────────────────────
  const wordOptions = useMemo(
    () =>
      [...corpus.wordIndex.entries()]
        .filter(([w, e]) => w.includes("-") && e.count >= 3)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 200)
        .map(([w]) => w),
    [corpus],
  );
  const [rows, setRows] = useState<{ word: string; com: string; qty: string }[]>([
    { word: "", com: "GRA", qty: "10" },
  ]);
  const composeTotal = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  return (
    <div className="panel">
      <h2>Scribe School</h2>
      <div className="callout">
        <h4>Do the scribe's job</h4>
        <p>
          The one part of Linear A we can do exactly as the Minoans did is
          the arithmetic. <b>Balance the account</b>: a real tablet with
          its total hidden — add the entries (fractions included) and
          write the KU-RO. <b>Compose a ledger</b>: build your own tablet
          in proper archive form and the total writes itself. When your
          answer differs from the scribe's, you might both be right — some
          tablets genuinely don't balance, and the grader says so.
        </p>
      </div>

      <div className="tab-row">
        <button
          className={`tab-btn${tab === "drill" ? " active" : ""}`}
          onClick={() => setTab("drill")}
        >
          Balance the account
        </button>
        <button
          className={`tab-btn${tab === "compose" ? " active" : ""}`}
          onClick={() => setTab("compose")}
        >
          Compose a ledger
        </button>
        <span style={{ flex: 1 }} />
        {tab === "drill" && score.tried > 0 && (
          <span className="dim" style={{ fontSize: 12 }}>
            {score.right}/{score.tried} balanced
          </span>
        )}
      </div>

      {tab === "drill" &&
        (ex ? (
          <div className="col2">
            <div className="card">
              <h4>
                <InscriptionLink id={ex.id} />{" "}
                <span className="dim">
                  · exercise {(exIdx % exercises.length) + 1} of{" "}
                  {exercises.length}
                </span>
              </h4>
              <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
                {ex.headingLines.map((l, i) => (
                  <div key={`h${i}`} className="dim" style={{ padding: "2px 0" }}>
                    {l.join(" ")}
                  </div>
                ))}
                {ex.itemLines.map((l, i) => (
                  <div key={i} style={{ padding: "2px 0" }}>
                    {l.join(" ")}
                  </div>
                ))}
                <div
                  style={{
                    padding: "4px 0",
                    borderTop: "1px solid var(--border)",
                    marginTop: 4,
                  }}
                >
                  {ex.kuroLine
                    .map((t) => (parseValue(t) !== null ? "▢" : t))
                    .join(" ")}{" "}
                  <span className="dim" style={{ fontSize: 11 }}>
                    ← the hidden total
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <h4>Your KU-RO</h4>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <input
                  className="input"
                  type="number"
                  min={0}
                  placeholder="whole"
                  value={whole}
                  onChange={(e) => {
                    setWhole(e.target.value);
                    setResult(null);
                  }}
                  style={{ width: 90 }}
                />
                {FRACTIONS.map((f) => (
                  <button
                    key={f.label}
                    className="btn btn-outline btn-sm"
                    style={{
                      fontFamily: "var(--mono)",
                      background: fracs.includes(f.value)
                        ? "var(--surface-1)"
                        : undefined,
                    }}
                    onClick={() => {
                      setFracs((cur) =>
                        cur.includes(f.value)
                          ? cur.filter((v) => v !== f.value)
                          : [...cur, f.value],
                      );
                      setResult(null);
                    }}
                    title={`${f.value}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="dim" style={{ fontSize: 12, marginBottom: 8 }}>
                your answer ={" "}
                <b style={{ color: "var(--text)" }}>
                  {answer.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </b>
              </div>
              <div className="toolbar">
                <button className="btn btn-sm" onClick={grade} disabled={answer <= 0}>
                  Check
                </button>
                <button className="btn btn-outline btn-sm" onClick={nextExercise}>
                  Next tablet →
                </button>
              </div>
              {result && (
                <div
                  className="card"
                  style={{
                    marginTop: 8,
                    borderColor:
                      result === "wrong" ? "var(--am)" : "var(--gn)",
                  }}
                >
                  {result === "scribe" && (
                    <p style={{ fontSize: 13 }}>
                      ✓ That's the scribe's own figure
                      {close(ex.scribeTotal, ex.itemSum)
                        ? " — and the account balances exactly."
                        : ` — though the entries actually sum to ${ex.itemSum.toLocaleString(undefined, { maximumFractionDigits: 3 })}: you reproduced the scribe's ${Math.abs(ex.itemSum - ex.scribeTotal).toLocaleString(undefined, { maximumFractionDigits: 3 })} discrepancy, which is exactly what a Minoan auditor would have flagged.`}
                    </p>
                  )}
                  {result === "sum" && (
                    <p style={{ fontSize: 13 }}>
                      ✓ Arithmetically perfect: the entries sum to{" "}
                      {ex.itemSum.toLocaleString(undefined, { maximumFractionDigits: 3 })}. The scribe, however, wrote{" "}
                      {ex.scribeTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })} — you just found a
                      Bronze Age bookkeeping error (or a damaged reading).
                      Both answers count.
                    </p>
                  )}
                  {result === "wrong" && (
                    <p style={{ fontSize: 13 }}>
                      Not yet — the scribe wrote{" "}
                      {ex.scribeTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      {close(ex.scribeTotal, ex.itemSum)
                        ? ", which the entries confirm."
                        : `, and the entries sum to ${ex.itemSum.toLocaleString(undefined, { maximumFractionDigits: 3 })}.`}{" "}
                      Watch the fractions — they're where everyone slips.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="dim">No suitable accounting tablets in this corpus.</div>
        ))}

      {tab === "compose" && (
        <div className="col2">
          <div className="card">
            <h4>Your entries</h4>
            <div style={{ display: "grid", gap: 6 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    list="school-words"
                    placeholder="word (e.g. a name)"
                    value={r.word}
                    onChange={(e) =>
                      setRows((cur) =>
                        cur.map((x, j) => (j === i ? { ...x, word: e.target.value.toUpperCase() } : x)),
                      )
                    }
                    style={{ width: 170 }}
                  />
                  <select
                    className="select"
                    value={r.com}
                    onChange={(e) =>
                      setRows((cur) =>
                        cur.map((x, j) => (j === i ? { ...x, com: e.target.value } : x)),
                      )
                    }
                  >
                    <option value="">(no commodity)</option>
                    {Object.keys(COMMODITIES).map((c) => (
                      <option key={c} value={c}>
                        {c} — {COMMODITIES[c].gloss}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={0.25}
                    value={r.qty}
                    onChange={(e) =>
                      setRows((cur) =>
                        cur.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)),
                      )
                    }
                    style={{ width: 80 }}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}
                    disabled={rows.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <datalist id="school-words">
              {wordOptions.map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>
            <div className="toolbar" style={{ marginTop: 8 }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setRows((cur) => [...cur, { word: "", com: "", qty: "1" }])}
              >
                + Add entry
              </button>
            </div>
          </div>

          <div className="card">
            <h4>Your tablet</h4>
            <div className="sub" style={{ marginBottom: 8 }}>
              Standard archive form: one entry per line — name, commodity,
              quantity — closed by a KU-RO the arithmetic writes for you.
            </div>
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 12,
                fontFamily: "var(--mono)",
                fontSize: 14,
              }}
            >
              {rows
                .filter((r) => r.word || r.com)
                .map((r, i) => (
                  <div key={i} style={{ padding: "3px 0", display: "flex", gap: 8, alignItems: "center" }}>
                    {r.word &&
                      r.word.split("-").map((p, pi) => <Glyph key={pi} sign={p} size={18} />)}
                    <span>
                      {r.word}
                      {r.word && r.com ? " " : ""}
                      {r.com} {r.qty}
                    </span>
                  </div>
                ))}
              <div
                style={{
                  borderTop: "1px solid var(--border-strong)",
                  marginTop: 6,
                  paddingTop: 6,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <Glyph sign="KU" size={18} />
                <Glyph sign="RO" size={18} />
                <span>
                  KU-RO{" "}
                  {composeTotal.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
              </div>
            </div>
            <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
              An HT scribe would also have started with a heading (a place
              or transaction word, often with the divider dot) — browse real
              examples in the Guided Reader.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
