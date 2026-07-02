import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseValue,
  isValueToken,
  lineValue,
  formatValue,
  parseAccountLines,
  checkBalances,
  TOTAL_MARKERS,
  GRAND_TOTAL_MARKERS,
  DEFICIT_MARKERS,
} from "./numerals";

// The real bundled corpus, read directly (no store) — the known-answer
// tests below pin values on actual tablets.
interface CorpusDoc {
  id: string;
  lines: string[][];
}
let corpusCache: CorpusDoc[] | null = null;
function corpus(): CorpusDoc[] {
  if (!corpusCache)
    corpusCache = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "public/corpus/inscriptions.json"),
        "utf8",
      ),
    ) as CorpusDoc[];
  return corpusCache;
}
const doc = (id: string): CorpusDoc => {
  const d = corpus().find((i) => i.id === id);
  if (!d) throw new Error(`corpus fixture missing ${id}`);
  return d;
};

describe("parseValue", () => {
  it("parses plain decimal integers", () => {
    expect(parseValue("197")).toBe(197);
    expect(parseValue("0")).toBe(0);
  });

  it("parses precomposed vulgar fractions", () => {
    expect(parseValue("½")).toBeCloseTo(0.5, 10);
    expect(parseValue("¾")).toBeCloseTo(0.75, 10);
    expect(parseValue("⅓")).toBeCloseTo(1 / 3, 10);
  });

  it("parses built-up superscript/subscript fractions (³⁄₄)", () => {
    expect(parseValue("³⁄₄")).toBeCloseTo(0.75, 10);
    expect(parseValue("¹⁄₂")).toBeCloseTo(0.5, 10);
  });

  it("returns null for non-numeral tokens and empty input", () => {
    expect(parseValue("KU-RO")).toBeNull();
    expect(parseValue("")).toBeNull();
    expect(parseValue("  ")).toBeNull();
    expect(parseValue("GRA")).toBeNull();
  });

  it("isValueToken mirrors parseValue", () => {
    expect(isValueToken("5")).toBe(true);
    expect(isValueToken("¾")).toBe(true);
    expect(isValueToken("KU-RO")).toBe(false);
  });
});

describe("lineValue", () => {
  it("sums an integer followed by a fraction (5 + ¾ = 5.75)", () => {
    expect(lineValue(["5", "³⁄₄"])).toBeCloseTo(5.75, 10);
  });

  it("ignores non-numeral tokens on the line", () => {
    expect(lineValue(["GRA", "10", "VIN", "5"])).toBe(15);
  });

  it("returns 0 for a line with no numerals", () => {
    expect(lineValue(["KU-RO", "GRA"])).toBe(0);
  });
});

describe("formatValue", () => {
  it("renders integers plainly", () => {
    expect(formatValue(5)).toBe("5");
  });

  it("renders a whole + fraction with the metrological glyph", () => {
    expect(formatValue(31.75)).toBe("31¾");
    expect(formatValue(0.5)).toBe("½");
  });

  it("falls back to a tidy decimal for an unrecognized fraction", () => {
    expect(formatValue(1.1)).toBe("1.1");
  });
});

describe("parseAccountLines + checkBalances", () => {
  it("tags roles and confirms a tablet that balances", () => {
    const lines = parseAccountLines([
      ["GRA", "10"],
      ["VIN", "5"],
      ["KU-RO", "15"],
    ]);
    expect(lines.map((l) => l.role)).toEqual(["item", "item", "total"]);

    const checks = checkBalances(lines);
    expect(checks).toHaveLength(1);
    expect(checks[0].marker).toBe("KU-RO");
    expect(checks[0].computedSum).toBe(15);
    expect(checks[0].statedTotal).toBe(15);
    expect(checks[0].balances).toBe(true);
    expect(checks[0].difference).toBe(0);
  });

  it("flags a tablet whose item lines do not match the stated total", () => {
    const lines = parseAccountLines([
      ["GRA", "10"],
      ["KU-RO", "12"],
    ]);
    const checks = checkBalances(lines);
    expect(checks).toHaveLength(1);
    expect(checks[0].balances).toBe(false);
    expect(checks[0].computedSum).toBe(10);
    expect(checks[0].statedTotal).toBe(12);
    expect(checks[0].difference).toBe(-2);
  });

  it("treats a numberless leading line as a header", () => {
    const lines = parseAccountLines([["A-DU"], ["GRA", "3"], ["KU-RO", "3"]]);
    expect(lines[0].role).toBe("header");
  });
});

