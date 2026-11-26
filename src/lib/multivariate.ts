// Multivariate exploration tools: correspondence analysis (the biplot
// behind "which sites/scribes pattern with which commodities"),
// average-linkage hierarchical clustering with bootstrap support, and
// label-propagation community detection for the co-occurrence network.
// All deterministic — power iteration from fixed start vectors, seeded
// resamples, ordered tie-breaks — so a screenshot is reproducible.

import { mulberry32 } from "./lexstats";

// ─── Correspondence analysis ─────────────────────────────────────────────
// Classic CA of a contingency table: SVD of the standardized residuals
//   S = D_r^(−1/2) (P − r·cᵀ) D_c^(−1/2),  P = N/n
// keeping the top two axes. Row/column principal coordinates put rows
// and columns in the same plane: a row sits in the direction of the
// columns it over-uses. The SVD is computed by power iteration with
// deflation on SᵀS — the tables here are tens × tens, so two leading
// singular triplets converge in a few hundred cheap iterations.

export interface CAPoint {
  label: string;
  x: number;
  y: number;
  /** marginal share of the table — drives point size */
  mass: number;
}

export interface CAResult {
  rows: CAPoint[];
  cols: CAPoint[];
  /** share of total inertia captured by axes 1 and 2 */
  inertia: [number, number];
  totalInertia: number;
}

function powerIterate(
  ata: number[][], // symmetric positive semi-definite (cols × cols)
  skip: number[][], // previously found eigenvectors to deflate against
): { value: number; vector: number[] } | null {
  const m = ata.length;
  if (m === 0) return null;
  // Fixed, slightly asymmetric start vector — deterministic, and not
  // orthogonal to anything by accident.
  let v = Array.from({ length: m }, (_, i) => 1 + (i + 1) / m);
  const orthogonalize = (vec: number[]) => {
    for (const u of skip) {
      let dot = 0;
      for (let i = 0; i < m; i++) dot += vec[i] * u[i];
      for (let i = 0; i < m; i++) vec[i] -= dot * u[i];
    }
  };
  const normalize = (vec: number[]): number => {
    let norm = 0;
    for (let i = 0; i < m; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm < 1e-12) return 0;
    for (let i = 0; i < m; i++) vec[i] /= norm;
    return norm;
  };
  orthogonalize(v);
  if (normalize(v) === 0) return null;

  let value = 0;
  for (let iter = 0; iter < 500; iter++) {
    const next = new Array<number>(m).fill(0);
    for (let i = 0; i < m; i++) {
      const row = ata[i];
      let s = 0;
      for (let j = 0; j < m; j++) s += row[j] * v[j];
      next[i] = s;
    }
    orthogonalize(next);
    const norm = normalize(next);
    if (norm === 0) return null; // nothing left in this subspace
    let diff = 0;
    for (let i = 0; i < m; i++) {
      const d = next[i] - v[i];
      diff += d * d;
    }
    value = norm;
    v = next;
    if (diff < 1e-20) break;
  }
  return { value, vector: v };
}

