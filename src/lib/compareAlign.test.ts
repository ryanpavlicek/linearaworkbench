import { describe, it, expect } from "vitest";
import { alignSequences, addSequence, buildCompareReport } from "./compareAlign";
import type { Inscription } from "./types";

function ins(id: string, words: string[]): Inscription {
  return {
    id,
    site: "HT",
    support: "tablet",
    scribe: "S1",
    findspot: "",
    context: "LMIB",
    name: id,
    words,
    translations: [],
    lines: [],
    glyphs: "",
    transcription: "",
    facsimileImages: [],
    images: [],
    imageRights: "",
    imageRightsURL: "",
  };
}

describe("alignSequences — progressive Needleman–Wunsch", () => {
  it("aligns identical sequences position-for-position", () => {
    const aln = alignSequences([
      ["A-B", "C-D"],
      ["A-B", "C-D"],
    ]);
    expect(aln).toHaveLength(2);
    expect(aln[0]).toEqual(["A-B", "A-B"]);
    expect(aln[1]).toEqual(["C-D", "C-D"]);
  });

  it("introduces a gap where one sequence has an extra word", () => {
    const aln = alignSequences([
      ["A-B", "X-Y", "C-D"],
      ["A-B", "C-D"],
    ]);
    expect(aln).toHaveLength(3);
    // Exactly one aligned position is a gap (a null in the shorter column).
    const gapRows = aln.filter((p) => p.includes(null));
    expect(gapRows).toHaveLength(1);
    // Positions where both columns are present hold the same shared word.
    for (const p of aln) {
      const present = p.filter((w): w is string => Boolean(w));
      if (present.length === 2) expect(present[0]).toBe(present[1]);
    }
  });

  it("addSequence appends a column to a single-sequence alignment", () => {
    const base = [["A-B"], ["C-D"]]; // seq0 as a 2-position alignment
    const out = addSequence(base, ["A-B", "C-D"], 1);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(["A-B", "A-B"]);
  });

  it("returns empty for no input", () => {
    expect(alignSequences([])).toEqual([]);
  });
});

describe("buildCompareReport", () => {
  const a = ins("HT1", ["A-B", "C-D"]);
  const b = ins("HT2", ["A-B", "E-F"]);

  it("renders an interlinear HTML table with metadata and a shared-words legend", () => {
    const alignment = alignSequences([a.words, b.words]);
    const shared = new Map([["A-B", "#5b9eff"]]);
    const { html, markdown } = buildCompareReport([a, b], alignment, shared);

    expect(html).toContain("HT1");
    expect(html).toContain("HT2");
    expect(html).toContain("Shared words (1)");
    expect(html).toContain("aligned positions");
    expect(markdown).toContain("inscriptions compared");
    expect(markdown).toContain("A-B");
  });

  it("notes the absence of shared words when the legend map is empty", () => {
    const alignment = alignSequences([a.words, b.words]);
    const { html, markdown } = buildCompareReport([a, b], alignment, new Map());
    expect(html).toContain("No shared multi-sign words");
    expect(markdown).toContain("No shared multi-sign words");
  });

  it("escapes HTML-significant characters in inscription ids", () => {
    const evil = ins("HT<1>", ["A-B"]);
    const { html } = buildCompareReport(
      [evil],
      alignSequences([evil.words]),
      new Map(),
    );
    expect(html).toContain("HT&lt;1&gt;");
    expect(html).not.toContain("<1>");
  });
});
