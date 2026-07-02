// NOTE: the expected values in this file are extracted into pyaegean's
// golden parity fixtures (tests/fixtures/golden/), so its Python ports
// assert against the SAME numbers. Changing an expectation here means
// re-extracting the fixtures there in the same change — see docs/DATA.md.
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
  cooccurrencePairs,
  keynessG2,
  griesDP,
  sequenceDistance,
  sequenceSimilarity,
  findMorphologicalClusters,
  isNumeralToken,
  buildPhoneticClasses,
  referenceKey,
  describePhoneticScheme,
  DEFAULT_PHONETIC_SCHEME,
  CONSERVATIVE_PHONETIC_SCHEME,
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

  it("returns 1 (not NaN) for an impossible table with a negative implied cell", () => {
    // joint > countA (a12 < 0), joint > countB (a21 < 0), and a22 < 0 must each be
    // rejected as not a real table, matching chiSquared2x2/logLikelihoodRatio2x2's
    // graceful return — never feed lnChoose an out-of-range argument.
    expect(fishersExact(5, 3, 5, 10)).toBe(1); // joint 5 > countA 3
    expect(fishersExact(5, 5, 3, 10)).toBe(1); // joint 5 > countB 3
    expect(fishersExact(3, 5, 5, 6)).toBe(1); // a22 = 6 − 5 − 5 + 3 = −1 < 0
    // a valid table is unaffected by the tightened guard:
    expect(fishersExact(5, 5, 5, 10)).toBeCloseTo(0.007937, 5);
  });
});

describe("keynessG2", () => {
  it("matches the hand-computed G² for a known 2×2 corpus comparison", () => {
    // item: 10/100 tokens in A vs 5/200 in B
    // expecteds: e11=5, e12=95, e21=10, e22=190
    const g2 = keynessG2(10, 100, 5, 200);
    expect(g2).toBeCloseTo(7.3297, 3);
  });

  it("is ~0 when the item's rate is identical in both corpora", () => {
    expect(keynessG2(10, 100, 20, 200)).toBeCloseTo(0, 10);
  });

  it("weights evidence: 30-vs-4 outranks 2-vs-0 at comparable totals", () => {
    const strong = keynessG2(30, 1000, 4, 1000);
    const weak = keynessG2(2, 1000, 0, 1000);
    expect(strong).toBeGreaterThan(weak);
    expect(weak).toBeGreaterThan(0);
  });

  it("returns 0 for degenerate tables", () => {
    expect(keynessG2(0, 100, 0, 200)).toBe(0);
    expect(keynessG2(5, 0, 1, 10)).toBe(0);
    expect(keynessG2(100, 100, 200, 200)).toBe(0);
  });
});

describe("griesDP", () => {
  it("is 0 when the item tracks the part sizes exactly", () => {
    // parts 100/200/300 tokens; item 1/2/3 — same proportions
    expect(griesDP([1, 2, 3], [100, 200, 300])).toBeCloseTo(0, 10);
  });

  it("matches the hand-computed value for a concentrated item", () => {
    // equal thirds; all 6 occurrences in part 1:
    // |1−⅓| + |0−⅓| + |0−⅓| = 4/3 → DP = 2/3
    expect(griesDP([6, 0, 0], [100, 100, 100])).toBeCloseTo(2 / 3, 10);
  });

  it("rises as concentration rises", () => {
    const even = griesDP([2, 2, 2], [100, 100, 100]);
    const skewed = griesDP([4, 1, 1], [100, 100, 100]);
    const all = griesDP([6, 0, 0], [100, 100, 100]);
    expect(skewed).toBeGreaterThan(even);
    expect(all).toBeGreaterThan(skewed);
  });

  it("weights by part size: filling a small part is more dispersed-looking than its share", () => {
    // item only in the small part (10 of 110 tokens): DP = ½(|1−1/11| + |0−10/11|) = 10/11
    expect(griesDP([3, 0], [10, 100])).toBeCloseTo(10 / 11, 10);
  });

  it("returns 0 for an unattested item or empty corpus", () => {
    expect(griesDP([0, 0], [100, 100])).toBe(0);
    expect(griesDP([1, 2], [0, 0])).toBe(0);
  });

  it("rejects a counts/partSizes length mismatch instead of distorting DP", () => {
    // counts and partSizes index the SAME parts; a surplus count has no part.
    // The first two-part comparison is well-defined and concentrated:
    //   item all in part 1 of equal halves → DP = ½(|1−½| + |0−½|) = ½.
    const wellFormed = griesDP([6, 0], [100, 100]);
    expect(wellFormed).toBeCloseTo(0.5, 10);
    // A 3rd surplus count (no 3rd part) used to inflate itemTotal from 6 to 12,
    // halving every v share and silently changing the answer. Now rejected.
    expect(griesDP([6, 0, 6], [100, 100])).toBe(0);
    expect(griesDP([6], [100, 100])).toBe(0); // counts shorter than partSizes
  });
});

