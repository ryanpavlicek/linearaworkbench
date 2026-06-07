import { describe, it, expect } from "vitest";
import {
  buildCitations,
  DEFAULT_CITATION_OPTIONS,
  WORKBENCH_VERSION,
  CITATION_STYLE_LABEL,
  type CitationStyle,
} from "./citations";

const ALL_STYLES = Object.keys(CITATION_STYLE_LABEL) as CitationStyle[];

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

  it("emits every source in every style without throwing or leaving blanks", () => {
    for (const style of ALL_STYLES) {
      const out = buildCitations({
        ...DEFAULT_CITATION_OPTIONS,
        style,
        snapshotDate: "2026-06-07",
      });
      const entries = out.split("\n\n");
      expect(entries).toHaveLength(5);
      for (const entry of entries) expect(entry.trim().length).toBeGreaterThan(0);
      // Each style should still name the canonical sources.
      expect(out).toContain("Godart");
      expect(out).toContain("Younger");
      expect(out).toContain("SigLA");
    }
  });

  it("falls back to today's date when no snapshotDate is given", () => {
    const out = buildCitations({
      style: "chicago",
      includeGorila: false,
      includeMwenge: false,
      includeYounger: false,
      includeSigla: false,
      includeWorkbench: true,
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(out).toContain(today);
  });
});
