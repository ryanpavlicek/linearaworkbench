import { useWorkbench } from "../store/workbench";

// The front door for working with this corpus in Python. pyaegean is the
// companion package built alongside the workbench: same bundled corpus,
// same query field ids, parity-tested in both projects' CI. This page is
// the in-app pointer to it — install line, runnable snippets, and the
// other programmatic doors into the site (data API, embeds, BYO corpus).

const PYPI_URL = "https://pypi.org/project/pyaegean/";
const GITHUB_URL = "https://github.com/ryanpavlicek/pyaegean";
const DOCS_URL = "https://ryanpavlicek.github.io/pyaegean/";
const COLAB_URL =
  "https://colab.research.google.com/github/ryanpavlicek/pyaegean/blob/main/notebooks/getting-started.ipynb";

const QUICKSTART = `import aegean
from aegean.analysis import FilterRow

corpus = aegean.load("lineara")          # the same 1,721 inscriptions
print(len(corpus), corpus.provenance.cite())

# the Query Builder, as code — identical field ids
results = corpus.query(
    [
        FilterRow("site", "Haghia Triada"),
        FilterRow("has-image", True),
    ],
)
for doc in results.inscriptions[:5]:
    print(doc.id, doc.meta.site, len(doc.words))

# pandas at document / word / token level
df = corpus.to_dataframe("token")`;

const ROUNDTRIP = `from aegean.io import to_workbench, from_workbench_export

# open ANY corpus in this workbench: write the JSON, host it anywhere
# CORS-readable, then visit  ?corpus=<url-to-json>
to_workbench(my_corpus, "my_corpus.json")

# and the reverse: load this site's Data Export (or api/v1) in Python
corpus = from_workbench_export("linear_a_corpus.json")`;

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
        Everything this workbench analyzes in the browser is also a Python
        package: <b>pyaegean</b> carries the same 1,721-inscription corpus,
        the same compound-query engine, and the analysis layer (sign-pattern
        search, phonetic alignment, collocation statistics, accounting
        reconciliation) — plus things a browser can't do well: pandas
        DataFrames, geopandas maps, EpiDoc/CSV/Parquet export, and a deep
        Ancient Greek NLP pipeline. The two projects are built together, and
        a parity checksum verified in both CIs keeps their corpora
        byte-identical.
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        <a className="btn btn-sm" href={PYPI_URL} target="_blank" rel="noopener noreferrer">
          PyPI ↗
        </a>
        <a className="btn btn-outline btn-sm" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
        <a className="btn btn-outline btn-sm" href={DOCS_URL} target="_blank" rel="noopener noreferrer">
          API reference ↗
        </a>
        <a
          className="btn btn-outline btn-sm"
          href={COLAB_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Run the guided tour in your browser — nothing to install"
        >
          Try it in Colab ↗
        </a>
      </div>

      <CodeCard
        title="Install"
        sub="Python 3.10+; the core install has zero heavy dependencies."
        code="pip install pyaegean"
      />

      <CodeCard
        title="Quick start"
        sub="Load the corpus, run a workbench query, get a DataFrame."
        code={QUICKSTART}
      />

      <CodeCard
        title="Round-trip with this site"
        sub="Your Python corpus in these modules, or this site's exports in Python."
        code={ROUNDTRIP}
      />

      <div className="card" style={{ marginTop: 12 }}>
        <h4>You don't have to leave the browser, either</h4>
        <p className="sub" style={{ marginTop: 4 }}>
          Snippets like these are generated for you all over the app: the
          Query Builder's <b>Py ⧉</b> button translates your current query,
          and every tablet's detail view copies the code that fetches it.
          Three more programmatic doors into the site:
        </p>
        <ul className="sub" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>
            <b>Static data API</b> — the corpus as versioned JSON at stable
            URLs, no app required:
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
            <b>Bring your own corpus</b> — <code>?corpus=&lt;url&gt;</code>{" "}
            or{" "}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setActive("export")}
              style={{ fontSize: 11, padding: "1px 8px" }}
            >
              Data Export
            </button>{" "}
            → <i>Bring your own corpus</i> loads any inscription JSON into
            every module for the session.
          </li>
        </ul>
      </div>
    </div>
  );
}
