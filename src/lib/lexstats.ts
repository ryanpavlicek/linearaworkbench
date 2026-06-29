// Estimators for vocabulary richness, lexical diversity, and the
// information structure of the sign system. Everything here is exact-math
// over count vectors — no corpus types — so the Lexical Statistics module,
// the Sign Transitions entropy panel, and the tests share one
// implementation. References live in docs/METHODOLOGY.md alongside the
// caveats that matter for a 7k-token corpus.

// ─── Seeded PRNG ─────────────────────────────────────────────────────────
// mulberry32 — a tiny, fast, decent-quality 32-bit PRNG. Everything random
// in the workbench (bootstrap resamples, permutation envelopes) runs from
// an explicit seed so a number a researcher cites is reproducible on
// reload.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Entropy ─────────────────────────────────────────────────────────────
// Shannon entropy in bits of a count vector (maximum-likelihood plug-in
// estimate). Zero counts contribute nothing.
export function shannonEntropy(counts: readonly number[]): number {
  let n = 0;
  for (const c of counts) if (c > 0) n += c;
  if (n <= 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

// Miller–Madow bias-corrected entropy: the plug-in estimator
// systematically UNDERestimates entropy in small samples (unseen
// categories contribute nothing). The first-order correction adds
// (K−1)/(2N·ln 2) bits, K = observed categories, N = sample size.
// Still an underestimate when many categories are unseen — which is the
// honest situation for sign bigrams in a 7k-token corpus; say so in the UI.
export function millerMadowEntropy(counts: readonly number[]): number {
  let n = 0;
  let k = 0;
  for (const c of counts) {
    if (c > 0) {
      n += c;
      k++;
    }
  }
  if (n <= 0 || k <= 1) return shannonEntropy(counts);
  return shannonEntropy(counts) + (k - 1) / (2 * n * Math.LN2);
}

// Bootstrap percentile CI for any statistic of a count vector. Resamples N
// tokens from the empirical distribution (multinomial with p̂ᵢ = cᵢ/N) and
// hands the resampled count vector — same length, same category order — to
// `stat`. Returns the [α/2, 1−α/2] percentile interval. Deterministic via
// the seed. The resample treats tokens as independent draws, which corpus
// tokens are not (words repeat whole); the interval is therefore a lower
// bound on the real uncertainty.
export function bootstrapCountsCI(
  counts: readonly number[],
  stat: (resampled: number[]) => number,
  opts: { iters?: number; seed?: number; alpha?: number } = {},
): [number, number] {
  const iters = opts.iters ?? 200;
  const alpha = opts.alpha ?? 0.05;
  const rand = mulberry32(opts.seed ?? 1);
  let n = 0;
  const cum: number[] = new Array(counts.length);
  for (let i = 0; i < counts.length; i++) {
    n += Math.max(0, counts[i]);
    cum[i] = n;
  }
  if (n === 0) return [0, 0];
  const stats: number[] = new Array(iters);
  const resampled = new Array<number>(counts.length);
  for (let it = 0; it < iters; it++) {
    resampled.fill(0);
    for (let d = 0; d < n; d++) {
      const u = rand() * n;
      // binary search for the first cum[i] > u
      let lo = 0;
      let hi = counts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] > u) hi = mid;
        else lo = mid + 1;
      }
      resampled[lo]++;
    }
    stats[it] = stat(resampled);
  }
  stats.sort((a, b) => a - b);
  const at = (q: number) =>
    stats[Math.min(iters - 1, Math.max(0, Math.round(q * (iters - 1))))];
  return [at(alpha / 2), at(1 - alpha / 2)];
}

// ─── Richness ────────────────────────────────────────────────────────────
// Chao1 lower-bound estimate of total vocabulary size from the observed
// types and the hapax/dis counts:
//
//   Ŝ = S_obs + F₁²/(2F₂)            (F₂ > 0)
//   Ŝ = S_obs + F₁(F₁−1)/2           (F₂ = 0, bias-corrected form)
//
// with Chao's (1987) variance and the standard log-normal 95% CI on the
// unseen-type count. It is a LOWER bound: it only sees the rare-type tail,
// and a corpus this small with ~60% hapax has a large unseen mass.
export interface Chao1Result {
  estimate: number;
  ciLow: number;
  ciHigh: number;
  unseen: number; // estimate − sObs
}

