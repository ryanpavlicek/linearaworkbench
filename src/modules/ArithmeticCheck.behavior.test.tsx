// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ArithmeticCheck from "./ArithmeticCheck";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

function statValue(label: string): number {
  const box = Array.from(document.querySelectorAll(".stat-box")).find(
    (b) => b.querySelector(".lbl")?.textContent?.trim() === label,
  )!;
  return Number(box.querySelector(".val")!.textContent);
}

describe("ArithmeticCheck — behavior against the real corpus", () => {
  it("finds accounting tablets and reports a balance breakdown", () => {
    render(<ArithmeticCheck />);
    expect(
      screen.getByRole("heading", { name: /accounting & metrology/i }),
    ).toBeTruthy();

    const tablets = statValue("Accounting tablets");
    const balanced = statValue("Totals that balance");
    const discrepant = statValue("Totals that don't");

    // The real corpus has KU-RO accounting tablets, some of which balance.
    expect(tablets).toBeGreaterThan(0);
    expect(balanced).toBeGreaterThan(0);
    expect(balanced + discrepant).toBeGreaterThan(0);

    // Every result row is labelled either "balances" or "discrepant".
    const scores = Array.from(
      document.querySelectorAll("tbody .score"),
    ).map((s) => s.textContent);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores.every((s) => s === "balances" || s === "discrepant")).toBe(true);
  });

  it("'Discrepant only' / 'Balanced only' filters narrow the table consistently", () => {
    const { container } = render(<ArithmeticCheck />);

    fireEvent.click(screen.getByRole("button", { name: /discrepant only/i }));
    const afterDiscrepant = Array.from(
      container.querySelectorAll("tbody .score"),
    ).map((s) => s.textContent);
    expect(afterDiscrepant.length).toBeGreaterThan(0);
    expect(afterDiscrepant.every((s) => s === "discrepant")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /balanced only/i }));
    const afterBalanced = Array.from(
      container.querySelectorAll("tbody .score"),
    ).map((s) => s.textContent);
    expect(afterBalanced.length).toBeGreaterThan(0);
    expect(afterBalanced.every((s) => s === "balances")).toBe(true);
  });

  it("expanding a tablet row reveals the itemized reconciliation", () => {
    const { container } = render(<ArithmeticCheck />);
    const firstRow = container.querySelector("tbody tr") as HTMLElement;
    fireEvent.click(firstRow);
    // The expanded detail states the computed-vs-stated comparison.
    expect(container.textContent).toContain("vs stated");
  });
});
