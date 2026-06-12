import { useMemo } from "react";
import { useWorkbench } from "../store/workbench";
import { noteRefs } from "../lib/notes";

// "Referenced by": everything in the researcher's own material that points
// at this inscription — annotations on it, annotations citing it as
// evidence, collections containing it, and notes linking to it. The store
// already implies this reverse index; this makes it visible at the moment
// you're looking at the tablet. Renders nothing when nothing links here.
export function WhatLinksHere({ inscriptionId }: { inscriptionId: string }) {
  const annotations = useWorkbench((s) => s.annotations);
  const collections = useWorkbench((s) => s.collections);
  const notes = useWorkbench((s) => s.notes);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const links = useMemo(() => {
    const onIt = annotations.filter(
      (a) => a.target.kind === "inscription" && a.target.value === inscriptionId,
    );
    const asEvidence = annotations.filter(
      (a) =>
        a.evidenceIds.includes(inscriptionId) &&
        !(a.target.kind === "inscription" && a.target.value === inscriptionId),
    );
    const inCollections = collections.filter((c) =>
      c.items.some((i) => i.kind === "inscription" && i.value === inscriptionId),
    );
    const inNotes = notes.filter((n) =>
      noteRefs(n.body).some((r) => r.kind === "ins" && r.value === inscriptionId),
    );
    return { onIt, asEvidence, inCollections, inNotes };
  }, [annotations, collections, notes, inscriptionId]);

  const total =
    links.asEvidence.length + links.inCollections.length + links.inNotes.length;
  if (total === 0) return null;

  const chip = {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface-1)",
    cursor: "pointer",
  } as const;

  return (
    <div style={{ margin: "10px 0" }}>
      <div className="dim" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Referenced by your research
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {links.asEvidence.map((a) => (
          <button
            key={a.id}
            style={{ ...chip, color: "var(--am)" }}
            title={`Cited as evidence for the annotation on ${a.target.value} (“${a.proposedMeaning || "…"}”) — open My Lexicon`}
            onClick={() => setActive("lexicon")}
          >
            ✎ evidence for {a.target.value}
          </button>
        ))}
        {links.inCollections.map((c) => (
          <button
            key={c.id}
            style={{ ...chip, color: "var(--cy)" }}
            title="Open Collections"
            onClick={() => setActive("annot", { tab: "collections" })}
          >
            📁 {c.name}
          </button>
        ))}
        {links.inNotes.map((n) => (
          <button
            key={n.id}
            style={{ ...chip, color: "var(--text-dim)" }}
            title="Open Notes"
            onClick={() => setActive("annot")}
          >
            📝 {n.title || "Untitled note"}
          </button>
        ))}
      </div>
    </div>
  );
}
