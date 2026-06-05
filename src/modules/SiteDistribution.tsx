import { useMemo, useState } from "react";
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

  const siteWords = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [w, e] of wordIndex) {
      if (!w.includes("-")) continue;
      for (const s of e.sites) {
        let set = map.get(s);
        if (!set) {
          set = new Set();
          map.set(s, set);
        }
        set.add(w);
      }
    }
    return map;
  }, [wordIndex]);

  const sortedSites = useMemo(
    () => [...siteIndex.entries()].sort((a, b) => b[1].count - a[1].count),
    [siteIndex],
  );

  const topSites = sortedSites.slice(0, 24);
  const maxIns = topSites[0]?.[1].count ?? 1;

  const jaccard = useMemo(() => {
    const jSites = sortedSites.slice(0, 10).map(([s]) => s);
    const out: { a: string; b: string; sim: number; shared: number }[] = [];
    for (let i = 0; i < jSites.length; i++) {
      for (let j = i + 1; j < jSites.length; j++) {
        const a = siteWords.get(jSites[i]) ?? new Set();
        const b = siteWords.get(jSites[j]) ?? new Set();
        const inter = [...a].filter((w) => b.has(w)).length;
        const union = new Set([...a, ...b]).size;
        if (union > 0)
          out.push({ a: jSites[i], b: jSites[j], sim: inter / union, shared: inter });
      }
    }
    out.sort((x, y) => y.sim - x.sim);
    return out;
  }, [sortedSites, siteWords]);

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
                <th>Site</th>
                <th>Inscriptions</th>
                <th>Unique words</th>
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {topSites.map(([s, d]) => {
                const wc = siteWords.get(s)?.size ?? 0;
                const pct = (d.count / maxIns) * 100;
                return (
                  <tr key={s}>
                    <td>
                      <b style={{ color: "var(--cy)" }}>{s}</b>
                    </td>
                    <td className="numeral">{d.count}</td>
                    <td className="dim">{wc}</td>
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
        </div>
      )}

      {tab === "jaccard" && (
        <div className="table-wrap">
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
                return (
                  <tr key={i}>
                    <td>
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
    </div>
  );
}
