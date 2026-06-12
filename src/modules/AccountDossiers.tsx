import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { csvEscape, downloadFile } from "../lib/helpers";
import {
  DEFICIT_MARKERS,
  GRAND_TOTAL_MARKERS,
  TOTAL_MARKERS,
  lineValue,
  parseValue,
} from "../lib/numerals";
import { commodityHead, isUndecipheredLogogram } from "../data/commodities";
import { isLexicalWord } from "../data/commodities";
import { InscriptionLink } from "../components/InscriptionLink";
import { WordToken } from "../components/WordToken";
import { SaveFindingButton } from "../components/SaveFindingButton";

// Follow a candidate account-holder through the archive. A "dossier" is
// every counted entry a word heads: lines where the word is the first
// lexical token and a quantity follows. That's the ledger pattern —
// name, commodity, number — so the dossier reads like the person's (or
// place's, or institution's) file: entries, quantities, commodities,
// the tablets, and who else is listed alongside.

interface Entry {
  insId: string;
  site: string;
  lineTokens: string[];
  value: number;
  commodity: string | null;
}

interface Dossier {
  word: string;
  entries: Entry[];
  totalValue: number;
  commodities: Map<string, number>;
  sites: Map<string, number>;
  tablets: Set<string>;
  coListed: Map<string, number>;
}

