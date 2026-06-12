import { describe, expect, it } from "vitest";
import { siteSimilarities, siteWordSets } from "./siteSimilarity";

type Entry = { sites: Set<string> };
const index = (entries: [string, string[]][]): Map<string, Entry> =>
  new Map(entries.map(([w, sites]) => [w, { sites: new Set(sites) }]));

describe("siteWordSets", () => {
  it("groups multi-sign words by site and ignores single signs", () => {
    const sets = siteWordSets(
      index([
        ["KU-RO", ["HT", "ZA"]],
        ["A-DU", ["HT"]],
        ["VIN", ["HT"]], // single sign — not vocabulary
      ]),
    );
    expect([...(sets.get("HT") ?? [])].sort()).toEqual(["A-DU", "KU-RO"]);
    expect([...(sets.get("ZA") ?? [])]).toEqual(["KU-RO"]);
  });
});

describe("siteSimilarities", () => {
  const idx = index([
    ["KU-RO", ["HT", "ZA", "KH"]],
    ["A-DU", ["HT", "ZA"]],
    ["PA-I-TO", ["HT"]],
    ["SI-RU", ["KH"]],
  ]);
  // vocab: HT {KU-RO, A-DU, PA-I-TO}, ZA {KU-RO, A-DU}, KH {KU-RO, SI-RU}

  it("computes Jaccard over shared vocabulary, sorted descending", () => {
    const pairs = siteSimilarities(idx, ["HT", "ZA", "KH"]);
    expect(pairs[0]).toMatchObject({ a: "HT", b: "ZA", shared: 2 });
    expect(pairs[0].sim).toBeCloseTo(2 / 3, 10); // {KU-RO,A-DU} / {KU-RO,A-DU,PA-I-TO}
    const htKh = pairs.find((p) => p.a === "HT" && p.b === "KH")!;
    expect(htKh.shared).toBe(1);
    expect(htKh.sim).toBeCloseTo(1 / 4, 10);
  });

  it("keeps zero-similarity pairs; drops a pair only when both sites are vocabulary-less", () => {
    const pairs = siteSimilarities(
      index([
        ["KU-RO", ["A"]],
        ["A-DU", ["B"]],
      ]),
      ["A", "B", "C", "D"], // C and D have no vocabulary at all
    );
    // A↔B, A↔C, A↔D, B↔C, B↔D survive at similarity 0; C↔D is undefined.
    expect(pairs).toHaveLength(5);
    expect(pairs.every((p) => p.sim === 0 && p.shared === 0)).toBe(true);
    expect(pairs.some((p) => p.a === "C" && p.b === "D")).toBe(false);
  });

  it("defaults to every site in the index", () => {
    const pairs = siteSimilarities(idx);
    expect(pairs).toHaveLength(3); // HT-ZA, HT-KH, ZA-KH
  });
});
