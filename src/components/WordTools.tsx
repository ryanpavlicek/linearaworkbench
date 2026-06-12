import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useWorkbench, annotationFor } from "../store/workbench";
import type { AnnotationTarget, Confidence } from "../lib/types";
import { anchoredPopoverPos } from "../lib/popover";

const CONF: { value: Confidence; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "var(--text-muted)" },
  { value: "medium", label: "Med", color: "var(--am)" },
  { value: "high", label: "High", color: "var(--gn)" },
];

function confColor(c: Confidence): string {
  return c === "high" ? "var(--gn)" : c === "medium" ? "var(--am)" : "var(--text-muted)";
}

const microLabel: CSSProperties = {
  font: "600 10px var(--sans)",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  margin: "10px 0 6px",
};

interface Props {
  target: AnnotationTarget;
  /** Optional one-tap meaning suggestions, e.g. domain-aware defaults. */
  suggestions?: string[];
}

/**
 * Combined, drop-in inline control for everything you can do to a word /
 * inscription / sign in place: record a hypothesis (proposed meaning +
 * confidence + notes), sort it into collections, and pin it — without opening
 * the detail modal. It's the inline twin of the detail-modal action set, and
 * writes through the same stores, so every capture shows up in the Annotations
 * list, the Collections module, the pin rail, and the Research Report.
 */
