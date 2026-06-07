// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { Component, Suspense, type ReactNode } from "react";
import { render, cleanup, waitFor } from "@testing-library/react";
import { MODULE_COMPONENTS } from "./registry";
import type { ModuleId } from "../lib/types";
import { loadRealCorpus } from "../test/corpusFixture";
import { useWorkbench } from "../store/workbench";

// Silence the expected React error-boundary console noise so a real failure
// stays legible in the output.
vi.spyOn(console, "error").mockImplementation(() => {});

class Boundary extends Component<{ children: ReactNode; onError: (e: Error) => void }> {
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.props.children;
  }
}

beforeAll(() => {
  loadRealCorpus();
  expect(useWorkbench.getState().loaded).toBe(true);
});

afterEach(cleanup);

// Every distinct module id in the registry. Several ids share a tabbed wrapper
// (Geography, Scribes, ResearchHub, …); rendering each id still exercises the
// wrapper's id-driven tab selection, so we keep them all.
const MODULE_IDS = Object.keys(MODULE_COMPONENTS) as ModuleId[];

describe("module smoke renders", () => {
  it.each(MODULE_IDS)("mounts <%s> against the real corpus without crashing", async (id) => {
    let caught: Error | null = null;
    const Mod = MODULE_COMPONENTS[id];
    const { container } = render(
      <Boundary onError={(e) => (caught = e)}>
        <Suspense fallback={<div data-testid="loading" />}>
          <Mod />
        </Suspense>
      </Boundary>,
    );

    // Wait for the lazy chunk to resolve (Suspense fallback removed) and for the
    // module to commit some DOM. If it threw on mount, the boundary captured it.
    await waitFor(() => {
      if (caught) throw caught;
      expect(container.querySelector('[data-testid="loading"]')).toBeNull();
      expect(container.textContent ?? "").not.toBe("");
    });

    expect(caught).toBeNull();
  });
});
