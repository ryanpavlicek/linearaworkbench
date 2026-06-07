// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CrossLinguistic from "./CrossLinguistic";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

describe("Cross-Linguistic Comparator — behavior against the real corpus", () => {
  it("ranks reference-language matches for a Linear A word", () => {
    const { container } = render(<CrossLinguistic />);
    expect(
      screen.getByRole("heading", { name: /cross-linguistic comparator/i }),
    ).toBeTruthy();

    fireEvent.change(
      screen.getByPlaceholderText(/enter linear a word/i),
      { target: { value: "KU-RO" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^compare$/i }));

    // A ranked match table appears, each row colour-coded by match quality.
    const scored = container.querySelectorAll(
      ".score-hi, .score-md, .score-lo",
    );
    expect(scored.length).toBeGreaterThan(0);
    // The header reports the match count for the queried word's phonetic form.
    expect(screen.getByText(/\d+\s+matches/i)).toBeTruthy();
  });

  it("recomputes against the new word's phonetic form on a fresh query", () => {
    const { container } = render(<CrossLinguistic />);
    const input = screen.getByPlaceholderText(/enter linear a word/i);

    fireEvent.change(input, { target: { value: "KU-RO" } });
    fireEvent.click(screen.getByRole("button", { name: /^compare$/i }));
    // The results header shows the queried word's phonetic reading.
    expect(container.textContent).toContain("/kuro/");

    fireEvent.change(input, { target: { value: "PA-I-TO" } });
    fireEvent.click(screen.getByRole("button", { name: /^compare$/i }));
    expect(container.textContent).toContain("/paito/");
    expect(container.textContent).not.toContain("/kuro/");
  });
});
