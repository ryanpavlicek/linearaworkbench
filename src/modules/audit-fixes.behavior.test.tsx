// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, fireEvent, cleanup, within } from "@testing-library/react";
import CompareInscriptions from "./CompareInscriptions";
import WordlistManager from "./WordlistManager";
import { loadRealCorpus, realCorpus } from "../test/corpusFixture";
import { useWorkbench } from "../store/workbench";
import type { ComparisonEntry } from "../lib/types";

// Regressions for two defects the module audit confirmed. Both hide on
// interaction/deep-link paths a mount-only smoke test never reaches.
beforeAll(() => loadRealCorpus());
afterEach(() => {
  cleanup();
  useWorkbench.setState({ moduleIntent: null });
  try {
    useWorkbench.getState().removeCustomLanguage("ZZMalformedTest");
  } catch {
    /* not added in this test */
  }
});

describe("Compare Inscriptions — single-id deep-link (Tablet Structure / Query Builder pivot)", () => {
  it("renders the one inscription's text instead of an empty table", () => {
    // The state a per-row "Compare" pivot lands in: exactly one id focused.
    const ins = realCorpus().inscriptions.find(
      (i) => i.id && i.words.some((w) => w.includes("-")),
    )!;
    useWorkbench.setState({ moduleIntent: { focus: ins.id } });

    const { container } = render(<CompareInscriptions />);

    // Pre-fix this showed the interlinear table whose body maps an empty
    // alignment (alignment needs >=2), i.e. a header and zero rows. The fix
    // forces the per-inscription Columns layout, whose "Transliteration"
    // label and the one-selection hint both prove the text now renders.
    expect(container.textContent).toMatch(/transliteration/i);
    expect(container.textContent).toMatch(/showing one inscription/i);
  });
});

describe("Wordlist Manager — custom list with missing m/d fields", () => {
  it("browses and filters without crashing the module", () => {
    // The shape a hand-built JSON upload could produce (the CSV path always
    // defaulted m/d; the JSON path did not). Stored straight into the store,
    // it used to throw e.m.toLowerCase() the moment the filter was non-empty.
    useWorkbench
      .getState()
      .addCustomLanguage("ZZMalformedTest", [
        { w: "abc" },
        { w: "xyz" },
      ] as unknown as ComparisonEntry[]);

    const { container } = render(<WordlistManager />);
    fireEvent.click(
      within(container).getByTitle(/browse the .* of ZZMalformedTest/i),
    );
    // The crash site: typing makes visibleEntries run the (now null-safe)
    // filter over entries whose m/d are undefined.
    fireEvent.change(
      within(container).getByPlaceholderText(/filter entries/i),
      { target: { value: "a" } },
    );
    // Survived the render and the matching entry is shown.
    expect(container.textContent).toMatch(/abc/);
  });
});
