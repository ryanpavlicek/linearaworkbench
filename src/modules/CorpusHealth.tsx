import { useMemo } from "react";
import { useWorkbench } from "../store/workbench";
import { csvEscape, downloadFile } from "../lib/helpers";
import { heuristicCategory } from "../lib/corpusExport";
import { useSort, SortHeader } from "../components/sort";

// The dataset's own condition, in one place: how much of the corpus
// carries scribe/period/findspot metadata, images, translations, damage —
// so any analysis elsewhere can be read against what's missing. Always
// corpus-wide (the point is the dataset, not the current Scope).

const DAMAGE_RE = /[[\]?]/;

export default function CorpusHealth() {
  const corpus = useWorkbench((s) => s.corpus);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);

  const health = useMemo(() => {
    const ins = corpus.inscriptions;
    const n = ins.length;
    let scribe = 0;
    let period = 0;
    let findspot = 0;
    let support = 0;
    let images = 0;
    let translated = 0;
    let classified = 0;
    let damagedTablets = 0;
    let damagedTokens = 0;
    let tokens = 0;
    let wordTokens = 0;
    const siteSet = new Set<string>();
    for (const i of ins) {
      if (i.site) siteSet.add(i.site);
      if (i.scribe) scribe++;
      if (i.context) period++;
      if (i.findspot) findspot++;
      if (i.support) support++;
      if (i.images.length > 0 || i.facsimileImages.length > 0) images++;
      if (i.translations.some((t, k) => t !== i.words[k])) translated++;
      if (heuristicCategory(i) !== "other") classified++;
      let tabletDamaged = false;
      for (const w of i.words) {
        tokens++;
        if (w.includes("-")) wordTokens++;
        if (DAMAGE_RE.test(w)) {
          damagedTokens++;
          tabletDamaged = true;
        }
      }
      if (tabletDamaged) damagedTablets++;
    }
    return {
      n,
      siteCount: siteSet.size,
      tokens,
      wordTokens,
      types: [...corpus.wordIndex.keys()].filter((w) => w.includes("-")).length,
      coverage: [
        { key: "scribe", label: "Scribal hand attributed", n: scribe, module: "scribes" as const },
        { key: "period", label: "Period dated (MM/LM)", n: period, module: "diachronic" as const },
        { key: "findspot", label: "Findspot recorded", n: findspot, module: "map" as const },
        { key: "support", label: "Support type recorded", n: support, module: "struct" as const },
        { key: "images", label: "Has photograph/facsimile", n: images, module: "browse" as const },
        { key: "translated", label: "Has editorial glosses", n: translated, module: "browse" as const },
        { key: "classified", label: "Auto-classified beyond 'other'", n: classified, module: "struct" as const },
      ],
      damagedTablets,
      damagedTokens,
    };
  }, [corpus]);

  const { sort, toggle, sortRows } = useSort("tablets", "desc");
  const siteRows = useMemo(() => {
    const ins = corpus.inscriptions;
    const sites = new Map<
      string,
      { tablets: number; scribe: number; period: number; image: number; words: number }
    >();
    for (const i of ins) {
      if (!i.site) continue;
      let s = sites.get(i.site);
      if (!s) {
        s = { tablets: 0, scribe: 0, period: 0, image: 0, words: 0 };
        sites.set(i.site, s);
      }
      s.tablets++;
      if (i.scribe) s.scribe++;
      if (i.context) s.period++;
      if (i.images.length > 0 || i.facsimileImages.length > 0) s.image++;
      s.words += i.words.filter((w) => w.includes("-")).length;
    }
    return [...sites.entries()].map(([site, s]) => ({
      site,
      tablets: s.tablets,
      scribePct: (100 * s.scribe) / s.tablets,
      periodPct: (100 * s.period) / s.tablets,
      imagePct: (100 * s.image) / s.tablets,
      wordTokens: s.words,
    }));
  }, [corpus]);

  const sorted = sortRows(siteRows, {
    site: (r) => r.site,
    tablets: (r) => r.tablets,
    scribe: (r) => r.scribePct,
    period: (r) => r.periodPct,
    image: (r) => r.imagePct,
    words: (r) => r.wordTokens,
  });

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["site", "tablets", "scribe_pct", "period_pct", "image_pct", "word_tokens"],
    ];
    for (const r of sorted)
      rows.push([
        r.site,
        r.tablets,
        r.scribePct.toFixed(1),
        r.periodPct.toFixed(1),
        r.imagePct.toFixed(1),
        r.wordTokens,
      ]);
    downloadFile(
      "linear_a_corpus_health_by_site.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  const pct = (k: number) => ((100 * k) / Math.max(1, health.n)).toFixed(0);

  return (
    <div className="panel">
      <h2>Corpus Health</h2>
      <div className="callout">
        <h4>What the dataset can and cannot support</h4>
        <p>
          Coverage and condition of the corpus itself — always corpus-wide,
          ignoring the Scope, because the point is the dataset every other
          module stands on. A scribe analysis is only as good as the share
          of tablets with an attributed hand; a diachronic claim only as
          good as the dated share. Missing metadata is mostly missing in
          the <em>sources</em> (GORILA's coverage varies by site), not lost
          in transcription.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{health.n.toLocaleString()}</span>
          <span className="lbl">Inscriptions</span>
        </div>
        <div className="stat-box">
          <span className="val">{health.siteCount}</span>
          <span className="lbl">Find-sites</span>
        </div>
        <div className="stat-box">
          <span className="val">{health.wordTokens.toLocaleString()}</span>
          <span className="lbl">Word tokens (multi-sign)</span>
        </div>
        <div className="stat-box">
          <span className="val">{health.types.toLocaleString()}</span>
          <span className="lbl">Distinct words</span>
        </div>
        <div
          className="stat-box"
          title={`${health.damagedTokens.toLocaleString()} tokens carry damage/uncertainty marks ([ ] ?) inherited from the source transcription`}
        >
          <span className="val">{pct(health.damagedTablets)}%</span>
          <span className="lbl">Tablets with damaged tokens</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Metadata coverage</h4>
        <div className="sub" style={{ marginBottom: 8 }}>
          Share of inscriptions carrying each kind of metadata. Click a row
          to open the module that uses it.
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {health.coverage.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveModule(c.module)}
              title={`${c.n.toLocaleString()} of ${health.n.toLocaleString()} inscriptions — open ${c.module}`}
              style={{
                display: "grid",
                gridTemplateColumns: "230px 1fr 90px",
                gap: 8,
                alignItems: "center",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
                color: "inherit",
              }}
            >
              <span className="dim" style={{ fontSize: 12 }}>
                {c.label}
              </span>
              <div
                style={{
                  height: 12,
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(100 * c.n) / Math.max(1, health.n)}%`,
                    background:
                      (100 * c.n) / Math.max(1, health.n) >= 50
                        ? "var(--gn)"
                        : "var(--am)",
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="numeral" style={{ fontSize: 12 }}>
                {c.n.toLocaleString()} · {pct(c.n)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4>
          Completeness by site{" "}
          <span className="dim">({siteRows.length} sites)</span>
        </h4>
        <div className="toolbar">
          <span style={{ flex: 1 }} />
          <button className="btn btn-outline btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <SortHeader label="Site" sortKey="site" sort={sort} onToggle={toggle} />
                <SortHeader label="Tablets" sortKey="tablets" sort={sort} onToggle={toggle} />
                <SortHeader label="Words" sortKey="words" sort={sort} onToggle={toggle} />
                <SortHeader label="Scribe %" sortKey="scribe" sort={sort} onToggle={toggle} />
                <SortHeader label="Period %" sortKey="period" sort={sort} onToggle={toggle} />
                <SortHeader label="Image %" sortKey="image" sort={sort} onToggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.site}>
                  <td>{r.site}</td>
                  <td className="numeral">{r.tablets}</td>
                  <td className="numeral">{r.wordTokens.toLocaleString()}</td>
                  <td className="numeral">{r.scribePct.toFixed(0)}%</td>
                  <td className="numeral">{r.periodPct.toFixed(0)}%</td>
                  <td className="numeral">{r.imagePct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
          Low coverage at a site usually reflects the publication record for
          that site, not a workbench gap — treat per-site analyses
          accordingly.
        </div>
      </div>
    </div>
  );
}