export function WordTools({ target, suggestions = [] }: Props) {
  const existing = useWorkbench((s) => annotationFor(s.annotations, target));
  const upsert = useWorkbench((s) => s.upsertAnnotation);
  const removeAnn = useWorkbench((s) => s.deleteAnnotation);
  const collections = useWorkbench((s) => s.collections);
  const createCollection = useWorkbench((s) => s.createCollection);
  const addToCollection = useWorkbench((s) => s.addToCollection);
  const removeFromCollection = useWorkbench((s) => s.removeFromCollection);
  const pins = useWorkbench((s) => s.pins);
  const togglePin = useWorkbench((s) => s.togglePin);
  const setPinRailVisible = useWorkbench((s) => s.setPinRailVisible);
  const toast = useWorkbench((s) => s.toast_show);

  // Collections + pins only apply to words and inscriptions, not signs.
  const collectable = target.kind === "word" || target.kind === "inscription";
  const pinned =
    collectable &&
    pins.some((p) => p.kind === target.kind && p.value === target.value);
  const memberOf = collectable
    ? collections.filter((c) =>
        c.items.some((i) => i.kind === target.kind && i.value === target.value),
      )
    : [];

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const [meaning, setMeaning] = useState(existing?.proposedMeaning ?? "");
  const [confidence, setConfidence] = useState<Confidence>(
    existing?.confidence ?? "medium",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [newColl, setNewColl] = useState("");

  const draft = useRef({ meaning, confidence, notes });
  draft.current = { meaning, confidence, notes };

  useEffect(() => {
    setMeaning(existing?.proposedMeaning ?? "");
    setConfidence(existing?.confidence ?? "medium");
    setNotes(existing?.notes ?? "");
    // Re-sync only when the annotation target changes; depending on the
    // subfields would clobber in-progress edits after a save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  function commit(silent = false) {
    const d = draft.current;
    if (!d.meaning.trim() && !d.notes.trim()) {
      if (existing) {
        removeAnn(existing.id);
        if (!silent) toast("Hypothesis cleared");
      }
      return;
    }
    upsert(target, {
      proposedMeaning: d.meaning.trim(),
      confidence: d.confidence,
      notes: d.notes.trim(),
    });
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popoverRef.current?.contains(t)) {
        commit(true);
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        commit(true);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasMeaning = !!existing?.proposedMeaning;

  function itemRef() {
    return { kind: target.kind as "word" | "inscription", value: target.value };
  }

  return (
    <span className="inline-annot" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={`inline-annot-trigger${
          hasMeaning || pinned || memberOf.length ? " has" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          if (!open && triggerRef.current)
            setPos(anchoredPopoverPos(triggerRef.current, 300, 360));
          setOpen((o) => !o);
        }}
        title={
          hasMeaning
            ? `Your hypothesis: ${existing!.proposedMeaning} (${existing!.confidence}). Click to edit / group / pin.`
            : "Annotate · add to collection · pin"
        }
      >
        {hasMeaning ? (
          <>
            <span
              className="inline-annot-dot"
              style={{ background: confColor(existing!.confidence) }}
            />
            <span className="inline-annot-txt">{existing!.proposedMeaning}</span>
          </>
        ) : (
          <span aria-hidden>✎</span>
        )}
        {pinned && <span title="Pinned">★</span>}
        {memberOf.length > 0 && (
          <span title={`In ${memberOf.length} collection(s)`}>⊞</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="inline-annot-pop"
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: 300,
              zIndex: 1000,
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="inline-annot-head">
            Word tools · <code>{target.value}</code>
          </div>

          {/* ── Hypothesis ─────────────────────────────────────────── */}
          <div style={{ ...microLabel, marginTop: 0 }}>Proposed meaning</div>
          <input
            ref={inputRef}
            className="input"
            placeholder="What do you think it means?"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            style={{ width: "100%", fontSize: 12 }}
          />
          {suggestions.length > 0 && (
            <div className="inline-annot-suggest">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMeaning(s)}
                  title="Use this meaning"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div
            className="tab-row"
            style={{ marginTop: 8, marginBottom: 0, border: 0, gap: 4 }}
          >
            {CONF.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`tab-btn${confidence === opt.value ? " active" : ""}`}
                style={{ borderColor: opt.color }}
                onClick={() => setConfidence(opt.value)}
                title={`Confidence: ${opt.label}`}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    background: opt.color,
                    marginRight: 4,
                  }}
                />
                {opt.label}
              </button>
            ))}
          </div>
          <textarea
            className="input"
            placeholder="Reasoning / evidence / questions…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{
              width: "100%",
              marginTop: 8,
              resize: "vertical",
              fontFamily: "var(--serif)",
              fontSize: 12,
            }}
          />

          {/* ── Collections ────────────────────────────────────────── */}
          {collectable && (
            <>
              <div style={microLabel}>Collections</div>
              <div style={{ maxHeight: 120, overflowY: "auto" }}>
                {collections.length === 0 && (
                  <div className="dim" style={{ fontSize: 11 }}>
                    No collections yet — create one below.
                  </div>
                )}
                {collections.map((c) => {
                  const isMember = c.items.some(
                    (i) => i.kind === target.kind && i.value === target.value,
                  );
                  return (
                    <label
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 2px",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isMember}
                        onChange={() => {
                          if (isMember) {
                            removeFromCollection(c.id, itemRef());
                            toast(`Removed from “${c.name}”`);
                          } else {
                            addToCollection(c.id, itemRef());
                            toast(`Added to “${c.name}”`);
                          }
                        }}
                      />
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <span className="dim" style={{ fontSize: 10 }}>
                        {c.items.length}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input
                  className="input"
                  placeholder="New collection…"
                  value={newColl}
                  onChange={(e) => setNewColl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newColl.trim()) {
                      const id = createCollection(newColl.trim());
                      addToCollection(id, itemRef());
                      toast(`Created “${newColl.trim()}”`);
                      setNewColl("");
                    }
                  }}
                  style={{ flex: 1, fontSize: 11 }}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!newColl.trim()}
                  onClick={() => {
                    const id = createCollection(newColl.trim());
                    addToCollection(id, itemRef());
                    toast(`Created “${newColl.trim()}”`);
                    setNewColl("");
                  }}
                >
                  +
                </button>
              </div>
            </>
          )}

          {/* ── Actions ────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
            }}
          >
            {collectable && (
              <button
                type="button"
                className={`btn btn-sm ${pinned ? "" : "btn-outline"}`}
                onClick={() => {
                  togglePin(target.kind as "word" | "inscription", target.value);
                  if (!pinned) setPinRailVisible(true);
                }}
                title={pinned ? "Unpin" : "Pin to the right rail"}
              >
                {pinned ? "★ Pinned" : "☆ Pin"}
              </button>
            )}
            {existing && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ color: "var(--rd)" }}
                onClick={() => {
                  removeAnn(existing.id);
                  setMeaning("");
                  setNotes("");
                  toast("Hypothesis deleted");
                }}
              >
                Delete note
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                commit();
                setOpen(false);
              }}
            >
              Done
            </button>
          </div>
        </div>,
          document.body,
        )}
    </span>
  );
}
