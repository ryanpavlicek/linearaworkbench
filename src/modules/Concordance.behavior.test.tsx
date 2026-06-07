// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Concordance from "./Concordance";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

const setTarget = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText(/target word/i), {
    target: { value },
  });

describe("Concordance (KWIC) — behavior against the real corpus", () => {
  it("renders keyword-in-context rows for an attested word", () => {
    const { container } = render(<Concordance />);
    expect(screen.getByRole("heading", { name: /concordance/i })).toBeTruthy();

    setTarget("KU-RO");
    // Every row's centre column is the (uppercased) keyword.
    const keywords = Array.from(
      container.querySelectorAll("tbody tr td:nth-child(2) b"),
    ).map((b) => b.textContent);
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.every((k) => k === "KU-RO")).toBe(true);
  });

  it("reports no attestations for an unattested form", () => {
    render(<Concordance />);
    setTarget("QE-QE-QE");
    expect(screen.getByText(/no attestations of/i)).toBeTruthy();
  });

  it("re-sorting by right context preserves the row count", () => {
    const { container } = render(<Concordance />);
    setTarget("KU-RO");
    const before = container.querySelectorAll("tbody tr").length;
    expect(before).toBeGreaterThan(0);
    const rightHeader = Array.from(
      container.querySelectorAll("thead th"),
    ).find((t) => /right context/i.test(t.textContent ?? ""))!;
    fireEvent.click(rightHeader);
    expect(container.querySelectorAll("tbody tr").length).toBe(before);
  });
});
