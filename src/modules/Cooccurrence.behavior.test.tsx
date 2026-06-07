// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Cooccurrence from "./Cooccurrence";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

describe("Co-occurrence — behavior against the real corpus", () => {
  it("renders collocation pairs with the PMI / G² / χ² statistic columns", () => {
    const { container } = render(<Cooccurrence />);
    expect(screen.getByRole("heading", { name: /co-occurrence/i })).toBeTruthy();

    const heads = Array.from(container.querySelectorAll("thead th")).map(
      (h) => h.textContent,
    );
    expect(heads).toEqual(expect.arrayContaining(["PMI", "G²", "χ²"]));
    expect(container.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });

  it("'collocates of' restricts every pair to ones containing the target word", () => {
    const { container } = render(<Cooccurrence />);

    // Flip on the collocates-of mode, then enter an exact target word.
    const colLabel = Array.from(container.querySelectorAll("label")).find((l) =>
      /collocates of/i.test(l.textContent ?? ""),
    )!;
    fireEvent.click(colLabel.querySelector('input[type="checkbox"]')!);
    fireEvent.change(screen.getByPlaceholderText(/collocates of word/i), {
      target: { value: "KU-RO" },
    });

    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const words = Array.from(r.querySelectorAll(".word-link")).map((l) =>
        (l.textContent ?? "").trim(),
      );
      expect(words).toContain("KU-RO");
    }
  });
});
