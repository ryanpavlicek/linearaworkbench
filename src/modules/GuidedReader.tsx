import { useEffect, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { wordToPhonetic } from "../lib/algorithms";
import {
  DEFICIT_MARKERS,
  GRAND_TOTAL_MARKERS,
  TOTAL_MARKERS,
  lineValue,
  parseValue,
} from "../lib/numerals";
import { anchorGloss } from "../lib/anchors";
import { commodityHead, isUndecipheredLogogram, COMMODITIES } from "../data/commodities";
import { Glyph } from "../components/Glyph";
import { InscriptionLink } from "../components/InscriptionLink";

// Read a real tablet, one token at a time. Steps are generated from the
// tablet's own parsed structure — no canned text per tablet beyond a
// one-line introduction — so the walkthrough never drifts from the data,
// and any tablet a researcher opens elsewhere can be read here too.

const CURATED: { id: string; intro: string }[] = [
  {
    id: "HT13",
    intro:
      "A wine ledger from Haghia Triada and the classic first tablet: a heading, a list of entries, and a KU-RO total you can check by addition — in this transcription the entries sum half a unit over the scribe's total, a famous little crux you'll meet at the last line.",
  },
  {
    id: "HT88",
    intro:
      "Haghia Triada accounting with people (VIR) and figs — a compact list with a verifiable total.",
  },
  {
    id: "HT95",
    intro:
      "A two-sided grain document at Haghia Triada listing the same commodity against a series of names.",
  },
  {
    id: "HT117a",
    intro:
      "An administrative list with a heading, a KU-RO total, and a second section — the standard archive form.",
  },
  {
    id: "PKZa11",
    intro:
      "Not an account: a stone libation vessel from Palaikastro carrying the religious dedication formula.",
  },
];

interface Step {
  lineIdx: number | null; // highlight: which physical line
  tokenIdx: number | null; // highlight: flat token index
  title: string;
  body: string;
}

export default function GuidedReader() {
  const corpus = useWorkbench((s) => s.corpus);
  const showInscription = useWorkbench((s) => s.showInscription);
  const initialIntent = useWorkbench.getState().moduleIntent;
  const available = useMemo(
    () => CURATED.filter((c) => corpus.byId.has(c.id)),
    [corpus],
  );
  const [tabletId, setTabletId] = useState<string>(
    initialIntent?.focus && corpus.byId.has(initialIntent.focus)
      ? initialIntent.focus
      : available[0]?.id ?? "",
  );
  const [step, setStep] = useState(0);

  const ins = corpus.byId.get(tabletId);

  const steps = useMemo<Step[]>(() => {
    if (!ins) return [];
    const out: Step[] = [];
    const intro = CURATED.find((c) => c.id === ins.id)?.intro;
    out.push({
      lineIdx: null,
      tokenIdx: null,
      title: `${ins.id} — ${ins.site || "findspot unrecorded"}`,
      body:
        (intro ? intro + " " : "") +
        `${ins.lines.length} line${ins.lines.length === 1 ? "" : "s"}, ${ins.words.length} tokens` +
        (ins.support ? `, on a ${ins.support.toLowerCase()}` : "") +
        (ins.context ? `, dated ${ins.context} by context` : "") +
        ". Use Next (or →) to step through every token; the transliteration above highlights where you are.",
    });
    let flat = 0;
    let runningTotal = 0;
    for (let li = 0; li < ins.lines.length; li++) {
      const line = ins.lines[li];
      const lineSum = lineValue(line);
      for (let ti = 0; ti < line.length; ti++) {
        const tok = line[ti];
        const idx = flat++;
        const v = parseValue(tok);
        if (v !== null) {
          const frac = !Number.isInteger(v);
          out.push({
            lineIdx: li,
            tokenIdx: idx,
            title: `${tok} — a numeral`,
            body:
              `The quantity ${v}${frac ? " (a metrological fraction — less than one whole unit)" : ""}. ` +
              "Linear A numerals are decimal but written additively: strokes for units, dots for tens, circles for hundreds. The transcription has already converted them to digits.",
          });
          continue;
        }
        const isTotal = TOTAL_MARKERS.has(tok);
        const isGrand = GRAND_TOTAL_MARKERS.has(tok);
        const isDeficit = DEFICIT_MARKERS.has(tok);
        if (isTotal || isGrand || isDeficit) {
          const itemSum = runningTotal;
          out.push({
            lineIdx: li,
            tokenIdx: idx,
            title: `${tok} — ${isGrand ? "the grand total" : isDeficit ? "a deficit marker" : "the total"}`,
            body: isDeficit
              ? `${tok} ("KI-RO") marks what is owed or missing — one of the very few words read with confidence, from how it behaves in the arithmetic.`
              : `${tok} introduces a sum. The entries so far add to ${itemSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}; the number after this word is the scribe's own total — ${lineSum > 0 ? `this line carries ${lineSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "check the next token"}. The match (or mismatch) is how KU-RO was deciphered as "total" — arithmetic, not language.`,
          });
          continue;
        }
        const com = commodityHead(tok);
        if (com) {
          out.push({
            lineIdx: li,
            tokenIdx: idx,
            title: `${tok} — a commodity logogram`,
            body: `One sign standing for a thing being counted: ${COMMODITIES[com]?.gloss ?? com}${tok.includes("+") ? ". The + marks a ligature — a modifier sign fused onto the base logogram, probably a variety or grade" : ""}. Logograms are read by what they depict and how they're counted, not by sound.`,
          });
          continue;
        }
        if (isUndecipheredLogogram(tok)) {
          out.push({
            lineIdx: li,
            tokenIdx: idx,
            title: `${tok} — an undeciphered logogram`,
            body: "A counted sign whose referent is unknown — numbered in the *NNN series. Something was being counted here; what it was is an open question.",
          });
          continue;
        }
        if (tok === "𐄁" || /^𐄁+$/.test(tok)) {
          out.push({
            lineIdx: li,
            tokenIdx: idx,
            title: "𐄁 — the word divider",
            body: "A separator dot — the scribe's equivalent of a space, marking where one word ends and the next begins. Well understood, and the reason transliterations can hyphenate words confidently.",
          });
          continue;
        }
        if (tok.includes("-")) {
          const gloss = anchorGloss(tok);
          const phon = wordToPhonetic(tok, {});
          out.push({
            lineIdx: li,
            tokenIdx: idx,
            title: `${tok} — a word`,
            body:
              `Read aloud (using the sound values borrowed back from Linear B): /${phon}/. ` +
              (gloss
                ? `This is one of the handful of conventionally-read words: ${gloss}.`
                : "Its meaning is unknown — in an accounting context, a word in this position is usually a name: a person, place, or institution the entry belongs to."),
          });
          continue;
        }
        out.push({
          lineIdx: li,
          tokenIdx: idx,
          title: `${tok} — a single sign`,
          body: "A lone sign: an abbreviation, a transaction marker, or a logogram outside the catalog. Single signs without numbers resist classification.",
        });
      }
      runningTotal += lineSum;
    }
    out.push({
      lineIdx: null,
      tokenIdx: null,
      title: "That's the whole document",
      body: "You've read every token. Open the full record for images, citation, commentary, and every analysis module's view of this tablet.",
    });
    return out;
  }, [ins]);

  useEffect(() => {
    setStep(0);
  }, [tabletId]);

  // ← / → step the walkthrough.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(steps.length - 1, s + 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  const cur = steps[step];
  let flatBase = 0;

  return (
    <div className="panel">
      <h2>Guided Reader</h2>
      <div className="callout">
        <h4>Read a real tablet, token by token</h4>
        <p>
          No prior knowledge needed. Pick a document and step through it:
          every word, logogram, and numeral explained from the corpus's own
          data — including the addition check that deciphered KU-RO. The
          script is undeciphered; what you'll learn is exactly what{" "}
          <em>can</em> be read, and how.
        </p>
      </div>

      <div className="toolbar">
        <select
          className="select"
          value={tabletId}
          onChange={(e) => setTabletId(e.target.value)}
        >
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}
            </option>
          ))}
        </select>
        <span className="dim" style={{ fontSize: 12 }}>
          step {step + 1} / {steps.length}
        </span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-outline btn-sm"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          ← Back
        </button>
        <button
          className="btn btn-sm"
          disabled={step >= steps.length - 1}
          onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
        >
          Next →
        </button>
      </div>

      {ins && cur ? (
        <>
          <div className="card" style={{ marginBottom: 10 }}>
            {ins.lines.map((line, li) => {
              const base = flatBase;
              flatBase += line.length;
              return (
                <div
                  key={li}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    padding: "3px 0",
                    opacity:
                      cur.lineIdx === null || cur.lineIdx === li ? 1 : 0.35,
                  }}
                >
                  <span className="dim" style={{ fontSize: 10, width: 22 }}>
                    .{li + 1}
                  </span>
                  {line.map((tok, ti) => {
                    const idx = base + ti;
                    const active = cur.tokenIdx === idx;
                    return (
                      <span
                        key={ti}
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 13,
                          padding: "1px 5px",
                          borderRadius: 3,
                          background: active ? "var(--ac)" : "transparent",
                          color: active ? "var(--surface-0)" : "var(--text)",
                          border: active
                            ? "1px solid var(--ac)"
                            : "1px solid transparent",
                        }}
                      >
                        {tok.includes("-") && (
                          <>
                            {tok.split("-").map((p, pi) => (
                              <Glyph key={pi} sign={p} size={14} />
                            ))}{" "}
                          </>
                        )}
                        {tok}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="card">
            <h4>{cur.title}</h4>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>{cur.body}</p>
            {step === steps.length - 1 && (
              <div className="toolbar">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => showInscription(ins.id)}
                >
                  Open the full record
                </button>
                <span className="dim" style={{ fontSize: 11 }}>
                  or pick another document above — <InscriptionLink id={ins.id} />{" "}
                  stays a click away
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="dim">No curated tablets found in this corpus.</div>
      )}
    </div>
  );
}
