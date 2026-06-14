import { useEffect, useRef } from "react";
import { useWorkbench } from "../store/workbench";
import { useFocusTrap } from "../lib/useFocusTrap";
import { GORILA_CEFAEL_URL } from "../lib/citations";

// Always-accessible "About the corpus" modal — opened from the footer link.
// Surfaces provenance, the count distinction, and the canonical citations in
// one click, so a researcher landing on any module can answer their own
// "where does this data come from?" question without leaving the page.
//
// Distinct from the Methodology page (which covers algorithm details) — this
// is the short data-card: who collected it, how we shaped it, how to cite it.
export function AboutCorpus({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inscriptions = useWorkbench((s) => s.corpus.inscriptions);
  const signs = useWorkbench((s) => s.corpus.signs);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useFocusTrap(open, modalRef);

  if (!open) return null;

  return (
    <div
      className="modal-scrim"
      onClick={onClose}
      style={{ alignItems: "center", padding: "0 16px" }}
    >
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="About the corpus"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680, maxHeight: "85vh" }}
      >
        <div className="modal-head">
          <div>
            <h3>About the corpus</h3>
            <div className="meta">
              Provenance, count, and how to cite it
            </div>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <Section title="What's loaded">
            <p>
              <b>{inscriptions.length}</b> tagged inscription entries · <b>{signs.length}</b>{" "}
              unique syllabic signs · all canonical metadata (site, period,
              scribe, support, findspot, transliterated words, glyph
              strings, translations, image paths). Ships as static JSON in{" "}
              <code>public/corpus/</code>.
            </p>
          </Section>

          <Section title="A note on the count">
            <p>
              Published Linear A scholarship typically cites{" "}
              <b>~1,400–1,500 documents</b>. The workbench loads{" "}
              <b>{inscriptions.length}</b> because the upstream transcription
              splits documents into separately-tagged fragments (a roundel
              face, an obverse/reverse pair, a separately-numbered sealing)
              while print scholarship aggregates them. Neither count is
              wrong — they answer different questions. If you're citing the
              corpus size in a publication, the conventional{" "}
              ~1,400–1,500 figure is more appropriate.
            </p>
          </Section>

          <Section title="Sources">
            <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
              <li>
                <b>Transcription</b> —{" "}
                <a
                  href="https://github.com/mwenge/lineara.xyz"
                  target="_blank"
                  rel="noreferrer"
                >
                  mwenge/lineara.xyz
                </a>
                , the digital corpus this workbench builds on.
              </li>
              <li>
                <b>Print edition</b> — Godart, L. & Olivier, J.-P.
                (1976–1985). <i>Recueil des inscriptions en linéaire A</i>{" "}
                (GORILA). École Française d'Athènes. The scholarly edition
                everything else derives from — all five volumes are{" "}
                <a
                  href={GORILA_CEFAEL_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  readable online at CEFAEL
                </a>
                , the École's digital library.
              </li>
              <li>
                <b>Commentary</b> — John Younger's Linear A material. The
                workbench bundles a mirror of the pre-2024 KU-hosted
                commentary (via lineara.xyz, 1,694 HTML docs) and renders
                each inline in its inscription's detail modal. The standalone{" "}
                <b>Commentary Browser</b> module (under Research) lets you
                read across the whole archive with full-text search and
                site-grouped browse. Younger now publishes updated and
                reorganized material as PDFs on{" "}
                <a
                  href="https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction"
                  target="_blank"
                  rel="noreferrer"
                >
                  academia.edu
                </a>{" "}
                — check there for the most current readings.
              </li>
              <li>
                <b>Paleography</b> —{" "}
                <a
                  href="https://sigla.phis.me/"
                  target="_blank"
                  rel="noreferrer"
                >
                  SigLA
                </a>
                , the per-scribe sign-variant database. Linked per inscription
                (Paleography ↗ in the detail modal) and per sign (in Sign
                Inventory, Sign Concordance, Sign Transitions, and word
                detail modals).
              </li>
            </ul>
          </Section>

          <Section title="Citing this workbench">
            <p>
              Analyses produced with the workbench are exploratory. Linear A
              remains undeciphered; proposed readings are hypotheses, not
              established facts. <b>Primary citations should go to the
              underlying corpus sources</b> above — they are the editorial
              authorities.
            </p>
            <p>
              If your work specifically uses the workbench's analytical
              features (alignment matrix, sound-shift hypotheses, accounting
              reconciliations, captured result tables…) or you want to enable
              reproducibility, <b>please also cite the workbench itself</b>.
              A <code>CITATION.cff</code> in the repo enables GitHub's
              "Cite this repository" button (one-click APA/BibTeX). The
              Research Report's <b>+ Citation block</b> emits pre-formatted
              references for GORILA / mwenge / Younger / SigLA <i>and</i> the
              workbench (version- and snapshot-pinned for reproducibility) in
              BibTeX, APA, Chicago, or MLA style.
            </p>
          </Section>

          <Section title="About the author">
            <p>
              <b>Ryan Pavlicek</b>
            </p>
            <p>
              I'm a software engineer that likes creating useful tools for
              exploring interesting problems.
            </p>
            <p>
              If you need to reach me please email{" "}
              <a href="mailto:ryan.pavlicek.github@gmail.com">
                ryan.pavlicek.github@gmail.com
              </a>
            </p>
          </Section>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                setActiveModule("methodology");
                onClose();
              }}
              title="Open the Methodology page — algorithms, statistical methods, citations, known limitations"
            >
              Open Methodology →
            </button>
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4
        style={{
          font: "600 11px var(--sans)",
          color: "var(--ac)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          margin: "0 0 6px",
        }}
      >
        {title}
      </h4>
      <div
        style={{
          font: "14px/1.6 var(--serif)",
          color: "var(--text-dim)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
