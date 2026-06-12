import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { SITE_COORDS } from "../data/siteCoords";
import { InscriptionLink } from "../components/InscriptionLink";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { csvEscape, downloadFile, prefersReducedMotion } from "../lib/helpers";
import { svgToPngDataUrl } from "../lib/svgSnapshot";
import type { Inscription } from "../lib/types";

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Default Aegean view — covers Crete and the Cycladic islands cleanly.
// Outliers (Tel Haror, Margiana, etc.) are listed separately.
const VIEW_LON = { min: 22.5, max: 27.5 };
const VIEW_LAT = { min: 34.5, max: 41.0 };
const PAD = 30;

// Approximate Crete coastline traced from west tip clockwise. Sourced by
// hand from standard maps; precise to ~5 km — good enough for site
// orientation, not for navigation.
const CRETE_OUTLINE: [number, number][] = [
  // [lon, lat]
  [23.55, 35.55], // NW Khania peninsula
  [23.7, 35.52],
  [23.85, 35.51],
  [24.05, 35.55],
  [24.2, 35.5],
  [24.35, 35.42],
  [24.5, 35.4],
  [24.65, 35.43],
  [24.8, 35.4],
  [24.95, 35.34],
  [25.1, 35.34],
  [25.18, 35.34],
  [25.32, 35.34],
  [25.5, 35.3],
  [25.7, 35.22],
  [25.85, 35.2],
  [26.05, 35.19],
  [26.18, 35.22],
  [26.28, 35.27],
  [26.3, 35.2],
  [26.32, 35.13],
  [26.27, 35.07],
  [26.2, 35.0],
  [26.1, 34.95],
  [25.95, 34.93],
  [25.8, 34.93],
  [25.5, 34.95],
  [25.2, 34.94],
  [24.9, 34.94],
  [24.6, 34.92],
  [24.3, 34.94],
  [24.0, 34.94],
  [23.7, 34.95],
  [23.55, 35.1],
  [23.5, 35.25],
  [23.5, 35.4],
  [23.55, 35.55],
];

// Smaller outlines for Thera (Santorini) and Kythera since both host
// significant Linear A material.
const THERA_OUTLINE: [number, number][] = [
  [25.34, 36.42],
  [25.4, 36.46],
  [25.45, 36.42],
  [25.46, 36.36],
  [25.42, 36.32],
  [25.36, 36.34],
  [25.34, 36.4],
  [25.34, 36.42],
];
const KYTHERA_OUTLINE: [number, number][] = [
  [22.95, 36.32],
  [23.05, 36.25],
  [23.05, 36.2],
  [22.98, 36.16],
  [22.92, 36.2],
  [22.92, 36.28],
  [22.95, 36.32],
];

interface Point {
  site: string;
  count: number;
  region: string;
  cx: number;
  cy: number;
  inView: boolean;
  lat: number;
  lon: number;
}

const VIEW_W = 900;
const VIEW_H = 720;
const DEFAULT_VIEWBOX: ViewBox = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
const MIN_VIEW_W = 80; // most zoomed in (~11× linear)
const MAX_VIEW_W = VIEW_W * 1.5; // a bit zoomed out