export function correspondenceAnalysis(
  rowLabels: readonly string[],
  colLabels: readonly string[],
  counts: readonly (readonly number[])[], // rows × cols
): CAResult | null {
  const nr = rowLabels.length;
  const nc = colLabels.length;
  if (nr < 3 || nc < 3) return null;
  let n = 0;
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) n += counts[i][j];
  if (n <= 0) return null;
  const r = new Array<number>(nr).fill(0);
  const c = new Array<number>(nc).fill(0);
  for (let i = 0; i < nr; i++)
    for (let j = 0; j < nc; j++) {
      r[i] += counts[i][j] / n;
      c[j] += counts[i][j] / n;
    }
  if (r.some((x) => x === 0) || c.some((x) => x === 0)) {
    // Zero-margin rows/cols carry no information and break the scaling —
    // the caller should have filtered them.
    return null;
  }
  // Standardized residual matrix S (nr × nc) and total inertia = Σ S².
  const S: number[][] = Array.from({ length: nr }, () =>
    new Array<number>(nc).fill(0),
  );
  let totalInertia = 0;
  for (let i = 0; i < nr; i++)
    for (let j = 0; j < nc; j++) {
      const p = counts[i][j] / n;
      const s = (p - r[i] * c[j]) / Math.sqrt(r[i] * c[j]);
      S[i][j] = s;
      totalInertia += s * s;
    }
  if (totalInertia < 1e-12) return null; // table is independent — no axes
  // SᵀS (nc × nc), then the two leading eigenpairs.
  const ata: number[][] = Array.from({ length: nc }, () =>
    new Array<number>(nc).fill(0),
  );
  for (let a = 0; a < nc; a++)
    for (let b = a; b < nc; b++) {
      let s = 0;
      for (let i = 0; i < nr; i++) s += S[i][a] * S[i][b];
      ata[a][b] = s;
      ata[b][a] = s;
    }
  const first = powerIterate(ata, []);
  if (!first) return null;
  const second = powerIterate(ata, [first.vector]);
  const sigma1 = Math.sqrt(Math.max(0, first.value));
  const sigma2 = second ? Math.sqrt(Math.max(0, second.value)) : 0;
  const v1 = first.vector;
  const v2 = second?.vector ?? new Array<number>(nc).fill(0);
  // u_k = S v_k / σ_k (nr)
  const u = (v: number[], sigma: number) => {
    const out = new Array<number>(nr).fill(0);
    if (sigma < 1e-12) return out;
    for (let i = 0; i < nr; i++) {
      let s = 0;
      for (let j = 0; j < nc; j++) s += S[i][j] * v[j];
      out[i] = s / sigma;
    }
    return out;
  };
  const u1 = u(v1, sigma1);
  const u2 = u(v2, sigma2);
  // Principal coordinates: rows F = D_r^(−1/2) u σ; cols G = D_c^(−1/2) v σ.
  const rows: CAPoint[] = rowLabels.map((label, i) => ({
    label,
    x: (u1[i] / Math.sqrt(r[i])) * sigma1,
    y: (u2[i] / Math.sqrt(r[i])) * sigma2,
    mass: r[i],
  }));
  const cols: CAPoint[] = colLabels.map((label, j) => ({
    label,
    x: (v1[j] / Math.sqrt(c[j])) * sigma1,
    y: (v2[j] / Math.sqrt(c[j])) * sigma2,
    mass: c[j],
  }));
  return {
    rows,
    cols,
    inertia: [
      (sigma1 * sigma1) / totalInertia,
      (sigma2 * sigma2) / totalInertia,
    ],
    totalInertia,
  };
}

// ─── UPGMA dendrogram with bootstrap support ─────────────────────────────
// Items are labeled feature-count vectors (e.g. a site's word counts).
// Distance = cosine distance between count vectors. The tree is built by
// average linkage; support for each internal node is the share of
// bootstrap replicates (resampling FEATURES — word types — with
// replacement) whose tree contains exactly the same member set.

export interface DendroMerge {
  /** indices into the original items (or earlier merges, offset by n) */
  a: number;
  b: number;
  height: number;
  /** sorted member labels of the cluster this merge creates */
  members: string[];
  /** bootstrap support 0–1; NaN when bootstrap is skipped */
  support: number;
}

export interface DendroResult {
  labels: string[];
  merges: DendroMerge[];
  /** display order of leaves (left→right) */
  order: string[];
}

