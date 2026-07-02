import { describe, expect, it } from "vitest";
import { PHONETIC_MAP } from "../data/phoneticMap";
import {
  buildLbDivergence,
  LA_VALUE_TO_LB_TRANSLIT,
  linearASignValueCounts,
  parseDamosFrequencies,
  spearmanRho,
} from "./linearB";

describe("parseDamosFrequencies", () => {
  const payload = {
    _meta: { version: 2, generated: "2026-06-01", cite: "Aurora 2015" },
    documents: [
      {
        // line labels, a divider, a logogram, a numeral, an underdotted
        // sign, a supraliteral word, and a bracket-damaged word
        content:
          ".1 ko-no-so , GRA 10\n" +
          ".2 ku-ro₂ / 'me-no' ọ-pe-ro\n" +
          ".3 ]ru-wo[ VIR 3\n",
      },
      { content: ".a a-pi-qo-i-ta\n" },
    ],
  };

  it("counts syllabograms in multi-sign words only", () => {
    const f = parseDamosFrequencies(payload);
    expect(f.counts["ko"]).toBe(1);
    expect(f.counts["no"]).toBe(2); // ko-no-so + me-no
    expect(f.counts["ku"]).toBe(1);
    expect(f.counts["ro2"]).toBe(1); // subscript normalized
    expect(f.counts["o"]).toBe(1); // underdot stripped, ọ-pe-ro counted
    expect(f.counts["ru"]).toBe(1); // brackets stripped, ]ru-wo[ counted
    expect(f.counts["GRA"]).toBeUndefined();
    expect(f.counts["10"]).toBeUndefined();
    expect(f.wordTokens).toBe(6);
    expect(f.docCount).toBe(2);
    expect(f.version).toBe("2");
  });

  it("ignores line labels and dividers", () => {
    const f = parseDamosFrequencies({
      documents: [{ content: ".12 , / a-ta\n" }],
    });
    expect(f.counts["a"]).toBe(1);
    expect(f.counts["ta"]).toBe(1);
    expect(f.wordTokens).toBe(1);
  });

  it("handles empty payloads", () => {
    const f = parseDamosFrequencies({});
    expect(f.totalSigns).toBe(0);
    expect(f.docCount).toBe(0);
  });
});

describe("linearASignValueCounts", () => {
  it("keys token-weighted counts by conventional value", () => {
    const r = linearASignValueCounts([
      { word: "KU-RO", count: 10 },
      { word: "KU-PA", count: 3 },
      { word: "KU", count: 99 }, // single sign — excluded
      { word: "OLE+U-KU", count: 5 }, // ligature — excluded
    ]);
    expect(r.byValue.get("ku")?.count).toBe(13);
    expect(r.byValue.get("ku")?.labels).toEqual(["KU"]);
    expect(r.byValue.get("ro")?.count).toBe(10);
    expect(r.totalSigns).toBe(26); // 2×10 + 2×3
  });

  it("counts value-less signs toward the total only", () => {
    const r = linearASignValueCounts([{ word: "KU-*301", count: 4 }]);
    expect(r.totalSigns).toBe(8);
    expect(r.byValue.get("ku")?.count).toBe(4);
    expect(r.byValue.size).toBe(1);
  });
});

describe("buildLbDivergence", () => {
  it("joins on shared values and signs the log-ratio toward Linear A", () => {
    const la = linearASignValueCounts([
      { word: "KU-RO", count: 50 },
      { word: "TA-RO", count: 10 },
    ]);
    const lb = {
      version: "2",
      generated: "",
      cite: "",
      counts: { ku: 10, ro: 300, ta: 50, zz: 5 },
      totalSigns: 1000,
      wordTokens: 400,
      docCount: 100,
    };
    const rows = buildLbDivergence(la, lb);
    const byValue = Object.fromEntries(rows.map((r) => [r.value, r]));
    // ku: LA 50/120 ≈ 417‰ vs LB 10‰ → strongly positive
    expect(byValue["ku"].logRatio).toBeGreaterThan(3);
    // ro: LA 60/120 = 500‰ vs LB 300‰ → mildly positive
    expect(byValue["ro"].logRatio).toBeGreaterThan(0);
    expect(byValue["ro"].logRatio).toBeLessThan(2);
    expect(byValue["ku"].laPer1000).toBeCloseTo(416.7, 0);
    // zz exists only in LB — not a shared row
    expect(byValue["zz"]).toBeUndefined();
    // sorted by |logRatio| descending
    expect(rows[0].value).toBe("ku");
  });

  it("returns empty for empty inputs", () => {
    expect(
      buildLbDivergence(
        { byValue: new Map(), totalSigns: 0 },
        {
          version: "",
          generated: "",
          cite: "",
          counts: {},
          totalSigns: 0,
          wordTokens: 0,
          docCount: 0,
        },
      ),
    ).toEqual([]);
  });
});

