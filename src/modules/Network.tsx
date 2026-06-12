import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { cooccurrencePairs } from "../lib/algorithms";
import { SaveFindingButton } from "../components/SaveFindingButton";

interface Node {
  word: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
  degree: number;
}
interface Edge {
  a: number;
  b: number;
  pmi: number;
  joint: number;
}

// Top-N word pairs by PMI (shared counting core in lib/algorithms).
function buildEdges(
  inscriptions: { words: string[] }[],
  minJoint: number,
  topN: number,
): { pairs: { a: string; b: string; pmi: number; joint: number }[] } {
  const pairs = cooccurrencePairs(inscriptions)
    .pairs.filter((p) => p.joint >= minJoint)
    .sort((x, y) => y.pmi - x.pmi)
    .slice(0, topN)
    .map(({ a, b, pmi, joint }) => ({ a, b, pmi, joint }));
  return { pairs };
}

const REPULSION = 1500;
const SPRING = 0.02;
const REST_LENGTH = 80;
const CENTER = 0.001;
const DAMPING = 0.85;

export default function Network() {
  const scoped = useScopedCorpus();
  const inscriptions = scoped.inscriptions;
  const showWord = useWorkbench((s) => s.showWord);
  const wordIndex = scoped.wordIndex;
  const [topN, setTopN] = useState(60);
  const [minJoint, setMinJoint] = useState(3);
  const [focusWord, setFocusWord] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const dragRef = useRef<{ node: Node; offsetX: number; offsetY: number } | null>(
    null,
  );
  // Bump on pair change or manual reload — forces React to re-execute the
  // SVG render after refs have been populated in the layout effect below.
  const [renderVersion, setRenderVersion] = useState(0);

  // Recompute graph data when filters change
  const { pairs } = useMemo(
    () => buildEdges(inscriptions, minJoint, topN),
    [inscriptions, minJoint, topN],
  );

  const stats = useMemo(() => {
    const words = new Set<string>();
    for (const p of pairs) {
      words.add(p.a);
      words.add(p.b);
    }
    return { nodeCount: words.size, edgeCount: pairs.length };
  }, [pairs]);

  const findingSummary =
    `Co-occurrence network: ${stats.nodeCount} nodes · ${stats.edgeCount} edges ` +
    `(top ${topN} pairs by PMI, min joint ${minJoint}).\nStrongest: ` +
    (pairs
      .slice(0, 6)
      .map((p) => `${p.a}+${p.b} (PMI ${p.pmi.toFixed(2)})`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [["word_a", "word_b", "pmi", "joint"]];
    for (const p of pairs) rows.push([p.a, p.b, p.pmi.toFixed(4), p.joint]);
    downloadFile(
      "linear_a_cooccurrence_network.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  // Initialize nodes whenever the pair set changes. The version bump
  // forces a single React re-render so the freshly populated refs are
  // actually drawn to the SVG.
  useLayoutEffect(() => {
    const wordSet = new Set<string>();
    for (const p of pairs) {
      wordSet.add(p.a);
      wordSet.add(p.b);
    }
    const nodes: Node[] = [...wordSet].map((w) => ({
      word: w,
      x: (Math.random() - 0.5) * 400,
      y: (Math.random() - 0.5) * 400,
      vx: 0,
      vy: 0,
      fixed: false,
      degree: 0,
    }));
    const idx = new Map(nodes.map((n, i) => [n.word, i]));
    const edges: Edge[] = pairs.map((p) => ({
      a: idx.get(p.a)!,
      b: idx.get(p.b)!,
      pmi: p.pmi,
      joint: p.joint,
    }));
    for (const e of edges) {
      nodes[e.a].degree++;
      nodes[e.b].degree++;
    }
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setRenderVersion((v) => v + 1);
  }, [pairs]);

  function reloadLayout() {
    // Re-randomize positions without changing the pair filters
    for (const n of nodesRef.current) {
      n.x = (Math.random() - 0.5) * 400;
      n.y = (Math.random() - 0.5) * 400;
      n.vx = 0;
      n.vy = 0;
      n.fixed = false;
    }
    setRenderVersion((v) => v + 1);
  }

  // Animation loop — uses refs so React state isn't bashed each frame.
  useEffect(() => {
    let raf = 0;
    let running = true;
    let renderTick = 0;
    function step() {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      if (!nodes.length) {
        raf = requestAnimationFrame(step);
        return;
      }
      // Repulsion (O(n²))
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
      // Spring along edges (weighted by PMI)
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const diff = d - REST_LENGTH;
        const w = Math.max(0.5, e.pmi);
        const fx = (dx / d) * diff * SPRING * w;
        const fy = (dy / d) * diff * SPRING * w;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      // Center + damping + integrate
      for (const n of nodes) {
        if (n.fixed) continue;
        n.vx -= n.x * CENTER;
        n.vy -= n.y * CENTER;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }
      // Render every other frame to lighten DOM work
      renderTick++;
      if (renderTick % 2 === 0) renderToDOM();
      if (running) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [pairs]);

  function renderToDOM() {
    const svg = svgRef.current;
    if (!svg) return;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const lineEls = svg.querySelectorAll<SVGLineElement>("line.edge");
    edges.forEach((e, i) => {
      const el = lineEls[i];
      if (!el) return;
      el.setAttribute("x1", String(nodes[e.a].x));
      el.setAttribute("y1", String(nodes[e.a].y));
      el.setAttribute("x2", String(nodes[e.b].x));
      el.setAttribute("y2", String(nodes[e.b].y));
    });
    const nodeEls = svg.querySelectorAll<SVGGElement>("g.node");
    nodes.forEach((n, i) => {
      const el = nodeEls[i];
      if (!el) return;
      el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
    });
  }

  // ---- Drag handlers --------------------------------------------------
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
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      dragRef.current.node.fixed = false;
      dragRef.current = null;
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }
  }

  const focusNeighbors = useMemo(() => {
    if (!focusWord) return new Set<string>();
    const set = new Set<string>([focusWord]);
    for (const p of pairs) {
      if (p.a === focusWord) set.add(p.b);
      if (p.b === focusWord) set.add(p.a);
    }
    return set;
  }, [focusWord, pairs]);

  const view = `${-400} ${-400} ${800} ${800}`;

  return (
    <div className="panel">
      <h2>Co-occurrence Network</h2>
      <div className="callout">
        <h4>Interactive force-directed graph</h4>
        <p>
          Each node is a multi-sign word; edges connect words that co-occur
          with high PMI. Drag any node to reposition it. Click a node to focus
          on its immediate neighborhood. Tighten the filters to reveal cleaner
          structure or pull more vocabulary into view.
        </p>
      </div>

      <div className="toolbar">
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          Top N edges by PMI
          <input
            type="number"
            className="input"
            value={topN}
            min={10}
            max={300}
            step={10}
            onChange={(e) => setTopN(+e.target.value || 60)}
            style={{ width: 80 }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          Min joint count
          <input
            type="number"
            className="input"
            value={minJoint}
            min={1}
            onChange={(e) => setMinJoint(+e.target.value || 1)}
            style={{ width: 60 }}
          />
        </label>
        <button
          className="btn btn-outline btn-sm"
          onClick={reloadLayout}
          title="Re-randomize node positions"
        >
          ↻ Reload layout
        </button>
        {focusWord && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setFocusWord(null)}
          >
            Clear focus
          </button>
        )}
        <span className="dim" style={{ marginLeft: "auto" }}>
          {stats.nodeCount} nodes · {stats.edgeCount} edges
        </span>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="network"
          moduleLabel="Co-occurrence Network"
          defaultTitle="Co-occurrence network"
          summary={findingSummary}
          payload={{ topN, minJoint }}
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
        {/* data-render ties this render to renderVersion: bumping it after
            the layout effect repopulates the refs forces the maps below to
            re-run against the fresh node/edge arrays. */}
        <svg
          ref={svgRef}
          data-render={renderVersion}
          viewBox={view}
          style={{ width: "100%", height: "70vh", display: "block" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="img"
          aria-label={`Force-directed co-occurrence network: ${stats.nodeCount} word nodes joined by ${stats.edgeCount} edges, edges weighted by PMI`}
        >
          {edgesRef.current.map((e, i) => {
            const a = nodesRef.current[e.a];
            const b = nodesRef.current[e.b];
            const dim =
              focusWord &&
              !focusNeighbors.has(a.word) &&
              !focusNeighbors.has(b.word);
            const strong =
              focusWord &&
              (a.word === focusWord || b.word === focusWord);
            return (
              <line
                key={i}
                className="edge"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={strong ? "var(--ac)" : "var(--border-strong)"}
                strokeWidth={Math.min(3, Math.max(0.5, e.pmi / 2))}
                strokeOpacity={dim ? 0.1 : 0.5}
              />
            );
          })}
          {nodesRef.current.map((n, i) => {
            const r = Math.min(16, 4 + Math.sqrt(n.degree) * 2);
            const inFocus = !focusWord || focusNeighbors.has(n.word);
            const isPivot = focusWord === n.word;
            const freq = wordIndex.get(n.word)?.count ?? 0;
            return (
              <g
                key={i}
                className="node"
                transform={`translate(${n.x}, ${n.y})`}
                style={{ cursor: "grab", opacity: inFocus ? 1 : 0.2 }}
                onPointerDown={(e) => onPointerDown(n, e)}
                onClick={(e) => {
                  if (dragRef.current) return;
                  // Click = focus; double-click = open word detail
                  if (e.detail === 2) showWord(n.word);
                  else setFocusWord(n.word === focusWord ? null : n.word);
                }}
              >
                <circle
                  r={r}
                  fill={isPivot ? "var(--ac)" : freq > 20 ? "var(--gn)" : "var(--pu)"}
                  stroke="var(--surface-0)"
                  strokeWidth={2}
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
                  {n.word}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
        Tip: drag to reposition, click to focus, double-click to open word detail.
      </div>
    </div>
  );
}
