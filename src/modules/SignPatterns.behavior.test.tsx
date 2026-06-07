// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SignPatterns from "./SignPatterns";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

const matchedWords = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("tbody .word-link")).map(
    (l) => (l.textContent ?? "").trim(),
  );

describe("SignPatterns — behavior against the real corpus", () => {
  it("offers example patterns before a query is entered", () => {
    render(<SignPatterns />);
    expect(screen.getByRole("heading", { name: /sign patterns/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "KU-*-RO" })).toBeTruthy();
  });

  it("'KU-*-RO' returns only 3-sign words bracketed by KU…RO", () => {
    const { container } = render(<SignPatterns />);
    fireEvent.change(screen.getByPlaceholderText(/pattern, e\.g/i), {
      target: { value: "KU-*-RO" },
    });

    const words = matchedWords(container);
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) {
      const parts = w.split("-");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe("KU");
      expect(parts[2]).toBe("RO");
    }
  });

  it("'**-RE' returns only words ending in RE", () => {
    const { container } = render(<SignPatterns />);
    fireEvent.change(screen.getByPlaceholderText(/pattern, e\.g/i), {
      target: { value: "**-RE" },
    });
    const words = matchedWords(container);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.split("-").pop() === "RE")).toBe(true);
  });

  it("an example button seeds the pattern and produces matches", () => {
    const { container } = render(<SignPatterns />);
    fireEvent.click(screen.getByRole("button", { name: "JA-SA-**" }));
    const words = matchedWords(container);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.startsWith("JA-SA"))).toBe(true);
  });

  it("a pattern with no matches shows the empty-state message", () => {
    render(<SignPatterns />);
    fireEvent.change(screen.getByPlaceholderText(/pattern, e\.g/i), {
      target: { value: "QE-QE-QE-QE" },
    });
    expect(screen.getByText(/no multi-sign words match/i)).toBeTruthy();
  });
});
