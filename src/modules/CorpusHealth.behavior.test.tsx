// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import CorpusHealth from "./CorpusHealth";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

function statBox(label: string): Element {
  const box = Array.from(document.querySelectorAll(".stat-box")).find(
    (b) => b.querySelector(".lbl")?.textContent?.trim() === label,
  );
  if (!box) throw new Error(`stat box "${label}" not found`);
  return box;
}

describe("CorpusHealth — damage statistic against the real corpus", () => {
  it("counts the 𐝫 lost-sign marker as damage: 21% of tablets, 672 tokens", () => {
    render(<CorpusHealth />);
    const box = statBox("Tablets with damaged tokens");
    // Brackets/question marks alone said 4% — the corpus's own lacuna
    // marker (𐝫, 552 standalone tokens) is damage too, as ScribeSchool
    // already treats it. 366 of 1,721 tablets → 21%.
    expect(box.querySelector(".val")!.textContent).toBe("21%");
    // The tooltip carries the token-level count.
    expect(box.getAttribute("title")).toContain("672");
    expect(box.getAttribute("title")).toContain("𐝫");
  });
});
