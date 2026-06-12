import type { DendroResult } from "../lib/multivariate";

// SVG dendrogram for an UPGMA result, with bootstrap support printed at
// each internal node. Support below 50% renders dimmed — those merges
// are arrangement, not signal, and the display should say so.
export function Dendrogram({
  result,
  width = 560,
}: {
  result: DendroResult;
  width?: number;
}) {
  const n = result.labels.length;
  const leafGap = 22;
  const H = n * leafGap + 30;
  const labelW = 150;
  const plotW = width - labelW - 20;
  const maxH = Math.max(...result.merges.map((m) => m.height), 0.001);
  const xOf = (h: number) => 10 + (1 - h / maxH) * plotW;

  // Leaf y positions follow the computed display order.
  const leafY = new Map<string, number>();
  result.order.forEach((label, i) => leafY.set(label, 20 + i * leafGap));

  // Each cluster id (leaf or merge) gets an (x, y) anchor.
  const anchor = new Map<number, { x: number; y: number }>();
  result.labels.forEach((label, i) =>
    anchor.set(i, { x: xOf(0), y: leafY.get(label)! }),
  );
  const shapes: JSX.Element[] = [];
  result.merges.forEach((m, k) => {
    const a = anchor.get(m.a)!;
    const b = anchor.get(m.b)!;
    const x = xOf(m.height);
    const y = (a.y + b.y) / 2;
    anchor.set(n + k, { x, y });
    const strong = m.support >= 0.5;
    shapes.push(
      <g key={k} stroke={strong ? "var(--text-dim)" : "var(--border-strong)"}>
        <line x1={a.x} y1={a.y} x2={x} y2={a.y} />
        <line x1={b.x} y1={b.y} x2={x} y2={b.y} />
        <line x1={x} y1={a.y} x2={x} y2={b.y} />
        {m.members.length < n && (
          <text
            x={x - 3}
            y={y + 3}
            fontSize={9}
            textAnchor="end"
            stroke="none"
            fill={strong ? "var(--gn)" : "var(--text-muted)"}
          >
            <title>{`{${m.members.join(", ")}} — recovered in ${(m.support * 100).toFixed(0)}% of bootstrap replicates (cosine distance over word profiles, features resampled)`}</title>
            {(m.support * 100).toFixed(0)}
          </text>
        )}
      </g>,
    );
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${H}`}
      style={{ width: "100%", height: "auto", maxWidth: width + 60 }}
      role="img"
      aria-label="Average-linkage dendrogram with bootstrap support percentages at each internal node"
    >
      {shapes}
      {result.order.map((label) => (
        <text
          key={label}
          x={xOf(0) + 6}
          y={leafY.get(label)! + 3}
          fontSize={11}
          fill="var(--text)"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
