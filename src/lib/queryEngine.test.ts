import { describe, it, expect } from "vitest";
import {
  defaultValue,
  inscriptionMatches,
  wordMatches,
  evalQuery,
  summarizeFilters,
  type FilterRow,
} from "./queryEngine";
import type { Inscription, WordEntry } from "./types";

function ins(
  id: string,
  site: string,
  words: string[],
  extra: Partial<Inscription> = {},
): Inscription {
  return {
    id,
    site,
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
    ...extra,
  };
}

const row = (field: FilterRow["field"], value: unknown, extra: Partial<FilterRow> = {}): FilterRow =>
  ({ rid: field + JSON.stringify(value), field, value, ...extra });

describe("defaultValue", () => {
  it("defaults by field kind", () => {
    expect(defaultValue("word-min-syllables")).toBe(2); // number
    expect(defaultValue("has-image")).toBe(true); // boolean
    expect(defaultValue("id-contains")).toBe(""); // text
  });
});

describe("inscriptionMatches — predicates and AND/OR/NOT", () => {
  const ht1 = ins("HT1", "HT", ["KU-RO"], { facsimileImages: ["img.jpg"] });

  it("matches single-field predicates and is vacuously true when empty", () => {
    expect(inscriptionMatches(ht1, [], new Set())).toBe(true);
    expect(inscriptionMatches(ht1, [row("site-is", "HT")], new Set())).toBe(true);
    expect(inscriptionMatches(ht1, [row("site-is", "ZA")], new Set())).toBe(false);
  });

  it("NOT flips a row's own test", () => {
    expect(
      inscriptionMatches(ht1, [row("site-is", "ZA", { negate: true })], new Set()),
    ).toBe(true);
  });

  it("AND requires all rows; OR requires any", () => {
    const andOk = [row("site-is", "HT"), row("scribe-is", "S1", { connector: "and" })];
    const andBad = [row("site-is", "HT"), row("scribe-is", "SX", { connector: "and" })];
    const orOk = [row("site-is", "ZA"), row("scribe-is", "S1", { connector: "or" })];
    expect(inscriptionMatches(ht1, andOk, new Set())).toBe(true);
    expect(inscriptionMatches(ht1, andBad, new Set())).toBe(false);
    expect(inscriptionMatches(ht1, orOk, new Set())).toBe(true);
  });

  it("boolean predicates: has-image and has-annotation", () => {
    expect(inscriptionMatches(ht1, [row("has-image", true)], new Set())).toBe(true);
    const noImg = ins("HT2", "HT", ["A-B"]);
    expect(inscriptionMatches(noImg, [row("has-image", true)], new Set())).toBe(false);
    expect(
      inscriptionMatches(ht1, [row("has-annotation", true)], new Set(["HT1"])),
    ).toBe(true);
  });

  it("ins-contains-word matches an exact token", () => {
    expect(inscriptionMatches(ht1, [row("ins-contains-word", "KU-RO")], new Set())).toBe(true);
    expect(inscriptionMatches(ht1, [row("ins-contains-word", "PA-I-TO")], new Set())).toBe(false);
  });
});

