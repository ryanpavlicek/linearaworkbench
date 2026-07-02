// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import PositionalGrammar from "./PositionalGrammar";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

// Filter down to a single word and return its row's cell texts.
function rowFor(container: HTMLElement, word: string): string[] {
  fireEvent.change(screen.getByPlaceholderText(/filter words/i), {
    target: { value: word },
  });
  const rows = Array.from(container.querySelectorAll("tbody tr"));
  expect(rows).toHaveLength(1);
  return Array.from(rows[0].querySelectorAll("td")).map(
    (td) => td.textContent?.trim() ?? "",
  );
}

describe("PositionalGrammar — single-word inscriptions against the real corpus", () => {
  // Cells: word, count, initial, medial, final, alone, bias, bar, kwic.
  it("*411-VS (attested only alone) no longer fills the initial and final slots", () => {
    const { container } = render(<PositionalGrammar />);
    const cells = rowFor(container, "*411-VS");
    expect(cells[1]).toBe("15"); // count
    // All 15 attestations are one-word nodules: before the fix they counted
    // 15 initial AND 15 final; now both slots are empty and Alone holds 15.
    expect(cells[2]).toBe("0"); // initial
    expect(cells[3]).toBe("0"); // medial
    expect(cells[4]).toBe("0"); // final
    expect(cells[5]).toBe("15"); // alone
    expect(cells[6]).toBe("—"); // no positional evidence, no G²
  });

  it("KU-RO keeps its real slot counts, minus the 3 alone attestations", () => {
    const { container } = render(<PositionalGrammar />);
    const cells = rowFor(container, "KU-RO");
    expect(cells[1]).toBe("37"); // count
    expect(cells[2]).toBe("4"); // initial (was 7 with alone double-counted)
    expect(cells[3]).toBe("10"); // medial
    expect(cells[4]).toBe("20"); // final (was 23)
    expect(cells[5]).toBe("3"); // alone
  });

  it("the bias filter never surfaces a word with no positional data", () => {
    const { container } = render(<PositionalGrammar />);
    fireEvent.change(screen.getByPlaceholderText(/filter words/i), {
      target: { value: "*411-VS" },
    });
    fireEvent.change(container.querySelector("select")!, {
      target: { value: "first" },
    });
    expect(container.querySelector("tbody")!.textContent).toContain(
      "No words match these filters.",
    );
  });
});