describe("cooccurrencePairs", () => {
  it("counts document-level joints and marginals over multi-sign words", () => {
    const { pairs, total } = cooccurrencePairs([
      { words: ["KU-RO", "A-DU", "5"] }, // numeral-like single token ignored
      { words: ["KU-RO", "A-DU"] },
      { words: ["KU-RO", "PA-I-TO"] },
      { words: ["VIN"] }, // no multi-sign word — excluded from total
    ]);
    expect(total).toBe(3);
    const kuAdu = pairs.find((p) => p.a === "A-DU" && p.b === "KU-RO")!;
    expect(kuAdu.joint).toBe(2);
    expect(kuAdu.countA).toBe(2); // A-DU
    expect(kuAdu.countB).toBe(3); // KU-RO
    // PMI = log2( (2/3) / ((2/3)·(3/3)) ) = 0
    expect(kuAdu.pmi).toBeCloseTo(0, 10);
    const kuPaito = pairs.find((p) => p.b === "PA-I-TO")!;
    // PMI = log2( (1/3) / ((3/3)·(1/3)) ) = 0
    expect(kuPaito.pmi).toBeCloseTo(0, 10);
    expect(pairs).toHaveLength(2);
  });

  it("deduplicates repeated words within one inscription", () => {
    const { pairs } = cooccurrencePairs([
      { words: ["KU-RO", "KU-RO", "A-DU"] },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].joint).toBe(1);
  });

  it("orders each pair's words lexicographically", () => {
    const { pairs } = cooccurrencePairs([{ words: ["ZU-MA", "A-DU"] }]);
    expect(pairs[0].a).toBe("A-DU");
    expect(pairs[0].b).toBe("ZU-MA");
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

  it("handles invalid k > n and negative n with a sane in-[0,1] interval", () => {
    // k > n is not a valid binomial: p̂ = 1.5 made p̂(1−p̂) < 0 and the √ NaN,
    // returning [NaN, NaN]. Clamp k to n (p̂ = 1) instead: a finite interval
    // whose bounds stay in [0,1], identical to the legitimate k = n case.
    const [lo, hi] = wilsonInterval(15, 10);
    expect(Number.isNaN(lo)).toBe(false);
    expect(Number.isNaN(hi)).toBe(false);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeLessThanOrEqual(hi);
    expect(hi).toBe(1); // p̂ clamped to 1 ⇒ upper bound pinned at 1
    expect(wilsonInterval(15, 10)).toEqual(wilsonInterval(10, 10));
    // Negative n broke the formula (out-of-[0,1] bounds); reject it.
    expect(wilsonInterval(3, -5)).toEqual([0, 1]);
    // Negative k clamps up to 0 (the all-failures interval, also = k = 0).
    expect(wilsonInterval(-4, 10)).toEqual(wilsonInterval(0, 10));
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

// ── Mutation-hardening for the statistics/phonetics core ────────────────────

describe("buildPhoneticClasses — scheme options change class membership", () => {
  const classWith = (cl: ReturnType<typeof buildPhoneticClasses>, c: string) =>
    cl.consonantClasses.find((g) => g.includes(c)) ?? [];

  it("the default scheme layers interdentals/ḥ/ž onto the base classes", () => {
    const cl = buildPhoneticClasses(DEFAULT_PHONETIC_SCHEME);
    expect(classWith(cl, "t")).toContain("ṯ"); // interdentals → dental
    expect(classWith(cl, "k")).toContain("ḥ"); // pharyngeal ḥ → velar
    expect(classWith(cl, "s")).toContain("ž"); // voiced postalveolar → sibilant
  });

  it("the conservative scheme excludes every contested phoneme", () => {
    const cl = buildPhoneticClasses(CONSERVATIVE_PHONETIC_SCHEME);
    expect(classWith(cl, "t")).not.toContain("ṯ");
    expect(classWith(cl, "k")).not.toContain("ḥ");
    expect(classWith(cl, "s")).not.toContain("ž");
  });

  it("routing interdentals to the sibilant class moves ṯ/ḏ off the dentals", () => {
    const cl = buildPhoneticClasses({
      ...DEFAULT_PHONETIC_SCHEME,
      interdentals: "sibilant",
    });
    expect(classWith(cl, "s")).toContain("ṯ");
    expect(classWith(cl, "t")).not.toContain("ṯ");
  });
});

describe("referenceKey / describePhoneticScheme", () => {
  it("strips reconstruction notation but keeps segmental content", () => {
    // PIE *ǵʰésr̥ → ǵésr (drop *, ʰ, combining syllabic ring U+0325).
    expect(referenceKey("*ǵʰésr̥")).toBe("ǵésr");
    expect(referenceKey("ka-ta")).toBe("kata"); // hyphens always dropped
  });

  it("keeps notation marks when stripping is disabled (still drops hyphens)", () => {
    expect(referenceKey("kʰa-ta", false)).toBe("kʰata");
  });

  it("describes a scheme as a reproducible one-line string", () => {
    expect(describePhoneticScheme(DEFAULT_PHONETIC_SCHEME)).toBe(
      "interdentals=dental, ḥ=velar, ž=sibilant, strip-notation=on",
    );
  });
});

describe("wordToPhonetic — subscripts and unknowns", () => {
  it("treats subscripted signs as distinct signs, never the plain series", () => {
    // RA₂ has no attested value in the map: it falls through lowercased
    // instead of borrowing RA's reading.
    expect(wordToPhonetic("RA₂-RO")).toBe("ra₂ro");
    expect(wordToPhonetic("SA-RA₂")).not.toBe(wordToPhonetic("SA-RA"));
  });
  it("reads a subscripted sign only from its own map entry", () => {
    expect(wordToPhonetic("SA-RA₂", { RA: "xx" })).toBe("sara₂");
    expect(wordToPhonetic("SA-RA₂", { "RA₂": "rya" })).toBe("sarya");
  });
  it("maps each known sign and lowercases unknown fall-through", () => {
    expect(wordToPhonetic("A-DU")).toBe("adu");
    expect(wordToPhonetic("ZZZ")).toBe("zzz");
  });
});

describe("phoneticDistance — indel cost and length normalization", () => {
  it("a single insertion costs indel/maxLen", () => {
    expect(phoneticDistance("ab", "abc")).toBeCloseTo(1 / 3, 12);
  });
  it("a deletion against the empty string normalizes to 1", () => {
    expect(phoneticDistance("a", "")).toBe(1);
    expect(phoneticDistance("", "")).toBe(0);
  });
  it("a far-class substitution costs 1/maxLen", () => {
    // c and x are outside every articulatory class → far cost 1.
    expect(phoneticDistance("abc", "abx")).toBeCloseTo(1 / 3, 12);
  });
});

describe("alignPhonetic — per-position operation labels", () => {
  const ops = (a: string, b: string) => alignPhonetic(a, b).map((c) => c.op);

  it("labels vowel, same-class, and far substitutions distinctly", () => {
    expect(ops("ka", "ko")).toEqual(["match", "sub-vowel"]); // a↔o vowels
    expect(ops("pa", "ba")).toEqual(["sub-class", "match"]); // p↔b labials
    expect(ops("ka", "ta")).toEqual(["sub-far", "match"]); // k↔t cross-class
  });

  it("labels insertions and deletions", () => {
    expect(ops("ka", "kla")).toContain("ins"); // extra 'l' in b
    expect(ops("kla", "ka")).toContain("del"); // extra 'l' in a
  });
});

describe("isNumeralToken", () => {
  it("accepts digit/approx tokens and rejects words and empties", () => {
    expect(isNumeralToken("123")).toBe(true);
    expect(isNumeralToken("≈")).toBe(true);
    expect(isNumeralToken("KU-RO")).toBe(false);
    expect(isNumeralToken("")).toBe(false);
  });

  it("accepts built-up fractions using the U+2044 fraction slash", () => {
    // The corpus renders every metrological fraction this way (superscript
    // numerator + ⁄ + subscript denominator); ⅟ alone missed all of them.
    expect(isNumeralToken("¹⁄₂")).toBe(true);
    expect(isNumeralToken("³⁄₄")).toBe(true);
    expect(isNumeralToken("¹⁄₁₆")).toBe(true);
  });
});

describe("findMorphologicalClusters — stem/suffix/threshold exactness", () => {
  const words = [
    { word: "po-ro", count: 4 },
    { word: "po-ro-na", count: 2 },
    { word: "po-ro-si", count: 1 }, // suffix "si" appears once → not productive
    { word: "ki-ro", count: 3 },
    { word: "ki-ro-na", count: 1 },
  ];

  it("links only via productive suffixes; stem is the shortest member", () => {
    const clusters = findMorphologicalClusters(words, {
      minSuffixProductivity: 2, // "na" ends two words; "si" only one
      minClusterSize: 2,
      maxSuffixLen: 1,
    });
    expect(clusters).toHaveLength(2);

    const poro = clusters.find((c) => c.stem === "po-ro")!;
    expect(poro.members.map((m) => m.word).sort()).toEqual([
      "po-ro",
      "po-ro-na", // po-ro-si is NOT linked (its suffix isn't productive)
    ]);
    expect(poro.suffixes).toEqual(["na"]);
    expect(poro.totalCount).toBe(6); // 4 + 2
    expect(poro.members.find((m) => m.word === "po-ro")!.suffix).toBe("");
    expect(poro.members.find((m) => m.word === "po-ro-na")!.suffix).toBe("na");
  });

  it("respects the productivity threshold exactly (>=, not >)", () => {
    // "na" appears in exactly 2 words; threshold 3 makes it non-productive.
    expect(
      findMorphologicalClusters(words, {
        minSuffixProductivity: 3,
        minClusterSize: 2,
        maxSuffixLen: 1,
      }),
    ).toHaveLength(0);
  });
});
