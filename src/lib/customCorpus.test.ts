import { describe, expect, it } from "vitest";
import { normalizeCorpusJson } from "./customCorpus";
import { buildCorpusExport } from "./corpusExport";
import { realCorpus } from "../test/corpusFixture";

describe("normalizeCorpusJson", () => {
  it("accepts a plain array and fills defaults for missing fields", () => {
    const { inscriptions, skipped, source } = normalizeCorpusJson([
      { id: "X1", words: ["A-B", "C"] },
    ]);
    expect(source).toBe("array");
    expect(skipped).toBe(0);
    const ins = inscriptions[0];
    expect(ins.id).toBe("X1");
    expect(ins.site).toBe("Unknown");
    expect(ins.support).toBe("unknown");
    expect(ins.name).toBe("X1");
    expect(ins.words).toEqual(["A-B", "C"]);
    expect(ins.lines).toEqual([["A-B", "C"]]);
    expect(ins.translations).toEqual(["", ""]);
    expect(ins.facsimileImages).toEqual([]);
    expect(ins.images).toEqual([]);
  });

  it("unwraps a schema-v1 corpus export object", () => {
    const { inscriptions, source } = normalizeCorpusJson({
      _meta: { schemaVersion: 1 },
      inscriptions: [{ id: "X1", words: ["A"] }],
    });
    expect(source).toBe("export");
    expect(inscriptions).toHaveLength(1);
  });

  it("derives words from lines when words are absent", () => {
    const { inscriptions } = normalizeCorpusJson([
      { id: "X1", lines: [["A-B"], ["C", "D"]] },
    ]);
    expect(inscriptions[0].words).toEqual(["A-B", "C", "D"]);
    expect(inscriptions[0].lines).toEqual([["A-B"], ["C", "D"]]);
  });

  it("pads or truncates translations to stay aligned with words", () => {
    const { inscriptions } = normalizeCorpusJson([
      { id: "X1", words: ["A", "B"], translations: ["one"] },
      { id: "X2", words: ["A"], translations: ["one", "two"] },
    ]);
    expect(inscriptions[0].translations).toEqual(["one", ""]);
    expect(inscriptions[1].translations).toEqual(["one"]);
  });

  it("skips entries without an id, without text, or with a duplicate id", () => {
    const { inscriptions, skipped } = normalizeCorpusJson([
      { id: "X1", words: ["A"] },
      { words: ["B"] }, // no id
      { id: "X1", words: ["C"] }, // duplicate
      { id: "X3" }, // no text at all
      { id: "X4", transcription: "A-B" }, // transcription alone is enough
    ]);
    expect(inscriptions.map((i) => i.id)).toEqual(["X1", "X4"]);
    expect(skipped).toBe(3);
  });

  it("rejects input that isn't a corpus at all", () => {
    expect(() => normalizeCorpusJson({ foo: 1 })).toThrow(/Expected a JSON array/);
    expect(() => normalizeCorpusJson("nope")).toThrow(/Expected a JSON array/);
    expect(() => normalizeCorpusJson([{ name: "no id" }])).toThrow(
      /No usable inscriptions/,
    );
  });

  it("ignores non-string junk inside arrays instead of crashing", () => {
    const { inscriptions } = normalizeCorpusJson([
      { id: "X1", words: ["A", 5, null, "B"], images: [1, "img.jpg"] },
    ]);
    expect(inscriptions[0].words).toEqual(["A", "B"]);
    expect(inscriptions[0].images).toEqual(["img.jpg"]);
  });

  it("reads the export schema's `period` and nested `images` block", () => {
    const { inscriptions } = normalizeCorpusJson({
      _meta: { schemaVersion: 1 },
      inscriptions: [
        {
          id: "HT1",
          period: "LMIB",
          words: ["KU-RO", "15"],
          images: {
            facsimile: ["images/HT1-Facsimile.jpg"],
            photograph: ["images/HT1-Inscription.jpg"],
            rights: "© École Française d'Athènes",
            rightsUrl: "papers/GORILA-Vol1.pdf#page=38",
          },
        },
      ],
    });
    const ins = inscriptions[0];
    expect(ins.context).toBe("LMIB");
    expect(ins.facsimileImages).toEqual(["images/HT1-Facsimile.jpg"]);
    expect(ins.images).toEqual(["images/HT1-Inscription.jpg"]);
    expect(ins.imageRights).toBe("© École Française d'Athènes");
    expect(ins.imageRightsURL).toBe("papers/GORILA-Vol1.pdf#page=38");
  });
});

describe("schema-v1 export round-trip", () => {
  it("re-imports the workbench's own export losslessly", () => {
    // A real bundled-corpus subset, restricted to entries the normalizer
    // keeps verbatim (it substitutes [words] for an empty `lines`).
    const subset = realCorpus()
      .inscriptions.filter((i) => i.words.length > 0 && i.lines.length > 0)
      .slice(0, 60);
    expect(subset).toHaveLength(60);
    // The subset must actually exercise the fields that used to drop.
    expect(subset.some((i) => i.context !== "")).toBe(true);
    expect(subset.some((i) => i.facsimileImages.length > 0)).toBe(true);
    expect(subset.some((i) => i.images.length > 0)).toBe(true);
    expect(subset.some((i) => i.imageRights !== "")).toBe(true);

    const exported = buildCorpusExport(subset, [], new Map(), {
      scope: {
        site: null,
        period: null,
        scribe: null,
        support: null,
        collectionId: null,
      },
      scopeSummary: "round-trip subset",
      includeUserState: false,
      includeSigns: false,
      includeWordFrequencies: false,
      hypothesis: {},
      annotations: [],
      collections: [],
      pins: [],
      tabletCategoryOverrides: {},
    });
    // Through JSON, exactly like a saved export file coming back in.
    const { inscriptions, skipped, source } = normalizeCorpusJson(
      JSON.parse(JSON.stringify(exported)),
    );
    expect(source).toBe("export");
    expect(skipped).toBe(0);
    expect(inscriptions).toEqual(subset);
  });
});
