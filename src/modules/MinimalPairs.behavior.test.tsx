// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MinimalPairs from "./MinimalPairs";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

const signFilter = () => screen.getByPlaceholderText(/filter by sign/i);

describe("MinimalPairs — subscripted signs are distinct (no plain-series fallback)", () => {
  it("types every PU₂ alternation as 'no AB values'", () => {
    const { container } = render(<MinimalPairs />);
    fireEvent.change(signFilter(), { target: { value: "PU₂" } });

    const rows = Array.from(container.querySelectorAll("tbody > tr"));
    expect(rows.length).toBeGreaterThan(0);

    // PA~PU₂ is the sharp case: assuming PU₂=pu typed it 'V-alternation'
    // (pa~pu, the flagship inflection signature). PU₂ has no attested AB
    // value, so the phonological relationship is unknowable.
    const paRow = rows.find((r) => {
      const bs = Array.from(r.querySelectorAll("td:first-child b")).map(
        (b) => b.textContent,
      );
      return bs[0] === "PA" && bs[1] === "PU₂";
    });
    expect(paRow).toBeTruthy();
    expect(paRow!.textContent).toContain("no AB values");
    expect(paRow!.textContent).not.toContain("V-alternation");

    // Every alternation involving PU₂ is opaque — no sign borrows PU's value.
    for (const r of rows) expect(r.textContent).toContain("no AB values");

    // With no vowel-typed alternations left there is nothing to plot: the
    // vowel-alternation grid does not render.
    expect(screen.queryByText(/vowel-alternation grid/i)).toBeNull();
  });

  it("plain-series alternations keep their phonological typing", () => {
    const { container } = render(<MinimalPairs />);
    fireEvent.change(signFilter(), { target: { value: "RO" } });
    const rows = Array.from(container.querySelectorAll("tbody > tr"));
    // KU-RO ~ KU-RE style alternations still type as V-alternation.
    const reRo = rows.find((r) => {
      const bs = Array.from(r.querySelectorAll("td:first-child b")).map(
        (b) => b.textContent,
      );
      return bs[0] === "RE" && bs[1] === "RO";
    });
    expect(reRo).toBeTruthy();
    expect(reRo!.textContent).toContain("V-alternation");
  });
});

describe("MinimalPairs — chance baseline", () => {
  it("is seeded: two runs over the same corpus give the identical envelope", () => {
    const first = render(<MinimalPairs />);
    fireEvent.click(first.getByText("Chance baseline?"));
    const box1 = first.getByText(/chance baseline \(/i).parentElement!;
    const text1 = box1.textContent!;
    // A real envelope rendered: "mean" value plus a "(min–max)" label.
    expect(text1).toMatch(/\d+/);
    expect(text1).toMatch(/\(\d+–\d+\)/);
    cleanup();

    const second = render(<MinimalPairs />);
    fireEvent.click(second.getByText("Chance baseline?"));
    const box2 = second.getByText(/chance baseline \(/i).parentElement!;
    expect(box2.textContent).toBe(text1);
  });
});
