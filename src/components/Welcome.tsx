import { useEffect, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useFocusTrap } from "../lib/useFocusTrap";
import { loadJson, saveJson } from "../lib/persistence";

const SEEN_KEY = "welcome-seen-v1";

// First-run modal pointing newcomers to the Help module. Once dismissed,
// never appears again on this browser (until you bump the SEEN_KEY version
// for a future major release).
export function Welcome() {
  const setActive = useWorkbench((s) => s.setActiveModule);
  const showInscription = useWorkbench((s) => s.showInscription);
  const loaded = useWorkbench((s) => s.loaded);
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loaded) return;
    const seen = loadJson<boolean>(SEEN_KEY, false);
    if (!seen) setOpen(true);
  }, [loaded]);

  // Close on Escape, mirroring the other modal surfaces.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useFocusTrap(open, modalRef);

  function dismiss(goHelp = false) {
    saveJson(SEEN_KEY, true);
    setOpen(false);
    if (goHelp) setActive("help");
  }

  if (!open) return null;

  return (
    <div
      className="modal-scrim"
      onClick={() => dismiss(false)}
      style={{ alignItems: "center", padding: "0 16px" }}
    >
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, maxHeight: "85vh" }}
      >
        <div className="modal-head">
          <div>
            <h3>Welcome to the Linear A Research Workbench</h3>
            <div className="meta">
              A research environment for the undeciphered Bronze Age Minoan
              script
            </div>
          </div>
          <button className="modal-close" onClick={() => dismiss(false)}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p
            style={{
              font: "14px/1.7 var(--serif)",
              color: "var(--text-dim)",
              marginBottom: 12,
            }}
          >
            The published Linear A corpus is roughly 1,400–1,500 documents
            from 1800–1450 BCE; the upstream transcription splits these into
            1,721 tagged entries (separately-numbered fragments, obverse/
            reverse faces) which is what this workbench loads. You can read
            the <em>sounds</em> via shared signs with Linear B, but the
            language itself is undeciphered. This workbench gives you tools
            to explore, hypothesize, annotate, and persist your work.
          </p>

          <div
            style={{
              padding: "10px 12px",
              background: "var(--ac-soft)",
              border: "1px solid #5b9eff40",
              borderRadius: 6,
              marginBottom: 12,
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
            transcribed it from the <b>GORILA</b> volumes by Godart &
            Olivier. If you want a tablet-image-first browsing experience,
            visit <a href="https://lineara.xyz" target="_blank" rel="noreferrer">lineara.xyz</a> — they
            integrate John Younger's scholarly commentary and a Crete map.
            This workbench is a complementary computational-research tool
            built on the same data.
          </div>

          <div
            className="col2"
            style={{ marginBottom: 12 }}
          >
            <FeatureCard
              title="38 analysis modules"
              text="Frequency, morphology, co-occurrence (table + network graph), sign concordance, wildcard sign-pattern search, sequence patterns, geography, scribal analysis, full-text Younger commentary browse, and more — grouped in the left sidebar, related views tabbed together. A Methodology page under Help explains the math behind every analysis."
            />
            <FeatureCard
              title="Linear A glyphs everywhere"
              text="Real Unicode Linear A characters rendered alongside transliterations, with facsimile images of the original tablets."
            />
            <FeatureCard
              title="Your research notebook"
              text="Attach proposed meanings, confidence levels, and notes to any word or inscription. Bookmark items into collections. Pin things to the right rail to keep in view."
            />
            <FeatureCard
              title="Builder + power tools"
              text="Compound query builder, side-by-side inscription comparison, sound-shift hypotheses with saved snapshots, cross-language alignment matrix."
            />
          </div>

          <div
            style={{
              padding: 12,
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--text-dim)",
              marginBottom: 12,
            }}
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
            or{" "}
            <kbd
              style={{
                font: "500 11px var(--mono)",
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                borderRadius: 3,
                padding: "1px 6px",
              }}
            >
              /
            </kbd>{" "}
            at any time to open the full How to Use guide.
          </div>

          <div
            style={{
              padding: 12,
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--text-dim)",
              marginBottom: 12,
            }}
          >
            <b style={{ color: "var(--text)" }}>Or try one right now:</b>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  dismiss(false);
                  setActive("arith");
                  showInscription("HT13");
                }}
              >
                Does this tablet's arithmetic balance?
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  dismiss(false);
                  setActive("onomastics");
                }}
              >
                Which words look like names?
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  dismiss(false);
                  setActive("scribes");
                }}
              >
                Compare two scribes
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              className="btn btn-outline"
              onClick={() => dismiss(false)}
            >
              Got it — let me explore
            </button>
            <button className="btn" onClick={() => dismiss(true)}>
              Show me how to use it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 10,
      }}
    >
      <div
        style={{
          font: "600 11px var(--sans)",
          color: "var(--ac)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          font: "12px/1.5 var(--serif)",
          color: "var(--text-dim)",
        }}
      >
        {text}
      </div>
    </div>
  );
}
