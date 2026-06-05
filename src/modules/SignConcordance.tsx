import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile, siglaSignListUrl } from "../lib/helpers";
import { PHONETIC_MAP } from "../data/phoneticMap";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { useSort, SortHeader } from "../components/sort";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

interface SignStat {
  count: number;
  initial: number;
  medial: number;
  final: number;
  words: Set<string>;
}

export default function SignConcordance() {
  const wordIndex = useScopedCorpus().wordIndex;
  const [q, setQ] = useState("");
  const [minCount, setMinCount] = useState(1);
  const [abOnly, setAbOnly] = useState(false);
  const { sort, toggle, sortRows } = useSort("total", "desc");

  const signs = useMemo(() => {
    const map = new Map<string, SignStat>();
    for (const [w, e] of wordIndex) {
      if (!w.includes("-")) continue;
      const parts = w.split("-");
      parts.forEach((s, i) => {
        let stat = map.get(s);
        if (!stat) {
          stat = {
            count: 0,
            initial: 0,
            medial: 0,
            final: 0,
            words: new Set(),
          };
          map.set(s, stat);
        }
        stat.count += e.count;
        stat.words.add(w);
        if (parts.length === 1) {
          stat.initial += e.count;
          stat.final += e.count;
        } else if (i === 0) stat.initial += e.count;
        else if (i === parts.length - 1) stat.final += e.count;
        else stat.medial += e.count;
      });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [wordIndex]);

  const filtered = useMemo(() => {
    const u = q.toUpperCase();
    return signs.filter(([s, d]) => {
      if (u && !s.toUpperCase().includes(u)) return false;
      if (d.count < minCount) return false;
      if (abOnly && !PHONETIC_MAP[s.replace(/[₂₃₄*]/g, "")]) return false;
      return true;
    });
  }, [signs, q, minCount, abOnly]);

  const sorted = sortRows(filtered, {
    sign: ([s]) => s,
    total: ([, d]) => d.count,
    words: ([, d]) => d.words.size,
    initial: ([, d]) => d.initial,
    medial: ([, d]) => d.medial,
    final: ([, d]) => d.final,
  });

  const high = signs.filter(([, d]) => d.count >= 10).length;
  const single = signs.filter(([, d]) => d.words.size === 1).length;

  const findingTitle = q ? `Sign concordance — “${q}”` : "Sign concordance";
  const findingSummary =
    `${signs.length} unique signs · ${high} with frequency ≥10 · ${single} single-word signs.\n` +
    `Most frequent: ` +
    (signs
      .slice(0, 8)
      .map(([s, d]) => `${s} (${d.count})`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["sign", "phonetic", "total", "distinct_words", "initial", "medial", "final"],
    ];
    for (const [s, d] of signs) {
      rows.push([
        s,
        PHONETIC_MAP[s.replace(/[₂₃₄*]/g, "")] ?? "",
        d.count,
        d.words.size,
        d.initial,
        d.medial,
        d.final,
      ]);
    }
    downloadFile(
      "linear_a_sign_concordance.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Sign Concordance</h2>
      <p className="panel-desc">
        Sign inventory with positional statistics — initial, medial, final
        attestations across multi-sign words.
      </p>
      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{signs.length}</span>
          <span className="lbl">Unique signs</span>
        </div>
        <div className="stat-box">
          <span className="val">{high}</span>
          <span className="lbl">Freq ≥10</span>
        </div>
        <div className="stat-box">
          <span className="val">{single}</span>
          <span className="lbl">Single-word signs</span>
        </div>
      </div>
      <div className="toolbar">
        <input
          className="input"
          placeholder="Filter signs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum total attestations"
        >
          count ≥
          <input
            type="number"
            className="input"
            min={1}
            value={minCount}
            onChange={(e) => setMinCount(Math.max(1, +e.target.value || 1))}
            style={{ width: 56, fontSize: 11, padding: "3px 6px" }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Only signs with a Linear B (AB-shared) value"
        >
          <input
            type="checkbox"
            checked={abOnly}
            onChange={(e) => setAbOnly(e.target.checked)}
          />
          AB-shared
        </label>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="signs"
          moduleLabel="Sign Concordance"
          defaultTitle={findingTitle}
          summary={findingSummary}
          payload={{ q }}
          reportFn={() => {
            const cap = 100;
            const slice = sorted.slice(0, cap);
            const cols: SnippetColumn<(typeof slice)[number]>[] = [
              { label: "Sign", render: ([s]) => `<b>${esc(s)}</b>` },
              {
                label: "Phonetic",
                render: ([s]) => {
                  const p = PHONETIC_MAP[s.replace(/[₂₃₄*]/g, "")];
                  return p ? `<span style="color:#16a34a;">/${esc(p)}/</span>` : "—";
                },
              },
              { label: "Total", render: ([, d]) => esc(d.count), align: "right" },
              { label: "Words", render: ([, d]) => esc(d.words.size), align: "right" },
              { label: "Initial", render: ([, d]) => esc(d.initial), align: "right" },
              { label: "Medial", render: ([, d]) => esc(d.medial), align: "right" },
              { label: "Final", render: ([, d]) => esc(d.final), align: "right" },
            ];
            const meta = `${filtered.length} of ${signs.length} signs${q ? ` matching "${q}"` : ""}${abOnly ? " · AB-shared only" : ""}${minCount > 1 ? ` · count ≥ ${minCount}` : ""}. ${slice.length < filtered.length ? `Showing top ${cap}.` : ""}`;
            return {
              html: snippetWrap(meta, snippetTable(slice, cols)),
              markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
            };
          }}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortHeader label="Sign" sortKey="sign" sort={sort} onToggle={toggle} />
              <th>Phonetic</th>
              <SortHeader label="Total" sortKey="total" sort={sort} onToggle={toggle} />
              <SortHeader label="Words" sortKey="words" sort={sort} onToggle={toggle} />
              <SortHeader label="Initial" sortKey="initial" sort={sort} onToggle={toggle} />
              <SortHeader label="Medial" sortKey="medial" sort={sort} onToggle={toggle} />
              <SortHeader label="Final" sortKey="final" sort={sort} onToggle={toggle} />
              <th>Position</th>
              <th style={{ width: 1 }}>Paleography</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([s, d]) => {
              const t = d.initial + d.medial + d.final;
              const pi = t ? (d.initial / t) * 100 : 0;
              const pm = t ? (d.medial / t) * 100 : 0;
              const pf = t ? (d.final / t) * 100 : 0;
              const phon = PHONETIC_MAP[s.replace(/[₂₃₄*]/g, "")];
              return (
                <tr key={s}>
                  <td>
                    <b style={{ color: "var(--ac)" }}>{s}</b>
                  </td>
                  <td className="dim">{phon || "?"}</td>
                  <td className="numeral">{d.count}</td>
                  <td className="dim">{d.words.size}</td>
                  <td className="dim">{d.initial}</td>
                  <td className="dim">{d.medial}</td>
                  <td className="dim">{d.final}</td>
                  <td>
                    <div className="pos-bar" style={{ width: 80 }}>
                      <div className="pos-first" style={{ width: `${pi}%` }} />
                      <div className="pos-mid" style={{ width: `${pm}%` }} />
                      <div className="pos-last" style={{ width: `${pf}%` }} />
                    </div>
                  </td>
                  <td>
                    <a
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10, whiteSpace: "nowrap" }}
                      href={siglaSignListUrl(s)}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open SigLA's sign list and scroll to ${s} — per-scribe variant drawings`}
                    >
                      ↗ SigLA
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
