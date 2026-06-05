import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile, normalizeSignLabel } from "../lib/helpers";
import { SaveFindingButton } from "../components/SaveFindingButton";

interface ScribeProfile {
  scribe: string;
  inscriptionCount: number;
  primarySite: string;
  signs: Set<string>;
}

interface Node {
  scribe: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
  degree: number;
  count: number;
  color: string;
}

interface Edge {
  a: number;
  b: number;
  weight: number;
}

const REPULSION = 1800;
const SPRING = 0.04;
const REST_LENGTH = 100;
const CENTER = 0.001;
const DAMPING = 0.85;

// Color scribes by their dominant find-site so geographic patterns are
// visible at a glance.
const SITE_PALETTE: Record<string, string> = {
  "Haghia Triada": "var(--ac)",
  Khania: "var(--gn)",
  Phaistos: "var(--am)",
  Knossos: "var(--pu)",
  Zakros: "var(--cy)",
  Malia: "var(--mg)",
};
const FALLBACK_COLOR = "var(--text-muted)";

export default function ScribeNetwork() {
  const inscriptions = useScopedCorpus().inscriptions;
  const setActive = useWorkbench((s) => s.setActiveModule);
  const [minCount, setMinCount] = useState(5);
  const [minJaccard, setMinJaccard] = useState(0.35);
  const [focusScribe, setFocusScribe] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const dragRef = useRef<{
    node: Node;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);

  // Build scribe profiles (sign set + inscription count + primary site)
  const profiles: ScribeProfile[] = useMemo(() => {
    const map = new Map<string, {
      scribe: string;
      inscriptionCount: number;
      siteCounts: Map<string, number>;
      signs: Set<string>;
    }>();
    for (const ins of inscriptions) {
      if (!ins.scribe) continue;
      let p = map.get(ins.scribe);
      if (!p) {
        p = {
          scribe: ins.scribe,
          inscriptionCount: 0,
          siteCounts: new Map(),
          signs: new Set(),
        };
        map.set(ins.scribe, p);
      }
      p.inscriptionCount++;
      if (ins.site)
        p.siteCounts.set(ins.site, (p.siteCounts.get(ins.site) ?? 0) + 1);
      for (const w of ins.words) {
        if (!w.includes("-")) continue;
        for (const sign of w.split("-")) p.signs.add(normalizeSignLabel(sign));
      }
    }
    return [...map.values()]
      .filter((p) => p.inscriptionCount >= minCount)
      .map((p) => {
        let primary = "";
        let best = 0;
        for (const [s, c] of p.siteCounts) {
          if (c > best) {
            best = c;
            primary = s;
          }
        }
        return {
          scribe: p.scribe,
          inscriptionCount: p.inscriptionCount,
          primarySite: primary,
          signs: p.signs,
        };
      })
      .sort((a, b) => b.inscriptionCount - a.inscriptionCount);
  }, [inscriptions, minCount]);

  // Pairwise Jaccard, keep edges above the threshold
  const edges = useMemo(() => {
    const out: { a: string; b: string; weight: number }[] = [];
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const A = profiles[i].signs;
        const B = profiles[j].signs;
        let inter = 0;
        for (const s of A) if (B.has(s)) inter++;
        const union = A.size + B.size - inter;
        if (union === 0) continue;
        const w = inter / union;
        if (w >= minJaccard)
          out.push({ a: profiles[i].scribe, b: profiles[j].scribe, weight: w });
      }
    }
    return out;
  }, [profiles, minJaccard]);

  const findingSummary =
    `Scribal network: ${profiles.length} scribes · ${edges.length} edges ` +
    `(min ${minCount} inscriptions, Jaccard ≥ ${minJaccard}).\nStrongest links: ` +
    ([...edges]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((e) => `${e.a}↔${e.b} (${(e.weight * 100).toFixed(0)}%)`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [["scribe_a", "scribe_b", "jaccard"]];
    for (const e of edges) rows.push([e.a, e.b, e.weight.toFixed(4)]);
    downloadFile(
      "linear_a_scribal_network.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  // Initialize the simulation nodes/edges
  useLayoutEffect(() => {
    const nodes: Node[] = profiles.map((p) => ({
      scribe: p.scribe,
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 500,
      vx: 0,
      vy: 0,
      fixed: false,
      degree: 0,
      count: p.inscriptionCount,
      color: SITE_PALETTE[p.primarySite] ?? FALLBACK_COLOR,
    }));
    const idx = new Map(nodes.map((n, i) => [n.scribe, i]));
    const physEdges: Edge[] = edges.map((e) => ({
      a: idx.get(e.a)!,
      b: idx.get(e.b)!,
      weight: e.weight,
    }));
    for (const e of physEdges) {
      nodes[e.a].degree++;
      nodes[e.b].degree++;
    }
    nodesRef.current = nodes;
    edgesRef.current = physEdges;
    setRenderVersion((v) => v + 1);
  }, [profiles, edges]);

  // Physics simulation
  useEffect(() => {
    let raf = 0;
    let running = true;
    let tick = 0;
    function step() {
      const nodes = nodesRef.current;
      const physEdges = edgesRef.current;
      if (!nodes.length) {
        raf = requestAnimationFrame(step);
        return;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 4) d2 = 4;
          const d = Math.sqrt(d2);
          const f = REPULSION / d2;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }
      for (const e of physEdges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const diff = d - REST_LENGTH;
        const fx = (dx / d) * diff * SPRING * e.weight;
        const fy = (dy / d) * diff * SPRING * e.weight;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      for (const n of nodes) {
        if (n.fixed) continue;
        n.vx -= n.x * CENTER;
        n.vy -= n.y * CENTER;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }
      tick++;
      if (tick % 2 === 0) renderToDOM();
      if (running) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [profiles, edges]);

  function renderToDOM() {
    const svg = svgRef.current;
    if (!svg) return;
    const lineEls = svg.querySelectorAll<SVGLineElement>("line.edge");
    edgesRef.current.forEach((e, i) => {
      const el = lineEls[i];
      if (!el) return;
      el.setAttribute("x1", String(nodesRef.current[e.a].x));
      el.setAttribute("y1", String(nodesRef.current[e.a].y));
      el.setAttribute("x2", String(nodesRef.current[e.b].x));
      el.setAttribute("y2", String(nodesRef.current[e.b].y));
    });
    const nodeEls = svg.querySelectorAll<SVGGElement>("g.node");
    nodesRef.current.forEach((n, i) => {
      const el = nodeEls[i];
      if (!el) return;
      el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
    });
  }

  function onPointerDown(node: Node, e: React.PointerEvent) {
    e.preventDefault();
    node.fixed = true;
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(ctm.inverse());
    dragRef.current = {
      node,
      offsetX: node.x - local.x,
      offsetY: node.y - local.y,
      moved: false,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(ctm.inverse());
    dragRef.current.node.x = local.x + dragRef.current.offsetX;
    dragRef.current.node.y = local.y + dragRef.current.offsetY;
    dragRef.current.node.vx = 0;
    dragRef.current.node.vy = 0;
    dragRef.current.moved = true;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      dragRef.current.node.fixed = false;
      dragRef.current = null;
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }
  }

  const focusNeighbors = useMemo(() => {
    if (!focusScribe) return new Set<string>();
    const set = new Set<string>([focusScribe]);
    for (const e of edges) {
      if (e.a === focusScribe) set.add(e.b);
      if (e.b === focusScribe) set.add(e.a);
    }
    return set;
  }, [focusScribe, edges]);

  return (
    <div className="panel">
      <h2>Scribal Network</h2>
      <div className="callout">
        <h4>Vocabulary-similarity graph of scribes</h4>
        <p>
          Each node is a scribe; edges connect scribes whose sign
          vocabularies overlap by at least the minimum Jaccard threshold.
          Clusters that emerge tend to reflect shared training, shared
          workshop, or shared tablet-type specialization. Node color =
          the scribe's primary find-site; node size = inscription count.
        </p>
      </div>

      <div className="toolbar">
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          title="Drop scribes with fewer attestations than this — small-sample profiles are too noisy to network"
        >
          min inscriptions
          <input
            type="number"
            className="input"
            value={minCount}
            min={2}
            max={50}
            onChange={(e) => setMinCount(Math.max(2, +e.target.value || 5))}
            style={{ width: 60 }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          title="Edge threshold — only Jaccard ≥ this is drawn"
        >
          min Jaccard
          <input
            type="number"
            className="input"
            value={minJaccard}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(e) =>
              setMinJaccard(Math.max(0.05, +e.target.value || 0.35))
            }
            style={{ width: 70 }}
          />
        </label>
        {focusScribe && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setFocusScribe(null)}
          >
            Clear focus
          </button>
        )}
        <span className="dim" style={{ marginLeft: "auto" }}>
          {profiles.length} scribes · {edges.length} edges
        </span>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="scribenet"
          moduleLabel="Scribal Network"
          defaultTitle="Scribal network"
          summary={findingSummary}
          payload={{ minCount, minJaccard }}
        />
      </div>

      <div
        style={{
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <svg
          ref={svgRef}
          data-render={renderVersion}
          viewBox="-400 -400 800 800"
          style={{ width: "100%", height: "75vh", display: "block" }}
        >
          {edgesRef.current.map((e, i) => {
            const a = nodesRef.current[e.a];
            const b = nodesRef.current[e.b];
            if (!a || !b) return null;
            const dim =
              focusScribe &&
              !focusNeighbors.has(a.scribe) &&
              !focusNeighbors.has(b.scribe);
            const strong =
              focusScribe && (a.scribe === focusScribe || b.scribe === focusScribe);
            return (
              <line
                key={i}
                className="edge"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={strong ? "var(--ac)" : "var(--border-strong)"}
                strokeWidth={Math.max(0.5, e.weight * 3)}
                strokeOpacity={dim ? 0.1 : 0.5}
              />
            );
          })}
          {nodesRef.current.map((n, i) => {
            const r = 6 + Math.sqrt(n.count) * 1.4;
            const inFocus = !focusScribe || focusNeighbors.has(n.scribe);
            const isPivot = focusScribe === n.scribe;
            return (
              <g
                key={i}
                className="node"
                transform={`translate(${n.x}, ${n.y})`}
                style={{ cursor: "grab", opacity: inFocus ? 1 : 0.2 }}
                onPointerDown={(e) => onPointerDown(n, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onClick={(e) => {
                  if (dragRef.current?.moved) return;
                  if (e.detail === 2) {
                    setActive("scribes", { focus: n.scribe });
                  } else {
                    setFocusScribe(n.scribe === focusScribe ? null : n.scribe);
                  }
                }}
              >
                <circle
                  r={r}
                  fill={n.color}
                  fillOpacity={isPivot ? 0.95 : 0.55}
                  stroke={n.color}
                  strokeWidth={isPivot ? 2 : 1}
                />
                <text
                  y={-r - 4}
                  textAnchor="middle"
                  fill={isPivot ? "var(--ac)" : "var(--text)"}
                  style={{
                    font: "10px var(--mono)",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {n.scribe}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
        Drag to reposition · click to focus a neighborhood · double-click
        to open the scribe in <b>Scribe Comparison</b>.
      </div>
    </div>
  );
}
