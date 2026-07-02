// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RootCognates from "./RootCognates";
import { loadRealCorpus } from "../test/corpusFixture";
import { useWorkbench } from "../store/workbench";

beforeAll(() => loadRealCorpus());
afterEach(() => {
  cleanup();
  useWorkbench.getState().resetHypothesis();
});

describe("RootCognates — melodies use the same sign key as roots", () => {
  it("subscripted signs contribute '?' to the melody instead of the plain-series vowel", () => {
    const { container } = render(<RootCognates />);
    fireEvent.change(screen.getByPlaceholderText(/filter roots/i), {
      target: { value: "ra₂" },
    });

    // The corpus's one RA₂-bearing family: /sr₂/ = SA-RA₂, A-SA-RA₂. The
    // root already treats RA₂ as its own sign (hence the ₂ in the skeleton);
    // the melody now agrees — the old lookup read RA₂ as "a" via RA.
    expect(container.textContent).toContain("/sr₂/");
    expect(container.textContent).toContain("(a-?)"); // SA-RA₂
    expect(container.textContent).toContain("(a-a-?)"); // A-SA-RA₂
    expect(container.textContent).not.toContain("(a-a)");
  });

  it("melodies follow the active hypothesis overrides, like the roots do", () => {
    useWorkbench.getState().setOverride("SA", "so");
    const { container } = render(<RootCognates />);
    fireEvent.change(screen.getByPlaceholderText(/filter roots/i), {
      target: { value: "ra₂" },
    });

    // SA now reads "so": the family's skeleton is unchanged (s + r₂) and
    // SA-RA₂'s melody tracks the override.
    expect(container.textContent).toContain("/sr₂/");
    expect(container.textContent).toContain("(o-?)");
  });
});
