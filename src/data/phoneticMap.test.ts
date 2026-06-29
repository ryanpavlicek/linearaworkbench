import { describe, it, expect } from "vitest";
import { PHONETIC_MAP } from "./phoneticMap";

describe("PHONETIC_MAP", () => {
  it("covers the full w-series (wa/we/wi/wo) shared with Linear B", () => {
    // Linear B has wa, we, wi, wo (no wu). WE and WO had been omitted while
    // WA and WI were present — a coverage gap, since AB75=we / AB42=wo are
    // standard shared values.
    expect(PHONETIC_MAP.WA).toBe("wa");
    expect(PHONETIC_MAP.WE).toBe("we");
    expect(PHONETIC_MAP.WI).toBe("wi");
    expect(PHONETIC_MAP.WO).toBe("wo");
  });

  it("maps the five pure vowels", () => {
    expect(PHONETIC_MAP.A).toBe("a");
    expect(PHONETIC_MAP.E).toBe("e");
    expect(PHONETIC_MAP.I).toBe("i");
    expect(PHONETIC_MAP.O).toBe("o");
    expect(PHONETIC_MAP.U).toBe("u");
  });

  it("stores non-empty lowercase phonetic values", () => {
    for (const [sign, val] of Object.entries(PHONETIC_MAP)) {
      expect(val.length, sign).toBeGreaterThan(0);
      expect(val, sign).toBe(val.toLowerCase());
    }
  });
});
