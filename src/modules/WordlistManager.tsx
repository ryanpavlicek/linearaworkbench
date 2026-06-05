import { useRef } from "react";
import { useWorkbench } from "../store/workbench";
import { COMPARISON_LANGUAGES } from "../data/languages";
import type { ComparisonEntry } from "../lib/types";

function parseWordlistFile(file: File): Promise<ComparisonEntry[]> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const text = String(r.result);
        let entries: ComparisonEntry[];
        if (file.name.endsWith(".json")) {
          entries = JSON.parse(text);
        } else {
          entries = text
            .split("\n")
            .filter((l) => l.trim())
            .map((l) => {
              const [w, m, d] = l.split(",").map((s) => s.trim());
              return { w, m: m || "?", d: d || "?" };
            });
        }
        entries.forEach(
          (e) => (e.p = e.w.replace(/[*₁₂₃ʰʷ]/g, "").toLowerCase()),
        );
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
  const toast = useWorkbench((s) => s.toast_show);
  const fileRef = useRef<HTMLInputElement>(null);

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
                  <td>
                    {l.custom ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: "var(--rd)" }}
                        onClick={() => remove(l.name)}
                      >
                        Remove
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
