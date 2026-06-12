import { useWorkbench } from "../store/workbench";

// The landing page — what the first-run popup used to say, as a place you
// can come back to. Fresh installs open here; returning users keep
// whatever module they were in. Everything actionable links onward.

export default function Home() {
  const setActive = useWorkbench((s) => s.setActiveModule);
  const showInscription = useWorkbench((s) => s.showInscription);

  return (
    <div className="panel" style={{ maxWidth: 880 }}>
      <h2>Linear A Research Workbench</h2>
      <p
        style={{
          font: "15px/1.7 var(--serif)",
          color: "var(--text-dim)",
          marginBottom: 14,
        }}
      >
        The published Linear A corpus is roughly 1,400–1,500 documents from
        1800–1450 BCE; the upstream transcription splits these into 1,721
        tagged entries (separately-numbered fragments, obverse/reverse
        faces), which is what this workbench loads. You can read the{" "}
        <em>sounds</em> via shared signs with Linear B, but the language
        itself is undeciphered. This workbench gives you tools to explore,
        hypothesize, annotate, and persist your work.
      </p>

      <div className="col2" style={{ marginBottom: 14 }}>
        <HomeCard
          title="50 analysis modules"
          text="Frequency, morphology, co-occurrence (table + network graph), sign concordance, wildcard sign-pattern search, geography, scribal analysis, full-text Younger commentary browse, and more — grouped in the left sidebar, related views tabbed together. A Methodology page under Help explains the math behind every analysis."
        />
        <HomeCard
          title="Learn the script"
          text="New to Linear A? The Learn group walks you through a real tablet token by token (Guided Reader), drills the syllabary with flashcards (Sign Trainer), lets you balance a real account like a scribe (Scribe School), and writes your name in signs (Write in Linear A)."
        />
        <HomeCard
          title="Your research notebook"
          text="Attach proposed meanings, confidence levels, and notes to any word or inscription. Bookmark items into collections, save findings with their result tables, and compile everything into an interactive report."
        />
        <HomeCard
          title="Builder + power tools"
          text="Compound query builder, side-by-side inscription comparison, sound-shift hypotheses with saved snapshots, cross-language alignment matrix, a static data API, and pyaegean round-trips for Python work."
        />
      </div>

      <div
        className="card"
        style={{ marginBottom: 14, fontSize: 13, color: "var(--text-dim)" }}
      >
        <b style={{ color: "var(--text)" }}>Try one right now:</b>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setActive("arith");
              showInscription("HT13");
            }}
          >
            Does this tablet's arithmetic balance?
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setActive("reader")}
          >
            Read your first tablet, guided
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setActive("onomastics")}
          >
            Which words look like names?
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setActive("scribes")}
          >
            Compare two scribes
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setActive("constellation")}
          >
            See the whole corpus in one sky
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{ marginBottom: 14, fontSize: 12, color: "var(--text-dim)" }}
      >
        <b style={{ color: "var(--text)" }}>Keyboard shortcuts:</b> press{" "}
        <kbd
          style={{
            font: "500 11px var(--mono)",
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: 3,
            padding: "1px 6px",
          }}
        >
          ?
        </kbd>{" "}
        any time for the full How to Use guide,{" "}
        <kbd
          style={{
            font: "500 11px var(--mono)",
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: 3,
            padding: "1px 6px",
          }}
        >
          Ctrl+K
        </kbd>{" "}
        for the command palette.{" "}
        <button
          className="btn btn-outline btn-sm"
          style={{ marginLeft: 8 }}
          onClick={() => setActive("help")}
        >
          Open How to Use →
        </button>
      </div>

      <div
        style={{
          padding: "10px 12px",
          background: "var(--ac-soft)",
          border: "1px solid #5b9eff40",
          borderRadius: 6,
          font: "12px/1.6 var(--serif)",
          color: "var(--text-dim)",
        }}
      >
        <b style={{ color: "var(--ac)", fontFamily: "var(--sans)" }}>
          Corpus credit:
        </b>{" "}
        The inscription data is sourced from{" "}
        <a
          href="https://github.com/mwenge/lineara.xyz"
          target="_blank"
          rel="noreferrer"
        >
          mwenge/lineara.xyz
        </a>{" "}
        (a wonderful visual exploration tool in its own right), which
        transcribed it from the <b>GORILA</b> volumes by Godart & Olivier.
        If you want a tablet-image-first browsing experience, visit{" "}
        <a href="https://lineara.xyz" target="_blank" rel="noreferrer">
          lineara.xyz
        </a>{" "}
        — they integrate John Younger's scholarly commentary and a Crete
        map. This workbench is a complementary computational-research tool
        built on the same data.
      </div>
    </div>
  );
}

function HomeCard({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <div
        style={{
          font: "600 12px var(--sans)",
          color: "var(--ac)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ font: "12px/1.6 var(--serif)", color: "var(--text-dim)" }}>
        {text}
      </div>
    </div>
  );
}