// ── Mutation-hardening: exact values across the parsing/format/balance paths ──

describe("parseValue — exhaustive forms", () => {
  it("maps every precomposed vulgar fraction to its exact value", () => {
    const cases: [string, number][] = [
      ["½", 0.5],
      ["⅓", 1 / 3],
      ["⅔", 2 / 3],
      ["¼", 0.25],
      ["¾", 0.75],
      ["⅕", 0.2],
      ["⅙", 1 / 6],
      ["⅚", 5 / 6],
      ["⅛", 0.125],
      ["⅝", 0.625],
      ["⅞", 0.875],
    ];
    for (const [g, v] of cases) expect(parseValue(g)).toBeCloseTo(v, 10);
  });

  it("parses an ASCII-slash fraction and rejects a zero denominator", () => {
    expect(parseValue("3/4")).toBeCloseTo(0.75, 10);
    expect(parseValue("5/0")).toBeNull();
    expect(parseValue("x/2")).toBeNull();
  });

  it("rejects malformed slash tokens instead of coercing them to a number", () => {
    // Empty numerator: Number("") === 0, so "/2" used to parse as 0/2 = 0.
    expect(parseValue("/2")).toBeNull();
    expect(parseValue("3/")).toBeNull();
    // Non-digit numerator must be rejected, not coerced.
    expect(parseValue("x/2")).toBeNull();
    // Improper / non-proper fractions are not metrological fractions.
    expect(parseValue("5/4")).toBeNull(); // numerator >= denominator
    expect(parseValue("4/4")).toBeNull(); // == 1, not a proper fraction
    expect(parseValue("0/4")).toBeNull(); // zero numerator
    // A genuine proper fraction still parses to its exact value.
    expect(parseValue("3/8")).toBeCloseTo(0.375, 10);
  });
});

describe("formatValue — exact glyph rendering", () => {
  it("renders bare and whole-prefixed metrological fractions exactly", () => {
    expect(formatValue(0.5)).toBe("½");
    expect(formatValue(2.5)).toBe("2½");
    expect(formatValue(1 / 3)).toBe("⅓");
    expect(formatValue(3 + 2 / 3)).toBe("3⅔");
    expect(formatValue(0.25)).toBe("¼");
    expect(formatValue(1 / 16)).toBe("¹⁄₁₆");
  });

  it("falls back to a trimmed decimal for an unrecognized fraction", () => {
    expect(formatValue(1.234)).toBe("1.234");
    expect(formatValue(2.51)).toBe("2.51");
    expect(formatValue(7)).toBe("7");
  });

  it("keeps the sign and integer part of a negative mixed number", () => {
    // -1.5 = -(1 + ½): both the minus sign and the "1" must survive.
    // The old Math.floor(-1.5) === -2 path dropped them and rendered "½".
    expect(formatValue(-1.5)).toBe("-1½");
    // A negative integer is still rendered plainly (sign preserved).
    expect(formatValue(-3)).toBe("-3");
    // A negative bare fraction has no integer part to show.
    expect(formatValue(-0.25)).toBe("-¼");
    // Positives are unchanged by the sign handling.
    expect(formatValue(2.75)).toBe("2¾");
  });
});

describe("parseAccountLines — role tagging", () => {
  it("tags grand totals, subtotals, and deficits distinctly", () => {
    const lines = parseAccountLines([
      ["GRA", "5"],
      ["KU-RO", "5"],
      ["KI-RO", "2"],
      ["PO-TO-KU-RO", "7"],
    ]);
    expect(lines.map((l) => l.role)).toEqual([
      "item",
      "total",
      "deficit",
      "grand-total",
    ]);
  });

  it("classifies commodity ideograms apart from syllabic terms", () => {
    const [line] = parseAccountLines([["GRA", "VINa", "KU-RO", "10"]]);
    expect(line.ideograms).toContain("GRA");
    expect(line.terms).toContain("KU-RO");
    expect(line.terms).not.toContain("GRA");
  });
});

