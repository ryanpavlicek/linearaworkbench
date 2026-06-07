import { describe, it, expect } from "vitest";
import {
  wordToPhonetic,
  phoneticDistance,
  extractRoot,
  alignPhonetic,
  chiSquared2x2,
  logLikelihoodRatio2x2,
  chiSquaredPValue,
  fishersExact,
  wilsonInterval,
  sequenceDistance,
  sequenceSimilarity,
  findMorphologicalClusters,
  isNumeralToken,
} from "./algorithms";

describe("wordToPhonetic / extractRoot", () => {
  it("maps hyphenated signs to their concatenated phonetic value", () => {
    expect(wordToPhonetic("KU-RO")).toBe("kuro");
    expect(wordToPhonetic("PA-I-TO")).toBe("paito");
  });

  it("honors per-sign overrides", () => {
    expect(wordToPhonetic("KU-RO", { KU: "gu" })).toBe("guro");
  });

  it("falls through unknown signs as lowercase text", () => {
    expect(wordToPhonetic("KU-???")).toBe("ku???");
  });

  it("extractRoot strips vowels from the phonetic form", () => {
    expect(extractRoot("KU-RO")).toBe("kr");
    expect(extractRoot("PA-I-TO")).toBe("pt");
  });
});

describe("phoneticDistance", () => {
  it("is 0 for identical strings and normalized into [0,1]", () => {
    expect(phoneticDistance("kuro", "kuro")).toBe(0);
    const d = phoneticDistance("kuro", "mada");
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it("charges less for a vowel↔vowel swap than a far consonant swap", () => {
    // one substitution over length 4. vowel weight 0.3 vs far weight 1.
    expect(phoneticDistance("kuro", "karo")).toBeCloseTo(0.3 / 4, 10);
    expect(phoneticDistance("kuro", "kulo")).toBeCloseTo(0.5 / 4, 10); // r↔l both liquids (same class)
  });

  it("same-articulatory-class consonants are cheaper than far ones", () => {
    // p↔b are both labials (same class, 0.5); p↔m crosses class (far, 1).
    const sameClass = phoneticDistance("pa", "ba");
    const farClass = phoneticDistance("pa", "na");
    expect(sameClass).toBeLessThan(farClass);
  });
});

describe("alignPhonetic", () => {
  it("emits an all-match alignment for identical strings", () => {
    const cells = alignPhonetic("kuro", "kuro");
    expect(cells).toHaveLength(4);
    expect(cells.every((c) => c.op === "match")).toBe(true);
  });

  it("marks an insertion when the second string is longer", () => {
    const cells = alignPhonetic("kro", "kuro");
    expect(cells.some((c) => c.op === "ins" && c.b === "u")).toBe(true);
  });
});

describe("collocation statistics — known-answer tables", () => {
  // 2x2: joint=5, countA=10, countB=10, total=100.
  // Expected counts: e11=1, e12=9, e21=9, e22=81.
  it("Yates-corrected chi-squared matches a hand computation", () => {
    // |ad-bc| = |5*85 - 5*5| = 400; corrected dev = 400 - 100/2 = 350;
    // chi2 = 100*350^2 / (10*10*90*90) = 12_250_000 / 810_000 ≈ 15.123
    expect(chiSquared2x2(5, 10, 10, 100)).toBeCloseTo(15.123, 2);
  });

  it("log-likelihood ratio (G²) matches a hand computation", () => {
    // G² = 2*(5ln5/1 + 5ln5/9 + 5ln5/9 + 85ln85/81) ≈ 12.533
    expect(logLikelihoodRatio2x2(5, 10, 10, 100)).toBeCloseTo(12.533, 2);
  });

  it("degenerate / impossible tables score 0", () => {
    expect(chiSquared2x2(0, 0, 10, 100)).toBe(0);
    expect(logLikelihoodRatio2x2(10, 10, 10, 10)).toBe(0); // countA === total
  });

  it("chi-squared p-value: 3.841 (1 df) ≈ 0.05", () => {
    expect(chiSquaredPValue(3.841)).toBeCloseTo(0.05, 2);
    expect(chiSquaredPValue(0)).toBe(1);
  });
});

describe("Fisher's exact (two-sided)", () => {
  it("perfect 5/5 association on N=10 ≈ 0.00794", () => {
    // Tables [[5,0],[0,5]] and [[0,5],[5,0]] each have p = 1/252.
    expect(fishersExact(5, 5, 5, 10)).toBeCloseTo(0.007937, 5);
  });

  it("never exceeds 1 and is 1 for a degenerate margin", () => {
    expect(fishersExact(0, 0, 5, 10)).toBe(1);
  });
});

describe("wilsonInterval", () => {
  it("brackets the point estimate and stays within [0,1]", () => {
    const [lo, hi] = wilsonInterval(5, 10);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(0.5);
  });

  it("returns the full interval for n = 0", () => {
    expect(wilsonInterval(0, 0)).toEqual([0, 1]);
  });
});

describe("sequence distance / similarity", () => {
  it("Levenshtein over token arrays", () => {
    expect(sequenceDistance(["a", "b", "c"], ["a", "b", "c"])).toBe(0);
    expect(sequenceDistance(["a", "b", "c"], ["a", "x", "c"])).toBe(1);
    expect(sequenceDistance(["a"], [])).toBe(1);
  });

  it("similarity is 1 for identical sequences and normalized otherwise", () => {
    expect(sequenceSimilarity(["a", "b", "c"], ["a", "b", "c"])).toBe(1);
    expect(sequenceSimilarity(["a", "b", "c"], ["a", "x", "c"])).toBeCloseTo(
      2 / 3,
      10,
    );
  });
});

describe("isNumeralToken", () => {
  it("recognizes digit / superscript / subscript numeral tokens", () => {
    expect(isNumeralToken("123")).toBe(true);
    expect(isNumeralToken("KU-RO")).toBe(false);
  });
});

describe("findMorphologicalClusters", () => {
  it("clusters stems with their productive-suffix derivations", () => {
    const words = [
      { word: "po-ro", count: 4 },
      { word: "po-ro-na", count: 2 },
      { word: "ki-ro", count: 3 },
      { word: "ki-ro-na", count: 1 },
    ];
    const clusters = findMorphologicalClusters(words, {
      minSuffixProductivity: 2, // "-na" ends two distinct words
      minClusterSize: 2,
      maxSuffixLen: 1,
    });
    expect(clusters).toHaveLength(2);

    const poro = clusters.find((c) => c.stem === "po-ro");
    expect(poro).toBeDefined();
    expect(poro!.members.map((m) => m.word).sort()).toEqual([
      "po-ro",
      "po-ro-na",
    ]);
    const derived = poro!.members.find((m) => m.word === "po-ro-na");
    expect(derived!.suffix).toBe("na");
    expect(poro!.suffixes).toContain("na");
  });

  it("drops clusters below the minimum size", () => {
    const words = [
      { word: "po-ro", count: 4 },
      { word: "po-ro-na", count: 2 },
    ];
    // "-na" only ends one word, so it is not productive at threshold 2 →
    // no links → no clusters of size >= 2.
    const clusters = findMorphologicalClusters(words, {
      minSuffixProductivity: 2,
      minClusterSize: 2,
      maxSuffixLen: 1,
    });
    expect(clusters).toHaveLength(0);
  });
});