export default function FindspotMap() {
  const inscriptions = useScopedCorpus().inscriptions;
  const setActive = useWorkbench((s) => s.setActiveModule);
  const [focusedSite, setFocusedSite] = useState<string | null>(null);
  const [overlayWord, setOverlayWord] = useState("");
  const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEWBOX);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startViewBox: ViewBox;
    moved: boolean;
  } | null>(null);
  // Tracks an in-flight viewBox animation so we can cancel it if the user
  // interacts again before it finishes.
  const animRef = useRef<number | null>(null);
  // Zoom factor relative to the default viewBox. >1 means zoomed in.
  const zoom = VIEW_W / viewBox.w;
  const viewW = VIEW_W;
  const viewH = VIEW_H;

  const siteCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ins of inscriptions) {
      if (!ins.site) continue;
      map.set(ins.site, (map.get(ins.site) ?? 0) + 1);
    }
    return map;
  }, [inscriptions]);

  // Word overlay: per-site count of inscriptions containing an exact word.
  // When set, markers recolor/scale by where that word appears.
  const overlayWordU = overlayWord.toUpperCase().trim();
  const overlayCounts = useMemo(() => {
    if (!overlayWordU) return null;
    const m = new Map<string, number>();
    for (const ins of inscriptions) {
      if (!ins.site) continue;
      if (ins.words.some((w) => w.toUpperCase() === overlayWordU))
        m.set(ins.site, (m.get(ins.site) ?? 0) + 1);
    }
    return m;
  }, [inscriptions, overlayWordU]);
  const maxOverlay = overlayCounts
    ? Math.max(1, ...overlayCounts.values())
    : 1;
  const overlayTotal = overlayCounts
    ? [...overlayCounts.values()].reduce((s, x) => s + x, 0)
    : 0;

  const points: Point[] = useMemo(() => {
    const list: Point[] = [];
    for (const [site, count] of siteCounts) {
      const coord = SITE_COORDS[site];
      if (!coord) continue;
      const inView =
        coord.lon >= VIEW_LON.min &&
        coord.lon <= VIEW_LON.max &&
        coord.lat >= VIEW_LAT.min &&
        coord.lat <= VIEW_LAT.max;
      // Equirectangular projection — fine for a small region. Y inverted
      // because SVG y-axis grows downward while latitude grows upward.
      const cx =
        PAD +
        ((coord.lon - VIEW_LON.min) / (VIEW_LON.max - VIEW_LON.min)) *
          (viewW - 2 * PAD);
      const cy =
        PAD +
        ((VIEW_LAT.max - coord.lat) / (VIEW_LAT.max - VIEW_LAT.min)) *
          (viewH - 2 * PAD);
      list.push({
        site,
        count,
        region: coord.region,
        cx,
        cy,
        inView,
        lat: coord.lat,
        lon: coord.lon,
      });
    }
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [siteCounts, viewW, viewH]);

  const inViewPoints = points.filter((p) => p.inView);
  const outOfViewPoints = points.filter((p) => !p.inView);
  const unmappedSites = useMemo(() => {
    const out: { site: string; count: number }[] = [];
    for (const [site, count] of siteCounts)
      if (!SITE_COORDS[site] && site)
        out.push({ site, count });
    return out.sort((a, b) => b.count - a.count);
  }, [siteCounts]);

  const maxCount = points[0]?.count ?? 1;
  const focusInscriptions = focusedSite
    ? inscriptions.filter((i) => i.site === focusedSite)
    : [];

  // Latitude/longitude grid lines, every 1° for context
  const gridLons: number[] = [];
  for (let v = Math.ceil(VIEW_LON.min); v < VIEW_LON.max; v++) gridLons.push(v);
  const gridLats: number[] = [];
  for (let v = Math.ceil(VIEW_LAT.min); v < VIEW_LAT.max; v++) gridLats.push(v);

  function lonToX(lon: number) {
    return (
      PAD +
      ((lon - VIEW_LON.min) / (VIEW_LON.max - VIEW_LON.min)) *
        (viewW - 2 * PAD)
    );
  }
  function latToY(lat: number) {
    return (
      PAD +
      ((VIEW_LAT.max - lat) / (VIEW_LAT.max - VIEW_LAT.min)) *
        (viewH - 2 * PAD)
    );
  }

  // ─── Zoom & pan handlers ────────────────────────────────────────────
  // ─── Animated viewBox transitions ───────────────────────────────────
  // easeOutCubic for a feel that's snappy at the start, settles at the end.
  const animateTo = useCallback((target: ViewBox, duration = 350) => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    // Respect reduced-motion: jump straight to the target, no tweening.
    if (prefersReducedMotion()) {
      setViewBox(target);
      return;
    }
    const start = { ...viewBox };
    const t0 = performance.now();
    function tick(now: number) {
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setViewBox({
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
        w: start.w + (target.w - start.w) * e,
        h: start.h + (target.h - start.h) * e,
      });
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
    }
    animRef.current = requestAnimationFrame(tick);
  }, [viewBox]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    },
    [],
  );

  function clampViewBox(vb: ViewBox): ViewBox {
    // Keep the user from panning into nothingness — clamp so at least a
    // quarter of the default viewport stays visible. Allow some overshoot
    // so coastlines near edges remain reachable.
    const aspect = VIEW_H / VIEW_W;
    const w = Math.max(MIN_VIEW_W, Math.min(MAX_VIEW_W, vb.w));
    const h = w * aspect;
    const minX = -w / 2;
    const maxX = VIEW_W - w / 2;
    const minY = -h / 2;
    const maxY = VIEW_H - h / 2;
    return {
      w,
      h,
      x: Math.max(minX, Math.min(maxX, vb.x)),
      y: Math.max(minY, Math.min(maxY, vb.y)),
    };
  }

  function svgPointFromClient(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w,
      y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h,
    };
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1 / 1.25 : 1.25;
    const newW = Math.max(
      MIN_VIEW_W,
      Math.min(MAX_VIEW_W, viewBox.w * factor),
    );
    if (newW === viewBox.w) return;
    const ratio = newW / viewBox.w;
    const cursor = svgPointFromClient(e.clientX, e.clientY);
    setViewBox(
      clampViewBox({
        x: cursor.x - (cursor.x - viewBox.x) * ratio,
        y: cursor.y - (cursor.y - viewBox.y) * ratio,
        w: newW,
        h: viewBox.h * ratio,
      }),
    );
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startViewBox: viewBox,
      moved: false,
    };
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragRef.current.moved = true;
    const sX = (dx / rect.width) * dragRef.current.startViewBox.w;
    const sY = (dy / rect.height) * dragRef.current.startViewBox.h;
    setViewBox(
      clampViewBox({
        x: dragRef.current.startViewBox.x - sX,
        y: dragRef.current.startViewBox.y - sY,
        w: dragRef.current.startViewBox.w,
        h: dragRef.current.startViewBox.h,
      }),
    );
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    const step = 0.18; // fraction of viewBox to pan per arrow press
    switch (e.key) {
      case "ArrowLeft":
        panBy(-step, 0);
        break;
      case "ArrowRight":
        panBy(step, 0);
        break;
      case "ArrowUp":
        panBy(0, -step);
        break;
      case "ArrowDown":
        panBy(0, step);
        break;
      case "+":
      case "=":
        zoomBy(1 / 1.5);
        break;
      case "-":
      case "_":
        zoomBy(1.5);
        break;
      case "0":
        resetView();
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  function zoomBy(factor: number) {
    const newW = Math.max(
      MIN_VIEW_W,
      Math.min(MAX_VIEW_W, viewBox.w * factor),
    );
    const ratio = newW / viewBox.w;
    const cx = viewBox.x + viewBox.w / 2;
    const cy = viewBox.y + viewBox.h / 2;
    animateTo(
      clampViewBox({
        x: cx - (viewBox.w * ratio) / 2,
        y: cy - (viewBox.h * ratio) / 2,
        w: newW,
        h: viewBox.h * ratio,
      }),
      200,
    );
  }
  function resetView() {
    animateTo(DEFAULT_VIEWBOX);
  }
  function panBy(dxFrac: number, dyFrac: number) {
    setViewBox((vb) =>
      clampViewBox({
        x: vb.x + vb.w * dxFrac,
        y: vb.y + vb.h * dyFrac,
        w: vb.w,
        h: vb.h,
      }),
    );
  }
  // Focus a site and optionally animate the map to center on it. Marker
  // clicks set focus without zooming (the marker is already in view).
  // Side-panel selections zoom because the marker may be off-screen.
  function focusSite(name: string | null, opts: { zoom?: boolean } = {}) {
    setFocusedSite((curr) => (curr === name ? null : name));
    if (opts.zoom && name) {
      const coord = SITE_COORDS[name];
      if (coord) centerOn(coord.lat, coord.lon, 6);
    }
  }

  // Center the view on a specific lat/lon at a target zoom level. Used by
  // the auto-focus behavior when a site gets selected, and by the minimap.
  function centerOn(lat: number, lon: number, targetZoom = 5, animate = true) {
    const targetW = VIEW_W / targetZoom;
    const targetH = targetW * (VIEW_H / VIEW_W);
    const cx = lonToX(lon);
    const cy = latToY(lat);
    const next = clampViewBox({
      x: cx - targetW / 2,
      y: cy - targetH / 2,
      w: targetW,
      h: targetH,
    });
    if (animate) animateTo(next);
    else setViewBox(next);
  }

  function zoomToCrete() {
    // Tight on Crete so visitors can immediately separate Haghia Triada,
    // Phaistos, Kamilari, Apodoulou, etc. in the Mesara plain.
    fitBox(23.4, 26.4, 34.8, 35.7);
  }
  function zoomToMesara() {
    fitBox(24.55, 25.0, 34.95, 35.18);
  }
  function fitBox(
    minLon: number,
    maxLon: number,
    minLat: number,
    maxLat: number,
  ) {
    const x1 = lonToX(minLon);
    const y1 = latToY(maxLat);
    const x2 = lonToX(maxLon);
    const y2 = latToY(minLat);
    animateTo(clampViewBox({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }));
  }

  const findingSummary =
    `${points.length} mapped find-sites` +
    (unmappedSites.length ? ` (+ ${unmappedSites.length} unmapped)` : "") +
    `.\nLargest: ` +
    (points
      .slice(0, 6)
      .map((p) => `${p.site} (${p.count})`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["site", "inscription_count", "region", "lat", "lon"],
    ];
    for (const p of points) rows.push([p.site, p.count, p.region, p.lat, p.lon]);
    for (const u of unmappedSites)
      rows.push([u.site, u.count, "unmapped", "", ""]);
    downloadFile(
      "linear_a_findspots.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 1600 }}>
      <h2>Findspot Map</h2>
      <div className="callout">
        <h4>Geographic distribution of Linear A inscriptions</h4>
        <p>
          Each marker is a find-site, sized by the log of attestation count.
          Click a site to filter the list at the right. Type a word into{" "}
          <b>Overlay</b> to recolor the map by where that word appears (brighter
          = more attestations; other sites dim). Most inscriptions come from
          Crete; a handful are from the Cycladic islands and the wider eastern
          Mediterranean, listed separately below.
        </p>
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <span className="dim" style={{ fontSize: 11 }}>
          {points.length} mapped sites
        </span>
        <input
          className="input"
          placeholder="Overlay a word's sites… (e.g. KU-RO)"
          value={overlayWord}
          onChange={(e) => setOverlayWord(e.target.value)}
          style={{ width: 220, fontSize: 11 }}
          title="Highlight the find-sites where a given word is attested"
        />
        {overlayWord && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setOverlayWord("")}
            title="Clear overlay"
          >
            ✕
          </button>
        )}
        {overlayCounts && (
          <span
            className="dim"
            style={{ fontSize: 11, color: "var(--cy)" }}
          >
            {overlayWordU}: {overlayCounts.size} site
            {overlayCounts.size === 1 ? "" : "s"} · {overlayTotal} tablet
            {overlayTotal === 1 ? "" : "s"}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="map"
          moduleLabel="Findspot Map"
          defaultTitle="Findspot map"
          summary={findingSummary}
          payloadFn={async () => {
            // Rasterize the current SVG (preserving the active zoom, focused
            // site, and word overlay) so the saved finding and the report
            // both show the map as the user saw it.
            const water = getComputedStyle(document.documentElement)
              .getPropertyValue("--map-water")
              .trim();
            const snapshot = svgRef.current
              ? await svgToPngDataUrl(svgRef.current, {
                  background: water || "#0e1420",
                })
              : null;
            return {
              snapshot,
              overlayWord: overlayWordU || undefined,
              focusedSite,
              zoom: Number(zoom.toFixed(2)),
            };
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div
          style={{
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Zoom controls overlay */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              display: "flex",
              gap: 4,
              zIndex: 5,
              background: "var(--map-overlay)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              padding: 4,
              backdropFilter: "blur(4px)",
            }}
          >
            <button
              className="btn btn-outline btn-sm"
              onClick={() => zoomBy(1 / 1.5)}
              title="Zoom in"
              style={{ padding: "2px 8px", fontSize: 14, minWidth: 28 }}
            >
              +
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => zoomBy(1.5)}
              title="Zoom out"
              style={{ padding: "2px 8px", fontSize: 14, minWidth: 28 }}
            >
              −
            </button>
            <div style={{ width: 1, background: "var(--border)" }} />
            <button
              className="btn btn-outline btn-sm"
              onClick={zoomToCrete}
              title="Fit Crete"
              style={{ padding: "2px 8px", fontSize: 10 }}
            >
              Crete
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={zoomToMesara}
              title="Fit the Mesara plain (Haghia Triada + Phaistos cluster)"
              style={{ padding: "2px 8px", fontSize: 10 }}
            >
              Mesara
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={resetView}
              title="Reset to full Aegean view"
              style={{ padding: "2px 8px", fontSize: 10 }}
            >
              Reset
            </button>
            <div
              style={{
                padding: "2px 6px",
                color: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--mono)",
                alignSelf: "center",
              }}
            >
              {zoom.toFixed(1)}×
            </div>
          </div>

          {/* Drag/zoom hint */}
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              color: "var(--text-muted)",
              fontSize: 10,
              fontFamily: "var(--sans)",
              background: "var(--map-overlay)",
              padding: "2px 8px",
              borderRadius: 3,
              pointerEvents: "none",
            }}
          >
            Scroll to zoom · drag to pan · arrow keys when focused
          </div>

          {/* Minimap overlay (bottom-right) */}
          <Minimap
            points={inViewPoints}
            viewBox={viewBox}
            onJump={(x, y) => {
              animateTo(
                clampViewBox({
                  x: x - viewBox.w / 2,
                  y: y - viewBox.h / 2,
                  w: viewBox.w,
                  h: viewBox.h,
                }),
                250,
              );
            }}
          />

          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              cursor: dragRef.current?.moved ? "grabbing" : "grab",
              touchAction: "none",
              outline: "none",
            }}
            role="img"
            aria-label="Interactive map of Linear A find-sites across Crete and the Aegean, each site marked at its coordinates and sized by inscription count; pan with drag or arrow keys, zoom with the wheel"
            tabIndex={0}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          >
            {/* Background sea */}
            <rect width={viewW} height={viewH} fill="var(--map-water)" />

            {/* Island outlines (under the markers) */}
            {[CRETE_OUTLINE, THERA_OUTLINE, KYTHERA_OUTLINE].map(
              (outline, i) => {
                const path =
                  outline
                    .map(
                      ([lon, lat], idx) =>
                        `${idx === 0 ? "M" : "L"}${lonToX(lon).toFixed(1)},${latToY(lat).toFixed(1)}`,
                    )
                    .join(" ") + " Z";
                return (
                  <path
                    key={i}
                    d={path}
                    fill="var(--map-land)"
                    stroke="#2a3550"
                    strokeWidth={1}
                    opacity={0.9}
                  />
                );
              },
            )}

            {/* Lat/Lon grid */}
            {gridLons.map((lon) => (
              <line
                key={`lon${lon}`}
                x1={lonToX(lon)}
                y1={PAD}
                x2={lonToX(lon)}
                y2={viewH - PAD}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={0.5}
              />
            ))}
            {gridLats.map((lat) => (
              <line
                key={`lat${lat}`}
                x1={PAD}
                y1={latToY(lat)}
                x2={viewW - PAD}
                y2={latToY(lat)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={0.5}
              />
            ))}
            {gridLons.map((lon) => (
              <text
                key={`lonT${lon}`}
                x={lonToX(lon)}
                y={viewH - PAD + 14}
                fill="var(--text-faint)"
                fontSize={9}
                textAnchor="middle"
                fontFamily="var(--mono)"
              >
                {lon}°E
              </text>
            ))}
            {gridLats.map((lat) => (
              <text
                key={`latT${lat}`}
                x={PAD - 6}
                y={latToY(lat) + 3}
                fill="var(--text-faint)"
                fontSize={9}
                textAnchor="end"
                fontFamily="var(--mono)"
              >
                {lat}°N
              </text>
            ))}

            {/* Compass note */}
            <text
              x={viewW - PAD}
              y={PAD - 8}
              fill="var(--text-muted)"
              fontSize={10}
              textAnchor="end"
              fontFamily="var(--sans)"
            >
              Aegean — Crete & nearby islands
            </text>

            {/* Markers — sizes and labels stay constant pixel size on the
                screen regardless of zoom. Labels collision-detect against
                each other so the eye actually has something to read. */}
            {(() => {
              // Target on-screen font size in pixels; converted to user
              // units below so it survives zoom changes uniformly.
              const TARGET_LABEL_PX = 12;
              const TARGET_COUNT_PX = 10;
              const labelFont = (TARGET_LABEL_PX * viewBox.w) / VIEW_W;
              const countFont = (TARGET_COUNT_PX * viewBox.w) / VIEW_W;

              // First pass — compute geometry & eligibility for every marker.
              const items = inViewPoints.map((p) => {
                const isFocus = focusedSite === p.site;
                const baseR = 3 + Math.sqrt(p.count / maxCount) * 22;
                const r = baseR / Math.max(1, Math.sqrt(zoom));
                const offset = r + 4 / Math.sqrt(zoom);
                // Eligibility — progressively disclose more labels as you
                // zoom in. Decluttering below trims further if needed.
                const overlayHit =
                  overlayCounts !== null &&
                  (overlayCounts.get(p.site) ?? 0) > 0;
                const eligible =
                  isFocus ||
                  overlayHit ||
                  (overlayCounts === null &&
                    (p.count >= 5 ||
                      (zoom >= 2 && p.count >= 2) ||
                      zoom >= 4));
                const labelText = `${p.site} ×${p.count}`;
                // Rough bounding box for collision check (proportional
                // font width — sans fonts average ~0.55em per char).
                const lw = labelText.length * labelFont * 0.55;
                const lh = labelFont * 1.4;
                const lx = p.cx - lw / 2;
                const ly = p.cy - offset - lh;
                return { p, isFocus, r, offset, eligible, labelText, lx, ly, lw, lh };
              });

              // Greedy decluttering — keep focused + highest-count labels,
              // skip any whose bounding box overlaps an already-kept label.
              const sortable = items
                .filter((it) => it.eligible)
                .sort((a, b) => {
                  if (a.isFocus !== b.isFocus) return a.isFocus ? -1 : 1;
                  return b.p.count - a.p.count;
                });
              const kept: typeof sortable = [];
              const overlaps = (a: (typeof sortable)[number], b: (typeof sortable)[number]) =>
                !(
                  a.lx + a.lw < b.lx ||
                  a.lx > b.lx + b.lw ||
                  a.ly + a.lh < b.ly ||
                  a.ly > b.ly + b.lh
                );
              for (const item of sortable) {
                if (kept.some((k) => overlaps(item, k))) continue;
                kept.push(item);
              }
              const visibleLabels = new Set(kept.map((k) => k.p.site));

              return items.map(({ p, isFocus, r, offset }) => {
                const baseColor =
                  p.region === "crete"
                    ? "var(--ac)"
                    : p.region === "aegean"
                      ? "var(--gn)"
                      : p.region === "mainland"
                        ? "var(--pu)"
                        : "var(--am)";
                const oc = overlayCounts
                  ? (overlayCounts.get(p.site) ?? 0)
                  : null;
                const color = oc && oc > 0 ? "var(--cy)" : baseColor;
                const fillOpacity =
                  oc !== null
                    ? oc > 0
                      ? 0.35 + 0.55 * (oc / maxOverlay)
                      : 0.05
                    : isFocus
                      ? 0.9
                      : 0.45;
                const strokeOpacity = oc !== null && oc === 0 ? 0.15 : 0.9;
                const showLabel = visibleLabels.has(p.site);
                return (
                  <g
                    key={p.site}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      if (dragRef.current?.moved) {
                        e.stopPropagation();
                        return;
                      }
                      setFocusedSite(focusedSite === p.site ? null : p.site);
                    }}
                  >
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={r}
                      fill={color}
                      fillOpacity={fillOpacity}
                      stroke={color}
                      strokeOpacity={strokeOpacity}
                      strokeWidth={(isFocus ? 2 : 1) / Math.sqrt(zoom)}
                    />
                    {showLabel && (
                      <text
                        x={p.cx}
                        y={p.cy - offset}
                        fill={isFocus ? color : "var(--text)"}
                        fontSize={labelFont}
                        fontWeight={isFocus ? 600 : 500}
                        textAnchor="middle"
                        fontFamily="var(--sans)"
                        style={{
                          pointerEvents: "none",
                          paintOrder: "stroke",
                          stroke: "var(--map-label-halo)",
                          strokeWidth: 3 / Math.sqrt(zoom),
                          strokeLinejoin: "round",
                        }}
                      >
                        {p.site}{" "}
                        <tspan
                          fill={
                            oc && oc > 0 ? "var(--cy)" : "var(--text-muted)"
                          }
                          fontSize={countFont}
                        >
                          ×{oc !== null ? oc : p.count}
                        </tspan>
                      </text>
                    )}
                  </g>
                );
              });
            })()}
          </svg>
        </div>

        <div>
          {focusedSite ? (
            <FocusedSitePanel
              site={focusedSite}
              count={siteCounts.get(focusedSite) ?? 0}
              inscriptions={focusInscriptions}
              clear={() => setFocusedSite(null)}
            />
          ) : (
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div
                style={{
                  font: "600 10px var(--sans)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 8,
                }}
              >
                Sites in view
              </div>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {inViewPoints.map((p) => (
                  <div
                    key={p.site}
                    onClick={() => focusSite(p.site, { zoom: true })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 6px",
                      cursor: "pointer",
                      borderRadius: 3,
                      fontSize: 12,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--surface-2)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "")
                    }
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        background:
                          p.region === "crete"
                            ? "var(--ac)"
                            : p.region === "aegean"
                              ? "var(--gn)"
                              : "var(--pu)",
                      }}
                    />
                    <span style={{ flex: 1 }}>{p.site}</span>
                    <span className="numeral">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outOfViewPoints.length > 0 && (
            <div
              style={{
                marginTop: 12,
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div
                style={{
                  font: "600 10px var(--sans)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 4,
                }}
              >
                Outside the Aegean view
              </div>
              <div className="dim" style={{ fontSize: 10, marginBottom: 6 }}>
                Linear A exports / outliers
              </div>
              {outOfViewPoints.map((p) => (
                <div
                  key={p.site}
                  onClick={() => focusSite(p.site, { zoom: true })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 6px",
                    cursor: "pointer",
                    borderRadius: 3,
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: "var(--am)",
                    }}
                  />
                  <span style={{ flex: 1 }}>{p.site}</span>
                  <span className="dim" style={{ fontSize: 10 }}>
                    {p.lat.toFixed(1)}°,{p.lon.toFixed(1)}°
                  </span>
                  <span className="numeral">{p.count}</span>
                </div>
              ))}
            </div>
          )}

          {unmappedSites.length > 0 && (
            <div
              style={{
                marginTop: 12,
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 12,
                fontSize: 11,
              }}
            >
              <div className="dim">
                Unmapped sites ({unmappedSites.length}):{" "}
                {unmappedSites.map((u) => `${u.site} ×${u.count}`).join(", ")}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 12,
              padding: 8,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            See <a
              onClick={() => setActive("geo")}
              style={{ cursor: "pointer", color: "var(--ac)" }}
            >
              Site Distribution
            </a>{" "}
            for Jaccard similarity between sites and site-exclusive
            vocabulary.
          </div>
        </div>
      </div>
    </div>
  );
}

// Small overview map in the corner. Shows the same sites at a glance and a
// rectangle marking the area the main view is currently covering. Click
// (or drag) inside the minimap to recenter the main view.
function Minimap({
  points,
  viewBox,
  onJump,
}: {
  points: Point[];
  viewBox: ViewBox;
  onJump: (x: number, y: number) => void;
}) {
  const W = 170;
  const H = (VIEW_H / VIEW_W) * W;
  const ref = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  function handle(e: React.PointerEvent<SVGSVGElement>) {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    onJump(px, py);
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        background: "var(--map-overlay)",
        border: "1px solid var(--border-strong)",
        borderRadius: 6,
        padding: 4,
        zIndex: 5,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          font: "600 9px var(--sans)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 2,
          paddingLeft: 4,
        }}
      >
        Overview
      </div>
      <svg
        ref={ref}
        width={W}
        height={H}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{
          display: "block",
          background: "var(--map-water)",
          borderRadius: 4,
          cursor: "crosshair",
          touchAction: "none",
        }}
        role="img"
        aria-label="Overview minimap of the whole map area; the rectangle marks the current viewport — click or drag to move it"
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          handle(e);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) handle(e);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          (e.target as Element).releasePointerCapture?.(e.pointerId);
        }}
      >
        {points.map((p) => {
          const color =
            p.region === "crete"
              ? "var(--ac)"
              : p.region === "aegean"
                ? "var(--gn)"
                : p.region === "mainland"
                  ? "var(--pu)"
                  : "var(--am)";
          return (
            <circle
              key={p.site}
              cx={p.cx}
              cy={p.cy}
              r={4 + Math.sqrt(p.count) * 1.2}
              fill={color}
              fillOpacity={0.7}
            />
          );
        })}
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.w}
          height={viewBox.h}
          fill="rgba(91,158,255,0.12)"
          stroke="var(--ac)"
          strokeWidth={3}
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}

