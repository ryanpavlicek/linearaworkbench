// @vitest-environment jsdom
import "./jsdomPolyfills";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, within, fireEvent } from "@testing-library/react";
import { App } from "../App";
import { useWorkbench } from "../store/workbench";
import { realCorpus } from "./corpusFixture";

// Drive the real <App/> the way a user would: it boots by fetching the corpus
// JSON from /corpus/, so we serve the genuine bundled files through a stubbed
// fetch. No browser needed — this runs in the same jsdom harness as the unit
// tests, yet exercises the full wiring (boot → search → open a tablet).
beforeEach(() => {
  localStorage.clear();
  // Reset to an unloaded store so App's boot effect fires.
  useWorkbench.setState({
    loaded: false,
    loadError: null,
    detail: null,
    activeModule: "search",
  });
  const { inscriptions, signs } = realCorpus();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.includes("signs") ? signs : inscriptions;
      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App integration — boot, search, open a tablet", () => {
  it("loads the corpus and renders the app chrome", async () => {
    render(<App />);
    // The loading state gives way to the default Corpus Search module.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /corpus search/i }),
      ).toBeTruthy(),
    );
    expect(useWorkbench.getState().loaded).toBe(true);
    expect(useWorkbench.getState().corpus.inscriptions.length).toBeGreaterThan(
      1000,
    );
  });

  it("filters results as the user types, then opens a tablet detail modal", async () => {
    const { container } = render(<App />);
    await screen.findByRole("heading", { name: /corpus search/i });

    const input = screen.getByPlaceholderText(
      /search words or inscription ids/i,
    ) as HTMLInputElement;

    // Type a securely-attested term. React's onChange needs the native value
    // setter + an input event to register in a controlled component.
    setControlledValue(input, "KU-RO");

    // Results recompute synchronously off the store; a results table appears.
    await waitFor(() => {
      const table = container.querySelector("table");
      expect(table).toBeTruthy();
      expect(within(table as HTMLElement).getAllByRole("row").length).toBeGreaterThan(1);
    });

    // Click the first inscription link in the results to open its detail.
    const firstLink = container.querySelector(".word-link") as HTMLElement;
    expect(firstLink).toBeTruthy();
    firstLink.click();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
    expect(useWorkbench.getState().detail?.kind).toBe("inscription");
  });

  it("navigates to another module via the Ctrl+K command palette", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: /corpus search/i });
    screen
      .queryByRole("button", { name: /got it — let me explore/i })
      ?.click();

    // Open the command palette and jump to the Accounting module by name.
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const palette = screen.getByPlaceholderText(/jump to a module/i);
    fireEvent.change(palette, { target: { value: "Accounting" } });
    fireEvent.keyDown(palette, { key: "Enter" });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /accounting & metrology/i }),
      ).toBeTruthy(),
    );
    expect(useWorkbench.getState().activeModule).toBe("arith");
  });
});

// Set a React-controlled input's value and fire the input event so the
// component's onChange runs (jsdom + React controlled-input dance).
function setControlledValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