function upgmaMergesDense(
  n: number,
  mat: Float64Array, // n × f dense count matrix (row-major)
  fCount: number,
  weights: Int32Array | null, // null = uniform 1 per feature; else bootstrap multiplicity
): { merges: { a: number; b: number; height: number; members: number[] }[] } {
  const stride = 2 * n;
  const dist = new Float64Array(stride * stride);
  const norms = new Float64Array(n);
  if (weights === null) {
    for (let i = 0; i < n; i++) {
      const off = i * fCount;
      let s = 0;
      for (let f = 0; f < fCount; f++) {
        const x = mat[off + f];
        s += x * x;
      }
      norms[i] = Math.sqrt(s);
    }
    for (let i = 0; i < n; i++) {
      const offI = i * fCount;
      const ni = norms[i];
      for (let j = i + 1; j < n; j++) {
        const nj = norms[j];
        let d = 1;
        if (ni > 0 && nj > 0) {
          const offJ = j * fCount;
          let dot = 0;
          for (let f = 0; f < fCount; f++) dot += mat[offI + f] * mat[offJ + f];
          d = 1 - dot / (ni * nj);
        }
        dist[i * stride + j] = d;
        dist[j * stride + i] = d;
      }
    }
  } else {
    // Only visit features with non-zero bootstrap multiplicity.
    const activeF: number[] = [];
    const activeW: number[] = [];
    for (let f = 0; f < fCount; f++) {
      const w = weights[f];
      if (w > 0) {
        activeF.push(f);
        activeW.push(w);
      }
    }
    const afLen = activeF.length;
    for (let i = 0; i < n; i++) {
      const off = i * fCount;
      let s = 0;
      for (let k = 0; k < afLen; k++) {
        const x = mat[off + activeF[k]];
        s += activeW[k] * x * x;
      }
      norms[i] = Math.sqrt(s);
    }
    for (let i = 0; i < n; i++) {
      const offI = i * fCount;
      const ni = norms[i];
      for (let j = i + 1; j < n; j++) {
        const nj = norms[j];
        let d = 1;
        if (ni > 0 && nj > 0) {
          const offJ = j * fCount;
          let dot = 0;
          for (let k = 0; k < afLen; k++) {
            const f = activeF[k];
            dot += activeW[k] * mat[offI + f] * mat[offJ + f];
          }
          d = 1 - dot / (ni * nj);
        }
        dist[i * stride + j] = d;
        dist[j * stride + i] = d;
      }
    }
  }

  const members: number[][] = new Array(2 * n);
  const ids: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    members[i] = [i];
    ids[i] = i;
  }
  const merges: { a: number; b: number; height: number; members: number[] }[] =
    [];
  while (ids.length > 1) {
    let bestAx = -1;
    let bestBx = -1;
    let bestD = Infinity;
    for (let x = 0; x < ids.length; x++) {
      const ix = ids[x];
      const rowOff = ix * stride;
      for (let y = x + 1; y < ids.length; y++) {
        const d = dist[rowOff + ids[y]];
        if (d < bestD - 1e-12) {
          bestD = d;
          bestAx = x;
          bestBx = y;
        }
      }
    }
    if (bestAx < 0) break;
    const a = ids[bestAx];
    const b = ids[bestBx];
    const newId = n + merges.length;
    const ma = members[a];
    const mb = members[b];
    const merged = [...ma, ...mb].sort((x, y) => x - y);
    members[newId] = merged;
    const denom = ma.length + mb.length;
    const rowA = a * stride;
    const rowB = b * stride;
    const rowNew = newId * stride;
    for (let i = 0; i < ids.length; i++) {
      const k = ids[i];
      if (k === a || k === b) continue;
      const dNew = (ma.length * dist[rowA + k] + mb.length * dist[rowB + k]) / denom;
      dist[rowNew + k] = dNew;
      dist[k * stride + newId] = dNew;
    }
    merges.push({ a, b, height: bestD, members: merged });
    ids.splice(bestBx, 1);
    ids.splice(bestAx, 1);
    ids.push(newId);
  }
  return { merges };
}

