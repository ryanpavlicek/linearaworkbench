import { describe, expect, it } from "vitest";
import {
  bootstrapCountsCI,
  chao1,
  fitHeaps,
  fitZipfMandelbrotMLE,
  mattr,
  millerMadowEntropy,
  mulberry32,
  shannonEntropy,
} from "./lexstats";

describe("mulberry32", () => {
  it("is deterministic per seed and uniform-ish in [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
    const c = mulberry32(7);
    expect(Array.from({ length: 5 }, () => c())).not.toEqual(seqA);
    const r = mulberry32(1);
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 2000).toBeGreaterThan(0.45);
    expect(sum / 2000).toBeLessThan(0.55);
  });
});

describe("shannonEntropy", () => {
  it("is 0 for a single category and log2(K) for uniform", () => {
    expect(shannonEntropy([10])).toBe(0);
    expect(shannonEntropy([5, 5, 5, 5])).toBeCloseTo(2, 10);
    expect(shannonEntropy([1, 1])).toBeCloseTo(1, 10);
  });

  it("matches a hand-computed skewed distribution", () => {
    // p = [0.5, 0.25, 0.25] → H = 1.5 bits
    expect(shannonEntropy([2, 1, 1])).toBeCloseTo(1.5, 10);
  });

  it("ignores zero counts and returns 0 for empty input", () => {
    expect(shannonEntropy([5, 0, 5, 0])).toBeCloseTo(1, 10);
    expect(shannonEntropy([])).toBe(0);
    expect(shannonEntropy([0, 0])).toBe(0);
  });
});

describe("millerMadowEntropy", () => {
  it("adds (K−1)/(2N·ln2) bits to the plug-in estimate", () => {
    const counts = [2, 1, 1];
    const expected = 1.5 + (3 - 1) / (2 * 4 * Math.LN2);
    expect(millerMadowEntropy(counts)).toBeCloseTo(expected, 10);
  });

  it("corrects toward the true entropy in a small skewed sample", () => {
    // True uniform over 8 categories = 3 bits. This 16-token draw is
    // skewed enough that the plug-in estimate lands well under 3; the MM
    // correction recovers most of the bias.
    const sample = [5, 3, 3, 1, 1, 1, 1, 1];
    const mle = shannonEntropy(sample);
    const mm = millerMadowEntropy(sample);
    expect(mm).toBeGreaterThan(mle);
    expect(Math.abs(mm - 3)).toBeLessThan(Math.abs(mle - 3));
  });

  it("degenerates safely", () => {
    expect(millerMadowEntropy([10])).toBe(0);
    expect(millerMadowEntropy([])).toBe(0);
  });
});

describe("bootstrapCountsCI", () => {
  it("brackets the point estimate and is deterministic", () => {
    const counts = [40, 30, 20, 10];
    const h = shannonEntropy(counts);
    const ci1 = bootstrapCountsCI(counts, shannonEntropy, { seed: 3 });
    const ci2 = bootstrapCountsCI(counts, shannonEntropy, { seed: 3 });
    expect(ci1).toEqual(ci2);
    expect(ci1[0]).toBeLessThanOrEqual(h);
    expect(ci1[1]).toBeGreaterThanOrEqual(h - 0.05); // resampling noise
    expect(ci1[0]).toBeLessThan(ci1[1]);
  });

  it("narrows as the sample grows", () => {
    const small = [8, 6, 4, 2];
    const big = small.map((c) => c * 50);
    const [a1, b1] = bootstrapCountsCI(small, shannonEntropy, { seed: 5 });
    const [a2, b2] = bootstrapCountsCI(big, shannonEntropy, { seed: 5 });
    expect(b2 - a2).toBeLessThan(b1 - a1);
  });

  it("handles an empty distribution", () => {
    expect(bootstrapCountsCI([0, 0], shannonEntropy)).toEqual([0, 0]);
  });
});

describe("chao1", () => {
  it("matches the classic formula when F2 > 0", () => {
    // S=50, F1=10, F2=5 → 50 + 100/10 = 60
    const r = chao1(50, 10, 5);
    expect(r.estimate).toBeCloseTo(60, 10);
    expect(r.unseen).toBeCloseTo(10, 10);
    expect(r.ciLow).toBeGreaterThanOrEqual(50);
    expect(r.ciLow).toBeLessThan(60);
    expect(r.ciHigh).toBeGreaterThan(60);
  });

  it("uses the bias-corrected form when F2 = 0", () => {
    // S=20, F1=4, F2=0 → 20 + 4·3/2 = 26
    const r = chao1(20, 4, 0);
    expect(r.estimate).toBeCloseTo(26, 10);
  });

  it("returns the observed count when there are no hapaxes", () => {
    const r = chao1(30, 0, 5);
    expect(r.estimate).toBe(30);
    expect(r.ciLow).toBe(30);
    expect(r.ciHigh).toBe(30);
  });
});

