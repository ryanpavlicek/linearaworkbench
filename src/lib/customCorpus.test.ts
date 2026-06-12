import { describe, expect, it } from "vitest";
import { normalizeCorpusJson } from "./customCorpus";

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
});