describe("transaction-term markers", () => {
  // KU-RO (and its variant KU-RA) means "total"; KI-RO is the deficit term.
  // KU-RO₂ is not an attested word and never appears in the corpus, so it must
  // not be treated as a deficit marker (it had wrongly been bundled with KI-RO).
  it("treats KI-RO as the only deficit marker", () => {
    expect([...DEFICIT_MARKERS]).toEqual(["KI-RO"]);
    expect(DEFICIT_MARKERS.has("KU-RO₂")).toBe(false);
  });

  it("keeps KU-RO a total and PO-TO-KU-RO a grand total, not deficits", () => {
    expect(TOTAL_MARKERS.has("KU-RO")).toBe(true);
    expect(GRAND_TOTAL_MARKERS.has("PO-TO-KU-RO")).toBe(true);
    expect(DEFICIT_MARKERS.has("KU-RO")).toBe(false);
  });
});

describe("checkBalances — sectioning and deficits", () => {
  it("excludes KI-RO deficit lines from the summed total", () => {
    const lines = parseAccountLines([
      ["GRA", "10"],
      ["KI-RO", "3"], // deficit — must NOT be added to the items
      ["KU-RO", "10"],
    ]);
    const [check] = checkBalances(lines);
    expect(check.computedSum).toBe(10);
    expect(check.balances).toBe(true);
  });

  it("resets the running items after each total (independent sections)", () => {
    const lines = parseAccountLines([
      ["GRA", "4"],
      ["KU-RO", "4"], // section 1 closes
      ["VINa", "9"],
      ["KU-RO", "9"], // section 2 sums only the post-reset item
    ]);
    const checks = checkBalances(lines);
    expect(checks).toHaveLength(2);
    expect(checks[0].computedSum).toBe(4);
    expect(checks[1].computedSum).toBe(9);
    expect(checks.every((c) => c.balances)).toBe(true);
  });

  it("checks a grand total against the stated subtotals, not an empty section", () => {
    const lines = parseAccountLines([
      ["GRA", "4"],
      ["KU-RO", "4"],
      ["VINa", "9"],
      ["KU-RO", "9"],
      ["PO-TO-KU-RO", "13"], // 4 + 9 — restates the subtotals
    ]);
    const checks = checkBalances(lines);
    expect(checks).toHaveLength(3);
    const grand = checks[2];
    expect(grand.marker).toBe("PO-TO-KU-RO");
    expect(grand.computedSum).toBe(13);
    expect(grand.itemCount).toBe(2); // two subtotals feed it
    expect(grand.balances).toBe(true);
  });

  it("a grand total also absorbs trailing items without their own subtotal", () => {
    const lines = parseAccountLines([
      ["GRA", "4"],
      ["KU-RO", "4"],
      ["VINa", "2"], // no closing KU-RO for this section
      ["PO-TO-KU-RO", "6"],
    ]);
    const checks = checkBalances(lines);
    const grand = checks[checks.length - 1];
    expect(grand.computedSum).toBe(6); // subtotal 4 + trailing item 2
    expect(grand.itemCount).toBe(2);
    expect(grand.balances).toBe(true);
  });

  it("yields no check for a total with nothing to check against", () => {
    // Leading KU-RO (items lost to damage) — previously produced a spurious
    // 0-vs-stated discrepancy.
    const lines = parseAccountLines([
      ["KU-RO", "12"],
      ["GRA", "3"],
      ["KU-RO", "3"],
    ]);
    const checks = checkBalances(lines);
    expect(checks).toHaveLength(1);
    expect(checks[0].computedSum).toBe(3);
    expect(checks[0].balances).toBe(true);
  });

  it("an unverifiable leading subtotal still feeds the grand total", () => {
    const lines = parseAccountLines([
      ["KU-RO", "5"], // items lost, but the stated value remains usable
      ["GRA", "2"],
      ["KU-RO", "2"],
      ["PO-TO-KU-RO", "7"],
    ]);
    const checks = checkBalances(lines);
    const grand = checks[checks.length - 1];
    expect(grand.marker).toBe("PO-TO-KU-RO");
    expect(grand.computedSum).toBe(7); // 5 + 2
    expect(grand.balances).toBe(true);
  });
});

