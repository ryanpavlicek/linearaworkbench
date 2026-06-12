// NOTE: the expected values in this file are extracted into pyaegean's
// golden parity fixtures (tests/fixtures/golden/) — changing an expectation
// here means re-extracting the fixtures there. See docs/DATA.md.
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

// ── Mutation-hardening: exact alignment + report structure ──────────────────

describe("alignSequences — exact substitution behavior", () => {
  it("aligns differing middle words as a substitution column (both present)", () => {
    const aln = alignSequences([
      ["A-B", "X-Y", "C-D"],
      ["A-B", "Z-Z", "C-D"],
    ]);
    expect(aln).toEqual([
      ["A-B", "A-B"],
      ["X-Y", "Z-Z"],
      ["C-D", "C-D"],
    ]);
  });

  it("progressively aligns three sequences into 2-or-3-wide positions", () => {
    const aln = alignSequences([
      ["A-B", "C-D"],
      ["A-B", "C-D"],
      ["A-B", "C-D"],
    ]);
    expect(aln).toEqual([
      ["A-B", "A-B", "A-B"],
      ["C-D", "C-D", "C-D"],
    ]);
  });
});

describe("buildCompareReport — exact structure", () => {
  const a = ins("HT1", ["A-B", "C-D"]);
  const b = ins("HT2", ["A-B", "E-F"]);

  it("states the exact compared-count / aligned-positions summary", () => {
    const alignment = alignSequences([a.words, b.words]);
    const { html, markdown } = buildCompareReport([a, b], alignment, new Map());
    expect(html).toContain("2 inscriptions compared · 2 aligned positions");
    expect(markdown).toContain("2 inscriptions compared · 2 aligned positions");
    // Per-tablet metadata line in the markdown.
    expect(markdown).toContain("- **HT1** — HT · LMIB · S1");
  });

  it("shades rows where the same word aligns across columns", () => {
    // First position (A-B / A-B) matches; it gets the shaded background.
    const { html } = buildCompareReport(
      [a, b],
      alignSequences([a.words, b.words]),
      new Map(),
    );
    expect(html).toContain("background:#f3f4f6");
  });

  it("renders a gap marker where a column has no word", () => {
    const longer = ins("HT3", ["A-B", "X-Y", "C-D"]);
    const shorter = ins("HT4", ["A-B", "C-D"]);
    const { html } = buildCompareReport(
      [longer, shorter],
      alignSequences([longer.words, shorter.words]),
      new Map(),
    );
    expect(html).toContain(">·<"); // gap cell content
  });

  it("truncates the markdown alignment listing past 50 positions", () => {
    const words = Array.from({ length: 51 }, (_, i) => `W${i}-X`);
    const p = ins("HT5", words);
    const q = ins("HT6", words);
    const { markdown } = buildCompareReport(
      [p, q],
      alignSequences([p.words, q.words]),
      new Map(),
    );
    expect(markdown).toContain("more aligned positions");
  });
});
