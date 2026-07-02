import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIBATION_WORDS, LIBATION_WORD_SET } from "./libation";

// The list's whole job is to match tokens of the real bundled corpus, so
// every entry is held to a liveness property against it — a dead entry
// (matching zero tokens) silently blinds the tablet-structure classifier
// and the Libation Formulas module and can't be caught by "it runs" tests.
const inscriptions = JSON.parse(
  readFileSync(
    new URL("../../public/corpus/inscriptions.json", import.meta.url),
    "utf8",
  ),
) as { id: string; words?: string[] }[];

const wordCount = new Map<string, number>();
for (const ins of inscriptions)
  for (const w of ins.words ?? []) wordCount.set(w, (wordCount.get(w) ?? 0) + 1);

describe("LIBATION_WORDS", () => {
  it("every entry matches at least one corpus token (no dead entries)", () => {
    for (const w of LIBATION_WORDS) {
      expect(wordCount.get(w) ?? 0, w).toBeGreaterThanOrEqual(1);
    }
  });

  it("carries the attested a-di-ki-te family, on the right vessels", () => {
    const on = (word: string) =>
      inscriptions.filter((i) => (i.words ?? []).includes(word)).map((i) => i.id);
    expect(on("A-DI-KI-TE")).toEqual(["PKZa12"]);
    expect(on("A-DI-KI-TE-TE")).toEqual(["PKZa11"]);
    expect(on("JA-DI-KI-TE-TE-DU-PU₂-RE")).toEqual(["PKZa15"]);
    expect(on("JA-DI-KI-TE-TE-*307-PU₂-RE")).toEqual(["PKZa8"]);
    for (const w of [
      "A-DI-KI-TE",
      "A-DI-KI-TE-TE",
      "JA-DI-KI-TE-TE-DU-PU₂-RE",
      "JA-DI-KI-TE-TE-*307-PU₂-RE",
    ]) {
      expect(LIBATION_WORD_SET.has(w), w).toBe(true);
    }
  });

  it("no longer carries the unattested restoration fragment", () => {
    // "A-DI-KI-TE-TE-DU" is a fragment of Younger's restored reading of the
    // damaged word on PK Za 11 (A-DI-KI-TE-TE-DU-PU-RE), not a token any
    // corpus inscription carries — as a list entry it matched nothing.
    expect(LIBATION_WORD_SET.has("A-DI-KI-TE-TE-DU")).toBe(false);
    expect(wordCount.get("A-DI-KI-TE-TE-DU")).toBeUndefined();
  });

  it("the set mirrors the list exactly", () => {
    expect(LIBATION_WORD_SET.size).toBe(new Set(LIBATION_WORDS).size);
    for (const w of LIBATION_WORDS) {
      expect(LIBATION_WORD_SET.has(w), w).toBe(true);
    }
  });
});