describe("the q-/z-series transliteration bridge", () => {
  const lb = {
    version: "2",
    generated: "",
    cite: "",
    // DAMOS keys: Linear B transliteration writes qa/qe and za/ze/zo for
    // the series the phonetic map writes kwa/kwe and dza/dze/dzo.
    counts: { qa: 30, qe: 20, za: 10, ze: 8, zo: 6 },
    totalSigns: 1000,
    wordTokens: 300,
    docCount: 50,
  };

  it("joins the labiovelar and affricate series to their DAMOS keys", () => {
    const la = linearASignValueCounts([
      { word: "QA-QE", count: 4 },
      { word: "ZA-ZE-ZO", count: 2 },
    ]);
    expect(la.byValue.get("kwa")?.count).toBe(4); // LA-side key stays "kwa"
    const rows = buildLbDivergence(la, lb);
    const byValue = Object.fromEntries(rows.map((r) => [r.value, r]));
    // Each series row now exists and carries the q-/z-keyed DAMOS count.
    expect(byValue["kwa"]).toMatchObject({ labels: ["QA"], laCount: 4, lbCount: 30 });
    expect(byValue["kwe"]).toMatchObject({ labels: ["QE"], laCount: 4, lbCount: 20 });
    expect(byValue["dza"]).toMatchObject({ labels: ["ZA"], laCount: 2, lbCount: 10 });
    expect(byValue["dze"]).toMatchObject({ labels: ["ZE"], laCount: 2, lbCount: 8 });
    expect(byValue["dzo"]).toMatchObject({ labels: ["ZO"], laCount: 2, lbCount: 6 });
    expect(rows).toHaveLength(5);
    // The bridged count also feeds the LB rate: 30 of 1,000 sign tokens.
    expect(byValue["kwa"].lbPer1000).toBeCloseTo(30, 10);
  });

  it("covers exactly the divergent pairs of the two alphabets", () => {
    // For a shared AB sign the DAMOS transliteration key is its label
    // lowercased (QA → qa, KU → ku), so the bridge is complete iff mapping
    // any phonetic value through it lands on the lowercased label.
    for (const [label, value] of Object.entries(PHONETIC_MAP)) {
      expect(LA_VALUE_TO_LB_TRANSLIT[value] ?? value, label).toBe(
        label.toLowerCase(),
      );
    }
    // …and carries nothing the phonetic map can't produce.
    const values = new Set(Object.values(PHONETIC_MAP));
    for (const key of Object.keys(LA_VALUE_TO_LB_TRANSLIT)) {
      expect(values.has(key), key).toBe(true);
    }
  });
});

describe("spearmanRho", () => {
  it("is 1 for monotone agreement and −1 for reversal", () => {
    expect(spearmanRho([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 10);
    expect(spearmanRho([1, 2, 3, 4], [9, 7, 5, 1])).toBeCloseTo(-1, 10);
  });

  it("matches a hand-computed mixed case", () => {
    // ranks x: 1,2,3,4,5; y: 2,1,4,3,5 → ρ = 1 − 6·4/(5·24) = 0.8
    expect(spearmanRho([10, 20, 30, 40, 50], [15, 12, 40, 30, 99])).toBeCloseTo(
      0.8,
      10,
    );
  });

  it("averages tied ranks and degenerates safely", () => {
    expect(spearmanRho([1, 1, 2], [5, 5, 9])).toBeCloseTo(1, 10);
    expect(spearmanRho([1, 2], [3, 4])).toBe(0); // n < 3
    expect(spearmanRho([1, 1, 1], [1, 2, 3])).toBe(0); // zero variance
  });
});
