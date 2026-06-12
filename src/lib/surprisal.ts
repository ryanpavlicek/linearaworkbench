// Graphotactic surprisal: a first-order sign-bigram model with
// Witten-Bell smoothing, scored leave-one-out so a word never gets credit
// for transitions only it attests. High mean surprisal = a sign sequence
// the rest of the corpus doesn't write — candidate loanwords, foreign
// names, scribal errors, or damaged readings. This is sequence-level
// only: it knows nothing about phonetic values or meaning.

const START = "^";
const END = "$";

export interface SignBigramModel {
  /** context → (next → token count); contexts include ^, nexts include $ */
  bigram: Map<string, Map<string, number>>;
  /** total outgoing tokens per context */
  contextTotal: Map<string, number>;
  /** distinct continuation types per context — Witten-Bell's T(a) */
  contTypes: Map<string, number>;
  /** next-symbol token counts (the backoff distribution) */
  nextCount: Map<string, number>;
  /** total transition tokens */
  total: number;
  /** distinct next symbols */
  vocab: number;
}

// Transitions of a word, with boundary markers: ^→p₁, p₁→p₂, …, pₙ→$.
function transitionsOf(word: string): [string, string][] {
  const parts = word.split("-");
  const out: [string, string][] = [[START, parts[0]]];
  for (let i = 0; i < parts.length - 1; i++) out.push([parts[i], parts[i + 1]]);
  out.push([parts[parts.length - 1], END]);
  return out;
}

// Train on the multi-sign vocabulary, token-weighted (a transition in a
// 20× word counts 20 times — the model describes what scribes actually
// wrote, not the type list).
export function trainSignBigramModel(
  words: readonly { word: string; count: number }[],
): SignBigramModel {
  const bigram = new Map<string, Map<string, number>>();
  const contextTotal = new Map<string, number>();
  const nextCount = new Map<string, number>();
  let total = 0;
  for (const { word, count } of words) {
    if (!word.includes("-")) continue;
    for (const [a, b] of transitionsOf(word)) {
      let inner = bigram.get(a);
      if (!inner) {
        inner = new Map();
        bigram.set(a, inner);
      }
      inner.set(b, (inner.get(b) ?? 0) + count);
      contextTotal.set(a, (contextTotal.get(a) ?? 0) + count);
      nextCount.set(b, (nextCount.get(b) ?? 0) + count);
      total += count;
    }
  }
  const contTypes = new Map<string, number>();
  for (const [a, inner] of bigram) contTypes.set(a, inner.size);
  return {
    bigram,
    contextTotal,
    contTypes,
    nextCount,
    total,
    vocab: nextCount.size,
  };
}

export interface WordSurprisal {
  /** mean bits per transition (boundaries included) — the headline score */
  mean: number;
  /** per-transition detail, for showing WHERE a word is improbable */
  steps: { from: string; to: string; bits: number }[];
}

// Score a word. `selfCount` is the word's own corpus token count: its own
// contribution is subtracted from every count before computing
// probabilities (leave-one-out), so a hapax built from one-off
// transitions scores as the anomaly it is instead of validating itself.
// Pass 0 to score a hypothetical word that isn't in the corpus.
export function wordSurprisal(
  model: SignBigramModel,
  word: string,
  selfCount = 0,
): WordSurprisal {
  const trans = transitionsOf(word);
  // The word's own contribution to the backoff distribution.
  const selfNext = new Map<string, number>();
  if (selfCount > 0) {
    for (const [, b] of trans)
      selfNext.set(b, (selfNext.get(b) ?? 0) + selfCount);
  }
  const totalAdj = Math.max(1, model.total - selfCount * trans.length);
  const steps: { from: string; to: string; bits: number }[] = [];
  let sum = 0;
  for (const [a, b] of trans) {
    const cab = Math.max(0, (model.bigram.get(a)?.get(b) ?? 0) - selfCount);
    const ca = Math.max(0, (model.contextTotal.get(a) ?? 0) - selfCount);
    // If removing this word zeroes the transition type, T(a) shrinks too.
    let t = model.contTypes.get(a) ?? 0;
    if (cab === 0 && (model.bigram.get(a)?.get(b) ?? 0) > 0) t = Math.max(0, t - 1);
    const cb = Math.max(0, (model.nextCount.get(b) ?? 0) - (selfNext.get(b) ?? 0));
    // Add-one-smoothed backoff so unseen symbols keep nonzero mass.
    const pBg = (cb + 1) / (totalAdj + model.vocab + 1);
    const denom = ca + t;
    const p = denom > 0 ? (cab + t * pBg) / denom : pBg;
    const bits = -Math.log2(Math.min(1, Math.max(p, 1e-12)));
    steps.push({ from: a, to: b, bits });
    sum += bits;
  }
  return { mean: trans.length > 0 ? sum / trans.length : 0, steps };
}
