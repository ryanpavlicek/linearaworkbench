import { describe, expect, it } from "vitest";
import { overlayOptions, overlaySiteCounts } from "./geoOverlays";
import type { Inscription } from "./types";

const ins = (partial: Partial<Inscription>): Inscription => ({
  id: "X1",
  site: "Haghia Triada",
  support: "Tablet",
  scribe: "",
  findspot: "",
  context: "",
  name: "X1",
  words: [],
  translations: [],
  lines: [],
  glyphs: "",
  transcription: "",
  facsimileImages: [],
  images: [],
  imageRights: "",
  imageRightsURL: "",
  ...partial,
});

const CORPUS: Inscription[] = [
  ins({ id: "HT1", words: ["KU-RO", "VIN", "5"], context: "LMIB", scribe: "S1" }),
  ins({ id: "HT2", words: ["A-DU", "VIN+KA"], context: "LMIB", scribe: "S2" }),
  ins({ id: "ZA1", site: "Zakros", words: ["KU-RO", "GRA"], context: "MMIII" }),
  ins({ id: "??", site: "", words: ["KU-RO"] }), // siteless — never counted
];

describe("overlaySiteCounts", () => {
  it("returns null for an empty value", () => {
    expect(overlaySiteCounts(CORPUS, "word", "")).toBeNull();
    expect(overlaySiteCounts(CORPUS, "word", "   ")).toBeNull();
  });

  it("word mode matches exact words case-insensitively, per site", () => {
    const m = overlaySiteCounts(CORPUS, "word", "ku-ro")!;
    expect(m.get("Haghia Triada")).toBe(1);
    expect(m.get("Zakros")).toBe(1);
    expect(m.size).toBe(2); // the siteless inscription is excluded
  });

  it("commodity mode matches the logogram head, ligatures included", () => {
    const m = overlaySiteCounts(CORPUS, "commodity", "VIN")!;
    expect(m.get("Haghia Triada")).toBe(2); // VIN and VIN+KA
    expect(m.has("Zakros")).toBe(false);
  });

  it("scribe and period modes match their metadata fields exactly", () => {
    expect(overlaySiteCounts(CORPUS, "scribe", "S1")!.get("Haghia Triada")).toBe(1);
    const lm = overlaySiteCounts(CORPUS, "period", "LMIB")!;
    expect(lm.get("Haghia Triada")).toBe(2);
    expect(lm.has("Zakros")).toBe(false);
  });
});

describe("overlayOptions", () => {
  it("word mode is free text — no options", () => {
    expect(overlayOptions(CORPUS, "word")).toEqual([]);
  });

  it("commodity options carry glosses and per-inscription counts", () => {
    const opts = overlayOptions(CORPUS, "commodity");
    const vin = opts.find((o) => o.value === "VIN")!;
    expect(vin.count).toBe(2);
    expect(vin.label).toMatch(/VIN — wine/);
    expect(opts.find((o) => o.value === "GRA")!.count).toBe(1);
  });

  it("period options sort chronologically: MM before LM", () => {
    const opts = overlayOptions(CORPUS, "period");
    expect(opts.map((o) => o.value)).toEqual(["MMIII", "LMIB"]);
  });

  it("category options cover the structural buckets present", () => {
    const opts = overlayOptions(CORPUS, "category");
    expect(opts.length).toBeGreaterThan(0);
    const total = opts.reduce((s, o) => s + o.count, 0);
    expect(total).toBe(3); // every sited inscription lands in exactly one bucket
  });
});
