import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { InscriptionLink } from "../components/InscriptionLink";
import { WordToken } from "../components/WordToken";

// The corpus on a date line. Dating is by the ceramic phase of each
// findspot context — it dates the DEPOSIT, not the act of writing — and
// the absolute years are the conventional Aegean chronology, which is
// genuinely debated (the LM IA / Thera-eruption problem can move dates
// by ~75 years). The strip uses the conventional middle-of-the-road
// ranges and says so.

interface PeriodMeta {
  key: string; // normalized context value
  label: string;
  from: number; // years BC (positive numbers)
  to: number;
  note: string;
}

// Conventional ceramic-phase ranges (approximate; low-vs-high chronology
// debated, esp. LM IA). Order = chronological.
const PERIODS: PeriodMeta[] = [
  { key: "MMIA", label: "MM IA", from: 2100, to: 1925, note: "Earliest palaces forming; writing emerging on Crete." },
  { key: "MMII", label: "MM II", from: 1875, to: 1750, note: "Protopalatial. The Phaistos tablet deposit — the oldest sizable Linear A archive." },
  { key: "MMIII", label: "MM III", from: 1750, to: 1700, note: "Transition after the old palaces' destruction." },
  { key: "MMIIIA", label: "MM IIIA", from: 1750, to: 1725, note: "Early Neopalatial transition." },
  { key: "MMIIIB", label: "MM IIIB", from: 1725, to: 1700, note: "Late Neopalatial transition." },
  { key: "LMI", label: "LM I", from: 1700, to: 1470, note: "Neopalatial — undivided LM I dating." },
  { key: "LMIA", label: "LM IA", from: 1700, to: 1625, note: "High Neopalatial; the Thera eruption falls in (or at the end of) this phase — its absolute date is the chronology debate." },
  { key: "LMIB", label: "LM IB", from: 1625, to: 1470, note: "The bulk of the corpus: the Haghia Triada archive and most site deposits, sealed by the LM IB destruction horizon." },
  { key: "LMIIIA", label: "LM IIIA", from: 1400, to: 1330, note: "After the script's administrative life — stragglers and heirlooms; Linear B now writes Greek at Knossos." },
  { key: "LBI", label: "LB I", from: 1700, to: 1470, note: "Late Bronze I, generic mainland-style dating." },
  { key: "Geometric", label: "Geometric", from: 900, to: 700, note: "Centuries after the script died — an heirloom or reused object in a much later context." },
];

const SPAN_FROM = 2150;
const SPAN_TO = 650;

