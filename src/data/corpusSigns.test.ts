import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { SignData } from "../lib/types";

// Pins the shipped sign table (public/corpus/signs.json) so a drifted rebuild
// of scripts/build-corpus.mjs fails here instead of shipping silently. The
// table is derived by corpus alignment over the 236 inscriptions whose
// transliterated syllabic-sign count matches their glyph-stream sign count,
// counting only ASSIGNED Linear A codepoints (U+10600-10736, U+10740-10755,
// U+10760-10767 per Unicode 16.0). Upstream uses the UNASSIGNED U+1076B as a
// damage/lacuna marker; counting it as a sign once desynced the aligner
// (109 inscriptions rejected, 15 attested signs missing, a phantom "VS"
// entry wearing the damage marker itself as its glyph).
const read = (f: string) =>
  readFileSync(new URL(`../../public/corpus/${f}`, import.meta.url), "utf8");

const signs: SignData[] = JSON.parse(read("signs.json"));
const byLabel = new Map(signs.map((s) => [s.label, s]));

const isAssignedLinearA = (cp: number) =>
  (cp >= 0x10600 && cp <= 0x10736) ||
  (cp >= 0x10740 && cp <= 0x10755) ||
  (cp >= 0x10760 && cp <= 0x10767);

describe("shipped sign table (public/corpus/signs.json)", () => {
  it("has exactly 95 entries, matching the manifest signCount", () => {
    expect(signs.length).toBe(95);
    const manifest = JSON.parse(read("manifest.json"));
    expect(manifest.signCount).toBe(signs.length);
  });

  it("assigns every glyph a codepoint inside the assigned Linear A repertoire", () => {
    // Unassigned codepoints (like upstream's U+1076B damage marker or the
    // U+1076D once shipped for *810) must never appear as sign glyphs.
    for (const s of signs) {
      if (s.codepoint === null) continue;
      expect(
        isAssignedLinearA(s.codepoint),
        `${s.label} U+${s.codepoint.toString(16).toUpperCase()}`,
      ).toBe(true);
      expect(s.glyph).toBe(String.fromCodePoint(s.codepoint));
    }
  });

  it("has no duplicate modal glyphs or codepoints (alignment-drift tripwire)", () => {
    const glyphs = signs.filter((s) => s.glyph !== null).map((s) => s.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    const cps = signs
      .filter((s) => s.codepoint !== null)
      .map((s) => s.codepoint);
    expect(new Set(cps).size).toBe(cps.length);
  });

  it("keeps *903 unrendered (no Linear A codepoint exists for it)", () => {
    // Upstream draws *903 with U+10102 AEGEAN CHECK MARK, which is not a
    // Linear A sign; the entry ships glyph-less rather than wrong.
    const s = byLabel.get("*903");
    expect(s).toBeDefined();
    expect(s?.glyph).toBeNull();
    expect(s?.codepoint).toBeNull();
    expect(s?.sharedWithLinearB).toBe(false);
    expect(s?.linearAOnly).toBe(true);
  });

  it("carries no entry for the damage marker or codepoint-less *810", () => {
    // "VS" is upstream's transliteration of a damaged/illegible sign position
    // (glyph stream: unassigned U+1076B), not a sign. *810 has no Linear A
    // codepoint. Both once shipped with unassigned-codepoint glyphs.
    expect(byLabel.has("VS")).toBe(false);
    expect(byLabel.has("*810")).toBe(false);
  });

  it("includes the signs recovered when the damage marker stopped counting", () => {
    // label -> modal glyph, each verified against its Unicode 16 name
    // (PU=AB050, PU2=AB029, QI=AB021, *34=AB034, *47=AB047, *3nn=A3nn,
    // *802=A802, VIN+TE=A588).
    const recovered: Record<string, string> = {
      PU: "\u{1062B}",
      PU2: "\u{1061C}",
      QI: "\u{1060F}",
      "*34": "\u{1061F}",
      "*47": "\u{10628}",
      "*305": "\u{10659}",
      "*310": "\u{10660}",
      "*312": "\u{10662}",
      "*321": "\u{1066D}",
      "*323": "\u{1066F}",
      "*331": "\u{10677}",
      "*358": "\u{10692}",
      "*363": "\u{10697}",
      "*802": "\u{10762}",
      "VIN+TE": "\u{106FB}",
    };
    for (const [label, glyph] of Object.entries(recovered)) {
      expect(byLabel.get(label)?.glyph, label).toBe(glyph);
    }
  });

  it("classifies AB-series signs as shared with Linear B", () => {
    expect(signs.filter((s) => s.sharedWithLinearB).length).toBe(66);
    expect(signs.filter((s) => s.linearAOnly).length).toBe(23);
    // AB-series signs without PHONETIC_MAP values were once misclassified as
    // not-shared (the starred ones as Linear-A-only). Their codepoints carry
    // LINEAR A SIGN ABnnn names in the Unicode 16 chart.
    const abSeries = [
      "RA2", "PA3", "TA2", "AU", "NWA", "ZU", "GRA", "OLIV", "VIN",
      "*21F", "*34", "*47", "*86", "*118", "*164", "*188",
    ];
    for (const label of abSeries) {
      const s = byLabel.get(label);
      expect(s?.sharedWithLinearB, label).toBe(true);
      expect(s?.linearAOnly, label).toBe(false);
    }
    // A-series (Linear-A-only names) stay unshared.
    for (const label of ["*301", "*306", "*314", "SI+SE", "CYP+D"]) {
      expect(byLabel.get(label)?.sharedWithLinearB, label).toBe(false);
    }
    // Shared-ness is glyph-evidenced: every shared sign has a codepoint in
    // the AB-named part of the block (all AB names sit below U+10655).
    for (const s of signs) {
      if (!s.sharedWithLinearB) continue;
      expect(s.codepoint, s.label).not.toBeNull();
      expect(s.codepoint ?? Infinity, s.label).toBeLessThan(0x10655);
    }
  });
});
