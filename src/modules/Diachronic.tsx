import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { isScopeActive, useScopedCorpus } from "../store/scope";
import { normalizeSignLabel, csvEscape, downloadFile } from "../lib/helpers";
import { WordToken } from "../components/WordToken";
import { Glyph } from "../components/Glyph";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

type Unit = "words" | "signs";

// Broad phase assignment from the dating context string.
function broadPhaseOf(context: string): "MM" | "LM" | null {
  if (/^MM/i.test(context)) return "MM";
  if (/^(LM|LB)/i.test(context)) return "LM";
  return null; // Geometric / unknown excluded
}

const isBroad = (sel: string) => sel === "MM" || sel === "LM";

// Does an inscription's context belong to the selected phase? A broad
// selection ("MM"/"LM") matches by prefix; a specific selection matches the
// exact finer code (e.g. "LMIB", "MMIIIA").
function matchesPhase(context: string, sel: string): boolean {
  if (!context) return false;
  return isBroad(sel) ? broadPhaseOf(context) === sel : context === sel;
}

function phaseLabel(sel: string): string {
  if (sel === "MM") return "Middle Minoan (MM)";
  if (sel === "LM") return "Late Minoan (LM)";
  return sel;
}

// Chronological ordering for phase codes: EM < MM < LM, then the finer
// code string (MMII < MMIII < MMIIIA…). Plain localeCompare would list LM
// before MM — backwards in time.
function phaseSortKey(context: string): string {
  const era = /^EM/i.test(context)
    ? "0"
    : /^MM/i.test(context)
      ? "1"
      : /^(LM|LB)/i.test(context)
        ? "2"
        : "3";
  return era + context;
}

interface PhaseProfile {
  tablets: number;
  wordFreq: Map<string, number>;
  signFreq: Map<string, number>;
  wordTokens: number;
  signTokens: number;
}

function emptyProfile(): PhaseProfile {
  return {
    tablets: 0,
    wordFreq: new Map(),
    signFreq: new Map(),
    wordTokens: 0,
    signTokens: 0,
  };
}

function addInscription(p: PhaseProfile, words: string[]) {
  p.tablets++;
  for (const w of words) {
    if (!w.includes("-")) continue;
    p.wordFreq.set(w, (p.wordFreq.get(w) ?? 0) + 1);
    p.wordTokens++;
    for (const sign of w.split("-")) {
      const s = normalizeSignLabel(sign);
      p.signFreq.set(s, (p.signFreq.get(s) ?? 0) + 1);
      p.signTokens++;
    }
  }
}

interface DistinctiveRow {
  item: string;
  aCount: number;
  bCount: number;
  logRatio: number; // log2( A relative freq / B relative freq ), +ve = A-leaning
}