describe("approximate fractions (≈)", () => {
  it("parses the editor's estimated value, dropping the ≈ qualifier", () => {
    // The value is the editor's reading of a damaged/unclear quantity; it
    // sums at face value (the qualifier is not propagated).
    expect(parseValue("≈ ¹⁄₆")).toBeCloseTo(1 / 6, 10);
    expect(parseValue("≈ ¹⁄₄")).toBeCloseTo(0.25, 10);
    expect(parseValue("≈5")).toBe(5);
    expect(isValueToken("≈ ¹⁄₆")).toBe(true);
    // A bare ≈ (nothing legible after it) is still not a value.
    expect(parseValue("≈")).toBeNull();
  });

  it("HT93b: the approximate fraction joins its line sum", () => {
    // HT93b line 1 reads "165 ≈ ¹⁄₆" — the estimated sixth used to be
    // silently dropped, understating the quantity to a flat 165.
    const ht93b = doc("HT93b");
    expect(ht93b.lines[0]).toEqual(["165", "≈ ¹⁄₆"]);
    expect(lineValue(ht93b.lines[0])).toBeCloseTo(165 + 1 / 6, 10);
  });

  it("HT123+124a: ≈ quantities feed both the items and the stated total", () => {
    const lines = parseAccountLines(doc("HT123+124a").lines);
    // The *308 item line "4 ≈ ¹⁄₆" carries 4⅙, not 4.
    expect(lines[7].tokens).toEqual(["*308", "4", "≈ ¹⁄₆"]);
    expect(lines[7].value).toBeCloseTo(4 + 1 / 6, 10);
    // The second KU-RO states "25 ≈ ¹⁄₆" = 25⅙.
    expect(lines[14].role).toBe("total");
    expect(lines[14].value).toBeCloseTo(25 + 1 / 6, 10);
    // And the balance check's computed item sum includes the item's ⅙:
    // 31 + 8¼ + 31½ + 8¾ + 16 + 4⅙ + 15 + 4¼ (deficit KI-RO lines excluded).
    const [check] = checkBalances(lines);
    expect(check.itemCount).toBe(8);
    expect(check.computedSum).toBeCloseTo(118 + 11 / 12, 10);
  });
});

describe("KU-RA total marker", () => {
  it("recognizes KU-RA as KU-RO's variant", () => {
    expect(TOTAL_MARKERS.has("KU-RA")).toBe(true);
    expect(TOTAL_MARKERS.has("KU-RO")).toBe(true);
  });

  it("ZA20: the KU-RA line yields a balance check", () => {
    // ZA20 closes with "KU-RA 130"; the surviving items sum to
    // 4 + 1 + 6 + 12 + 3 = 26 (the tablet is broken at both ends).
    const checks = checkBalances(parseAccountLines(doc("ZA20").lines));
    expect(checks).toHaveLength(1);
    expect(checks[0].marker).toBe("KU-RA");
    expect(checks[0].statedTotal).toBe(130);
    expect(checks[0].computedSum).toBe(26);
    expect(checks[0].itemCount).toBe(5);
    expect(checks[0].balances).toBe(false);
  });

  it("corpus-wide: KU-RA adds exactly the ZA20 check and flips no other tablet", () => {
    // ARKH2's KU-RA leads its list (no items above it), so it stays
    // checkless by the leading-total rule; ZA20's is the one new check.
    let total = 0;
    const kuraTablets: string[] = [];
    for (const d of corpus()) {
      const checks = checkBalances(parseAccountLines(d.lines));
      total += checks.length;
      if (checks.some((c) => c.marker === "KU-RA")) kuraTablets.push(d.id);
    }
    expect(kuraTablets).toEqual(["ZA20"]);
    expect(total).toBe(35); // 34 KU-RO/PO-TO-KU-RO checks + ZA20's KU-RA
  });
});