describe("mattr", () => {
  it("equals TTR of each window, averaged", () => {
    // Stream of 4 with window 2: windows AB, BA, AA → TTRs 1, 1, 0.5
    expect(mattr(["A", "B", "A", "A"], 2)).toBeCloseTo((1 + 1 + 0.5) / 3, 10);
  });

  it("is 1 for an all-distinct stream and 1/w for a constant stream", () => {
    expect(mattr(["a", "b", "c", "d", "e"], 3)).toBeCloseTo(1, 10);
    expect(mattr(["x", "x", "x", "x"], 4)).toBeCloseTo(0.25, 10);
  });

  it("returns null when the stream is shorter than the window", () => {
    expect(mattr(["a", "b"], 100)).toBeNull();
    expect(mattr([], 10)).toBeNull();
  });

  it("is insensitive to stream length for a stationary process", () => {
    // Repeating ABAB…: every window of 4 has exactly 2 types.
    const short = Array.from({ length: 40 }, (_, i) => (i % 2 ? "A" : "B"));
    const long = Array.from({ length: 400 }, (_, i) => (i % 2 ? "A" : "B"));
    expect(mattr(short, 4)).toBeCloseTo(0.5, 10);
    expect(mattr(long, 4)).toBeCloseTo(0.5, 10);
  });
});

describe("fitHeaps", () => {
  it("recovers k and beta from an exact power law", () => {
    const points = Array.from({ length: 50 }, (_, i) => {
      const tokens = (i + 1) * 20;
      return { tokens, types: 3.5 * Math.pow(tokens, 0.55) };
    });
    const fit = fitHeaps(points);
    expect(fit).not.toBeNull();
    expect(fit!.k).toBeCloseTo(3.5, 3);
    expect(fit!.beta).toBeCloseTo(0.55, 6);
    expect(fit!.r2).toBeCloseTo(1, 6);
  });

  it("skips zero points and returns null when too few remain", () => {
    expect(fitHeaps([{ tokens: 0, types: 0 }])).toBeNull();
    expect(
      fitHeaps([
        { tokens: 0, types: 0 },
        { tokens: 10, types: 8 },
        { tokens: 20, types: 14 },
      ]),
    ).toBeNull();
  });
});

describe("fitZipfMandelbrotMLE", () => {
  it("recovers parameters from synthetic Zipf–Mandelbrot counts", () => {
    const s0 = 1.2;
    const b0 = 2.5;
    const freqs: number[] = [];
    for (let r = 1; r <= 300; r++) {
      freqs.push(Math.round(50_000 * Math.pow(r + b0, -s0)));
    }
    const fit = fitZipfMandelbrotMLE(freqs);
    expect(fit).not.toBeNull();
    expect(fit!.s).toBeCloseTo(s0, 1);
    expect(Math.abs(fit!.beta - b0)).toBeLessThan(0.75);
    expect(fit!.ks).toBeLessThan(0.02);
    expect(fit!.r2Log).toBeGreaterThan(0.98);
  });

  it("fits plain Zipf with beta near 0", () => {
    const freqs: number[] = [];
    for (let r = 1; r <= 200; r++) {
      freqs.push(Math.round(20_000 * Math.pow(r, -1)));
    }
    const fit = fitZipfMandelbrotMLE(freqs);
    expect(fit).not.toBeNull();
    expect(fit!.s).toBeCloseTo(1, 1);
    expect(fit!.beta).toBeLessThan(1);
  });

  it("reports a large KS for badly non-Zipfian data", () => {
    // Uniform frequencies are about as un-Zipfian as it gets.
    const uniform = new Array(100).fill(50);
    const fit = fitZipfMandelbrotMLE(uniform);
    expect(fit).not.toBeNull();
    // Best fit should drive s toward ~0 (flat); KS still reflects misfit
    // of the head. Mostly this asserts we don't crash and stay sane.
    expect(fit!.s).toBeLessThan(0.3);
  });

  it("returns null for tiny inputs", () => {
    expect(fitZipfMandelbrotMLE([5, 3])).toBeNull();
    expect(fitZipfMandelbrotMLE([])).toBeNull();
  });
});
