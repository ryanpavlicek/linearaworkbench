// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TabletStructure from "./TabletStructure";
import { useWorkbench } from "../store/workbench";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

const statValues = (root: HTMLElement) =>
  Array.from(root.querySelectorAll(".stat-grid .stat-box .val")).map((el) =>
    // a filtered box renders "eff / total" — the leading number is the
    // effective count
    Number((el.textContent ?? "").trim().split("/")[0]),
  );

describe("TabletStructure — behavior against the real corpus", () => {
  it("classifies every inscription into exactly one category", () => {
    const { container } = render(<TabletStructure />);
    expect(
      screen.getByRole("heading", { name: /tablet structure/i }),
    ).toBeTruthy();

    const counts = statValues(container);
    expect(counts.length).toBeGreaterThanOrEqual(4); // accounting/libation/list/text…
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(
      useWorkbench.getState().corpus.inscriptions.length,
    );
  });

  it("the filter narrows category counts and clears back to the full corpus", () => {
    const { container } = render(<TabletStructure />);
    const before = statValues(container);

    fireEvent.change(
      screen.getByPlaceholderText(/match id \/ site/i),
      { target: { value: "Zakros" } },
    );
    const filtered = statValues(container);
    // Zakros is a fraction of the corpus — at least one included category
    // must have shrunk, and none may grow.
    expect(filtered.some((c, i) => c < before[i])).toBe(true);
    expect(filtered.every((c, i) => c <= before[i])).toBe(true);

    fireEvent.click(screen.getByTitle(/clear the filter/i));
    expect(statValues(container)).toEqual(before);
  });
});
