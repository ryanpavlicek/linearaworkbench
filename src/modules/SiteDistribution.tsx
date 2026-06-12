import { Fragment, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import { siteSimilarities, siteWordSets } from "../lib/siteSimilarity";
import { useSort, SortHeader } from "../components/sort";
import { upgmaWithBootstrap } from "../lib/multivariate";
import { Dendrogram } from "../components/Dendrogram";

type Tab = "sites" | "jaccard" | "exclusive";

export default function SiteDistribution() {
  const scoped = useScopedCorpus();
  const wordIndex = scoped.wordIndex;
  const siteIndex = scoped.siteIndex;
  const initialIntent = useWorkbench.getState().moduleIntent;
  const initialTab: Tab =
    initialIntent?.tab === "jaccard"
      ? "jaccard"
      : initialIntent?.tab === "exclusive"
        ? "exclusive"
        : "sites";
  const [tab, setTab] = useState<Tab>(initialTab);

  const siteWords = useMemo(() => siteWordSets(wordIndex), [wordIndex]);

  // Average-linkage dendrogram over per-site word profiles (cosine
  // distance, token-weighted) with seeded bootstrap support. Sites under
  // 30 word tokens are left out — their profiles are too thin to cluster
  // honestly, and they'd attach essentially at random.
  const dendro = useMemo(() => {
    const tallies = new Map<string, Map<string, number>>();
    for (const ins of scoped.inscriptions) {
      if (!ins.site) continue;
      let m = tallies.get(ins.site);
      if (!m) {
        m = new Map();
        tallies.set(ins.site, m);
      }
      for (const w of ins.words) {
        if (!w.includes("-")) continue;
        m.set(w, (m.get(w) ?? 0) + 1);
      }
    }
    const items = [...tallies.entries()]
      .filter(([, m]) => {
        let t = 0;
        for (const c of m.values()) t += c;
        return t >= 30;
      })
      .map(([label, counts]) => ({ label, counts }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const excluded = tallies.size - items.length;
    const result = upgmaWithBootstrap(items, { iters: 100, seed: 42 });
    return result ? { result, excluded, included: items.length } : null;
  }, [scoped.inscriptions]);

  // Vocabulary diversity per site: Shannon entropy over the site's word-
  // token frequencies, normalized by log₂(types) to a 0–1 evenness. High =
  // varied vocabulary (many words, none dominating); low = a few formulas
  // repeated. Distinguishes archive sites from single-formula findspots
  // beyond what the raw unique-word count shows.
  const siteDiversity = useMemo(() => {
    const tallies = new Map<string, Map<string, number>>();
    for (const ins of scoped.inscriptions) {
      if (!ins.site) continue;
      let m = tallies.get(ins.site);
      if (!m) {
        m = new Map();
        tallies.set(ins.site, m);
      }
      for (const w of ins.words) {
        if (!w.includes("-")) continue;
        m.set(w, (m.get(w) ?? 0) + 1);
      }
    }
    const out = new Map<string, { h: number; evenness: number }>();
    for (const [site, m] of tallies) {
      let total = 0;
      for (const c of m.values()) total += c;
      if (total === 0 || m.size < 2) {
        out.set(site, { h: 0, evenness: 0 });
        continue;
      }
      let h = 0;
      for (const c of m.values()) {
        const p = c / total;
        h -= p * Math.log2(p);
      }
      out.set(site, { h, evenness: h / Math.log2(m.size) });
    }
    return out;
  }, [scoped.inscriptions]);

  const sortedSites = useMemo(
    () => [...siteIndex.entries()].sort((a, b) => b[1].count - a[1].count),
    [siteIndex],
  );

  const [showAllSites, setShowAllSites] = useState(false);
  const [openPair, setOpenPair] = useState<number | null>(null);
  const { sort, toggle, sortRows } = useSort("count", "desc");
  const topSites = sortRows(
    showAllSites ? sortedSites : sortedSites.slice(0, 24),
    {
      site: ([s]) => s,
      count: ([, d]) => d.count,
      words: ([s]) => siteWords.get(s)?.size ?? 0,
      diversity: ([s]) => siteDiversity.get(s)?.h ?? 0,
    },
  );
  const maxIns = sortedSites[0]?.[1].count ?? 1;

  // Shared-vocabulary Jaccard over the ten biggest sites — the same shared
  // implementation the Findspot Map's site-links arcs draw from.
  const jaccard = useMemo(
    () =>
      siteSimilarities(
        wordIndex,
        sortedSites.slice(0, 10).map(([s]) => s),
      ),
    [sortedSites, wordIndex],
  );

  const exclusive = useMemo(
    () =>
      [...wordIndex.entries()]
        .filter(([w, d]) => w.includes("-") && d.count >= 2 && d.sites.size === 1)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50),
    [wordIndex],
  );

  const findingTitle = `Site distribution — ${tab}`;
  const findingSummary =
    tab === "jaccard"
      ? `Inter-site lexical similarity (Jaccard) over the top sites.\nMost similar: ` +
        (jaccard
          .slice(0, 5)
          .map((j) => `${j.a}↔${j.b} ${(j.sim * 100).toFixed(1)}%`)
          .join(", ") || "none") +
        "."
      : tab === "exclusive"
        ? `${exclusive.length} words attested at only one site (count ≥2).\nTop: ` +
          (exclusive
            .slice(0, 6)
            .map(([w, d]) => `${w} (${d.count}, ${[...d.sites][0]})`)
            .join(", ") || "none") +
          "."
        : `${sortedSites.length} find-sites.\nLargest: ` +
          (sortedSites
            .slice(0, 6)
            .map(([s, d]) => `${s} (${d.count})`)
            .join(", ") || "none") +
          ".";

  function exportCsv() {
    let rows: (string | number)[][];
    let name: string;
    if (tab === "jaccard") {
      rows = [["site_a", "site_b", "jaccard", "shared_words"]];
      for (const j of jaccard)
        rows.push([j.a, j.b, `${(j.sim * 100).toFixed(2)}%`, j.shared]);
      name = "site_jaccard";
    } else if (tab === "exclusive") {
      rows = [["word", "count", "exclusive_to_site"]];
      for (const [w, d] of exclusive) rows.push([w, d.count, [...d.sites][0]]);
      name = "site_exclusive_words";
    } else {
      rows = [["site", "inscriptions", "unique_words"]];
      for (const [s, d] of sortedSites)
        rows.push([s, d.count, siteWords.get(s)?.size ?? 0]);
      name = "site_distribution";
    }
    downloadFile(
      `linear_a_${name}.csv`,
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Site Distribution</h2>
      <p className="panel-desc">
        Inscription counts by find-site, lexical overlap (Jaccard) between
        sites, and words attested at only a single site.
      </p>
      <div className="tab-row">
        <button
          className={`tab-btn${tab === "sites" ? " active" : ""}`}
          onClick={() => setTab("sites")}
        >
          Sites ({sortedSites.length})
        </button>
        <button
          className={`tab-btn${tab === "jaccard" ? " active" : ""}`}
          onClick={() => setTab("jaccard")}
        >
          Jaccard similarity
        </button>
        <button
          className={`tab-btn${tab === "exclusive" ? " active" : ""}`}
          onClick={() => setTab("exclusive")}
        >
          Site-exclusive words
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="geo"
          moduleLabel="Site Distribution"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ tab }}
          reportFn={() => {
            // Capture whatever the active tab is showing — sites table,
            // Jaccard pairs, or exclusive words.
            if (tab === "jaccard") {
              const slice = jaccard.slice(0, 50);
              const cols: SnippetColumn<(typeof slice)[number]>[] = [
                { label: "Site A", render: (j) => esc(j.a) },
                { label: "Site B", render: (j) => esc(j.b) },
                {
                  label: "Jaccard",
                  render: (j) => `<b>${(j.sim * 100).toFixed(1)}%</b>`,
                  align: "right",
                },
                { label: "Shared words", render: (j) => esc(j.shared), align: "right" },
              ];
              const meta = `Pairwise vocabulary Jaccard over the top 10 sites (${jaccard.length} pairs).`;
              return {
                html: snippetWrap(meta, snippetTable(slice, cols)),
                markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
              };
            }
            if (tab === "exclusive") {
              const cols: SnippetColumn<(typeof exclusive)[number]>[] = [
                { label: "Word", render: ([w]) => `<code>${esc(w)}</code>` },
                { label: "Count", render: ([, d]) => esc(d.count), align: "right" },
                {
                  label: "Site",
                  render: ([, d]) => esc([...d.sites][0] ?? ""),
                },
              ];
              const meta = `${exclusive.length} words attested at only one site (count ≥ 2).`;
              return {
                html: snippetWrap(meta, snippetTable(exclusive, cols)),
                markdown: `_${meta}_\n\n` + snippetTableMd(exclusive, cols),
              };
            }
            // Sites tab
            const cols: SnippetColumn<(typeof sortedSites)[number]>[] = [
              { label: "Site", render: ([s]) => `<b>${esc(s)}</b>` },
              {
                label: "Inscriptions",
                render: ([, d]) => esc(d.count),
                align: "right",
              },
              {
                label: "Unique words",
                render: ([s]) => esc(siteWords.get(s)?.size ?? 0),
                align: "right",
              },
            ];
            const meta = `${sortedSites.length} find-sites across the corpus.`;
            return {
              html: snippetWrap(meta, snippetTable(sortedSites, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(sortedSites, cols),
            };
          }}
        />
      </div>

      {tab === "sites" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader label="Site" sortKey="site" sort={sort} onToggle={toggle} />
                <SortHeader label="Inscriptions" sortKey="count" sort={sort} onToggle={toggle} />
                <SortHeader label="Unique words" sortKey="words" sort={sort} onToggle={toggle} />
                <SortHeader
                  label="Diversity H"
                  sortKey="diversity"
                  sort={sort}
                  onToggle={toggle}
                  title="Shannon entropy (bits) over the site's word-token frequencies; the parenthesized figure is evenness (H normalized by log₂ of the site's vocabulary). High = a varied working archive; low = a few formulas repeated."
                />
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {topSites.map(([s, d]) => {
                const wc = siteWords.get(s)?.size ?? 0;
                const pct = (d.count / maxIns) * 100;
                const div = siteDiversity.get(s);
                return (
                  <tr key={s}>
                    <td>
                      <b style={{ color: "var(--cy)" }}>{s}</b>
                    </td>
                    <td className="numeral">{d.count}</td>
                    <td className="dim">{wc}</td>
                    <td
                      className="dim"
                      title={
                        div && div.h > 0
                          ? `H = ${div.h.toFixed(2)} bits, evenness ${div.evenness.toFixed(2)}`
                          : "Fewer than two distinct words — diversity undefined"
                      }
                    >
                      {div && div.h > 0
                        ? `${div.h.toFixed(1)} (${div.evenness.toFixed(2)})`
                        : "—"}
                    </td>
                    <td>
                      <div
                        style={{
                          background: "var(--cy)",
                          height: 10,
                          width: `${pct}%`,
                          borderRadius: 1,
                          opacity: 0.55,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedSites.length > 24 && (
            <button
              className="btn btn-outline btn-sm"
              style={{ margin: "6px 4px" }}
              onClick={() => setShowAllSites((v) => !v)}
            >
              {showAllSites
                ? "Show top 24"
                : `Show all ${sortedSites.length} sites`}
            </button>
          )}
        </div>
      )}

      {tab === "jaccard" && (
        <div className="table-wrap">
          <div className="dim" style={{ fontSize: 11, margin: "4px 0 6px" }}>
            Click a pair to see the words the two sites share.
          </div>
          <table>
            <thead>
              <tr>
                <th>Site A</th>
                <th>Site B</th>
                <th>Jaccard</th>
                <th>Shared words</th>
              </tr>
            </thead>
            <tbody>
              {jaccard.slice(0, 30).map((j, i) => {
                const cls =
                  j.sim > 0.3 ? "score-hi" : j.sim > 0.15 ? "score-md" : "score-lo";
                const isOpen = openPair === i;
                const sharedWords = isOpen
                  ? [...(siteWords.get(j.a) ?? [])]
                      .filter((w) => siteWords.get(j.b)?.has(w))
                      .sort()
                  : [];
                return (
                  <Fragment key={i}>
                    <tr
                      style={{ cursor: "pointer" }}
                      onClick={() => setOpenPair(isOpen ? null : i)}
                      title="Click to list the shared vocabulary"
                    >
                      <td>
                        <span
                          style={{ marginRight: 6, color: "var(--text-muted)" }}
                        >
                          {isOpen ? "▾" : "▸"}
                        </span>
                        <b style={{ color: "var(--cy)" }}>{j.a}</b>
                      </td>
                      <td>
                        <b style={{ color: "var(--cy)" }}>{j.b}</b>
                      </td>
                      <td>
                        <span className={`score ${cls}`}>
                          {(j.sim * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="dim">{j.shared}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={4} style={{ padding: "6px 12px" }}>
                          {sharedWords.length > 0 ? (
                            <div style={{ lineHeight: 1.9 }}>
                              {sharedWords.map((w) => (
                                <span key={w} style={{ marginRight: 6 }}>
                                  <WordToken word={w} />
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="dim">
                              No shared multi-sign words.
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "exclusive" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Word</th>
                <th>Count</th>
                <th>Exclusive to</th>
              </tr>
            </thead>
            <tbody>
              {exclusive.map(([w, d]) => (
                <tr key={w}>
                  <td>
                    <WordToken word={w} />
                  </td>
                  <td className="numeral">{d.count}</td>
                  <td>
                    <b style={{ color: "var(--cy)" }}>{[...d.sites][0]}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dendro && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4>
            Site clustering — vocabulary-profile dendrogram{" "}
            <span className="dim">
              ({dendro.included} sites · 100 bootstrap replicates
              {dendro.excluded > 0
                ? ` · ${dendro.excluded} sites under 30 tokens left out`
                : ""}
              )
            </span>
          </h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            Average-linkage clustering of per-site word profiles (cosine
            distance, token-weighted). The number at each junction is{" "}
            <b>bootstrap support</b>: the share of 100 word-resampled
            replicates in which exactly that grouping reappears. A merge at
            60+ is a finding; a merge in dim gray under 50 is just where
            the algorithm had to put something — without the support
            numbers, every dendrogram looks equally confident, which is the
            usual way these figures mislead.
          </div>
          <Dendrogram result={dendro.result} />
        </div>
      )}
    </div>
  );
}
