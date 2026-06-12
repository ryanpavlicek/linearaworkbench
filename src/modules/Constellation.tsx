import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { correspondenceAnalysis } from "../lib/multivariate";

// Every text-bearing inscription in one picture: correspondence analysis
// of the inscription × top-vocabulary table, plotted as a starfield.
// Documents drift toward the words they use, so the libation corpus, the
// big ledgers, and the site idioms separate into visible regions — an
// overview to fly through before drilling into any one module. Documents
// with fewer than 3 word tokens (most nodules and roundels) carry too
// little vocabulary to place honestly and are counted, not plotted.

const SITE_COLORS = [
  "#5b9eff",
  "#ff8c42",
  "#3ecf8e",
  "#e05c84",
  "#b08bf5",
  "#e7c54b",
  "#46c3d6",
  "#a3a3a3",
];

export default function Constellation() {
  const scoped = useScopedCorpus();
  const showInscription = useWorkbench((s) => s.showInscription);
  const [hover, setHover] = useState<string | null>(null);

  const data = useMemo(() => {
    // Inscription rows with ≥3 word tokens; columns = top vocabulary.
    const rows: { id: string; site: string; words: string[] }[] = [];
    const wordTotals = new Map<string, number>();
    for (const ins of scoped.inscriptions) {
      const ws = ins.words.filter((w) => w.includes("-"));
      if (ws.length < 3) continue;
      rows.push({ id: ins.id, site: ins.site || "?", words: ws });
      for (const w of ws) wordTotals.set(w, (wordTotals.get(w) ?? 0) + 1);
    }
    const excluded = scoped.inscriptions.length - rows.length;
    // Top-80 / ≥4-attestation columns beat a looser cut in practice: a
    // wider vocabulary adds a few more plottable documents but dilutes
    // the leading axes' inertia by a third — structure over coverage.
    const cols = [...wordTotals.entries()]
      .filter(([, c]) => c >= 4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([w]) => w);
    if (rows.length < 10 || cols.length < 5)
      return { points: [], excluded, dropped: 0, inertia: [0, 0] as [number, number], sites: [] as string[] };
    const colIdx = new Map(cols.map((c, i) => [c, i]));
    // Keep only rows that use at least one of the column words.
    const usable = rows.filter((r) => r.words.some((w) => colIdx.has(w)));
    const counts = usable.map((r) => {
      const v = new Array<number>(cols.length).fill(0);
      for (const w of r.words) {
        const j = colIdx.get(w);
        if (j !== undefined) v[j]++;
      }
      return v;
    });
    const ca = correspondenceAnalysis(
      usable.map((r) => r.id),
      cols,
      counts,
    );
    if (!ca)
      return { points: [], excluded, dropped: 0, inertia: [0, 0] as [number, number], sites: [] as string[] };
    const siteList = [...new Set(usable.map((r) => r.site))].sort(
      (a, b) =>
        usable.filter((r) => r.site === b).length -
        usable.filter((r) => r.site === a).length,
    );
    const points = ca.rows.map((p, i) => ({
      id: usable[i].id,
      site: usable[i].site,
      x: p.x,
      y: p.y,
      tokens: usable[i].words.length,
    }));
    return {
      points,
      excluded,
      dropped: rows.length - usable.length,
      inertia: ca.inertia,
      sites: siteList,
    };
  }, [scoped.inscriptions]);

  const plot = useMemo(() => {
    if (data.points.length === 0) return null;
    const maxAbs = Math.max(
      0.05,
      ...data.points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))),
    );
    const W = 880;
    const H = 560;
    const PAD = 24;
    return {
      W,
      H,
      sx: (x: number) => W / 2 + (x / maxAbs) * (W / 2 - PAD),
      sy: (y: number) => H / 2 - (y / maxAbs) * (H / 2 - PAD),
    };
  }, [data.points]);

  const colorOf = (site: string) => {
    const i = data.sites.indexOf(site);
    return SITE_COLORS[i >= 0 ? i % SITE_COLORS.length : SITE_COLORS.length - 1];
  };

  return (
    <div className="panel" style={{ maxWidth: 1100 }}>
      <h2>Constellation</h2>
      <div className="callout">
        <h4>The whole written corpus in one sky</h4>
        <p>
          Correspondence analysis of the inscription × vocabulary table
          (the {data.points.length ? "top 80 words" : "top words"}, each
          attested 4+ times): documents drift toward the words they use,
          so neighborhoods are shared vocabulary — the libation formula
          texts cluster away from the ledgers, and site idioms form their
          own asterisms. Hover to identify a star; click to open the
          tablet. The axes carry{" "}
          {((data.inertia[0] + data.inertia[1]) * 100).toFixed(0)}% of the
          table's structure; documents under 3 word tokens (
          {data.excluded.toLocaleString()}, mostly nodules and roundels)
          can't be placed honestly and aren't plotted
          {data.dropped > 0
            ? `, and ${data.dropped} more share no top-vocabulary word`
            : ""}
          .
        </p>
      </div>

      {plot ? (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 6,
              fontSize: 11,
            }}
          >
            {data.sites.slice(0, 8).map((s) => (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: colorOf(s),
                    display: "inline-block",
                  }}
                />
                <span className="dim">{s}</span>
              </span>
            ))}
            {data.sites.length > 8 && (
              <span className="dim">+{data.sites.length - 8} more sites in gray</span>
            )}
          </div>
          <svg
            viewBox={`0 0 ${plot.W} ${plot.H}`}
            style={{
              width: "100%",
              height: "auto",
              background: "var(--surface-1)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
            role="img"
            aria-label="Correspondence-analysis map of all text-bearing inscriptions, colored by find-site"
          >
            {data.points.map((p) => (
              <circle
                key={p.id}
                cx={plot.sx(p.x)}
                cy={plot.sy(p.y)}
                r={hover === p.id ? 7 : 2.5 + Math.sqrt(p.tokens) * 0.7}
                fill={colorOf(p.site)}
                opacity={hover && hover !== p.id ? 0.35 : 0.8}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => showInscription(p.id)}
              >
                <title>{`${p.id} — ${p.site}, ${p.tokens} word tokens. Click to open.`}</title>
              </circle>
            ))}
            {hover && (
              <text
                x={12}
                y={22}
                fontSize={13}
                fill="var(--text)"
                fontFamily="var(--mono)"
              >
                {hover}
              </text>
            )}
          </svg>
        </>
      ) : (
        <div className="dim">
          Not enough text-bearing inscriptions in the current Scope to map.
        </div>
      )}
    </div>
  );
}