export default function Diachronic() {
  const allInscriptions = useWorkbench((s) => s.corpus.inscriptions);
  const scopedInscriptions = useScopedCorpus().inscriptions;
  const scope = useWorkbench((s) => s.scope);
  const createCollectionWithItems = useWorkbench(
    (s) => s.createCollectionWithItems,
  );
  const setScope = useWorkbench((s) => s.setScope);
  const toast = useWorkbench((s) => s.toast_show);
  const [unit, setUnit] = useState<Unit>("words");
  const [phaseA, setPhaseA] = useState("MM");
  const [phaseB, setPhaseB] = useState("LM");
  // Off by default: comparing phases normally wants the whole corpus, and
  // "Use phase as scope" would otherwise feed the module its own output.
  // Turning it on enables conditioned diachrony ("Haghia Triada only:
  // MM vs LM").
  const [respectScope, setRespectScope] = useState(false);
  const inscriptions = respectScope ? scopedInscriptions : allInscriptions;

  // Materialize a phase's matching inscriptions as a temp collection and set
  // the global Scope to it — same pattern as Tablet Structure and Query
  // Builder. Works uniformly for broad ("MM"/"LM") and specific ("LMIB")
  // phase selections, since collection-based scoping bypasses the period
  // exact-match constraint of the scope schema.
  function adoptPhaseAsScope(phase: string, label: string) {
    const matching = inscriptions.filter((ins) =>
      matchesPhase(ins.context, phase),
    );
    if (matching.length === 0) {
      toast(`No tablets in ${label}`, "error");
      return;
    }
    const id = createCollectionWithItems(
      `Diachronic • ${label} (${matching.length})`,
      matching.map((i) => ({ kind: "inscription" as const, value: i.id })),
    );
    if (id) {
      setScope({
        site: null,
        period: null,
        scribe: null,
        support: null,
        collectionId: id,
      });
      toast(`Scope set to ${matching.length} ${label} tablets`);
    }
  }

  // Distinct finer phase codes present in the corpus, with tablet counts,
  // in chronological order (MM before LM).
  const phaseOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ins of inscriptions)
      if (ins.context) counts.set(ins.context, (counts.get(ins.context) ?? 0) + 1);
    return [...counts.entries()].sort((x, y) =>
      phaseSortKey(x[0]).localeCompare(phaseSortKey(y[0])),
    );
  }, [inscriptions]);

  const { a, b } = useMemo(() => {
    const a = emptyProfile();
    const b = emptyProfile();
    for (const ins of inscriptions) {
      if (matchesPhase(ins.context, phaseA)) addInscription(a, ins.words);
      else if (matchesPhase(ins.context, phaseB)) addInscription(b, ins.words);
    }
    return { a, b };
  }, [inscriptions, phaseA, phaseB]);

  const distinctive = useMemo<DistinctiveRow[]>(() => {
    const aFreq = unit === "words" ? a.wordFreq : a.signFreq;
    const bFreq = unit === "words" ? b.wordFreq : b.signFreq;
    const aTok = unit === "words" ? a.wordTokens : a.signTokens;
    const bTok = unit === "words" ? b.wordTokens : b.signTokens;
    const vocab = new Set<string>([...aFreq.keys(), ...bFreq.keys()]);
    const V = vocab.size;
    const rows: DistinctiveRow[] = [];
    for (const item of vocab) {
      const aC = aFreq.get(item) ?? 0;
      const bC = bFreq.get(item) ?? 0;
      const aRel = (aC + 1) / (aTok + V);
      const bRel = (bC + 1) / (bTok + V);
      rows.push({
        item,
        aCount: aC,
        bCount: bC,
        logRatio: Math.log2(aRel / bRel),
      });
    }
    return rows.filter((r) => r.aCount + r.bCount >= 2);
  }, [unit, a, b]);

  const aLeaning = useMemo(
    () => [...distinctive].sort((x, y) => y.logRatio - x.logRatio).slice(0, 25),
    [distinctive],
  );
  const bLeaning = useMemo(
    () => [...distinctive].sort((x, y) => x.logRatio - y.logRatio).slice(0, 25),
    [distinctive],
  );

  const jaccard = useMemo(() => {
    const x = unit === "words" ? a.wordFreq : a.signFreq;
    const y = unit === "words" ? b.wordFreq : b.signFreq;
    let inter = 0;
    for (const k of x.keys()) if (y.has(k)) inter++;
    const union = new Set([...x.keys(), ...y.keys()]).size;
    return union > 0 ? inter / union : 0;
  }, [unit, a, b]);

  const labelA = phaseLabel(phaseA);
  const labelB = phaseLabel(phaseB);
  const findingTitle = `Diachronic ${phaseA} vs ${phaseB} — ${unit}`;
  const findingSummary =
    `${labelA} vs ${labelB} by ${unit}. ${a.tablets} / ${b.tablets} tablets; ` +
    `${unit} overlap (Jaccard) ${(jaccard * 100).toFixed(1)}%.\n` +
    `${phaseA}-distinctive: ${
      aLeaning
        .slice(0, 5)
        .map((r) => r.item)
        .join(", ") || "none"
    }.\n${phaseB}-distinctive: ${
      bLeaning
        .slice(0, 5)
        .map((r) => r.item)
        .join(", ") || "none"
    }.`;

  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        unit === "words" ? "word" : "sign",
        `${phaseA}_count`,
        `${phaseB}_count`,
        `log2_ratio_${phaseA}_over_${phaseB}`,
      ],
    ];
    for (const r of [...distinctive].sort((x, y) => y.logRatio - x.logRatio)) {
      rows.push([r.item, r.aCount, r.bCount, r.logRatio.toFixed(3)]);
    }
    downloadFile(
      `linear_a_diachronic_${phaseA}_vs_${phaseB}_${unit}.csv`,
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  function renderItem(item: string) {
    if (unit === "words") return <WordToken word={item} />;
    return (
      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        <Glyph sign={item} size={16} />
        <b style={{ fontFamily: "var(--mono)" }}>{item}</b>
      </span>
    );
  }

  const PhaseSelect = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      className="select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ fontSize: 11, padding: "3px 6px" }}
    >
      <optgroup label="Broad phase">
        <option value="MM">Middle Minoan (all MM)</option>
        <option value="LM">Late Minoan (all LM)</option>
      </optgroup>
      <optgroup label="Specific phase">
        {phaseOptions.map(([ctx, n]) => (
          <option key={ctx} value={ctx}>
            {ctx} ({n})
          </option>
        ))}
      </optgroup>
    </select>
  );

  const lopsided = Math.max(a.tablets, b.tablets) > 10 * Math.min(a.tablets, b.tablets);

  return (
    <div className="panel">
      <h2>Diachronic Comparison</h2>
      <div className="callout">
        <h4>Compare any two dating phases</h4>
        <p>
          The corpus spans roughly 350 years, from Middle Minoan (MM) to
          Late Minoan (LM). Pick any two phases — the broad MM / LM buckets or
          two specific sub-phases (e.g. MM IIIA vs LM IB) — and this module
          surfaces the words and signs most distinctive to each via a log-ratio
          of relative frequency (add-one smoothed). Undated tablets are
          excluded.
        </p>
        {lopsided && (
          <p style={{ marginTop: 6, fontSize: 12 }}>
            <b>Caveat:</b> these two phases have a very lopsided sample (
            {a.tablets} vs {b.tablets} tablets), so the smaller side's
            distinctive items rest on few attestations — read them as
            suggestive, not conclusive.
          </p>
        )}
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <span
          className="dim"
          style={{ font: "600 9px var(--sans)", textTransform: "uppercase", letterSpacing: 0.6 }}
        >
          Compare
        </span>
        <PhaseSelect value={phaseA} onChange={setPhaseA} />
        <span className="dim">vs</span>
        <PhaseSelect value={phaseB} onChange={setPhaseB} />
        <span style={{ width: 12 }} />
        <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
          {(
            [
              ["words", "Words"],
              ["signs", "Signs"],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              className={`tab-btn${unit === k ? " active" : ""}`}
              onClick={() => setUnit(k)}
            >
              {lbl}
            </button>
          ))}
        </div>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Restrict the comparison to the global Scope (e.g. one site or support type). Off compares across the whole corpus."
        >
          <input
            type="checkbox"
            checked={respectScope}
            onChange={(e) => setRespectScope(e.target.checked)}
          />
          respect Scope
        </label>
        {isScopeActive(scope) && !respectScope && (
          <span className="dim" style={{ fontSize: 10 }}>
            (Scope active but ignored here)
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="diachronic"
          moduleLabel="Diachronic (MM/LM)"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ unit, phaseA, phaseB }}
          reportFn={() => {
            // Capture the distinctive table on both sides. We tile A-leaning
            // and B-leaning together so the finding tells the full story.
            const rows = [
              ...aLeaning.map((r) => ({ ...r, side: "a" as const })),
              ...bLeaning.map((r) => ({ ...r, side: "b" as const })),
            ];
            type Row = (typeof rows)[number];
            const cols: SnippetColumn<Row>[] = [
              {
                label: "Distinctive to",
                render: (r) =>
                  r.side === "a"
                    ? `<b style="color:#b45309;">${esc(phaseA)}</b>`
                    : `<b style="color:#1d4ed8;">${esc(phaseB)}</b>`,
              },
              {
                label: unit === "words" ? "Word" : "Sign",
                render: (r) =>
                  unit === "words"
                    ? `<code>${esc(r.item)}</code>`
                    : `<span style="font-family:ui-monospace,Menlo,monospace;">${esc(r.item)}</span>`,
              },
              {
                label: `${phaseA} count`,
                render: (r) => esc(r.aCount),
                align: "right",
              },
              {
                label: `${phaseB} count`,
                render: (r) => esc(r.bCount),
                align: "right",
              },
              {
                label: `log₂ ${phaseA}/${phaseB}`,
                render: (r) =>
                  `<span style="color:${r.logRatio > 0 ? "#b45309" : "#1d4ed8"};">${r.logRatio > 0 ? "+" : ""}${r.logRatio.toFixed(2)}</span>`,
                align: "right",
              },
            ];
            const meta = `${phaseLabel(phaseA)} vs ${phaseLabel(phaseB)} by ${unit}. ${a.tablets} / ${b.tablets} tablets · Jaccard overlap ${(jaccard * 100).toFixed(1)}%. Top 25 distinctive to each side.`;
            return {
              html: snippetWrap(meta, snippetTable(rows, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(rows, cols),
            };
          }}
        />
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val" style={{ color: "var(--am)" }}>
            {a.tablets.toLocaleString()}
          </span>
          <span className="lbl">{phaseA} tablets</span>
        </div>
        <div className="stat-box">
          <span className="val" style={{ color: "var(--ac)" }}>
            {b.tablets.toLocaleString()}
          </span>
          <span className="lbl">{phaseB} tablets</span>
        </div>
        <div className="stat-box">
          <span className="val">{(jaccard * 100).toFixed(1)}%</span>
          <span className="lbl">
            {unit === "words" ? "Word" : "Sign"} overlap (Jaccard)
          </span>
        </div>
        <div className="stat-box">
          <span className="val">{distinctive.length}</span>
          <span className="lbl">{unit} compared</span>
        </div>
      </div>

      {a.tablets === 0 || b.tablets === 0 ? (
        <div className="card">
          <div className="dim">
            One of the selected phases has no tablets — pick two phases that are
            both attested.
          </div>
        </div>
      ) : (
        <div className="col2">
          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h4 style={{ color: "var(--am)", margin: 0 }}>
                Distinctive to {phaseA}
              </h4>
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-outline btn-sm"
                onClick={() => adoptPhaseAsScope(phaseA, labelA)}
                title={`Use the ${a.tablets} ${phaseA} tablets as the global corpus scope — every other module will compute over just these`}
              >
                ◇ Use {phaseA} as scope
              </button>
            </div>
            <div className="sub" style={{ marginBottom: 8 }}>
              Highest {phaseA}/{phaseB} relative-frequency ratio. Counts shown{" "}
              {phaseA}/{phaseB}.
            </div>
            <DistinctiveList rows={aLeaning} renderItem={renderItem} side="a" />
          </div>
          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h4 style={{ color: "var(--ac)", margin: 0 }}>
                Distinctive to {phaseB}
              </h4>
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-outline btn-sm"
                onClick={() => adoptPhaseAsScope(phaseB, labelB)}
                title={`Use the ${b.tablets} ${phaseB} tablets as the global corpus scope — every other module will compute over just these`}
              >
                ◇ Use {phaseB} as scope
              </button>
            </div>
            <div className="sub" style={{ marginBottom: 8 }}>
              Highest {phaseB}/{phaseA} relative-frequency ratio. Counts shown{" "}
              {phaseA}/{phaseB}.
            </div>
            <DistinctiveList rows={bLeaning} renderItem={renderItem} side="b" />
          </div>
        </div>
      )}
    </div>
  );
}

function DistinctiveList({
  rows,
  renderItem,
  side,
}: {
  rows: DistinctiveRow[];
  renderItem: (item: string) => React.ReactNode;
  side: "a" | "b";
}) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      {rows.map((r) => (
        <div
          key={r.item}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
            alignItems: "center",
            fontSize: 11,
            padding: "1px 0",
          }}
        >
          <span>{renderItem(r.item)}</span>
          <span
            className="dim"
            style={{ fontFamily: "var(--mono)", fontSize: 10 }}
            title={`log2 A/B = ${r.logRatio.toFixed(2)}`}
          >
            {r.aCount}/{r.bCount}
            <span
              style={{
                marginLeft: 6,
                color: side === "a" ? "var(--am)" : "var(--ac)",
              }}
            >
              {r.logRatio > 0 ? "+" : ""}
              {r.logRatio.toFixed(1)}
            </span>
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <span className="dim">No items meet the minimum attestation.</span>
      )}
    </div>
  );
}
