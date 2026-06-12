import { useEffect, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { Glyph } from "../components/Glyph";

// Leitner-box flashcards for the syllabary: see a glyph, recall its
// conventional value, self-grade. Three boxes — miss a card and it
// returns to box 1; know it and it climbs; box 3 cards retire from the
// regular rotation. Progress persists in this browser. High-frequency
// signs come first, because learning KU before a hapax sign is how you
// start actually reading tablets.

const STORE_KEY = "linear-a-workbench:sign-trainer";

interface Progress {
  // label → box (1–3); absent = unseen (treated as box 1)
  boxes: Record<string, number>;
  seen: number;
  correct: number;
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    // fall through to a fresh start
  }
  return { boxes: {}, seen: 0, correct: 0 };
}

export default function SignTrainer() {
  const corpus = useWorkbench((s) => s.corpus);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [revealed, setRevealed] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);

  // Cards: signs with a conventional value, ordered by corpus frequency.
  const cards = useMemo(
    () =>
      corpus.signs
        .filter((s) => s.phonetic && s.glyph)
        .sort((a, b) => b.total - a.total),
    [corpus],
  );

  // The deck order interleaves by box: box-1 cards (unknown) surface
  // every round, box-2 every other, box-3 rarely. Deterministic walk —
  // no shuffle needed, frequency order does the prioritizing.
  const deck = useMemo(() => {
    const b = (label: string) => progress.boxes[label] ?? 1;
    const b1 = cards.filter((c) => b(c.label) === 1);
    const b2 = cards.filter((c) => b(c.label) === 2);
    const b3 = cards.filter((c) => b(c.label) === 3);
    const out: typeof cards = [];
    let i2 = 0;
    let i3 = 0;
    b1.forEach((c, i) => {
      out.push(c);
      if (i % 2 === 1 && i2 < b2.length) out.push(b2[i2++]);
      if (i % 5 === 4 && i3 < b3.length) out.push(b3[i3++]);
    });
    while (i2 < b2.length) out.push(b2[i2++]);
    while (i3 < b3.length) out.push(b3[i3++]);
    return out.length > 0 ? out : cards;
  }, [cards, progress.boxes]);

  const card = deck[cardIdx % Math.max(1, deck.length)];

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(progress));
    } catch {
      // storage full/blocked — session-only progress still works
    }
  }, [progress]);

  function grade(knew: boolean) {
    if (!card) return;
    setProgress((p) => {
      const cur = p.boxes[card.label] ?? 1;
      const next = knew ? Math.min(3, cur + 1) : 1;
      return {
        boxes: { ...p.boxes, [card.label]: next },
        seen: p.seen + 1,
        correct: p.correct + (knew ? 1 : 0),
      };
    });
    setRevealed(false);
    setCardIdx((i) => i + 1);
  }

  const boxCounts = useMemo(() => {
    const counts = [0, 0, 0];
    for (const c of cards) counts[(progress.boxes[c.label] ?? 1) - 1]++;
    return counts;
  }, [cards, progress.boxes]);

  function reset() {
    setProgress({ boxes: {}, seen: 0, correct: 0 });
    setCardIdx(0);
    setRevealed(false);
  }

  return (
    <div className="panel" style={{ maxWidth: 760 }}>
      <h2>Sign Trainer</h2>
      <div className="callout">
        <h4>Learn the syllabary the spaced way</h4>
        <p>
          Flashcards over every sign with a conventional sound value,
          highest-frequency first — three Leitner boxes, so signs you miss
          come back often and signs you know retire to occasional review.
          The values are the AB conventions read back from Linear B; how a
          sign sounded in Minoan is the open question this whole site is
          about.
        </p>
      </div>

      <div className="toolbar">
        <span className="dim" style={{ fontSize: 12 }}>
          learning {boxCounts[0]} · reviewing {boxCounts[1]} · known{" "}
          {boxCounts[2]}
          {progress.seen > 0 &&
            ` · ${Math.round((100 * progress.correct) / progress.seen)}% over ${progress.seen} cards`}
        </span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-outline btn-sm"
          onClick={reset}
          title="Wipe trainer progress in this browser"
        >
          Reset progress
        </button>
      </div>

      {card && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "28px 16px" }}
        >
          <div style={{ marginBottom: 12 }}>
            <Glyph sign={card.label} size={84} />
          </div>
          {revealed ? (
            <>
              <div style={{ fontSize: 22, marginBottom: 4 }}>
                <b>{card.phonetic}</b>{" "}
                <span className="dim" style={{ fontSize: 14 }}>
                  ({card.label})
                </span>
              </div>
              <div className="dim" style={{ fontSize: 12, marginBottom: 14 }}>
                {card.total.toLocaleString()} attestations in the corpus ·
                box {(progress.boxes[card.label] ?? 1)}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn btn-sm" onClick={() => grade(true)}>
                  Knew it ✓
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => grade(false)}
                >
                  Again ↺
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="dim" style={{ fontSize: 13, marginBottom: 14 }}>
                What's this sign's conventional value?
              </div>
              <button className="btn btn-sm" onClick={() => setRevealed(true)}>
                Reveal
              </button>
            </>
          )}
        </div>
      )}
      <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
        {cards.length} signs carry a conventional value. Progress lives in
        this browser only.
      </div>
    </div>
  );
}