export function chao1(sObs: number, f1: number, f2: number): Chao1Result {
  if (sObs <= 0 || f1 <= 0) {
    return { estimate: sObs, ciLow: sObs, ciHigh: sObs, unseen: 0 };
  }
  let estimate: number;
  let variance: number;
  if (f2 > 0) {
    const r = f1 / f2;
    estimate = sObs + (f1 * f1) / (2 * f2);
    variance = f2 * (0.5 * r * r + r * r * r + 0.25 * r * r * r * r);
  } else {
    estimate = sObs + (f1 * (f1 - 1)) / 2;
    variance =
      (f1 * (f1 - 1)) / 2 +
      (f1 * (2 * f1 - 1) * (2 * f1 - 1)) / 4 -
      (f1 * f1 * f1 * f1) / (4 * estimate);
  }
  const t = estimate - sObs;
  if (t <= 0 || variance <= 0) {
    return { estimate, ciLow: estimate, ciHigh: estimate, unseen: t };
  }
  const k = Math.exp(1.96 * Math.sqrt(Math.log(1 + variance / (t * t))));
  return {
    estimate,
    ciLow: sObs + t / k,
    ciHigh: sObs + t * k,
    unseen: t,
  };
}

// ─── Diversity ───────────────────────────────────────────────────────────
// MATTR — moving-average type-token ratio (Covington & McFall 2010): the
// mean TTR over every sliding window of `window` tokens. Unlike raw TTR it
// does not shrink mechanically as the corpus grows, so two differently
// sized slices are comparable. Returns null when the stream is shorter
// than one window.
export function mattr(
  tokens: readonly string[],
  window = 100,
): number | null {
  const n = tokens.length;
  if (n < window || window <= 0) return null;
  const inWindow = new Map<string, number>();
  let types = 0;
  for (let i = 0; i < window; i++) {
    const c = (inWindow.get(tokens[i]) ?? 0) + 1;
    inWindow.set(tokens[i], c);
    if (c === 1) types++;
  }
  let sum = types / window;
  let windows = 1;
  for (let i = window; i < n; i++) {
    const out = tokens[i - window];
    const oc = (inWindow.get(out) ?? 1) - 1;
    if (oc === 0) {
      inWindow.delete(out);
      types--;
    } else inWindow.set(out, oc);
    const inc = (inWindow.get(tokens[i]) ?? 0) + 1;
    inWindow.set(tokens[i], inc);
    if (inc === 1) types++;
    sum += types / window;
    windows++;
  }
  return sum / windows;
}

// ─── Heaps' law ──────────────────────────────────────────────────────────
// V(N) = k·N^β fitted by least squares in log–log space over a vocabulary
// growth curve. β < 1 means the vocabulary grows sublinearly (normal for
// language; β typically 0.4–0.6 in large corpora). R² is in log space.
export interface HeapsFit {
  k: number;
  beta: number;
  r2: number;
}

export function fitHeaps(
  points: readonly { tokens: number; types: number }[],
): HeapsFit | null {
  const pts = points.filter((p) => p.tokens >= 1 && p.types >= 1);
  if (pts.length < 5) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  const n = pts.length;
  for (const p of pts) {
    const x = Math.log(p.tokens);
    const y = Math.log(p.types);
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
  }
  // denom = n·Σx² − (Σx)² is exactly 0 only when every x is identical (no
  // spread in log-tokens to regress against). Constant-x input does not hit
  // exactly 0, though: catastrophic cancellation leaves a tiny float residue
  // (e.g. −1.1e-13) of the opposite sign, so an `=== 0` guard misses it and
  // the fit is fabricated (a spurious β, and an r² like −3.6e-15). Treat the
  // denominator as degenerate when it is negligible relative to the scale of
  // its terms (a true value is positive and O(n·Σx²)), with an absolute floor
  // for the all-zero edge. Same reasoning for ssTot below.
  const denom = n * sxx - sx * sx;
  const eps = 1e-9;
  if (denom <= eps * Math.max(n * sxx, 1)) return null;
  const beta = (n * sxy - sx * sy) / denom;
  const logK = (sy - beta * sx) / n;
  const ssTot = syy - (sy * sy) / n;
  const ssRes = ssTot - (beta * (n * sxy - sx * sy)) / n;
  const r2 = ssTot > eps * Math.max(syy, 1) ? 1 - ssRes / ssTot : 0;
  return { k: Math.exp(logK), beta, r2 };
}

