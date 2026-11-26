import { useWorkbench } from "../store/workbench";
import { TOOL_REPO } from "../lib/corpusExport";

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
          title="34 focused workspaces (59 views)"
          text="Frequency, morphology & paradigms, co-occurrence (table + network graph), signs & graphotactics, accounting & metrology, chronology, geography, scribal analysis, full-text Younger commentary browse, and more — grouped in the left sidebar with related views tabbed together. See Methodology under Help for the formulas behind every analysis."
        />
        <HomeCard
          title="Learn the script"
          text="New to Linear A? The Learn group walks through a tablet token by token (Guided Reader), drills the syllabary with flashcards (Sign Trainer), lets you balance a real account (Scribe School), and transliterates names into signs (Write in Linear A)."
        />
        <HomeCard
          title="Your research notebook"
          text="Attach proposed meanings, confidence levels, and notes to any word or inscription. Organize items into collections, save findings with their result tables, and compile everything into an offline HTML or Markdown report."
        />
        <HomeCard
          title="Power tools & pyaegean"
          text="Compound query builder, side-by-side inscription comparison, sound-shift hypotheses with saved snapshots, cross-language alignment matrix, a static JSON API, and direct round-trips with pyaegean in Python and the CLI."
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
            Does this tablet&apos;s arithmetic balance?
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
            Explore corpus vocabulary CA
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
        any time for How to Use,{" "}
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
        className="card"
        style={{ marginBottom: 14, fontSize: 12, color: "var(--text-dim)" }}
      >
        <b style={{ color: "var(--text)" }}>Offline &amp; self-hosting:</b>{" "}
        Run the workbench locally via <code>aegean workbench</code> or host your
        own copy from{" "}
        <a href={TOOL_REPO} target="_blank" rel="noopener noreferrer">
          github.com/ryanpavlicek/linearaworkbench
        </a>
        .
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
        Inscription data is sourced from{" "}
        <a
          href="https://github.com/mwenge/lineara.xyz"
          target="_blank"
          rel="noopener noreferrer"
        >
          mwenge/lineara.xyz
        </a>
        , transcribed from the <b>GORILA</b> volumes by Godart &amp; Olivier.
        For an image-first tablet browser, see{" "}
        <a href="https://lineara.xyz" target="_blank" rel="noopener noreferrer">
          lineara.xyz
        </a>
        .
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
