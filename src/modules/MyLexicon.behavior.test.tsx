// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MyLexicon from "./MyLexicon";
import { useWorkbench } from "../store/workbench";
import { loadRealCorpus } from "../test/corpusFixture";
import type { Annotation } from "../lib/types";

beforeAll(() => loadRealCorpus());
afterEach(() => {
  cleanup();
  useWorkbench.setState({ annotations: [] });
});

function seed(annotations: Annotation[]) {
  useWorkbench.setState({ annotations });
}

const ann = (partial: Partial<Annotation>): Annotation => ({
  id: Math.random().toString(36).slice(2),
  target: { kind: "word", value: "KU-RO" },
  proposedMeaning: "total",
  confidence: "high",
  notes: "",
  evidenceIds: [],
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
  ...partial,
});

describe("MyLexicon — behavior against the real corpus", () => {
  it("explains itself when no annotations exist yet", () => {
    render(<MyLexicon />);
    expect(screen.getByRole("heading", { name: /my lexicon/i })).toBeTruthy();
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });

  it("joins each entry with its live corpus attestation", () => {
    seed([ann({})]);
    const { container } = render(<MyLexicon />);
    const row = container.querySelector("tbody tr")!;
    expect(row.textContent).toContain("KU-RO");
    expect(row.textContent).toContain("total");
    // KU-RO is one of the best-attested words in the corpus — the joined
    // count and site columns must be present and plural.
    const kuRo = useWorkbench.getState().corpus.wordIndex.get("KU-RO")!;
    expect(kuRo.count).toBeGreaterThan(10);
    expect(row.textContent).toContain(String(kuRo.count));
    expect(row.textContent).toContain(String(kuRo.sites.size));
  });

  it("the confidence filter narrows the table", () => {
    seed([
      ann({ proposedMeaning: "total", confidence: "high" }),
      ann({
        target: { kind: "word", value: "KI-RO" },
        proposedMeaning: "deficit",
        confidence: "medium",
      }),
    ]);
    const { container } = render(<MyLexicon />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);

    // second select is the confidence filter
    const confSelect = container.querySelectorAll("select")[1];
    fireEvent.change(confSelect, { target: { value: "high" } });

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("KU-RO");
  });

  it("the text filter matches entry, meaning, and notes", () => {
    seed([
      ann({ proposedMeaning: "total" }),
      ann({
        target: { kind: "word", value: "KI-RO" },
        proposedMeaning: "deficit",
        notes: "appears with shortfall entries",
      }),
    ]);
    const { container } = render(<MyLexicon />);
    fireEvent.change(
      screen.getByPlaceholderText(/filter by entry, meaning/i),
      { target: { value: "shortfall" } },
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("KI-RO");
  });
});
