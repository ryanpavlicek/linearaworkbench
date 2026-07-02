import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSignAlias } from "./abNumbers";

// The shipped sign table is the ground truth for which AB-chart members the
// corpus actually uses: each sign's Unicode codepoint name carries its AB
// number (QA = U+1060C LINEAR A SIGN AB016, NWA = U+10629 AB048, …), which
// is what pins the mappings below.
const signs = JSON.parse(
  readFileSync(
    new URL("../../public/corpus/signs.json", import.meta.url),
    "utf8",
  ),
) as { label: string; codepoint: number | null }[];

describe("resolveSignAlias", () => {
  it("resolves the chart members the table ships beyond the CV core", () => {
    // Verified against the shipped codepoints' Unicode names:
    // AB016/AB029/AB048/AB056/AB065/AB066/AB085.
    expect(resolveSignAlias("AB16")).toBe("QA");
    expect(resolveSignAlias("AB29")).toBe("PU2");
    expect(resolveSignAlias("AB48")).toBe("NWA");
    expect(resolveSignAlias("AB56")).toBe("PA3");
    expect(resolveSignAlias("AB65")).toBe("JU");
    expect(resolveSignAlias("AB66")).toBe("TA2");
    expect(resolveSignAlias("AB85")).toBe("AU");
  });

  it("keeps the long-standing resolutions and pass-throughs", () => {
    expect(resolveSignAlias("AB77")).toBe("KA");
    expect(resolveSignAlias("ab 8")).toBe("A");
    expect(resolveSignAlias("ab-17")).toBe("ZA");
    expect(resolveSignAlias("A301")).toBe("*301");
    expect(resolveSignAlias("KA")).toBeNull();
    expect(resolveSignAlias("AB999")).toBeNull();
  });

  it("reaches every AB-block syllabogram in the shipped sign table", () => {
    // AB syllabograms occupy U+10600–U+10646; a sign there with a plain
    // phonetic label (not starred, not a ligature) is a standard-chart
    // member and must be reachable from some ABnn alias — otherwise the
    // sign-search alias silently misses a sign the corpus uses.
    const reachable = new Set<string>();
    for (let n = 1; n <= 99; n++) {
      const label = resolveSignAlias(`AB${n}`);
      if (label) reachable.add(label);
    }
    const chartLabels = signs
      .filter(
        (s) =>
          s.codepoint !== null &&
          s.codepoint >= 0x10600 &&
          s.codepoint <= 0x10646 &&
          /^[A-Z]+[0-9]?$/.test(s.label),
      )
      .map((s) => s.label);
    expect(chartLabels.length).toBeGreaterThanOrEqual(50); // the real signary
    for (const label of chartLabels) {
      expect(reachable.has(label), label).toBe(true);
    }
  });
});
