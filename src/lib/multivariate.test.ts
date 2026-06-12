import { describe, expect, it } from "vitest";
import {
  correspondenceAnalysis,
  labelPropagation,
  upgmaWithBootstrap,
} from "./multivariate";

describe("correspondenceAnalysis", () => {
  it("separates a block-structured table on axis 1", () => {
    // Rows 0–1 use cols A/B, rows 2–3 use cols C/D — two clean blocks.
    const res = correspondenceAnalysis(
      ["r0", "r1", "r2", "r3"],
      ["A", "B", "C", "D"],
      [
        [30, 25, 1, 2],
        [28, 31, 2, 1],
        [1, 2, 33, 27],
        [2, 1, 26, 30],
      ],
    )!;
    expect(res).not.toBeNull();
    // Axis 1 dominates and splits the row blocks by sign.
    expect(res.inertia[0]).toBeGreaterThan(0.8);
    const [r0, r1, r2, r3] = res.rows;
    expect(Math.sign(r0.x)).toBe(Math.sign(r1.x));
    expect(Math.sign(r2.x)).toBe(Math.sign(r3.x));
    expect(Math.sign(r0.x)).not.toBe(Math.sign(r2.x));
    // Columns side with the rows that use them.
    const colA = res.cols.find((c) => c.label === "A")!;
    const colC = res.cols.find((c) => c.label === "C")!;
    expect(Math.sign(colA.x)).toBe(Math.sign(r0.x));
    expect(Math.sign(colC.x)).toBe(Math.sign(r2.x));
  });

  it("returns null for an independent table and degenerate inputs", () => {
    // Outer-product table → residuals ≈ 0 → no structure to plot.
    const r = [10, 20, 30];
    const c = [1, 2, 3];
    const table = r.map((ri) => c.map((cj) => ri * cj));
    expect(correspondenceAnalysis(["a", "b", "c"], ["x", "y", "z"], table)).toBeNull();
    expect(
      correspondenceAnalysis(["a", "b"], ["x", "y", "z"], [
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toBeNull();
  });

  it("is deterministic", () => {
    const table = [
      [5, 1, 0, 2],
      [4, 2, 1, 1],
      [0, 6, 5, 0],
      [1, 4, 6, 1],
      [2, 0, 1, 7],
    ];
    const labels = ["p", "q", "r", "s", "t"];
    const cols = ["w", "x", "y", "z"];
    const a = correspondenceAnalysis(labels, cols, table)!;
    const b = correspondenceAnalysis(labels, cols, table)!;
    expect(a).toEqual(b);
  });
});

describe("upgmaWithBootstrap", () => {
  const counts = (o: Record<string, number>) => new Map(Object.entries(o));
  const items = [
    { label: "siteA1", counts: counts({ ku: 30, ro: 28, pa: 2 }) },
    { label: "siteA2", counts: counts({ ku: 25, ro: 30, pa: 1 }) },
    { label: "siteB1", counts: counts({ za: 22, te: 18, ku: 1 }) },
    { label: "siteB2", counts: counts({ za: 19, te: 24, ro: 2 }) },
  ];

  it("pairs the obviously similar items with high support", () => {
    const res = upgmaWithBootstrap(items, { iters: 60, seed: 9 })!;
    expect(res).not.toBeNull();
    const pairKeys = res.merges.map((m) => m.members.join("+"));
    expect(pairKeys).toContain("siteA1+siteA2");
    expect(pairKeys).toContain("siteB1+siteB2");
    const a = res.merges.find((m) => m.members.join("+") === "siteA1+siteA2")!;
    expect(a.support).toBeGreaterThan(0.8);
    // root contains everyone and is trivially supported
    const root = res.merges[res.merges.length - 1];
    expect(root.members.length).toBe(4);
    expect(root.support).toBe(1);
  });

  it("is deterministic per seed and null below 3 items", () => {
    const a = upgmaWithBootstrap(items, { iters: 30, seed: 5 });
    const b = upgmaWithBootstrap(items, { iters: 30, seed: 5 });
    expect(a).toEqual(b);
    expect(upgmaWithBootstrap(items.slice(0, 2))).toBeNull();
  });
});

describe("labelPropagation", () => {
  it("finds two cliques joined by one weak bridge", () => {
    const nodes = ["a1", "a2", "a3", "b1", "b2", "b3"];
    const edges = [
      { a: "a1", b: "a2", w: 5 },
      { a: "a1", b: "a3", w: 5 },
      { a: "a2", b: "a3", w: 5 },
      { a: "b1", b: "b2", w: 5 },
      { a: "b1", b: "b3", w: 5 },
      { a: "b2", b: "b3", w: 5 },
      { a: "a3", b: "b1", w: 1 }, // bridge
    ];
    const com = labelPropagation(nodes, edges, { seed: 3 });
    expect(com.get("a1")).toBe(com.get("a2"));
    expect(com.get("a1")).toBe(com.get("a3"));
    expect(com.get("b1")).toBe(com.get("b2"));
    expect(com.get("b1")).toBe(com.get("b3"));
    expect(com.get("a1")).not.toBe(com.get("b1"));
  });

  it("leaves isolated nodes in their own community and is deterministic", () => {
    const nodes = ["x", "y", "lone"];
    const edges = [{ a: "x", b: "y", w: 2 }];
    const a = labelPropagation(nodes, edges, { seed: 11 });
    const b = labelPropagation(nodes, edges, { seed: 11 });
    expect(a).toEqual(b);
    expect(a.get("x")).toBe(a.get("y"));
    expect(a.get("lone")).not.toBe(a.get("x"));
  });
});
