// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModuleErrorBoundary } from "./ModuleErrorBoundary";

afterEach(cleanup);

function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error("kaboom");
  return <div>module content</div>;
}

describe("ModuleErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ModuleErrorBoundary resetKey="a">
        <div>ok</div>
      </ModuleErrorBoundary>,
    );
    expect(screen.getByText("ok")).toBeTruthy();
  });

  it("contains a child crash and recovers via Try again", () => {
    // React logs caught boundary errors to console.error; keep the run quiet.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ModuleErrorBoundary resetKey="a">
        <Boom explode={true} />
      </ModuleErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("kaboom");
    // The underlying cause is gone (e.g. state changed); retry re-mounts.
    rerender(
      <ModuleErrorBoundary resetKey="a">
        <Boom explode={false} />
      </ModuleErrorBoundary>,
    );
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("module content")).toBeTruthy();
    spy.mockRestore();
  });

  it("resets automatically when resetKey (the active module) changes", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ModuleErrorBoundary resetKey="a">
        <Boom explode={true} />
      </ModuleErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    rerender(
      <ModuleErrorBoundary resetKey="b">
        <Boom explode={false} />
      </ModuleErrorBoundary>,
    );
    expect(screen.getByText("module content")).toBeTruthy();
    spy.mockRestore();
  });
});
