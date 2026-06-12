import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { isScopeActive, scopeSummary, useScopedCorpus } from "../store/scope";
import { WordToken } from "../components/WordToken";
import { InscriptionLink } from "../components/InscriptionLink";
import { GlyphPalette } from "../components/GlyphPalette";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { csvEscape, downloadFile, MAX_ROWS } from "../lib/helpers";

export default function CorpusSearch() {
  // Scope-aware, like Corpus Browser — the two corpus surfaces must agree.
  const inscriptions = useScopedCorpus().inscriptions;
  const totalInscriptions = useWorkbench(
    (s) => s.corpus.inscriptions.length,
  );
  const scope = useWorkbench((s) => s.scope);

  const [q, setQ] = useState("");
  const [site, setSite] = useState("");
  const [type, setType] = useState("");
  const [scribe, setScribe] = useState("");
  const [period, setPeriod] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const sites = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.site).filter(Boolean))].sort(),
    [inscriptions],
  );
  const types = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.support).filter(Boolean))].sort(),
    [inscriptions],
  );
  const scribes = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.scribe).filter(Boolean))].sort(),
    [inscriptions],
  );
  const periods = useMemo(
    () =>
      [...new Set(inscriptions.map((i) => i.context).filter(Boolean))].sort(),
    [inscriptions],
  );

  const results = useMemo(() => {
    const upper = q.toUpperCase().trim();
    return inscriptions.filter((ins) => {
      if (
        upper &&
        !ins.id.toUpperCase().includes(upper) &&
        !ins.words.some((w) => w.toUpperCase().includes(upper))
      )
        return false;
      if (site && ins.site !== site) return false;
      if (type && ins.support !== type) return false;
      if (scribe && ins.scribe !== scribe) return false;
      if (period && ins.context !== period) return false;
      return true;
    });
  }, [inscriptions, q, site, type, scribe, period]);

  const filterDesc = [
    site && `site ${site}`,
    type && `support ${type}`,
    period && `period ${period}`,
    scribe && `scribe ${scribe}`,
  ]
    .filter(Boolean)
    .join(", ");
  const hasQuery = !!(q || filterDesc);
  const findingTitle = q
    ? `Search: ${q}`
    : filterDesc
      ? `Search: ${filterDesc}`
      : "Corpus search";
  const findingSummary =
    `Search${q ? ` “${q}”` : ""}${filterDesc ? ` (${filterDesc})` : ""}: ` +
    `${results.length} inscriptions.\n` +
    results.slice(0, 12).map((i) => i.id).join(", ") +
    (results.length > 12 ? ", …" : ".");

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["inscription", "site", "support", "period", "scribe", "text"],
    ];
    for (const ins of results) {
      rows.push([
        ins.id,
        ins.site,
        ins.support,
        ins.context,
        ins.scribe,
        ins.words.join(" "),
      ]);
    }
    downloadFile(
      "linear_a_search_results.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Corpus Search</h2>
      <p className="panel-desc">
        Search inscriptions by ID or word; filter by site and tablet support.
      </p>

      {isScopeActive(scope) && (
        <div
          className="dim"
          style={{
            fontSize: 11,
            marginBottom: 8,
            color: "var(--ac)",
          }}
        >
          ◆ Scope: {scopeSummary(scope)} — searching {inscriptions.length} of{" "}
          {totalInscriptions} inscriptions. Clear it in the top bar to search
          everything.
        </div>
      )}

      <div className="toolbar">
        <input
          className="input"
          placeholder="Search words or inscription IDs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setPaletteOpen(true)}
          title="Build a search query by clicking Linear A glyphs"
        >
          🔣 By glyph
        </button>
        <select
          className="select"
          value={site}
          onChange={(e) => setSite(e.target.value)}
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="select"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All supports</option>
          {types.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          title="Dating period (LM = Late Minoan, MM = Middle Minoan)"
        >
          <option value="">All periods</option>
          {periods.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          className="select"
          value={scribe}
          onChange={(e) => setScribe(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All scribes</option>
          {scribes.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="dim">{results.length} results</span>
        <button
          className="btn btn-outline btn-sm"
          onClick={exportCsv}
          disabled={results.length === 0}
        >
          Export CSV
        </button>
        <SaveFindingButton
          module="search"
          moduleLabel="Corpus Search"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ q, site, type, scribe, period }}
          disabled={!hasQuery}
        />
      </div>

      <GlyphPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        initialQuery={q}
        onPick={(query) => setQ(query)}
      />

      {results.length > MAX_ROWS ? (
        <div className="card">
          <div className="dim">
            {results.length} results — narrow your search to display them.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Site</th>
                <th>Support</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 200).map((ins) => (
                <tr key={ins.id}>
                  <td>
                    <InscriptionLink id={ins.id} />
                  </td>
                  <td className="site-text">{ins.site}</td>
                  <td className="dim">{ins.support}</td>
                  <td style={{ maxWidth: 600 }}>
                    {ins.words.map((w, i) => (
                      <WordToken key={i} word={w} highlight={q} />
                    ))}
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
