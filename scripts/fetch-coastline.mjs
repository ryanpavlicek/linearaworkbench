// Regenerate src/data/aegeanLand.ts — the Findspot Map's land polygons —
// from Natural Earth's 1:10m land layer (public domain), pinned to a
// commit so reruns are reproducible. Network is needed only when running
// THIS script; the generated file is committed and the app stays fully
// offline.
//
//   node scripts/fetch-coastline.mjs
//
// Pipeline: download → clip every polygon ring to the Aegean bbox
// (Sutherland–Hodgman) → simplify (Douglas–Peucker, ~150 m tolerance) →
// drop slivers below ~1.5 km² → emit compact [lon, lat] rings.

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const NE_COMMIT = "ca96624a56bd078437bca8184e78163e5039ad19"; // v5.x, 2022-06-02
const NE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_COMMIT}/geojson/ne_10m_land.geojson`;

// Generous margin around the map's view (lon 22.5–27.5, lat 34.5–41.0) so
// panning to the clamped edges still shows land, and the mainland /
// Anatolian context frames the outlier sites.
const BBOX = { minLon: 19.5, maxLon: 30.5, minLat: 33.0, maxLat: 42.5 };

const SIMPLIFY_EPS = 0.0015; // degrees ≈ 150 m — Crete stays crisp
const MIN_RING_AREA = 0.00015; // square degrees ≈ 1.5 km² — drops islets

// ── Sutherland–Hodgman: clip a ring against one half-plane at a time ─────
function clipRing(ring, bbox) {
  const edges = [
    { inside: (p) => p[0] >= bbox.minLon, axis: 0, value: bbox.minLon },
    { inside: (p) => p[0] <= bbox.maxLon, axis: 0, value: bbox.maxLon },
    { inside: (p) => p[1] >= bbox.minLat, axis: 1, value: bbox.minLat },
    { inside: (p) => p[1] <= bbox.maxLat, axis: 1, value: bbox.maxLat },
  ];
  let pts = ring;
  for (const edge of edges) {
    if (pts.length === 0) return [];
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const curIn = edge.inside(cur);
      const prevIn = edge.inside(prev);
      if (curIn !== prevIn) {
        // intersection of prev→cur with the clip line
        const t =
          (edge.value - prev[edge.axis]) / (cur[edge.axis] - prev[edge.axis]);
        const other = 1 - edge.axis;
        const pt = [];
        pt[edge.axis] = edge.value;
        pt[other] = prev[other] + t * (cur[other] - prev[other]);
        out.push(pt);
      }
      if (curIn) out.push(cur);
    }
    pts = out;
  }
  return pts;
}

// ── Douglas–Peucker simplification ───────────────────────────────────────
function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  const cx = a[0] + Math.max(0, Math.min(1, t)) * dx;
  const cy = a[1] + Math.max(0, Math.min(1, t)) * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]];
  const left = simplify(pts.slice(0, idx + 1), eps);
  const right = simplify(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

function ringArea(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

console.log("downloading Natural Earth 10m land (pinned)…");
const res = await fetch(NE_URL);
if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
const geo = await res.json();

const rings = [];
for (const feature of geo.features) {
  const g = feature.geometry;
  const polys =
    g.type === "Polygon"
      ? [g.coordinates]
      : g.type === "MultiPolygon"
        ? g.coordinates
        : [];
  for (const poly of polys) {
    for (const rawRing of poly) {
      // quick reject: ring bbox vs target bbox
      let minLon = Infinity,
        maxLon = -Infinity,
        minLat = Infinity,
        maxLat = -Infinity;
      for (const [lon, lat] of rawRing) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      if (
        maxLon < BBOX.minLon ||
        minLon > BBOX.maxLon ||
        maxLat < BBOX.minLat ||
        minLat > BBOX.maxLat
      )
        continue;
      const clipped = clipRing(rawRing, BBOX);
      if (clipped.length < 4) continue;
      const simplified = simplify(clipped, SIMPLIFY_EPS);
      if (simplified.length < 4) continue;
      if (ringArea(simplified) < MIN_RING_AREA) continue;
      rings.push(
        simplified.map(([lon, lat]) => [
          Number(lon.toFixed(4)),
          Number(lat.toFixed(4)),
        ]),
      );
    }
  }
}

rings.sort((a, b) => ringArea(b) - ringArea(a));
const points = rings.reduce((s, r) => s + r.length, 0);
console.log(`kept ${rings.length} rings, ${points} points`);

const header = `// Land polygons for the Findspot Map — Natural Earth 1:10m land layer
// (public domain), clipped to the Aegean view and simplified. GENERATED by
// scripts/fetch-coastline.mjs (source pinned to nvkelso/natural-earth-vector
// @ ${NE_COMMIT.slice(0, 12)}); edit the script, not this file.
// ${rings.length} rings, ${points} points, [lon, lat] pairs.

export const AEGEAN_LAND: [number, number][][] = `;

const body = JSON.stringify(rings);
const out = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/data/aegeanLand.ts",
);
writeFileSync(out, header + body + ";\n");
console.log(`wrote ${out}`);
