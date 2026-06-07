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
