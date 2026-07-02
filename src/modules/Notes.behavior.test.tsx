// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Notes from "./Notes";
import { loadRealCorpus } from "../test/corpusFixture";
import { useWorkbench } from "../store/workbench";
import type { ResearchNote } from "../lib/types";

// Stored-XSS regression for the live note preview. Note bodies restore
// verbatim from imported backup files, and the preview renders through
// dangerouslySetInnerHTML — a wb: link label carrying an HTML payload used to
// reach the chip <button> unescaped. The fix is two layers (escape at the
// renderNoteHtml boundary + the DOMPurify pass every injection site gets);
// this exercises both through the real component.

beforeAll(() => loadRealCorpus());
afterEach(() => {
  cleanup();
  useWorkbench.setState({ notes: [] });
});

const note = (body: string): ResearchNote => ({
  id: "n-payload",
  title: "Imported note",
  body,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("Notes preview — wb: chip label injection", () => {
  it("renders the payload as escaped text, never as a live <img onerror>", () => {
    useWorkbench.setState({
      notes: [note("See [<img src=x onerror=alert(1)>](wb:ins/HT13) for totals.")],
    });

    const { container } = render(<Notes />);

    // The chip renders, carrying the payload as literal text…
    const chip = container.querySelector("button.note-chip");
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(chip!.getAttribute("data-ref-value")).toBe("HT13");
    // …and nothing executable made it into the preview DOM.
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("keeps legitimate previews intact through the sanitize pass", () => {
    useWorkbench.setState({
      notes: [
        note(
          "# Totals\n\nThe **grand total** [KU-RO](wb:word/KU-RO) *recurs* on [HT13](wb:ins/HT13).",
        ),
      ],
    });

    const { container } = render(<Notes />);

    expect(container.querySelector("h1")?.textContent).toBe("Totals");
    const chips = container.querySelectorAll("button.note-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toBe("KU-RO");
    expect(chips[0].getAttribute("data-ref-kind")).toBe("word");
    expect(container.querySelector("strong")).not.toBeNull();
    expect(container.querySelector("em")).not.toBeNull();
  });
});
