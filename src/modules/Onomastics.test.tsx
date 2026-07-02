// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FUNCTION_WORDS } from "./Onomastics";

// The exclusion list must track the corpus: an entry matching zero tokens
// excludes nothing (dead weight that reads like a real identification), so
// every entry is held to the same liveness property as the other curated
// word lists. cwd-relative like corpusFixture — under jsdom import.meta.url
// is not a file: URL.
const inscriptions = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "public/corpus/inscriptions.json"),
    "utf8",
  ),
) as { words?: string[] }[];

const corpusWords = new Set<string>();
for (const ins of inscriptions) for (const w of ins.words ?? []) corpusWords.add(w);

describe("FUNCTION_WORDS", () => {
  it("every excluded term matches at least one corpus token", () => {
    expect(FUNCTION_WORDS.size).toBeGreaterThan(0);
    for (const w of FUNCTION_WORDS) {
      expect(corpusWords.has(w), w).toBe(true);
    }
  });

  it("keeps the transaction terms and no longer lists KU-RO₂", () => {
    // KU-RO₂ came out with the 1.5.3 marker fix: no corpus token carries it.
    expect(corpusWords.has("KU-RO₂")).toBe(false);
    expect(FUNCTION_WORDS.has("KU-RO₂")).toBe(false);
    // The securely identified structural terms stay excluded.
    expect(FUNCTION_WORDS.has("KU-RO")).toBe(true);
    expect(FUNCTION_WORDS.has("KI-RO")).toBe(true);
    expect(FUNCTION_WORDS.has("PO-TO-KU-RO")).toBe(true);
    expect(FUNCTION_WORDS.has("SA-RA₂")).toBe(true);
  });
});
