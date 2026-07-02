import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCountableNumeral } from "./DocumentTypes";

interface CorpusDoc {
  id: string;
  words: string[];
}
const corpus = (): CorpusDoc[] =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "public/corpus/inscriptions.json"),
      "utf8",
    ),
  ) as CorpusDoc[];

describe("isCountableNumeral — the 'with numerals' predicate", () => {
  it("counts integers and built-up fractions, not separators or approx marks", () => {
    expect(isCountableNumeral("10")).toBe(true);
    expect(isCountableNumeral("¹⁄₂")).toBe(true); // U+2044 built-up fraction
    expect(isCountableNumeral("³⁄₈")).toBe(true);
    expect(isCountableNumeral("𐄁")).toBe(false); // separator dot carries no digit
    expect(isCountableNumeral("≈")).toBe(false); // bare approximation mark
    expect(isCountableNumeral("KU-RO")).toBe(false);
  });

  it("recovers the fraction-only documents corpus-wide", () => {
    const docs = corpus();
    const withNumerals = docs.filter((d) => d.words.some(isCountableNumeral));
    // 349 documents carry an integer numeral; 29 more record quantities
    // only as built-up metrological fractions ("¹⁄₂") and were invisible
    // while the numeral regex lacked the U+2044 fraction slash.
    expect(withNumerals.length).toBe(378);
    const fractionOnly = withNumerals.filter((d) =>
      d.words.filter(isCountableNumeral).every((w) => w.includes("⁄")),
    );
    expect(fractionOnly.length).toBe(29);
    const ids = fractionOnly.map((d) => d.id);
    expect(ids).toContain("HT147");
    expect(ids).toContain("KH80");
    expect(ids).toContain("PH30");
  });
});
