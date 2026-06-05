import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import { anchoredPopoverPos } from "../lib/popover";

interface Props {
  module: ModuleId;
  moduleLabel: string;
  /** Pre-filled, editable title for the finding. */
  defaultTitle: string;
  /** Human-readable snapshot of the current result (shown + stored). */
  summary: string;
  /** Optional JSON-serializable data the module can use to restore the view. */
  payload?: unknown;
  /**
   * Just-in-time payload builder. Called at save time (sync or async). When
   * present, its return value is used instead of `payload` — useful when the
   * payload depends on live DOM (e.g. an SVG snapshot).
   */
  payloadFn?: () => unknown | Promise<unknown>;
  /**
   * Optional just-in-time builder for a *report-renderable* representation of
   * the current result (HTML + optional Markdown). When provided, the research
   * report renders this in place of the bare summary text, so the report shows
   * the full table / list / visual the user saw at save time — not just the
   * one-line summary.
   */
  reportFn?: () =>
    | { html: string; markdown?: string }
    | Promise<{ html: string; markdown?: string }>;
  disabled?: boolean;
  label?: string;
}

/**
 * Drop-in "save this result" control for any analysis module. Opens a small
 * popover (editable title + optional note + a preview of the summary) and
 * writes a Finding to the store — which is tracked in the Findings list,
 * exportable, and compiled into the Research Report.
 */
export function SaveFindingButton({
  module,
  moduleLabel,
  defaultTitle,
  summary,
  payload,
  payloadFn,
  reportFn,
  disabled,
  label = "💾 Save to findings",
}: Props) {
  const addFinding = useWorkbench((s) => s.addFinding);
  const toast = useWorkbench((s) => s.toast_show);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(defaultTitle);
  const [notes, setNotes] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Re-seed the title from the current view whenever the popover is closed.
  useEffect(() => {
    if (!open) setName(defaultTitle);
  }, [defaultTitle, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popoverRef.current?.contains(t))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function save() {
    const t = name.trim() || defaultTitle;
    setBusy(true);
    try {
      let resolvedPayload: unknown = payload;
      if (payloadFn) {
        try {
          resolvedPayload = await payloadFn();
        } catch {
          // Fall back to the static payload if the builder fails.
          resolvedPayload = payload;
        }
      }
      let report: { html: string; markdown?: string } | undefined;
      if (reportFn) {
        try {
          report = await reportFn();
        } catch {
          report = undefined;
        }
      }
      addFinding({
        module,
        moduleLabel,
        title: t,
        summary,
        payload: resolvedPayload,
        report,
        notes: notes.trim() || undefined,
      });
      toast(`Saved “${t}” to findings`);
      setNotes("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-annot" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-sm"
        disabled={disabled}
        onClick={() => {
          if (!open && triggerRef.current)
            setPos(anchoredPopoverPos(triggerRef.current, 320, 360));
          setOpen((o) => !o);
        }}
        title="Save this result to your findings — tracked, exportable, and added to the research report"
      >
        {label}
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
            right: "auto",
            width: 320,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inline-annot-head">Save finding · {moduleLabel}</div>
          <input
            ref={inputRef}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Title"
            style={{ width: "100%", fontSize: 12 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
          />
          <div
            style={{
              fontSize: 11,
              margin: "8px 0",
              whiteSpace: "pre-wrap",
              maxHeight: 90,
              overflowY: "auto",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 6,
              color: "var(--text-dim)",
            }}
          >
            {summary}
          </div>
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)…"
            rows={2}
            style={{
              width: "100%",
              resize: "vertical",
              fontFamily: "var(--serif)",
              fontSize: 12,
            }}
          />
          <div
            style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}
          >
            <button
              type="button"
              className="btn btn-sm"
              onClick={save}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>,
          document.body,
        )}
    </span>
  );
}
