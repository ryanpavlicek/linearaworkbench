import { describe, expect, it } from "vitest";
import { trainSignBigramModel, wordSurprisal } from "./surprisal";
import { isLexicalWord } from "../data/commodities";

// A small vocabulary with one dominant pattern (KU-RO-like) and assorted
// support, so common vs novel transitions are clearly separated.
const VOCAB = [
  { word: "KU-RO", count: 30 },
  { word: "KU-RA", count: 10 },
  { word: "KU-RE", count: 5 },
  { word: "SA-RO", count: 8 },
  { word: "SA-RA", count: 6 },
  { word: "DA-RO", count: 4 },
  { word: "DA-KU-RO", count: 3 },
  { word: "TI", count: 50 }, // single-sign: must be ignored in training
];

describe("trainSignBigramModel", () => {
  it("counts token-weighted transitions with boundary markers", () => {
    const m = trainSignBigramModel(VOCAB);
    expect(m.bigram.get("KU")?.get("RO")).toBe(33); // 30 + 3 via DA-KU-RO
    expect(m.bigram.get("^")?.get("KU")).toBe(45);
    expect(m.bigram.get("RO")?.get("$")).toBe(45);
    // single-sign TI contributes nothing
    expect(m.bigram.get("^")?.get("TI")).toBeUndefined();
    expect(m.contTypes.get("KU")).toBe(3); // RO, RA, RE
  });
});

describe("wordSurprisal", () => {
  const m = trainSignBigramModel(VOCAB);

  it("scores common patterns far below novel ones", () => {
    const common = wordSurprisal(m, "KU-RO");
    const novel = wordSurprisal(m, "ZU-PU"); // both signs unattested
    expect(common.mean).toBeLessThan(2);
    expect(novel.mean).toBeGreaterThan(5);
    expect(novel.mean).toBeGreaterThan(common.mean * 2);
  });

  it("returns one step per transition including boundaries", () => {
    const r = wordSurprisal(m, "DA-KU-RO");
    expect(r.steps.map((s) => `${s.from}→${s.to}`)).toEqual([
      "^→DA",
      "DA→KU",
      "KU→RO",
      "RO→$",
    ]);
    for (const s of r.steps) expect(s.bits).toBeGreaterThanOrEqual(0);
  });

  it("leave-one-out removes a word's self-support", () => {
    // DA-KU-RO is the sole carrier of DA→KU; scored with its own count
    // removed, that transition must get much more surprising.
    const withSelf = wordSurprisal(m, "DA-KU-RO", 0);
    const loo = wordSurprisal(m, "DA-KU-RO", 3);
    expect(loo.mean).toBeGreaterThan(withSelf.mean);
    const daKu = (r: typeof loo) =>
      r.steps.find((s) => s.from === "DA" && s.to === "KU")!.bits;
    expect(daKu(loo)).toBeGreaterThan(daKu(withSelf) + 1);
    // KU→RO keeps outside support (30 tokens from KU-RO), so it stays cheap.
    const kuRo = loo.steps.find((s) => s.from === "KU" && s.to === "RO")!;
    expect(kuRo.bits).toBeLessThan(2);
  });

  it("probabilities stay valid under heavy exclusion", () => {
    // Excluding more tokens than exist must not produce negative counts,
    // probabilities over 1, or negative bits.
    const r = wordSurprisal(m, "KU-RO", 9999);
    for (const s of r.steps) {
      expect(Number.isFinite(s.bits)).toBe(true);
      expect(s.bits).toBeGreaterThanOrEqual(0);
    }
  });

  it("is deterministic", () => {
    const a = wordSurprisal(m, "SA-RA", 6);
    const b = wordSurprisal(m, "SA-RA", 6);
    expect(a).toEqual(b);
  });
});

describe("isLexicalWord (the anomaly-list filter)", () => {
  it("accepts syllabic words, including ones with sub-400 starred signs", () => {
    expect(isLexicalWord("KU-RO")).toBe(true);
    expect(isLexicalWord("A-TA-I-*301-WA-JA")).toBe(true);
    expect(isLexicalWord("A-SA-SA-RA-ME")).toBe(true);
  });

  it("rejects logogram chains, ligatures, and damaged tokens", () => {
    expect(isLexicalWord("*405-VS-*906")).toBe(false); // *400+ vessel series
    expect(isLexicalWord("*307+*387-GRA+QE")).toBe(false); // ligature
    expect(isLexicalWord("HIDE+[?]-*328")).toBe(false); // bracketed damage
    expect(isLexicalWord("GRA-PA")).toBe(false); // commodity head part
    expect(isLexicalWord("*301-*306")).toBe(false); // pure starred chain
    expect(isLexicalWord("KU")).toBe(false); // single sign
  });
});
