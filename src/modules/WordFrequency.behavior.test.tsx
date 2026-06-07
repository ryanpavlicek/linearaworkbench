// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import WordFrequency from "./WordFrequency";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

const countCells = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("tbody td.numeral")).map((c) =>
    Number(c.textContent),
  );

describe("WordFrequency — behavior against the real corpus", () => {
  it("lists words sorted by descending count by default", () => {
    const { container } = render(<WordFrequency />);
    expect(screen.getByRole("heading", { name: /word frequency/i })).toBeTruthy();

    const counts = countCells(container);
    expect(counts.length).toBeGreaterThan(1);
    // Default sort is count desc — non-increasing down the table.
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
    // The most frequent multi-sign word recurs many times in the corpus.
    expect(counts[0]).toBeGreaterThan(1);
  });

  it("the text filter restricts rows to matching words", () => {
    const { container } = render(<WordFrequency />);
    const before = container.querySelectorAll("tbody tr").length;

    fireEvent.change(screen.getByPlaceholderText(/filter words/i), {
      target: { value: "KU-RO" },
    });

    const links = Array.from(
      container.querySelectorAll("tbody .word-link"),
    ) as HTMLElement[];
    expect(links.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("tbody tr").length).toBeLessThan(before);
    expect(
      links.every((l) => (l.textContent ?? "").toUpperCase().includes("KU-RO")),
    ).toBe(true);
  });

  it("the hapax filter shows only words attested exactly once", () => {
    const { container } = render(<WordFrequency />);
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    const counts = countCells(container);
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((c) => c === 1)).toBe(true);
  });
});
