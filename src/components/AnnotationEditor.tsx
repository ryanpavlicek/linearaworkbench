import { useEffect, useState } from "react";
import { useWorkbench, annotationFor } from "../store/workbench";
import type { AnnotationTarget, Confidence } from "../lib/types";

interface Props {
  target: AnnotationTarget;
}

const CONF_OPTIONS: { value: Confidence; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "var(--text-muted)" },
  { value: "medium", label: "Medium", color: "var(--am)" },
  { value: "high", label: "High", color: "var(--gn)" },
];

// Inline editor used inside the DetailModal for word and inscription detail.
// Auto-saves on blur for any non-empty field; auto-deletes on cleared fields.
export function AnnotationEditor({ target }: Props) {
  const existing = useWorkbench((s) => annotationFor(s.annotations, target));
  const upsert = useWorkbench((s) => s.upsertAnnotation);
  const remove = useWorkbench((s) => s.deleteAnnotation);
  const toast = useWorkbench((s) => s.toast_show);

  const [meaning, setMeaning] = useState(existing?.proposedMeaning ?? "");
  const [confidence, setConfidence] = useState<Confidence>(
    existing?.confidence ?? "medium",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  useEffect(() => {
    setMeaning(existing?.proposedMeaning ?? "");
    setConfidence(existing?.confidence ?? "medium");
    setNotes(existing?.notes ?? "");
  }, [existing?.id]);

  function save() {
    if (!meaning.trim() && !notes.trim()) {
      if (existing) {
        remove(existing.id);
        toast("Annotation cleared");
      }
      return;
    }
    upsert(target, { proposedMeaning: meaning, confidence, notes });
  }

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 12,
        marginTop: 16,
      }}
    >
      <div
        style={{
          font: "600 10px var(--sans)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        Annotation
        {existing && (
          <span className="dim" style={{ marginLeft: 8, fontSize: 10 }}>
            updated {new Date(existing.updatedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="input"
          placeholder="Proposed meaning (e.g. &quot;owed quantity&quot;)"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          onBlur={save}
          style={{ flex: 1 }}
        />
        <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
          {CONF_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`tab-btn${confidence === opt.value ? " active" : ""}`}
              onClick={() => {
                setConfidence(opt.value);
                if (meaning.trim() || notes.trim())
                  upsert(target, {
                    proposedMeaning: meaning,
                    confidence: opt.value,
                    notes,
                  });
              }}
              style={{ borderColor: opt.color }}
              title={`Confidence: ${opt.label}`}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: opt.color,
                  marginRight: 4,
                }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        className="input"
        placeholder="Reasoning / supporting evidence / questions to revisit…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
        rows={3}
        style={{
          width: "100%",
          resize: "vertical",
          fontFamily: "var(--serif)",
        }}
      />

      {existing && (
        <div
          style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}
        >
          <button
            className="btn btn-outline btn-sm"
            style={{ color: "var(--rd)" }}
            onClick={() => {
              remove(existing.id);
              setMeaning("");
              setNotes("");
              toast("Annotation deleted");
            }}
          >
            Delete annotation
          </button>
        </div>
      )}
    </div>
  );
}

export function AnnotationChip({ target }: { target: AnnotationTarget }) {
  const annotation = useWorkbench((s) => annotationFor(s.annotations, target));
  if (!annotation || !annotation.proposedMeaning) return null;
  const color =
    annotation.confidence === "high"
      ? "var(--gn)"
      : annotation.confidence === "medium"
        ? "var(--am)"
        : "var(--text-muted)";
  return (
    <span
      title={`${annotation.proposedMeaning} (${annotation.confidence} confidence)`}
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: 3,
        background: color,
        marginLeft: 4,
        verticalAlign: "middle",
      }}
    />
  );
}
