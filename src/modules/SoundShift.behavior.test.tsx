// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SoundShift from "./SoundShift";
import { loadRealCorpus, realCorpus } from "../test/corpusFixture";
import { useWorkbench } from "../store/workbench";

beforeAll(() => loadRealCorpus());
afterEach(() => {
  cleanup();
  useWorkbench.getState().resetHypothesis();
});

// Independent count of RA word-token occurrences: for every multi-sign word,
// each part whose sign key ("*" stripped, subscripts kept) is exactly RA,
// weighted by the word's corpus count. RA₂ parts must not contribute.
function expectedRaCount(): number {
  const counts = new Map<string, number>();
  for (const i of realCorpus().inscriptions)
    for (const w of i.words)
      if (w.includes("-")) counts.set(w, (counts.get(w) ?? 0) + 1);
  let total = 0;
  for (const [w, c] of counts)
    for (const p of w.split("-")) if (p.replace(/\*/g, "") === "RA") total += c;
  return total;
}

describe("SoundShift — sign keys keep subscripted signs distinct", () => {
  it("the RA grid cell counts plain-RA occurrences only", () => {
    const { container } = render(<SoundShift />);
    const raCell = container.querySelector('.hyp-cell[title^="RA: "]')!;
    expect(raCell).toBeTruthy();
    const m = /^RA: (\d+) word-token/.exec(raCell.getAttribute("title")!);
    expect(m).toBeTruthy();
    // The old key folded RA₂ (and would fold PA₃/TA₂/PU₂ into their series):
    // 20 RA₂-bearing word types inflated this count.
    expect(Number(m![1])).toBe(expectedRaCount());
  });

  it("editing RA evaluates only words that contain plain RA, never RA₂-only words", () => {
    useWorkbench.getState().setOverride("RA", "la");
    const { container } = render(<SoundShift />);

    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows.length).toBeGreaterThan(0);

    const words = rows.map(
      (r) => r.querySelector("td .word-link")?.textContent?.trim() ?? "",
    );
    // Every evaluated word carries the exact sign RA…
    for (const w of words) {
      expect(w.split("-").map((p) => p.replace(/\*/g, ""))).toContain("RA");
    }
    // …and the most frequent RA₂ word (SA-RA₂, the top word the old key
    // wrongly listed as affected) is gone: no corpus word carries both.
    expect(container.querySelector("tbody")!.textContent).not.toContain("RA₂");
  });
});
