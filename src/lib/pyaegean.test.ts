import { describe, expect, it } from "vitest";
import { inscriptionSnippet, querySnippet } from "./pyaegean";
import type { FilterRow } from "./queryEngine";

describe("inscriptionSnippet", () => {
  it("loads the corpus and fetches the inscription by id", () => {
    const py = inscriptionSnippet("HT13");
    expect(py).toContain('aegean.load("lineara")');
    expect(py).toContain('corpus.get("HT13")');
  });
});

describe("querySnippet", () => {
  it("maps rows to FilterRow calls with identical field ids", () => {
    const filters: FilterRow[] = [
      { rid: "1", field: "site-is", value: "Haghia Triada" },
      {
        rid: "2",
        field: "word-sign-pattern",
        value: "KU-*-RO",
        connector: "and",
      },
    ];
    const py = querySnippet(filters, "inscriptions");
    expect(py).toContain("from aegean.analysis import FilterRow");
    expect(py).toContain('FilterRow("site-is", "Haghia Triada"),');
    // "and" is the default connector on both sides — not emitted.
    expect(py).toContain('FilterRow("word-sign-pattern", "KU-*-RO"),');
    expect(py).toContain('output="inscriptions"');
    expect(py).toContain("results.inscriptions");
  });

  it("renders or/negate/number/boolean values in Python form", () => {
    const filters: FilterRow[] = [
      { rid: "1", field: "has-image", value: true },
      {
        rid: "2",
        field: "word-min-syllables",
        value: 3,
        connector: "or",
        negate: true,
      },
    ];
    const py = querySnippet(filters, "words");
    expect(py).toContain('FilterRow("has-image", True),');
    expect(py).toContain(
      'FilterRow("word-min-syllables", 3, connector="or", negate=True),',
    );
    expect(py).toContain("for word, count in results.words:");
  });

  it("drops workbench-local has-annotation rows with a note", () => {
    const filters: FilterRow[] = [
      { rid: "1", field: "has-annotation", value: true },
      { rid: "2", field: "site-is", value: "Zakros", connector: "and" },
    ];
    const py = querySnippet(filters, "inscriptions");
    expect(py).not.toContain('FilterRow("has-annotation"');
    expect(py).toContain("workbench-local annotations");
    expect(py).toContain('FilterRow("site-is", "Zakros"');
  });
});
