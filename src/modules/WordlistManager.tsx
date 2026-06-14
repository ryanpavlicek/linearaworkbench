import { useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { COMPARISON_LANGUAGES } from "../data/languages";
import { useMultiWords } from "../lib/helpers";
import { phoneticDistance, wordToPhonetic } from "../lib/algorithms";
import { WordToken } from "../components/WordToken";
import type { ComparisonEntry } from "../lib/types";

function parseWordlistFile(file: File): Promise<ComparisonEntry[]> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const text = String(r.result);
        let raw: Partial<ComparisonEntry>[];
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed))
            throw new Error(
              "A JSON wordlist must be an array of {w, m, d} entries",
            );
          raw = parsed;
        } else {
          const lines = text.split("\n").filter((l) => l.trim());
          // The documented format includes a header row — drop it instead
          // of importing {w:"word", m:"meaning", d:"domain"} as an entry.
          if (lines.length > 0) {
            const first = lines[0].split(",").map((s) => s.trim().toLowerCase());
            if (first[0] === "word") lines.shift();
          }
          raw = lines.map((l) => {
            const [w, m, d] = l.split(",").map((s) => s.trim());
            return { w, m, d };
          });
        }
        // Normalize every entry so downstream code (the entry filter, the
        // corpus-engagement preview, the comparator) can assume string
        // w/m/d and a precomputed p. The CSV branch always had a headword,
        // but a hand-built JSON upload can omit m/d (or even w) — which used
        // to crash the entry filter on e.m.toLowerCase(). Entries without a
        // usable headword are dropped rather than stored as junk.
        const entries: ComparisonEntry[] = raw
          .filter((e) => e && e.w != null && String(e.w).trim() !== "")
          .map((e) => {
            const w = String(e.w);
            return {
              w,
              m: e.m == null ? "?" : String(e.m),
              d: e.d == null ? "?" : String(e.d),
              p: w.replace(/[*₁₂₃ʰʷ]/g, "").toLowerCase(),
            };
          });
        if (entries.length === 0)
          throw new Error("No valid entries found (each needs a headword)");
        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export default function WordlistManager() {
  const custom = useWorkbench((s) => s.customLanguages);
  const add = useWorkbench((s) => s.addCustomLanguage);
  const remove = useWorkbench((s) => s.removeCustomLanguage);
  const hyp = useWorkbench((s) => s.hypothesis);
  const toast = useWorkbench((s) => s.toast_show);
  const fileRef = useRef<HTMLInputElement>(null);
  const words = useMultiWords();

  // Entry browser + on-demand corpus-engagement preview for one list.
  const [openLang, setOpenLang] = useState<string | null>(null);
  const [entryQ, setEntryQ] = useState("");
  const [preview, setPreview] = useState<{
    lang: string;
    engaged: number;
    total: number;
    best: { entry: ComparisonEntry; word: string; dist: number }[];
  } | null>(null);

  const openEntries = useMemo<ComparisonEntry[] | null>(() => {
    if (!openLang) return null;
    return custom[openLang] ?? COMPARISON_LANGUAGES[openLang] ?? null;
  }, [openLang, custom]);

  const visibleEntries = useMemo(() => {
    if (!openEntries) return [];
    const u = entryQ.trim().toLowerCase();
    if (!u) return openEntries;
    // Null-safe field access: entries persisted by an earlier build (before
    // JSON uploads were normalized) may still carry undefined m/d.
    return openEntries.filter(
      (e) =>
        (e.w ?? "").toLowerCase().includes(u) ||
        (e.m ?? "").toLowerCase().includes(u) ||
        (e.d ?? "").toLowerCase().includes(u),
    );
  }, [openEntries, entryQ]);

  // How much does this wordlist ENGAGE the corpus? For each entry, the
  // closest Linear A word; an entry "engages" when something sits within
  // the comparator's default 0.45-distance band. A list whose entries
  // nothing ever matches is dead weight in the comparator.
  function computePreview(lang: string, entries: ComparisonEntry[]) {
    const corpusPhon = words.map((w) => ({
      word: w.word,
      ph: wordToPhonetic(w.word, hyp),
    }));
    let engaged = 0;
    const best: { entry: ComparisonEntry; word: string; dist: number }[] = [];
    for (const e of entries) {
      const key = e.p ?? e.w.toLowerCase();
      let bw = "";
      let bd = Infinity;
      for (const c of corpusPhon) {
        const d = phoneticDistance(c.ph, key);
        if (d < bd) {
          bd = d;
          bw = c.word;
        }
      }
      if (bd <= 0.45) engaged++;
      best.push({ entry: e, word: bw, dist: bd });
    }
    best.sort((a, b) => a.dist - b.dist);
    setPreview({ lang, engaged, total: entries.length, best: best.slice(0, 8) });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const entries = await parseWordlistFile(f);
      const name = f.name.replace(/\.[^.]+$/, "");
      add(name, entries);
      toast(`Loaded "${name}" (${entries.length} entries)`);
    } catch (err) {
      toast(`Error loading wordlist: ${err}`, "error");
    }
    e.target.value = "";
  }

  const builtIn = Object.entries(COMPARISON_LANGUAGES).map(([k, v]) => ({
    name: k,
    count: v.length,
    custom: false,
  }));
  const customList = Object.entries(custom).map(([k, v]) => ({
    name: k,
    count: v.length,
    custom: true,
  }));
  const all = [...builtIn, ...customList];

  return (
    <div className="panel">
      <h2>Wordlist Manager</h2>
      <div className="callout">
        <h4>Reference languages</h4>
        <p>
          Built-in comparison wordlists ship with the app. You can upload
          additional reference vocabularies as JSON (array of{" "}
          <code>{"{ w, m, d }"}</code>) or CSV (one{" "}
          <code>word,meaning,domain</code> per line).
        </p>
      </div>
      <div className="toolbar">
        <button className="btn" onClick={() => fileRef.current?.click()}>
          + Upload wordlist
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,.txt"
          style={{ display: "none" }}
          onChange={onFile}
        />
      </div>
      <div className="stat-grid">
        <div className="stat-box">
          <span className="val">{all.length}</span>
          <span className="lbl">Languages</span>
        </div>
        <div className="stat-box">
          <span className="val">
            {all.reduce((s, l) => s + l.count, 0)}
          </span>
          <span className="lbl">Total entries</span>
        </div>
        <div className="stat-box">
          <span className="val">{customList.length}</span>
          <span className="lbl">Custom</span>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Language</th>
              <th>Entries</th>
              <th>Type</th>
              <th>Domains</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {all.map((l) => {
              const entries = l.custom
                ? custom[l.name]
                : COMPARISON_LANGUAGES[l.name];
              const domains = [...new Set(entries.map((e) => e.d))];
              return (
                <tr key={l.name}>
                  <td>
                    <b
                      style={{
                        color: l.custom ? "var(--am)" : "var(--ac)",
                      }}
                    >
                      {l.name}
                    </b>
                  </td>
                  <td className="numeral">{l.count}</td>
                  <td>
                    {l.custom ? (
                      <span className="tag tag-warn">custom</span>
                    ) : (
                      <span className="tag tag-site">built-in</span>
                    )}
                  </td>
                  <td className="dim">{domains.join(", ")}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setOpenLang(openLang === l.name ? null : l.name);
                        setEntryQ("");
                      }}
                      title={`Browse the ${l.count} entries of ${l.name}`}
                    >
                      {openLang === l.name ? "Close" : "Browse"}
                    </button>{" "}
                    {l.custom && (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: "var(--rd)" }}
                        onClick={() => {
                          remove(l.name);
                          if (openLang === l.name) setOpenLang(null);
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {openLang && openEntries && (
        <div className="card" style={{ marginTop: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <h4 style={{ margin: 0 }}>
              {openLang}{" "}
              <span className="dim">({openEntries.length} entries)</span>
            </h4>
            <input
              className="input"
              placeholder="Filter entries…"
              value={entryQ}
              onChange={(e) => setEntryQ(e.target.value)}
              style={{ width: 180, fontSize: 12 }}
            />
            <span style={{ flex: 1 }} />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => computePreview(openLang, openEntries)}
              title="For every entry, find the closest Linear A word — how much of this list the corpus can actually engage with at the comparator's default threshold"
            >
              Preview corpus matches
            </button>
          </div>
          {preview && preview.lang === openLang && (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                marginBottom: 8,
                fontSize: 11,
              }}
            >
              <b>
                {preview.engaged} of {preview.total}
              </b>{" "}
              entries have a Linear A word within the comparator's default
              threshold (≥55% similarity). Closest pairs:{" "}
              {preview.best.map((b, i) => (
                <span key={i} style={{ whiteSpace: "nowrap", marginRight: 8 }}>
                  {b.entry.w} ≈ <WordToken word={b.word} />
                  <span className="dim" style={{ fontSize: 10 }}>
                    {((1 - b.dist) * 100).toFixed(0)}%
                  </span>
                </span>
              ))}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "2px 12px",
              maxHeight: 320,
              overflowY: "auto",
              fontSize: 11,
            }}
          >
            {visibleEntries.slice(0, 400).map((e, i) => (
              <div key={`${e.w}-${i}`} style={{ display: "flex", gap: 6 }}>
                <b style={{ fontFamily: "var(--mono)", minWidth: 80 }}>
                  {e.w}
                </b>
                <span className="dim" style={{ flex: 1 }}>
                  {e.m}
                </span>
                <span className="tag tag-domain">{e.d}</span>
              </div>
            ))}
            {visibleEntries.length > 400 && (
              <span className="dim">
                +{visibleEntries.length - 400} more — narrow the filter
              </span>
            )}
            {visibleEntries.length === 0 && (
              <span className="dim">No entries match “{entryQ}”.</span>
            )}
          </div>
        </div>
      )}

      <div className="col2" style={{ marginTop: 16 }}>
        <div className="card">
          <h4>JSON format</h4>
          <pre
            style={{
              font: "11px var(--mono)",
              color: "var(--text-dim)",
              marginTop: 6,
              whiteSpace: "pre-wrap",
            }}
          >
{`[
  { "w": "ilu", "m": "god", "d": "REL" },
  { "w": "šarru", "m": "king", "d": "ADM" }
]`}
          </pre>
        </div>
        <div className="card">
          <h4>CSV format</h4>
          <pre
            style={{
              font: "11px var(--mono)",
              color: "var(--text-dim)",
              marginTop: 6,
              whiteSpace: "pre-wrap",
            }}
          >
{`word,meaning,domain
ilu,god,REL
šarru,king,ADM`}
          </pre>
        </div>
      </div>
    </div>
  );
}