// ─── Zipf–Mandelbrot, by maximum likelihood ──────────────────────────────
// Rank–frequency model p(r) ∝ (r+β)^(−s), normalized over the observed
// ranks 1..R (a truncated Zipf–Mandelbrot — the right likelihood for a
// finite attested vocabulary). Fitted by maximizing the multinomial
// log-likelihood Σ f_r·ln p(r) over a coarse (s, β) grid refined twice
// around the optimum. Reports the one-sample Kolmogorov–Smirnov statistic
// D = max_r |F_emp(r) − F_fit(r)| over token-share CDFs as the
// goodness-of-fit number (smaller = closer), plus log-space R² for
// continuity with the chart.
export interface ZipfMandelbrotFit {
  s: number;
  beta: number;
  ks: number;
  r2Log: number;
  logZ: number; // ln of the normalizer Σ (r+β)^(−s), for drawing the curve
}

function zmLogLik(freqs: readonly number[], s: number, beta: number): number {
  let z = 0;
  for (let r = 1; r <= freqs.length; r++) z += Math.pow(r + beta, -s);
  const logZ = Math.log(z);
  let ll = 0;
  for (let r = 1; r <= freqs.length; r++) {
    ll += freqs[r - 1] * (-s * Math.log(r + beta) - logZ);
  }
  return ll;
}

export function fitZipfMandelbrotMLE(
  freqs: readonly number[],
): ZipfMandelbrotFit | null {
  if (freqs.length < 5) return null;
  let best = { s: 1, beta: 0, ll: -Infinity };
  const evaluate = (s: number, beta: number) => {
    const ll = zmLogLik(freqs, s, beta);
    if (ll > best.ll) best = { s, beta, ll };
  };
  // Coarse grid, then two refinement passes around the running optimum.
  for (let s = 0.2; s <= 3.0001; s += 0.1)
    for (let beta = 0; beta <= 15.0001; beta += 0.5) evaluate(s, beta);
  for (let pass = 0; pass < 2; pass++) {
    const sStep = pass === 0 ? 0.02 : 0.004;
    const bStep = pass === 0 ? 0.1 : 0.02;
    const { s: s0, beta: b0 } = best;
    for (let s = s0 - 5 * sStep; s <= s0 + 5 * sStep; s += sStep)
      for (
        let beta = Math.max(0, b0 - 5 * bStep);
        beta <= b0 + 5 * bStep;
        beta += bStep
      )
        evaluate(Math.max(0.01, s), beta);
  }

  const { s, beta } = best;
  let z = 0;
  for (let r = 1; r <= freqs.length; r++) z += Math.pow(r + beta, -s);
  const logZ = Math.log(z);

  // KS over cumulative token shares.
  let n = 0;
  for (const f of freqs) n += f;
  if (n <= 0) return null;
  let cumEmp = 0;
  let cumFit = 0;
  let ks = 0;
  for (let r = 1; r <= freqs.length; r++) {
    cumEmp += freqs[r - 1] / n;
    cumFit += Math.pow(r + beta, -s) / z;
    const d = Math.abs(cumEmp - cumFit);
    if (d > ks) ks = d;
  }

  // Log-space R² of fitted vs observed log-frequencies.
  let sy = 0;
  let syy = 0;
  let ssRes = 0;
  let m = 0;
  for (let r = 1; r <= freqs.length; r++) {
    if (freqs[r - 1] <= 0) continue;
    const obs = Math.log(freqs[r - 1]);
    const fit = Math.log(n) - s * Math.log(r + beta) - logZ;
    sy += obs;
    syy += obs * obs;
    ssRes += (obs - fit) * (obs - fit);
    m++;
  }
  const ssTot = syy - (sy * sy) / m;
  const r2Log = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { s, beta, ks, r2Log, logZ };
}
