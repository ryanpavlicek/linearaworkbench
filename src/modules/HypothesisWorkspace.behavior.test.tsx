// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import HypothesisWorkspace from "./HypothesisWorkspace";
import { loadRealCorpus } from "../test/corpusFixture";
import { useWorkbench } from "../store/workbench";

beforeAll(() => loadRealCorpus());
afterEach(() => {
  cleanup();
  const st = useWorkbench.getState();
  st.resetHypothesis();
  while (useWorkbench.getState().savedHypotheses.length > 0)
    st.deleteHypothesis(0);
});

// Two snapshots that disagree on RA only: baseline vs RA→la.
function saveRaPair() {
  const st = useWorkbench.getState();
  st.resetHypothesis();
  st.saveHypothesis("base");
  st.setOverride("RA", "la");
  st.saveHypothesis("ra-la");
}

const wordCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("tbody tr")).map(
    (r) => r.querySelector("td .word-link")?.textContent?.trim() ?? "",
  );

const hasExactRa = (w: string) =>
  w.split("-").map((p) => p.replace(/\*/g, "")).includes("RA");

describe("HypothesisWorkspace — affected words under the exact-sign key", () => {
  it("diffing snapshots that differ on RA evaluates plain-RA words only", () => {
    saveRaPair();
    const { container } = render(<HypothesisWorkspace />);
    fireEvent.click(screen.getByText("Diff two"));

    const words = wordCells(container).filter(Boolean);
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) expect(hasExactRa(w)).toBe(true);
    // The old key folded RA₂ into RA, listing RA₂-only words (SA-RA₂ is the
    // most frequent) as affected by an RA-only diff.
    expect(container.textContent).not.toContain("RA₂");
  });

  it("compare-all evaluates over plain-RA words only", () => {
    saveRaPair();
    const { container } = render(<HypothesisWorkspace />);
    fireEvent.click(screen.getByText("Compare all"));

    const words = wordCells(container).filter(Boolean);
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) expect(hasExactRa(w)).toBe(true);
    expect(container.querySelector("tbody")!.textContent).not.toContain("RA₂");
  });
});