function FocusedSitePanel({
  site,
  count,
  inscriptions,
  clear,
}: {
  site: string;
  count: number;
  inscriptions: Inscription[];
  clear: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--ac)",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            font: "600 10px var(--sans)",
            color: "var(--ac)",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Focused
        </span>
        <span style={{ font: "500 14px var(--sans)", color: "var(--text)" }}>
          {site}
        </span>
        <span className="dim">×{count}</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={clear}>
          Clear
        </button>
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {inscriptions.slice(0, 150).map((ins) => (
          <div
            key={ins.id}
            style={{
              padding: "2px 4px",
              fontSize: 11,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <InscriptionLink id={ins.id} />
            {ins.context && (
              <span className="dim" style={{ fontSize: 10 }}>
                {ins.context}
              </span>
            )}
            {ins.scribe && (
              <span className="dim" style={{ fontSize: 10 }}>
                {ins.scribe}
              </span>
            )}
            <span className="dim" style={{ fontSize: 10, flex: 1 }}>
              {ins.words.filter((w) => w.includes("-")).length} words
            </span>
          </div>
        ))}
        {inscriptions.length > 150 && (
          <div className="dim" style={{ fontSize: 11, padding: 4 }}>
            +{inscriptions.length - 150} more
          </div>
        )}
      </div>
    </div>
  );
}