export function upgmaWithBootstrap(
  items: readonly { label: string; counts: ReadonlyMap<string, number> }[],
  opts: { iters?: number; seed?: number } = {},
): DendroResult | null {
  const n = items.length;
  if (n < 3) return null;
  const vocab = [...new Set(items.flatMap((it) => [...it.counts.keys()]))];
  const fCount = vocab.length;
  if (fCount < 2) return null;

  // Build dense n × fCount Float64Array once so bootstrap replicates avoid
  // millions of Map<string, number> lookups.
  const mat = new Float64Array(n * fCount);
  const featIdx = new Map<string, number>();
  for (let f = 0; f < fCount; f++) featIdx.set(vocab[f], f);
  for (let i = 0; i < n; i++) {
    const off = i * fCount;
    for (const [feat, val] of items[i].counts) {
      const fi = featIdx.get(feat);
      if (fi !== undefined) mat[off + fi] = val;
    }
  }

  const ref = upgmaMergesDense(n, mat, fCount, null);
  const iters = opts.iters ?? 100;
  const rand = mulberry32(opts.seed ?? 42);
  const want = new Map<string, number>(); // memberKey → hits
  const memberKey = (m: number[]) => m.join(",");
  for (const mg of ref.merges) want.set(memberKey(mg.members), 0);
  const weights = new Int32Array(fCount);
  for (let it = 0; it < iters; it++) {
    weights.fill(0);
    for (let i = 0; i < fCount; i++) weights[Math.floor(rand() * fCount)]++;
    const rep = upgmaMergesDense(n, mat, fCount, weights);
    const seen = new Set(rep.merges.map((m) => memberKey(m.members)));
    for (const k of want.keys()) if (seen.has(k)) want.set(k, want.get(k)! + 1);
  }
  const merges: DendroMerge[] = ref.merges.map((m) => ({
    a: m.a,
    b: m.b,
    height: m.height,
    members: m.members.map((i) => items[i].label).sort(),
    support:
      m.members.length === n
        ? 1 // the root is trivially present in every tree
        : (want.get(memberKey(m.members)) ?? 0) / iters,
  }));
  // Leaf display order via in-order walk of the final merge.
  const order: string[] = [];
  const walk = (id: number) => {
    if (id < n) {
      order.push(items[id].label);
      return;
    }
    const m = ref.merges[id - n];
    walk(m.a);
    walk(m.b);
  };
  walk(n + ref.merges.length - 1);
  return { labels: items.map((i) => i.label), merges, order };
}

// ─── Label-propagation communities ───────────────────────────────────────
// Raghavan et al. (2007), weighted, with deterministic tie-breaks and a
// seeded visit order. Cheap, no resolution parameter, and good enough to
// color a few hundred nodes; not a substitute for modularity methods on
// large graphs.

export function labelPropagation(
  nodes: readonly string[],
  edges: readonly { a: string; b: string; w: number }[],
  opts: { seed?: number; maxIters?: number } = {},
): Map<string, number> {
  const rand = mulberry32(opts.seed ?? 7);
  const maxIters = opts.maxIters ?? 50;
  const label = new Map<string, number>();
  nodes.forEach((nd, i) => label.set(nd, i));
  const nbrs = new Map<string, { to: string; w: number }[]>();
  for (const e of edges) {
    if (!label.has(e.a) || !label.has(e.b) || e.a === e.b) continue;
    if (!nbrs.has(e.a)) nbrs.set(e.a, []);
    if (!nbrs.has(e.b)) nbrs.set(e.b, []);
    nbrs.get(e.a)!.push({ to: e.b, w: e.w });
    nbrs.get(e.b)!.push({ to: e.a, w: e.w });
  }
  const orderArr = [...nodes];
  for (let iter = 0; iter < maxIters; iter++) {
    // seeded shuffle each round
    for (let i = orderArr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [orderArr[i], orderArr[j]] = [orderArr[j], orderArr[i]];
    }
    let changed = 0;
    for (const nd of orderArr) {
      const ns = nbrs.get(nd);
      if (!ns || ns.length === 0) continue;
      const weight = new Map<number, number>();
      for (const { to, w } of ns) {
        const l = label.get(to)!;
        weight.set(l, (weight.get(l) ?? 0) + w);
      }
      let bestLabel = label.get(nd)!;
      let bestW = -Infinity;
      for (const [l, w] of weight) {
        if (w > bestW || (w === bestW && l < bestLabel)) {
          bestW = w;
          bestLabel = l;
        }
      }
      if (bestLabel !== label.get(nd)) {
        label.set(nd, bestLabel);
        changed++;
      }
    }
    if (changed === 0) break;
  }
  // Renumber communities by descending size (stable, display-friendly).
  const sizes = new Map<number, number>();
  for (const l of label.values()) sizes.set(l, (sizes.get(l) ?? 0) + 1);
  const renumber = new Map<number, number>();
  [...sizes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .forEach(([old], i) => renumber.set(old, i));
  const out = new Map<string, number>();
  for (const [nd, l] of label) out.set(nd, renumber.get(l)!);
  return out;
}
