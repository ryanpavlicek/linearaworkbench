import { describe, it, expect } from "vitest";
import {
  compileSignPattern,
  matchSignPattern,
  wordMatchesSignPattern,
} from "./signPattern";

describe("compileSignPattern", () => {
  it("normalizes labels to uppercase, subscript-folded form", () => {
    const p = compileSignPattern("ra2-ro");
    expect(p?.tokens).toEqual(["RA2", "RO"]);
    expect(p?.hasDoubleStar).toBe(false);
  });

  it("preserves wildcards and flags the variable-length one", () => {
    expect(compileSignPattern("KU-*-RO")?.hasDoubleStar).toBe(false);
    expect(compileSignPattern("KU-**")?.hasDoubleStar).toBe(true);
  });

  it("returns null for an empty pattern", () => {
    expect(compileSignPattern("")).toBeNull();
    expect(compileSignPattern("-")).toBeNull();
  });
});

describe("matchSignPattern — single-sign wildcard (*)", () => {
  it("'KU-*-RO' matches exactly three signs with those ends", () => {
    const p = compileSignPattern("KU-*-RO")!;
    expect(matchSignPattern(["KU", "NE", "RO"], p)).toBe(true);
    expect(matchSignPattern(["KU", "RO"], p)).toBe(false); // too short
    expect(matchSignPattern(["KU", "NE", "TA", "RO"], p)).toBe(false); // too long
  });

  it("folds subscripts when matching (RA₂ ≡ RA2)", () => {
    const p = compileSignPattern("RA2-RO")!;
    expect(matchSignPattern(["RA₂", "RO"], p)).toBe(true);
  });
});

describe("matchSignPattern — variable-length wildcard (**)", () => {
  it("'KU-**' matches two or more signs starting with KU", () => {
    const p = compileSignPattern("KU-**")!;
    expect(matchSignPattern(["KU", "NE", "RO"], p)).toBe(true);
    expect(matchSignPattern(["KU", "RO"], p)).toBe(true);
    expect(matchSignPattern(["KU"], p)).toBe(true); // ** absorbs zero signs
    expect(matchSignPattern(["DA", "RO"], p)).toBe(false);
  });

  it("'**-RO' matches any sequence ending in RO", () => {
    const p = compileSignPattern("**-RO")!;
    expect(matchSignPattern(["KU", "NE", "RO"], p)).toBe(true);
    expect(matchSignPattern(["RO"], p)).toBe(true);
    expect(matchSignPattern(["KU", "NE"], p)).toBe(false);
  });
});

describe("wordMatchesSignPattern", () => {
  it("compiles and matches a hyphenated word in one call", () => {
    expect(wordMatchesSignPattern("KU-NE-RO", "KU-*-RO")).toBe(true);
    expect(wordMatchesSignPattern("KU-RO", "KU-*-RO")).toBe(false);
    expect(wordMatchesSignPattern("KU-RO", "**")).toBe(true);
  });

  it("returns false for single-sign words (no separators)", () => {
    expect(wordMatchesSignPattern("KU", "**")).toBe(false);
  });
});