export default function Timeline() {
  const scoped = useScopedCorpus();
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const setScope = useWorkbench((s) => s.setScope);
  const [selected, setSelected] = useState<string | null>(null);

  const byPeriod = useMemo(() => {
    const m = new Map<
      string,
      {
        count: number;
        sites: Map<string, number>;
        words: Map<string, number>;
        ids: string[];
      }
    >();
    let undated = 0;
    for (const ins of scoped.inscriptions) {
      const key = ins.context?.trim();
      if (!key) {
        undated++;
        continue;
      }
      let p = m.get(key);
      if (!p) {
        p = { count: 0, sites: new Map(), words: new Map(), ids: [] };
        m.set(key, p);
      }
      p.count++;
      if (ins.site) p.sites.set(ins.site, (p.sites.get(ins.site) ?? 0) + 1);
      if (p.ids.length < 20) p.ids.push(ins.id);
      for (const w of ins.words)
        if (w.includes("-")) p.words.set(w, (p.words.get(w) ?? 0) + 1);
    }
    return { m, undated };
  }, [scoped.inscriptions]);

  const bands = useMemo(() => {
    const W = 920;
    const H = 150;
    const x = (yearBC: number) =>
      ((SPAN_FROM - yearBC) / (SPAN_FROM - SPAN_TO)) * (W - 80) + 40;
    const maxCount = Math.max(
      1,
      ...PERIODS.map((p) => byPeriod.m.get(p.key)?.count ?? 0),
    );
    return {
      W,
      H,
      x,
      list: PERIODS.filter((p) => (byPeriod.m.get(p.key)?.count ?? 0) > 0).map(
        (p) => {
          const count = byPeriod.m.get(p.key)!.count;
          return {
            ...p,
            count,
            x1: x(p.from),
            x2: x(p.to),
            h: 14 + (Math.log(1 + count) / Math.log(1 + maxCount)) * 80,
          };
        },
      ),
    };
  }, [byPeriod]);

  const sel = selected ? byPeriod.m.get(selected) : null;
  const selMeta = selected ? PERIODS.find((p) => p.key === selected) : null;

  return (
    <div className="panel" style={{ maxWidth: 1100 }}>
      <h2>Timeline</h2>
      <div className="callout">
        <h4>When the corpus was written — as far as deposits can say</h4>
        <p>
          Each band is a ceramic phase; band height scales with how many
          inscriptions date to it (log scale — LM IB would otherwise erase
          everything else). Two honesty notes: dating is by the{" "}
          <em>deposit</em> an object was found in, not the act of writing;
          and the absolute years are the conventional chronology — the LM
          IA debate (the Thera eruption) can shift the Neopalatial dates by
          decades. {byPeriod.undated} inscriptions (~
          {Math.round((100 * byPeriod.undated) / Math.max(1, scoped.inscriptions.length))}
          %) have no dated context and aren't on the strip.
        </p>
      </div>

      <svg
        viewBox={`0 0 ${bands.W} ${bands.H + 40}`}
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label="Timeline of the corpus by ceramic phase, band height proportional to inscription count"
      >
        <line
          x1={20}
          y1={bands.H}
          x2={bands.W - 20}
          y2={bands.H}
          stroke="var(--border-strong)"
        />
        {[2100, 1900, 1700, 1500, 1300, 1100, 900, 700].map((y) => (
          <g key={y}>
            <line
              x1={bands.x(y)}
              y1={bands.H}
              x2={bands.x(y)}
              y2={bands.H + 5}
              stroke="var(--border-strong)"
            />
            <text
              x={bands.x(y)}
              y={bands.H + 18}
              fontSize={10}
              fill="var(--text-muted)"
              textAnchor="middle"
            >
              {y} BC
            </text>
          </g>
        ))}
        {bands.list.map((b) => (
          <g
            key={b.key}
            onClick={() => setSelected(b.key === selected ? null : b.key)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={Math.min(b.x1, b.x2)}
              y={bands.H - b.h}
              width={Math.max(4, Math.abs(b.x2 - b.x1))}
              height={b.h}
              fill={selected === b.key ? "var(--ac)" : "var(--ac)"}
              opacity={selected === b.key ? 0.75 : 0.35}
              stroke="var(--ac)"
            >
              <title>{`${b.label} (c. ${b.from}–${b.to} BC) — ${b.count} inscriptions. ${b.note}`}</title>
            </rect>
            <text
              x={(b.x1 + b.x2) / 2}
              y={bands.H - b.h - 4}
              fontSize={10}
              fill="var(--text)"
              textAnchor="middle"
            >
              {b.label} ({b.count})
            </text>
          </g>
        ))}
      </svg>

      {sel && selMeta ? (
        <div className="card" style={{ marginTop: 8 }}>
          <h4>
            {selMeta.label}{" "}
            <span className="dim">
              c. {selMeta.from}–{selMeta.to} BC · {sel.count} inscriptions
            </span>
          </h4>
          <p className="sub" style={{ marginBottom: 8 }}>
            {selMeta.note}
          </p>
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                setScope({
                  site: null,
                  period: selected,
                  scribe: null,
                  support: null,
                  collectionId: null,
                })
              }
              title="Set the global Scope to this period"
            >
              ◇ Use as Scope
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setActiveModule("diachronic")}
              title="Compare vocabulary between phases in the Diachronic module"
            >
              Diachronic →
            </button>
          </div>
          <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
            Sites:{" "}
            {[...sel.sites.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([s, n]) => `${s} (${n})`)
              .join(" · ")}
          </div>
          {sel.words.size > 0 && (
            <div style={{ marginBottom: 8 }}>
              {[...sel.words.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([w, c]) => (
                  <span key={w}>
                    <WordToken word={w} />
                    <span className="dim" style={{ fontSize: 10 }}>
                      ×{c}{" "}
                    </span>
                  </span>
                ))}
            </div>
          )}
          <div style={{ fontSize: 12 }}>
            {sel.ids.slice(0, 12).map((id) => (
              <span key={id} style={{ marginRight: 8 }}>
                <InscriptionLink id={id} />
              </span>
            ))}
            {sel.count > 12 && <span className="dim">+{sel.count - 12} more</span>}
          </div>
        </div>
      ) : (
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
          Click a band for that phase's sites, vocabulary, examples, and a
          one-click Scope.
        </div>
      )}
    </div>
  );
}
