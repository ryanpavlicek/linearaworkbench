import { useWorkbench } from "../store/workbench";

// Programmatic entry point for working with Linear A and the wider Aegean/Greek
// corpus in Python via pyaegean. Both projects share the same 1,721-entry
// GORILA corpus, query field IDs, and parity checksums.

const PYPI_URL = "https://pypi.org/project/pyaegean/";
const GITHUB_URL = "https://github.com/ryanpavlicek/pyaegean";
const DOCS_URL = "https://pyaegean.xyz/";
const DEMO_URL = "https://pyaegean.xyz/demo/";
const COLAB_URL =
  "https://colab.research.google.com/github/ryanpavlicek/pyaegean/blob/main/notebooks/walkthrough-aegean.ipynb";

const INSTALL = `# Core package (zero heavy dependencies; Python 3.10+)
pip install pyaegean

# Add CLI / local Workbench launcher, pandas DataFrames, or interactive TUI
pip install "pyaegean[cli,data]"
pip install "pyaegean[tui]"`;

const QUICKSTART = `import aegean
from aegean.analysis import FilterRow

corpus = aegean.open("lineara")          # same 1,721-entry GORILA corpus
print(len(corpus), corpus.provenance.cite())

# Compound Query Builder in Python (identical field IDs)
results = corpus.query([
    FilterRow("site-is", "Haghia Triada"),
    FilterRow("has-image", True),
])
for doc in results.inscriptions[:5]:
    print(doc.id, doc.meta.site, len(doc.words))

# Full-text / sign search, exact accounting, and pandas export (needs [data])
hits = corpus.search("KU-RO")
df = corpus.to_dataframe("token")`;

const LOCAL_BRIDGE = `# Launch this exact Workbench locally (with cached GORILA plates if installed)
aegean workbench

# Pre-scope to a site, tablet, or custom corpus from pyaegean
aegean workbench --site "Haghia Triada" --module arith
aegean workbench --corpus sigla          # inspect 802 SigLA Linear A docs
aegean workbench --doc HT13              # jump directly to HT13

# Manage corpora, images, and the Workbench bundle from one place
aegean library status
aegean library install lineara-images`;

const ROUNDTRIP = `from aegean.io import (
    to_workbench,
    from_workbench_export,
    load_workbench_backup,
)

# Send any pyaegean corpus (SigLA, Linear B, filtered slice) to the Workbench
to_workbench(my_corpus, "my_corpus.json")

# Load a Workbench Data Export or api/v1 JSON back into Python
corpus = from_workbench_export("linear_a_corpus.json")

# Read your Workbench backup (hypotheses, annotations, saved queries, collections)
state = load_workbench_backup("linear-a-workbench-backup.json")
print(state["hypotheses"])`;

const API_CURL = `curl -s https://linearaworkbench.xyz/api/v1/inscriptions/HT13.json \\
  | jq '.derived.balance'`;

function CodeCard({
  title,
  sub,
  code,
}: {
  title: string;
  sub?: string;
  code: string;
}) {
  const toast = useWorkbench((s) => s.toast_show);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h4>{title}</h4>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            navigator.clipboard
              .writeText(code)
              .then(() => toast("Copied to clipboard"))
              .catch(() => toast("Couldn't copy — select the text instead", "error"));
          }}
          title="Copy this snippet"
        >
          ⧉ Copy
        </button>
      </div>
      {sub && (
        <div className="sub" style={{ marginTop: 2 }}>
          {sub}
        </div>
      )}
      <pre
        style={{
          font: "12px/1.6 var(--mono)",
          color: "var(--text-dim)",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "10px 14px",
          marginTop: 8,
          overflowX: "auto",
        }}
      >
        {code}
      </pre>
    </div>
  );
}

export default function PythonToolkit() {
  const setActive = useWorkbench((s) => s.setActiveModule);
  return (
    <div className="panel">
      <h2>Python Toolkit — pyaegean</h2>
      <p className="panel-desc">
        <b>pyaegean</b> is the companion Python, CLI, TUI, and MCP toolkit built
        alongside this workbench. It ships the same 1,721-entry Linear A corpus
        and compound-query engine, plus multi-script corpora (SigLA Linear A,
        ~5,900 Linear B DAMOS tablets, Cypriot, Cypro-Minoan, and Ancient Greek),
        exact rational accounting, distributional embeddings, Procrustes
        cross-script alignment, Harris morpheme segmentation, Brainerd–Robinson
        seriation, Monte Carlo null models, EpiDoc/RDF/Parquet export, and a
        29-tool MCP server (<code>aegean-mcp</code>).
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        <a className="btn btn-sm" href={PYPI_URL} target="_blank" rel="noopener noreferrer">
          PyPI ↗
        </a>
        <a className="btn btn-outline btn-sm" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
        <a className="btn btn-outline btn-sm" href={DOCS_URL} target="_blank" rel="noopener noreferrer">
          Docs &amp; API ↗
        </a>
        <a className="btn btn-outline btn-sm" href={DEMO_URL} target="_blank" rel="noopener noreferrer">
          Browser Demo ↗
        </a>
        <a
          className="btn btn-outline btn-sm"
          href={COLAB_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Run the Aegean walkthrough notebook in Colab"
        >
          Colab Notebook ↗
        </a>
      </div>

      <CodeCard
        title="Install"
        sub="Python 3.10+. Core installs with zero third-party dependencies."
        code={INSTALL}
      />

      <CodeCard
        title="Quick start"
        sub="Open the corpus, run a Workbench query, search, and build a DataFrame."
        code={QUICKSTART}
      />

      <CodeCard
        title="Run this Workbench locally via CLI"
        sub="Serve offline with cached GORILA plates, pre-scope to any site or corpus, or jump straight to a tablet."
        code={LOCAL_BRIDGE}
      />

      <CodeCard
        title="Round-trip with Python"
        sub="Load Python corpora into these modules, or bring Workbench exports and backups back into Python."
        code={ROUNDTRIP}
      />

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Other programmatic doors</h4>
        <p className="sub" style={{ marginTop: 4 }}>
          Use the Query Builder&apos;s <b>Copy pyaegean code</b> button to export
          any active query as Python, or click <b>Py ⧉</b> inside any tablet
          detail modal. Three additional entry points:
        </p>
        <ul className="sub" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>
            <b>Static data API</b> — versioned JSON endpoints at stable URLs:
            <pre
              style={{
                font: "11px/1.5 var(--mono)",
                color: "var(--text-dim)",
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "8px 12px",
                marginTop: 6,
                overflowX: "auto",
              }}
            >
              {API_CURL}
            </pre>
          </li>
          <li>
            <b>Live embeds</b> — <code>?embed=1#/i/HT13</code> renders a
            chromeless tablet card for iframes.
          </li>
          <li>
            <b>Bring your own corpus</b> — pass <code>?corpus=&lt;url&gt;</code>{" "}
            (same-origin or HTTPS) or use{" "}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setActive("export")}
              style={{ fontSize: 11, padding: "1px 8px" }}
            >
              Data Export
            </button>{" "}
            → <i>Bring your own corpus</i> to load any inscription JSON for the
            session.
          </li>
        </ul>
      </div>
    </div>
  );
}
