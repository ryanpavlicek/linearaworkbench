// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, fireEvent, cleanup, within } from "@testing-library/react";
import Commodities from "./Commodities";
import Timeline from "./Timeline";
import Constellation from "./Constellation";
import { loadRealCorpus } from "../test/corpusFixture";

// Regression guards for the post-wave chart-legibility fixes. These exist
// because DOM-probe spot checks missed: a CA biplot that rendered EMPTY in
// the scribal-hands / periods modes (a zero-margin column made the analysis
// degenerate), and a Timeline whose phase bands overlapped. Pixel-level
// legibility (label spacing, zoom) still needs a human eye — jsdom has no
// layout engine — but the functional defects below are now caught here.

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

// The CA card, located by its heading, regardless of what else is on the page.
function caCard(container: HTMLElement): HTMLElement {
  const h4 = Array.from(container.querySelectorAll("h4")).find((h) =>
    /correspondence analysis/i.test(h.textContent ?? ""),
  );
  if (!h4) throw new Error("CA card not found");
  return h4.closest(".card") as HTMLElement;
}

describe("Commodity Catalog — correspondence analysis", () => {
  // One mount, switch the select in place: rendering the full catalog twice
  // is needlessly heavy. Two regressions are guarded here:
  //   1. The scribal-hands mode used to render EMPTY (a zero-margin column
  //      made the analysis degenerate); it must now draw a real biplot.
  //   2. The label de-overlap pass infinite-looped on the real corpus —
  //      `p.y + 13` rounds, in floating point, to a value a hair under 13
  //      away, so a label re-collided with itself forever (the whole render
  //      hung). If that ever regresses this test never returns; it passing
  //      at all is the guard.
  it("draws a non-empty biplot for the well-populated dimensions", () => {
    const { container } = render(<Commodities />);
    const card = caCard(container);
    const select = card.querySelector("select") as HTMLSelectElement;
    // Sites (26) and scribal hands (50) both have ≥3 rows clearing the token
    // floor, so each yields a real plot.
    for (const mode of ["site", "scribe"] as const) {
      fireEvent.change(select, { target: { value: mode } });
      expect(
        card.textContent,
        `${mode} mode should not show the empty fallback`,
      ).not.toMatch(/not enough data/i);
      const svg = card.querySelector("svg");
      expect(svg, `${mode} mode should draw an SVG`).toBeTruthy();
      // Rows (blue) + commodity columns (amber) both plot as circles.
      expect(
        svg!.querySelectorAll("circle").length,
        `${mode} mode should plot points`,
      ).toBeGreaterThan(3);
      // The heaviest rows always draw a text label.
      expect(svg!.querySelectorAll("text").length).toBeGreaterThan(2);
    }
  });

  it("honestly reports insufficient data for the period dimension", () => {
    // The commodity record is overwhelmingly LM IB (≈96% of commodity
    // tokens); no other ceramic phase clears the floor, so fewer than the
    // three rows a correspondence analysis needs ever qualify. The honest
    // empty state — not a biplot fabricated from a single populated row — is
    // the correct output, and must stay that way.
    const { container } = render(<Commodities />);
    const card = caCard(container);
    const select = card.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "period" } });
    expect(card.textContent).toMatch(/not enough data/i);
    expect(card.querySelector("svg")).toBeNull();
  });
});

describe("Timeline — one lane per attested phase (no overlapping bands)", () => {
  it("renders a separate row for each dated phase", () => {
    const { container } = render(<Timeline />);
    // Each phase is its own clickable lane button labelled "<phase> (n)".
    const lanes = Array.from(container.querySelectorAll("button")).filter((b) =>
      /(MM|LM|LB|Geometric).*\(\d+\)/.test(b.textContent ?? ""),
    );
    // The corpus attests well over half a dozen phases; the key point is
    // each gets its own row rather than stacking on one band.
    expect(lanes.length).toBeGreaterThanOrEqual(8);
    // LM IB dominates the corpus and must be present.
    expect(
      lanes.some((l) => /LM IB \(\d{3,}\)/.test(l.textContent ?? "")),
    ).toBe(true);
  });

  it("opens a phase detail with a one-click Scope when a lane is clicked", () => {
    const { container } = render(<Timeline />);
    const lmib = Array.from(container.querySelectorAll("button")).find((b) =>
      /LM IB \(\d/.test(b.textContent ?? ""),
    ) as HTMLElement;
    fireEvent.click(lmib);
    expect(within(container).getByText(/use as scope/i)).toBeTruthy();
  });
});

describe("Constellation — starfield with interactive site legend", () => {
  it("plots the text-bearing corpus and toggles a site via its legend chip", () => {
    const { container } = render(<Constellation />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    const circles = svg!.querySelectorAll("circle");
    // Hundreds of substantial documents are plottable.
    expect(circles.length).toBeGreaterThan(50);

    // The legend chips are buttons that dim their site. Click the first and
    // confirm at least one star drops to the dimmed opacity (0.08).
    const legend = Array.from(container.querySelectorAll("button")).find((b) =>
      /haghia triada/i.test(b.textContent ?? ""),
    ) as HTMLElement;
    expect(legend).toBeTruthy();
    fireEvent.click(legend);
    const dimmed = Array.from(svg!.querySelectorAll("circle")).some(
      (c) => c.getAttribute("opacity") === "0.08",
    );
    expect(dimmed).toBe(true);
  });
});
