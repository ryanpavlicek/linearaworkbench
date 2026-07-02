import { useRef, useState } from "react";
import { useWorkbench, getAllLanguages } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { isScopeActive, scopeSummary } from "../store/scope";
import { phoneticDistance, wordToPhonetic } from "../lib/algorithms";
import { csvEscape, downloadFile } from "../lib/helpers";
import { lookupPhonetic } from "../lib/signKeys";
import {
  applyBackup,
  buildBackup,
  clearAllWorkbenchData,
  isBackupFile,
  summarizeBackup,
  type BackupFile,
  type RestoreMode,
} from "../lib/backup";
import {
  buildCorpusExport,
  SCHEMA_VERSION,
} from "../lib/corpusExport";
import { FolderSyncCard } from "../components/FolderSyncCard";
import { VaultExportCard } from "../components/VaultExportCard";

export default function DataExport() {
  const corpusTotal = useWorkbench((s) => s.corpus.inscriptions.length);
  const signs = useWorkbench((s) => s.corpus.signs);
  const hyp = useWorkbench((s) => s.hypothesis);
  const custom = useWorkbench((s) => s.customLanguages);
  const annotations = useWorkbench((s) => s.annotations);
  const collections = useWorkbench((s) => s.collections);
  const pins = useWorkbench((s) => s.pins);
  const tabletCategories = useWorkbench((s) => s.tabletCategories);
  const scope = useWorkbench((s) => s.scope);
  const toast = useWorkbench((s) => s.toast_show);
  // Scope-aware: EVERY export card respects the active scope (so a
  // researcher can export just "LMIB Haghia Triada tablets" or the whole
  // corpus, by toggling Scope off/on before exporting).
  const scoped = useScopedCorpus();
  const wordIndex = scoped.wordIndex;
  const inscriptions = scoped.inscriptions;
  // Per-checkbox options for the full corpus export. Defaults are
  // conservative — a clean reference dump, no user state, no extras.
  const [includeUserState, setIncludeUserState] = useState(false);
  const [includeSigns, setIncludeSigns] = useState(true);
  const [includeWordFreq, setIncludeWordFreq] = useState(false);

  const multi = () =>
    [...wordIndex.entries()]
      .filter(([w]) => w.includes("-"))
      .sort((a, b) => b[1].count - a[1].count);

  function wordFreqCsv() {
    const rows: (string | number)[][] = [
      ["word", "phonetic", "count", "sites", "site_list"],
    ];
    for (const [w, d] of multi()) {
      rows.push([
        w,
        wordToPhonetic(w, hyp),
        d.count,
        d.sites.size,
        [...d.sites].join(";"),
      ]);
    }
    downloadFile(
      "linear_a_word_freq.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
    toast("Exported word frequencies");
  }

  function wordFreqJson() {
    const data = multi().map(([w, d]) => ({
      word: w,
      phonetic: wordToPhonetic(w, hyp),
      count: d.count,
      sites: [...d.sites],
    }));
    downloadFile(
      "linear_a_word_freq.json",
      JSON.stringify(data, null, 2),
      "application/json",
    );
    toast("Exported word frequencies (JSON)");
  }

  function compCsv() {
    const langs = getAllLanguages(custom);
    const rows: (string | number)[][] = [
      ["word", "phonetic", "count", "best_match", "match_lang", "meaning", "distance"],
    ];
    for (const [w, d] of multi()) {
      const ph = wordToPhonetic(w, hyp);
      let best: { word: string; lang: string; meaning: string; dist: number } | null = null;
      for (const [ln, entries] of Object.entries(langs)) {
        for (const e of entries) {
          const dist = phoneticDistance(ph, e.p ?? e.w.toLowerCase());
          if (dist < 0.55 && (!best || dist < best.dist))
            best = { word: e.w, lang: ln, meaning: e.m, dist };
        }
      }
      rows.push([
        w,
        ph,
        d.count,
        best?.word ?? "",
        best?.lang ?? "",
        best?.meaning ?? "",
        best ? best.dist.toFixed(3) : "",
      ]);
    }
    downloadFile(
      "linear_a_comparisons.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
    toast("Exported comparisons");
  }

  function compJson() {
    const langs = getAllLanguages(custom);
    const data = multi().map(([w, d]) => {
      const ph = wordToPhonetic(w, hyp);
      let best: { word: string; lang: string; meaning: string; dist: number } | null = null;
      for (const [ln, entries] of Object.entries(langs)) {
        for (const e of entries) {
          const dist = phoneticDistance(ph, e.p ?? e.w.toLowerCase());
          if (dist < 0.55 && (!best || dist < best.dist))
            best = { word: e.w, lang: ln, meaning: e.m, dist };
        }
      }
      return { word: w, phonetic: ph, count: d.count, bestMatch: best };
    });
    downloadFile(
      "linear_a_comparisons.json",
      JSON.stringify(data, null, 2),
      "application/json",
    );
    toast("Exported comparisons (JSON)");
  }

  function insCsv() {
    const rows: (string | number)[][] = [
      ["id", "site", "support", "word_count", "text"],
    ];
    for (const i of inscriptions) {
      rows.push([i.id, i.site, i.support, i.words.length, i.words.join(" ")]);
    }
    downloadFile(
      "linear_a_inscriptions.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
    toast("Exported inscriptions");
  }

  // One row per word TOKEN with full positional metadata — the long/tidy
  // format statistical tools (pandas, R) want, so positional analyses
  // don't have to re-derive line and slot indices from the joined text.
  function tokensCsv() {
    const rows: (string | number)[][] = [
      [
        "inscription",
        "site",
        "period",
        "scribe",
        "support",
        "line",
        "slot",
        "token",
        "is_word",
        "sign_count",
      ],
    ];
    for (const i of inscriptions) {
      i.lines.forEach((line, li) => {
        line.forEach((tok, ti) => {
          rows.push([
            i.id,
            i.site,
            i.context,
            i.scribe,
            i.support,
            li + 1,
            ti + 1,
            tok,
            tok.includes("-") ? "yes" : "",
            tok.includes("-") ? tok.split("-").length : "",
          ]);
        });
      });
    }
    downloadFile(
      "linear_a_tokens_long.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
    toast(`Exported ${rows.length - 1} tokens (long format)`);
  }

  function insJson() {
    downloadFile(
      "linear_a_inscriptions.json",
      JSON.stringify(
        inscriptions.map((i) => ({
          id: i.id,
          site: i.site,
          support: i.support,
          words: i.words,
        })),
        null,
        2,
      ),
      "application/json",
    );
    toast("Exported inscriptions (JSON)");
  }

  function signsCsv() {
    const map = new Map<
      string,
      { count: number; initial: number; medial: number; final: number }
    >();
    for (const [w, d] of multi()) {
      const parts = w.split("-");
      parts.forEach((s, i) => {
        let stat = map.get(s);
        if (!stat) {
          stat = { count: 0, initial: 0, medial: 0, final: 0 };
          map.set(s, stat);
        }
        stat.count += d.count;
        if (parts.length === 1) {
          stat.initial += d.count;
          stat.final += d.count;
        } else if (i === 0) stat.initial += d.count;
        else if (i === parts.length - 1) stat.final += d.count;
        else stat.medial += d.count;
      });
    }
    const rows: (string | number)[][] = [
      ["sign", "phonetic", "total", "initial", "medial", "final"],
    ];
    const sorted = [...map.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [s, d] of sorted) {
      rows.push([
        s,
        lookupPhonetic(s) ?? "?",
        d.count,
        d.initial,
        d.medial,
        d.final,
      ]);
    }
    downloadFile(
      "linear_a_signs.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
    toast("Exported sign concordance");
  }

  // ── Full corpus JSON (structured export for downstream pipelines) ─────────
  function fullCorpusJson() {
    const data = buildCorpusExport(
      scoped.inscriptions,
      signs,
      scoped.wordIndex,
      {
        scope,
        scopeSummary: isScopeActive(scope) ? scopeSummary(scope) : "whole corpus",
        includeUserState,
        includeSigns,
        includeWordFrequencies: includeWordFreq,
        hypothesis: hyp,
        annotations,
        collections,
        pins,
        tabletCategoryOverrides: tabletCategories,
      },
    );
    const scopeTag = isScopeActive(scope)
      ? "_" + scopeSummary(scope).replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40)
      : "";
    downloadFile(
      `linear_a_corpus${scopeTag}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    toast(
      `Exported ${data.inscriptions.length} inscriptions as structured JSON (schema v${SCHEMA_VERSION})`,
    );
  }

  // ── Backup & restore ────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);

  // ── Bring your own corpus ─────────────────────────────────────────────────
  const applyCustomCorpus = useWorkbench((s) => s.applyCustomCorpus);
  const corpusSource = useWorkbench((s) => s.corpusSource);
  const corpusFileRef = useRef<HTMLInputElement>(null);

  function onPickCorpusFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const { loaded: n, skipped } = applyCustomCorpus(raw, f.name);
        toast(
          `Loaded ${n} inscriptions from ${f.name}${skipped ? ` (${skipped} entries skipped)` : ""}`,
        );
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Couldn't parse that file as JSON.",
          "error",
        );
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  // ── Reset to baseline ─────────────────────────────────────────────────────
  // Two-step destructive action: arm the panel, then require the user to type
  // CLEAR so it can't be triggered by a stray click.
  const [resetArmed, setResetArmed] = useState(false);
  const [resetText, setResetText] = useState("");

  function doReset() {
    const n = clearAllWorkbenchData();
    toast(`Reset complete — ${n} stored items cleared. Reloading…`);
    setTimeout(() => location.reload(), 700);
  }

  function downloadBackup() {
    const file = buildBackup();
    const stamp = file.exportedAt.replace(/[-:T]/g, "").slice(0, 13);
    downloadFile(
      `linear_a_workbench_backup_${stamp}.json`,
      JSON.stringify(file, null, 2),
      "application/json",
    );
    const s = summarizeBackup(file);
    toast(`Backup downloaded — ${s.keys} keys, ${Math.round(s.bytes / 1024)} KB`);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isBackupFile(parsed)) {
          toast("That doesn't look like a workbench backup file.", "error");
          return;
        }
        setPending(parsed);
      } catch {
        toast("Couldn't parse that file as JSON.", "error");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  function doRestore(mode: RestoreMode) {
    if (!pending) return;
    const r = applyBackup(pending, mode);
    setPending(null);
    toast(
      `Restored ${r.applied} keys${mode === "replace" ? ` (replaced ${r.cleared})` : ""}. Reloading…`,
    );
    // The Zustand store was hydrated from localStorage at init; reload so all
    // modules pick up the restored state cleanly.
    setTimeout(() => location.reload(), 600);
  }

  const summary = pending ? summarizeBackup(pending) : null;

  return (
    <div className="panel">
      <h2>Data Export</h2>
      <p className="panel-desc">
        Export analysis tables as CSV or JSON for further work in spreadsheets,
        notebooks, or statistical tools.
      </p>

      <div
        className="card"
        style={{ borderLeft: "3px solid var(--ac)", marginBottom: 16 }}
      >
        <h4>📦 Full corpus JSON</h4>
        <p className="sub" style={{ marginTop: 4, fontSize: 13 }}>
          One structured file containing every inscription (with all canonical
          metadata: site, period, scribe, support, findspot, words, lines,
          glyphs, translations, image paths, rights) plus a per-inscription{" "}
          <code>derived</code> block with the workbench's enriched analyses —
          multi-sign-word count, tablet-structure category (heuristic + any
          override you applied), and the accounting balance check where
          applicable. Versioned schema (currently v{SCHEMA_VERSION}), provenance
          metadata in <code>_meta</code>, drop-in ready for{" "}
          <code>pandas.read_json</code> / <code>jq</code> / R{" "}
          <code>jsonlite</code>.{" "}
          {isScopeActive(scope) ? (
            <>
              <b>Scope is active</b> ({scopeSummary(scope)}) —{" "}
              {scoped.inscriptions.length} of {corpusTotal} inscriptions
              will be exported. Clear the scope in the top bar to export the
              whole corpus.
            </>
          ) : (
            <>
              Exporting the <b>whole corpus</b> ({corpusTotal}{" "}
              inscriptions). Set a Scope in the top bar to export a slice
              instead.
            </>
          )}
        </p>
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 10,
            fontSize: 12,
          }}
        >
          <label
            className="dim"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title="Include the sign inventory (84 signs with Unicode glyphs, Linear B values where shared, attestation counts, mapping confidence)"
          >
            <input
              type="checkbox"
              checked={includeSigns}
              onChange={(e) => setIncludeSigns(e.target.checked)}
            />
            include sign inventory
          </label>
          <label
            className="dim"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title="Include the full word-frequency table (multi-sign words with phonetic, count, sites)"
          >
            <input
              type="checkbox"
              checked={includeWordFreq}
              onChange={(e) => setIncludeWordFreq(e.target.checked)}
            />
            include word frequencies
          </label>
          <label
            className="dim"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title="Include your annotations, collection memberships, and pin state per inscription. Leave off for a clean reference dump."
          >
            <input
              type="checkbox"
              checked={includeUserState}
              onChange={(e) => setIncludeUserState(e.target.checked)}
            />
            include my annotations / collections / pins
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-sm" onClick={fullCorpusJson}>
            ⬇ Download corpus JSON
          </button>
        </div>
      </div>

      {isScopeActive(scope) && (
        <div className="dim" style={{ fontSize: 11, marginBottom: 8, color: "var(--ac)" }}>
          ◆ Scope: {scopeSummary(scope)} — every card below exports the
          scoped slice ({scoped.inscriptions.length} of {corpusTotal}{" "}
          inscriptions).
        </div>
      )}

      <div className="col2">
        <div className="card">
          <h4>Word frequencies</h4>
          <div className="sub">
            All multi-sign words with phonetic, count, and sites
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={wordFreqCsv}>
              CSV
            </button>
            <button className="btn btn-outline btn-sm" onClick={wordFreqJson}>
              JSON
            </button>
          </div>
        </div>
        <div className="card">
          <h4>Comparison results</h4>
          <div className="sub">
            Best cross-linguistic match per word at current hypothesis
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={compCsv}>
              CSV
            </button>
            <button className="btn btn-outline btn-sm" onClick={compJson}>
              JSON
            </button>
          </div>
        </div>
        <div className="card">
          <h4>Inscriptions</h4>
          <div className="sub">Full corpus with metadata</div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={insCsv}>
              CSV
            </button>
            <button className="btn btn-outline btn-sm" onClick={insJson}>
              JSON
            </button>
          </div>
        </div>
        <div className="card">
          <h4>Tokens (long format)</h4>
          <div className="sub">
            One row per word token with line and slot indices — tidy data
            for pandas / R
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={tokensCsv}>
              CSV
            </button>
          </div>
        </div>
        <div className="card">
          <h4>Sign concordance</h4>
          <div className="sub">Sign inventory with positional statistics</div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={signsCsv}>
              CSV
            </button>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{ borderLeft: "3px solid var(--ac)", marginTop: 16 }}
      >
        <h4>Backup &amp; restore — your work</h4>
        <p className="sub" style={{ marginTop: 4 }}>
          Everything you create in the workbench lives in your browser's
          storage. <b>Download a backup</b> regularly — one JSON file with{" "}
          <em>all</em> of your annotations, collections, findings, saved
          hypotheses, queries, pinned items, tablet reclassifications, report
          layout, sidebar layout, and display settings — so a cleared cache or
          a different machine doesn't lose your work. Restore re-applies the
          file and reloads the workbench.
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <button
            className="btn btn-sm"
            onClick={downloadBackup}
            title="Download a single JSON file containing all your workbench data and settings"
          >
            ⬇ Download backup
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => fileRef.current?.click()}
            title="Select a previously-downloaded backup file to restore"
          >
            ⬆ Restore from file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={onPickFile}
          />
        </div>
      </div>

      <FolderSyncCard onLoadBackup={setPending} />

      <VaultExportCard />

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Bring your own corpus</h4>
        <p className="sub" style={{ marginTop: 4 }}>
          Load a different inscription set into every module for this session —
          a corpus you exported here (possibly scoped), a pyaegean{" "}
          <code>to_workbench()</code> dump, or any JSON array of inscription
          records (only <code>id</code> and some text are required; everything
          else gets sensible defaults). The same thing works as a shareable
          link: <code>?corpus=&lt;url-to-json&gt;</code>. The bundled corpus
          comes back on reload.{" "}
          {corpusSource && (
            <>
              <b>Currently loaded:</b> {corpusSource}.
            </>
          )}
        </p>
        <div style={{ marginTop: 10 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => corpusFileRef.current?.click()}
            title="Pick a JSON file of inscriptions to browse for this session"
          >
            ⬆ Load corpus from file…
          </button>
          <input
            ref={corpusFileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={onPickCorpusFile}
          />
        </div>
      </div>

      <div
        className="card"
        style={{ borderLeft: "3px solid var(--rd)", marginTop: 12 }}
      >
        <h4 style={{ color: "var(--rd)" }}>Reset to baseline — start over</h4>
        <p className="sub" style={{ marginTop: 4 }}>
          Wipe <b>all</b> of your workbench data and return to a clean install:
          annotations, collections, findings, saved hypotheses, saved queries,
          pinned items, tablet reclassifications, notes, report &amp; sidebar
          layout, and display settings. This <b>cannot be undone</b> — if
          there's any chance you'll want this work back, <b>download a backup
          first</b> (above). A connected sync folder stays paired.
        </p>
        {!resetArmed ? (
          <button
            className="btn btn-sm"
            style={{
              marginTop: 8,
              background: "var(--rd)",
              borderColor: "var(--rd)",
            }}
            onClick={() => {
              setResetArmed(true);
              setResetText("");
            }}
          >
            Reset everything…
          </button>
        ) : (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              border: "1px solid var(--rd)",
              borderRadius: 6,
              background: "var(--surface-1)",
            }}
          >
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              Type <b style={{ fontFamily: "var(--mono)" }}>CLEAR</b> to confirm
              you want to erase everything and start over:
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input
                className="input"
                value={resetText}
                onChange={(e) => setResetText(e.target.value)}
                placeholder="CLEAR"
                autoFocus
                style={{ width: 120, fontFamily: "var(--mono)", letterSpacing: 1 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && resetText === "CLEAR") doReset();
                }}
              />
              <button
                className="btn btn-sm"
                disabled={resetText !== "CLEAR"}
                style={
                  resetText === "CLEAR"
                    ? { background: "var(--rd)", borderColor: "var(--rd)" }
                    : undefined
                }
                onClick={doReset}
                title={
                  resetText === "CLEAR"
                    ? "Erase all workbench data and reload"
                    : "Type CLEAR to enable"
                }
              >
                Erase everything &amp; reload
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setResetArmed(false);
                  setResetText("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {pending && summary && (
        <div
          className="card"
          style={{
            borderLeft: "3px solid var(--am)",
            marginTop: 12,
            background: "var(--surface-1)",
          }}
        >
          <h4>Restore preview</h4>
          <div className="sub" style={{ marginBottom: 8 }}>
            Backup from{" "}
            <b>{new Date(pending.exportedAt).toLocaleString()}</b> ·{" "}
            {summary.keys} keys · {Math.round(summary.bytes / 1024)} KB
          </div>
          {summary.highlights.length > 0 && (
            <ul
              style={{
                fontSize: 12,
                color: "var(--text-dim)",
                paddingLeft: 18,
                marginBottom: 10,
              }}
            >
              {summary.highlights.map((h) => (
                <li key={h.label}>
                  {h.count} {h.label}
                </li>
              ))}
            </ul>
          )}
          <div className="sub" style={{ marginBottom: 10 }}>
            Choose how to apply it:
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              className="btn btn-sm"
              onClick={() => doRestore("merge")}
              title="Overwrite only the keys present in the backup; leave anything else as-is"
            >
              Merge into current state
            </button>
            <button
              className="btn btn-sm btn-outline"
              style={{ color: "var(--rd)", borderColor: "var(--rd)" }}
              onClick={() => {
                if (
                  window.confirm(
                    "Replace all current workbench data with the backup? This wipes anything not in the backup.",
                  )
                )
                  doRestore("replace");
              }}
              title="Wipe all current workbench data and apply the backup exactly as exported"
            >
              Replace everything
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
