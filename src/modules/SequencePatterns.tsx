import { useMemo, useState } from "react";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import { InscriptionLink } from "../components/InscriptionLink";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";

const IDEOS = new Set(["OLE", "GRA", "VIN", "FIC", "AES", "AUR", "ARG"]);
const NUM_RE = /^[0-9¹²³⁴⁵⁶⁷⁸⁹⁰⅟₁₂₃₄₅₆₇₈₉₀≈]+$/;

function tokenize(words: string[]): string {
  return words
    .map((w) => {
      if (w === "KU-RO") return "T";
      if (NUM_RE.test(w)) return "N";
      if (w === "𐄁") return "S";
      if (IDEOS.has(w)) return "I";
      return "W";
    })
    .join("");
}

const TOK_LABELS: Record<string, string> = {
  W: "WORD",
  N: "NUM",
  T: "TOTAL",
  I: "IDEO",
  S: "SEP",
};

type SortKey = "count" | "length" | "pattern";
type Contains = "any" | "N" | "T" | "I" | "S";
type LenFilter = "any" | "2" | "3" | "4" | "5" | "6";

const DISPLAY_CAP = 150;

export default function SequencePatterns() {
  const inscriptions = useScopedCorpus().inscriptions;
  const [minCount, setMinCount] = useState(3);
  const [lenFilter, setLenFilter] = useState<LenFilter>("any");
  const [contains, setContains] = useState<Contains>("any");
  const [sortKey, setSortKey] = useState<SortKey>("count");

  // All structural patterns (length 2–6) attested at least twice.
  const patterns = useMemo(() => {
    const map = new Map<string, { count: number; examples: string[] }>();
    for (const ins of inscriptions) {
      const tok = tokenize(ins.words);
      const max = Math.min(6, tok.length);
      for (let len = 2; len <= max; len++) {
        for (let i = 0; i <= tok.length - len; i++) {
          const sub = tok.slice(i, i + len);
          let p = map.get(sub);
          if (!p) {
            p = { count: 0, examples: [] };
            map.set(sub, p);
          }
          p.count++;
          if (p.examples.length < 3) p.examples.push(ins.id);
        }
      }
    }
    return [...map.entries()].filter(
      ([p, d]) => d.count >= 2 && p.length >= 2 && !/^W+$/.test(p),
    );
  }, [inscriptions]);

  const filtered = useMemo(() => {
    const rows = patterns.filter(([p, d]) => {
      if (d.count < minCount) return false;
      if (lenFilter !== "any" && p.length !== +lenFilter) return false;
      if (contains !== "any" && !p.includes(contains)) return false;
      return true;
    });
    rows.sort((a, b) => {
      if (sortKey === "length")
        return b[0].length - a[0].length || b[1].count - a[1].count;
      if (sortKey === "pattern") return a[0].localeCompare(b[0]);
      return b[1].count - a[1].count;
    });
    return rows;
  }, [patterns, minCount, lenFilter, contains, sortKey]);

  const display = filtered.slice(0, DISPLAY_CAP);

  const expand = (p: string) =>
    p
      .split("")
      .map((c) => TOK_LABELS[c] ?? c)
      .join("·");

  const filterDesc = [
    `≥${minCount}×`,
    lenFilter !== "any" && `length ${lenFilter}`,
    contains !== "any" && `contains ${TOK_LABELS[contains]}`,
  ]
    .filter(Boolean)
    .join(", ");
  const findingSummary =
    `${filtered.length} structural patterns (${filterDesc}).\n` +
    `Top: ` +
    (filtered
      .slice(0, 6)
      .map(([p, d]) => `${expand(p)} (${d.count}×)`)
      .join(", ") || "none") +
    ".";

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["pattern", "expanded", "count", "examples"],
    ];
    for (const [p, d] of filtered) {
      rows.push([p, expand(p), d.count, d.examples.join(";")]);
    }
    downloadFile(
      "linear_a_sequence_patterns.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  return (
    <div className="panel">
      <h2>Sequence Patterns</h2>
      <div className="callout">
        <h4>Structural template miner</h4>
        <p>
          Tokenizes each inscription into structural types:{" "}
          <span className="pat-tok pt-W">W</span> word{" "}
          <span className="pat-tok pt-N">N</span> number{" "}
          <span className="pat-tok pt-T">T</span> total (KU-RO){" "}
          <span className="pat-tok pt-I">I</span> ideogram{" "}
          <span className="pat-tok pt-S">S</span> separator. Filter by frequency,
          length, or a required token type.
        </p>
      </div>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Minimum number of attestations"
        >
          count ≥
          <input
            type="number"
            className="input"
            min={2}
            value={minCount}
            onChange={(e) => setMinCount(Math.max(2, +e.target.value || 2))}
            style={{ width: 56, fontSize: 11, padding: "3px 6px" }}
          />
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Pattern length (number of tokens)"
        >
          length
          <select
            className="select"
            value={lenFilter}
            onChange={(e) => setLenFilter(e.target.value as LenFilter)}
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="any">any</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Require a token type to be present"
        >
          contains
          <select
            className="select"
            value={contains}
            onChange={(e) => setContains(e.target.value as Contains)}
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="any">any</option>
            <option value="N">NUM</option>
            <option value="T">TOTAL</option>
            <option value="I">IDEO</option>
            <option value="S">SEP</option>
          </select>
        </label>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="Sort patterns"
        >
          sort
          <select
            className="select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="count">Count</option>
            <option value="length">Length</option>
            <option value="pattern">Pattern</option>
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="seqpat"
          moduleLabel="Sequence Patterns"
          defaultTitle="Sequence patterns"
          summary={findingSummary}
          payload={{ minCount, lenFilter, contains, sortKey }}
          reportFn={() => {
            const cap = 60;
            const slice = display.slice(0, cap).map(([p, d], i) => ({
              rank: i + 1,
              pattern: p,
              count: d.count,
              examples: d.examples,
            }));
            const tokColor: Record<string, string> = {
              W: "#1d4ed8",
              N: "#b45309",
              T: "#16a34a",
              I: "#6d28d9",
              S: "#6b7280",
            };
            type R = (typeof slice)[number];
            const cols: SnippetColumn<R>[] = [
              {
                label: "#",
                render: (r) => `<span style="color:#6b7280;">${r.rank}</span>`,
                align: "right",
              },
              {
                label: "Count",
                render: (r) => esc(r.count),
                align: "right",
              },
              {
                label: "Pattern",
                render: (r) =>
                  r.pattern
                    .split("")
                    .map(
                      (c) =>
                        `<span style="display:inline-block;padding:1px 5px;margin-right:3px;border-radius:3px;background:${tokColor[c] || "#9ca3af"}22;color:${tokColor[c] || "#374151"};font-family:ui-monospace,Menlo,monospace;font-size:10px;font-weight:600;">${esc(TOK_LABELS[c] ?? c)}</span>`,
                    )
                    .join(""),
                md: (r) => expand(r.pattern),
              },
              {
                label: "Example tablets",
                render: (r) =>
                  r.examples
                    .map(
                      (id) =>
                        `<code style="background:#f3f4f6;padding:1px 4px;border-radius:2px;margin-right:3px;">${esc(id)}</code>`,
                    )
                    .join(""),
                md: (r) => r.examples.join(", "),
              },
            ];
            const meta = `${filtered.length} structural patterns (${filterDesc}). Showing first ${slice.length}.`;
            const html = snippetWrap(meta, snippetTable(slice, cols));
            const markdown = `_${meta}_\n\n` + snippetTableMd(slice, cols);
            return { html, markdown };
          }}
        />
      </div>
      <div className="dim" style={{ fontSize: 11, margin: "6px 0" }}>
        {filtered.length} patterns
        {filtered.length > DISPLAY_CAP ? ` — showing first ${DISPLAY_CAP}` : ""}
      </div>
      <div>
        {display.map(([p, d]) => (
          <div key={p} className="match-row">
            <div className="numeral" style={{ minWidth: 50 }}>
              {d.count}×
            </div>
            <div style={{ minWidth: 200 }}>
              {p.split("").map((c, i) => (
                <span key={i} className={`pat-tok pt-${c}`}>
                  {TOK_LABELS[c] ?? c}
                </span>
              ))}
            </div>
            <div className="dim" style={{ flex: 1 }}>
              {d.examples.map((id, i) => (
                <span key={id}>
                  {i > 0 ? ", " : ""}
                  <InscriptionLink id={id} />
                </span>
              ))}
            </div>
          </div>
        ))}
        {display.length === 0 && (
          <p className="dim" style={{ padding: 12 }}>
            No patterns match these filters.
          </p>
        )}
      </div>
    </div>
  );
}
