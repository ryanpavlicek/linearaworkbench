import { describe, it, expect } from "vitest";
import {
  parseValue,
  isValueToken,
  lineValue,
  formatValue,
  parseAccountLines,
  checkBalances,
} from "./numerals";

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