export default function AccountDossiers() {
  const scoped = useScopedCorpus();
  const showWord = useWorkbench((s) => s.showWord);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const initialIntent = useWorkbench.getState().moduleIntent;
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(
    initialIntent?.focus?.toUpperCase().trim() || null,
  );

  const dossiers = useMemo(() => {
    const m = new Map<string, Dossier>();
    // Heads-per-tablet, to build the co-listed map afterwards.
    const headsByTablet = new Map<string, Set<string>>();
    for (const ins of scoped.inscriptions) {
      for (const line of ins.lines) {
        // Head = the first lexical word on the line; counted = the line
        // carries a real quantity after it. Total/grand-total/deficit
        // lines are skipped: KU-RO, PO-TO-KU-RO, and KI-RO are accounting
        // operators, not account holders.
        const head = line.find((t) => isLexicalWord(t));
        if (!head) continue;
        if (
          TOTAL_MARKERS.has(head) ||
          GRAND_TOTAL_MARKERS.has(head) ||
          DEFICIT_MARKERS.has(head)
        )
          continue;
        const headIdx = line.indexOf(head);
        const after = line.slice(headIdx + 1);
        const value = lineValue(after);
        const hasQuantity = after.some((t) => parseValue(t) !== null);
        if (!hasQuantity) continue;
        const com =
          after.map((t) => commodityHead(t) ?? (isUndecipheredLogogram(t) ? t : null)).find(Boolean) ?? null;
        let d = m.get(head);
        if (!d) {
          d = {
            word: head,
            entries: [],
            totalValue: 0,
            commodities: new Map(),
            sites: new Map(),
            tablets: new Set(),
            coListed: new Map(),
          };
          m.set(head, d);
        }
        d.entries.push({
          insId: ins.id,
          site: ins.site,
          lineTokens: line,
          value,
          commodity: com,
        });
        d.totalValue += value;
        if (com) d.commodities.set(com, (d.commodities.get(com) ?? 0) + 1);
        if (ins.site) d.sites.set(ins.site, (d.sites.get(ins.site) ?? 0) + 1);
        d.tablets.add(ins.id);
        let hb = headsByTablet.get(ins.id);
        if (!hb) {
          hb = new Set();
          headsByTablet.set(ins.id, hb);
        }
        hb.add(head);
      }
    }
    // Co-listed: other entry heads on the same tablets.
    for (const heads of headsByTablet.values()) {
      for (const a of heads)
        for (const b of heads) {
          if (a === b) continue;
          const d = m.get(a)!;
          d.coListed.set(b, (d.coListed.get(b) ?? 0) + 1);
        }
    }
    return [...m.values()].sort(
      (a, b) => b.entries.length - a.entries.length || a.word.localeCompare(b.word),
    );
  }, [scoped.inscriptions]);

  const filtered = useMemo(() => {
    const u = q.toUpperCase();
    return dossiers.filter((d) => !u || d.word.includes(u));
  }, [dossiers, q]);

  const sel = selected ? dossiers.find((d) => d.word === selected) : null;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["word", "entries", "tablets", "total_quantity", "commodities", "sites"],
    ];
    for (const d of dossiers)
      rows.push([
        d.word,
        d.entries.length,
        d.tablets.size,
        d.totalValue.toFixed(3),
        [...d.commodities.keys()].join(" "),
        [...d.sites.keys()].join(" / "),
      ]);
    downloadFile(
      "linear_a_account_dossiers.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  const findingSummary = sel
    ? `Dossier ${sel.word}: ${sel.entries.length} counted entries on ${sel.tablets.size} tablets · total quantity ${sel.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} · commodities ${[...sel.commodities.keys()].join(", ") || "—"} · sites ${[...sel.sites.keys()].join(", ")}.`
    : `${dossiers.length} entry-heading words; top: ` +
      dossiers
        .slice(0, 6)
        .map((d) => `${d.word} (${d.entries.length})`)
        .join(", ") +
      ".";

  return (
    <div className="panel">
      <h2>Account Dossiers</h2>
      <div className="callout">
        <h4>Follow a name through the archive</h4>
        <p>
          Every line where a word heads a counted entry — the ledger
          pattern of <i>name · commodity · quantity</i> — gathered into one
          file per word: entries, quantities, commodities, tablets, and who
          else is listed alongside. "Account holder" is the working
          hypothesis, not a fact: an entry head can be a person, a place,
          an institution, or a transaction term. The dossier shows the
          evidence either way; total lines (KU-RO) are excluded.
        </p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Filter words…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 140 }}
        />
        <span className="dim" style={{ fontSize: 12 }}>
          {filtered.length} entry-heading words
        </span>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
        <SaveFindingButton
          module="dossiers"
          moduleLabel="Account Dossiers"
          defaultTitle={sel ? `Dossier — ${sel.word}` : "Account dossiers"}
          summary={findingSummary}
          payload={selected ? { word: selected } : undefined}
        />
      </div>

      <div className="col2">
        <div className="table-wrap" style={{ maxHeight: 560, overflowY: "auto" }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Word</th>
                <th style={{ textAlign: "right" }}>Entries</th>
                <th style={{ textAlign: "right" }}>Tablets</th>
                <th style={{ textAlign: "right" }} title="Sum of the parsed quantities across all entries (mixed units — see the Methodology caveats on Linear A metrology)">
                  Σ qty
                </th>
                <th>Commodities</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((d) => (
                <tr
                  key={d.word}
                  onClick={() => setSelected(d.word === selected ? null : d.word)}
                  style={{
                    cursor: "pointer",
                    background: selected === d.word ? "var(--surface-1)" : undefined,
                  }}
                >
                  <td style={{ fontFamily: "var(--mono)" }}>
                    <b>{d.word}</b>
                  </td>
                  <td className="numeral">{d.entries.length}</td>
                  <td className="numeral">{d.tablets.size}</td>
                  <td className="numeral">
                    {d.totalValue.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td className="dim" style={{ fontSize: 11 }}>
                    {[...d.commodities.keys()].slice(0, 3).join(" ")}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="dim" style={{ padding: 12 }}>
                    No entry-heading words match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          {sel ? (
            <div className="card">
              <h4 style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)" }}>{sel.word}</span>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: 10, padding: "1px 6px" }}
                  onClick={() => showWord(sel.word)}
                >
                  Word detail
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: 10, padding: "1px 6px" }}
                  onClick={() => setActiveModule("kwic", { focus: sel.word })}
                  title="Every occurrence in context"
                >
                  KWIC →
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: 10, padding: "1px 6px" }}
                  onClick={() =>
                    setActiveModule("onomastics", { focus: sel.word })
                  }
                  title="Is it a plausible personal name? See the Name Candidates verdict"
                >
                  Name? →
                </button>
              </h4>
              <div className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
                {sel.entries.length} entries · {sel.tablets.size} tablets · Σ
                qty{" "}
                {sel.totalValue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                ·{" "}
                {[...sel.sites.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([s, n]) => `${s} ${n}`)
                  .join(" · ")}
              </div>

              {sel.coListed.size > 0 && (
                <>
                  <div
                    style={{
                      font: "600 10px var(--sans)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      marginBottom: 4,
                    }}
                  >
                    Listed alongside (shared tablets)
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    {[...sel.coListed.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 12)
                      .map(([w, n]) => (
                        <span key={w}>
                          <WordToken word={w} />
                          <span className="dim" style={{ fontSize: 10 }}>
                            ×{n}{" "}
                          </span>
                        </span>
                      ))}
                  </div>
                </>
              )}

              <div
                style={{
                  font: "600 10px var(--sans)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 4,
                }}
              >
                Entries
              </div>
              <div style={{ display: "grid", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                {sel.entries.map((e, i) => (
                  <div
                    key={`${e.insId}-${i}`}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "baseline",
                      fontSize: 11,
                      flexWrap: "wrap",
                    }}
                  >
                    <InscriptionLink id={e.insId} />
                    <span
                      style={{ fontFamily: "var(--mono)", color: "var(--text-dim)" }}
                    >
                      {e.lineTokens.join(" ")}
                    </span>
                    {e.value > 0 && (
                      <span className="numeral" style={{ whiteSpace: "nowrap" }}>
                        = {e.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="dim">
                Select a word to open its dossier: all counted entries it
                heads, total quantities, commodity mix, the tablets, and
                the words listed alongside it. High-entry words recurring
                across tablets with varied commodities are the strongest
                account-holder candidates.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
