import { describe, it, expect } from "vitest";
import {
  buildCitations,
  DEFAULT_CITATION_OPTIONS,
  WORKBENCH_VERSION,
} from "./citations";

describe("buildCitations", () => {
  it("includes only the sources that are toggled on", () => {
    const out = buildCitations({
      style: "apa",
      includeGorila: true,
      includeMwenge: false,
      includeYounger: false,
      includeSigla: false,
      includeWorkbench: false,
    });
    expect(out).toContain("Godart");
    expect(out).not.toContain("lineara.xyz");
    expect(out).not.toContain("Younger");
  });

  it("separates multiple entries with a blank line", () => {
    const out = buildCitations({
      style: "apa",
      includeGorila: true,
      includeMwenge: true,
      includeYounger: false,
      includeSigla: false,
      includeWorkbench: false,
    });
    expect(out.split("\n\n")).toHaveLength(2);
  });

  it("pins the workbench version and the supplied snapshot date", () => {
    const out = buildCitations({
      style: "apa",
      snapshotDate: "2026-06-07",
      includeGorila: false,
      includeMwenge: false,
      includeYounger: false,
      includeSigla: false,
      includeWorkbench: true,
    });
    expect(out).toContain(`Version ${WORKBENCH_VERSION}`);
    expect(out).toContain("Pavlicek, R.");
  });

  it("emits a BibTeX entry with an @software key for the workbench", () => {
    const out = buildCitations({
      style: "bibtex",
      snapshotDate: "2026-06-07",
      includeGorila: false,
      includeMwenge: false,
      includeYounger: false,
      includeSigla: false,
      includeWorkbench: true,
    });
    expect(out).toContain("@software{linear_a_research_workbench,");
    expect(out).toContain("Accessed: 2026-06-07");
  });

  it("defaults cover all five sources", () => {
    const out = buildCitations({
      ...DEFAULT_CITATION_OPTIONS,
      snapshotDate: "2026-06-07",
    });
    expect(out.split("\n\n")).toHaveLength(5);
  });
});