describe("wordMatches — word-scope predicates", () => {
  const cooc = new Map<string, Set<string>>([["KU-RO", new Set(["PA-I-TO"])]]);

  it("prefix / suffix / syllable-count predicates", () => {
    expect(wordMatches("KU-RO", [row("word-prefix", "KU")], cooc)).toBe(true);
    expect(wordMatches("PA-RO", [row("word-prefix", "KU")], cooc)).toBe(false);
    expect(wordMatches("KU-RO", [row("word-suffix", "RO")], cooc)).toBe(true);
    expect(wordMatches("KU-NE-RO", [row("word-min-syllables", 3)], cooc)).toBe(true);
    expect(wordMatches("KU-RO", [row("word-min-syllables", 3)], cooc)).toBe(false);
    expect(wordMatches("KU-RO", [row("word-max-syllables", 2)], cooc)).toBe(true);
  });

  it("contains-sign, sign-pattern, and co-occurs-with predicates", () => {
    expect(wordMatches("KU-NE-RO", [row("word-contains-sign", "NE")], cooc)).toBe(true);
    expect(wordMatches("KU-NE-RO", [row("word-sign-pattern", "KU-*-RO")], cooc)).toBe(true);
    expect(wordMatches("KU-RO", [row("word-cooccurs-with", "PA-I-TO")], cooc)).toBe(true);
    expect(wordMatches("KU-RO", [row("word-cooccurs-with", "ZZ")], cooc)).toBe(false);
  });

  it("empty min/max-syllables values are neutral (no-op match), like the sibling predicates", () => {
    // A blank value must not filter — matching word-contains/prefix/suffix.
    // word-max-syllables was the dangerous case: Number("") is 0, so the old
    // `parts.length <= 0` rejected every real word; an empty value must match.
    expect(wordMatches("KU-NE-RO", [row("word-max-syllables", "")], cooc)).toBe(true);
    expect(wordMatches("KU-NE-RO", [row("word-min-syllables", "")], cooc)).toBe(true);
    // Whitespace-only and nullish values are blank too.
    expect(wordMatches("KU-NE-RO", [row("word-max-syllables", "  ")], cooc)).toBe(true);
    expect(wordMatches("KU-NE-RO", [row("word-min-syllables", null)], cooc)).toBe(true);
    // A real value still filters correctly: KU-NE-RO has 3 signs.
    expect(wordMatches("KU-NE-RO", [row("word-max-syllables", 2)], cooc)).toBe(false);
    expect(wordMatches("KU-RO", [row("word-max-syllables", 2)], cooc)).toBe(true);
    expect(wordMatches("KU-NE-RO", [row("word-min-syllables", 4)], cooc)).toBe(false);
    expect(wordMatches("KU-NE-RO", [row("word-min-syllables", 3)], cooc)).toBe(true);
  });
});

describe("evalQuery", () => {
  const corpus = [
    ins("HT1", "HT", ["KU-RO", "PA-I-TO"]),
    ins("HT2", "HT", ["KU-NE-RO"]),
    ins("ZA1", "ZA", ["PA-I-TO"]),
  ];
  const wordIndex = new Map<string, WordEntry>([
    ["KU-RO", { count: 1, inscriptionIds: ["HT1"], sites: new Set(["HT"]) }],
    ["PA-I-TO", { count: 2, inscriptionIds: ["HT1", "ZA1"], sites: new Set(["HT", "ZA"]) }],
    ["KU-NE-RO", { count: 1, inscriptionIds: ["HT2"], sites: new Set(["HT"]) }],
  ]);
  const empty = new Map<string, Set<string>>();

  it("returns inscriptions filtered by an inscription-scope predicate", () => {
    const { inscriptions } = evalQuery(
      [row("site-is", "HT")],
      "inscriptions",
      corpus,
      wordIndex,
      new Set(),
      empty,
    );
    expect(inscriptions.map((i) => i.id).sort()).toEqual(["HT1", "HT2"]);
  });

  it("intersects a word-scope predicate into the inscription results", () => {
    const { inscriptions } = evalQuery(
      [row("word-suffix", "RO")],
      "inscriptions",
      corpus,
      wordIndex,
      new Set(),
      empty,
    );
    // Only HT1 (KU-RO) and HT2 (KU-NE-RO) have a word ending in RO.
    expect(inscriptions.map((i) => i.id).sort()).toEqual(["HT1", "HT2"]);
  });

  it("word output mode returns [word, count] sorted by descending count", () => {
    const { words } = evalQuery(
      [row("word-suffix", "O")], // matches KU-RO? no (ends O). PA-I-TO ends O; KU-NE-RO ends O
      "words",
      corpus,
      wordIndex,
      new Set(),
      empty,
    );
    // PA-I-TO appears in 2 matched inscriptions, KU-NE-RO in 1 → sorted desc.
    expect(words[0][0]).toBe("PA-I-TO");
    expect(words[0][1]).toBe(2);
  });
});

describe("summarizeFilters", () => {
  it("renders a readable label, with NOT and boolean values", () => {
    expect(summarizeFilters([row("site-is", "HT")])).toBe("Site is: HT");
    expect(summarizeFilters([row("has-image", true)])).toBe("Has facsimile image: yes");
    expect(summarizeFilters([row("site-is", "ZA", { negate: true })])).toBe(
      "NOT Site is: ZA",
    );
    expect(summarizeFilters([])).toBe("(no filters)");
  });
});
