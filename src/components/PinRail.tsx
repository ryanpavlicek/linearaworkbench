import { useEffect, useRef } from "react";
import { useWorkbench } from "../store/workbench";
import { wordToPhonetic } from "../lib/algorithms";
import { normalizeSignLabel } from "../lib/helpers";
import { AnnotationChip } from "./AnnotationEditor";
import type { Pin } from "../lib/types";

// Right-side persistent dock of words/inscriptions the researcher wants to
// keep in view while exploring other modules.
export function PinRail() {
  const pins = useWorkbench((s) => s.pins);
  const visible = useWorkbench((s) => s.settings.pinRailVisible);
  const width = useWorkbench((s) => s.settings.pinRailWidth);
  const update = useWorkbench((s) => s.updateSettings);
  const setVisible = useWorkbench((s) => s.setPinRailVisible);
  const clear = useWorkbench((s) => s.clearPins);
  const handleRef = useRef<HTMLDivElement>(null);

  // Apply current width as a CSS variable so the grid track picks it up.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--pin-rail-w",
      `${Math.max(220, Math.min(600, width))}px`,
    );
  }, [width]);

  // Drag-to-resize: track left-edge drag and update settings.
  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const handle = handleRef.current;
    handle?.classList.add("dragging");
    const startX = e.clientX;
    const startW = width;
    function move(ev: PointerEvent) {
      const dx = startX - ev.clientX;
      const next = Math.max(220, Math.min(600, startW + dx));
      document.documentElement.style.setProperty("--pin-rail-w", `${next}px`);
    }
    function end(ev: PointerEvent) {
      handle?.classList.remove("dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      const dx = startX - ev.clientX;
      const next = Math.max(220, Math.min(600, startW + dx));
      update({ pinRailWidth: next });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  // The rail shows whenever the user has it toggled on — even with no pins,
  // where it shows a hint. (The toggle means "rail visible", literally.)
  if (!visible) return null;

  return (
    <aside
      className="pin-rail"
      aria-label="Pinned items"
      style={{
        background: "var(--surface-0)",
        borderLeft: "1px solid var(--border)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        ref={handleRef}
        className="pin-rail-handle"
        onPointerDown={startDrag}
        title="Drag to resize"
        role="separator"
        aria-orientation="vertical"
      />
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "sticky",
          top: 0,
          background: "var(--surface-0)",
          zIndex: 1,
        }}
      >
        <span
          style={{
            font: "600 10px var(--sans)",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Pinned
        </span>
        <span className="dim" style={{ fontSize: 10 }}>
          {pins.length}
        </span>
        <span style={{ flex: 1 }} />
        {pins.length > 0 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={clear}
            title="Unpin all"
            style={{ padding: "2px 6px", fontSize: 10 }}
          >
            Clear
          </button>
        )}
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setVisible(false)}
          title="Hide pin rail"
          style={{ padding: "2px 6px", fontSize: 10 }}
        >
          ✕
        </button>
      </div>
      {pins.length === 0 ? (
        <div
          style={{
            padding: "16px 14px",
            color: "var(--text-muted)",
            font: "12px/1.6 var(--serif)",
          }}
        >
          No pins yet. Open any word or inscription and click{" "}
          <span
            style={{
              font: "500 11px var(--sans)",
              color: "var(--text-dim)",
              whiteSpace: "nowrap",
            }}
          >
            ☆ Pin
          </span>{" "}
          to keep it here while you explore other modules.
        </div>
      ) : (
        <div style={{ padding: 8 }}>
          {pins.map((p) => (
            <PinCard key={p.id} pin={p} />
          ))}
        </div>
      )}
    </aside>
  );
}

function PinCard({ pin }: { pin: Pin }) {
  const unpin = useWorkbench((s) => s.unpin);
  const showWord = useWorkbench((s) => s.showWord);
  const showInscription = useWorkbench((s) => s.showInscription);
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const byId = useWorkbench((s) => s.corpus.byId);
  const signsByLabel = useWorkbench((s) => s.corpus.signsByLabel);
  const hypothesis = useWorkbench((s) => s.hypothesis);

  function open() {
    if (pin.kind === "word") showWord(pin.value);
    else showInscription(pin.value);
  }

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 8,
        marginBottom: 6,
        cursor: "pointer",
      }}
      onClick={open}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 4,
        }}
      >
        <span
          className="tag"
          style={{
            background: pin.kind === "word" ? "#5b9eff14" : "#9b7cf014",
            color: pin.kind === "word" ? "var(--ac)" : "var(--pu)",
            border: "1px solid currentColor",
            fontSize: 8,
          }}
        >
          {pin.kind === "word" ? "WORD" : "INS"}
        </span>
        <span style={{ flex: 1 }} />
        <button
          className="dim"
          style={{
            background: "none",
            padding: 2,
            cursor: "pointer",
            fontSize: 11,
            color: "var(--rd)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            unpin(pin.id);
          }}
          title="Unpin"
        >
          ✕
        </button>
      </div>
      {pin.kind === "word" ? (
        <WordCardBody word={pin.value} />
      ) : (
        <InscriptionCardBody id={pin.value} />
      )}
    </div>
  );

  function WordCardBody({ word }: { word: string }) {
    const entry = wordIndex.get(word);
    const glyphs = word
      .split("-")
      .map((p) => signsByLabel.get(normalizeSignLabel(p))?.glyph ?? "")
      .join("");
    return (
      <>
        {glyphs && (
          <div
            style={{
              fontFamily: "var(--glyph)",
              fontSize: 20,
              color: "var(--text)",
              marginBottom: 2,
            }}
          >
            {glyphs}
          </div>
        )}
        <div
          style={{
            font: "500 12px var(--mono)",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {word}
          <AnnotationChip target={{ kind: "word", value: word }} />
        </div>
        <div className="dim" style={{ fontSize: 10 }}>
          /{wordToPhonetic(word, hypothesis)}/
          {entry && ` · ×${entry.count} · ${entry.sites.size}↺`}
        </div>
      </>
    );
  }

  function InscriptionCardBody({ id }: { id: string }) {
    const ins = byId.get(id);
    if (!ins)
      return (
        <div className="dim" style={{ fontSize: 11 }}>
          {id} (not loaded)
        </div>
      );
    return (
      <>
        {ins.glyphs && (
          <div
            style={{
              fontFamily: "var(--glyph)",
              fontSize: 16,
              color: "var(--text)",
              marginBottom: 4,
              maxHeight: 56,
              overflow: "hidden",
              lineHeight: 1.2,
            }}
          >
            {ins.glyphs}
          </div>
        )}
        <div
          style={{
            font: "500 12px var(--mono)",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {ins.id}
          <AnnotationChip target={{ kind: "inscription", value: id }} />
        </div>
        <div className="dim" style={{ fontSize: 10 }}>
          {ins.site}
          {ins.context && ` · ${ins.context}`}
        </div>
      </>
    );
  }
}

// Tiny inline button for any context to pin/unpin the current target.
export function PinButton({
  kind,
  value,
  size = "sm",
}: {
  kind: "word" | "inscription";
  value: string;
  size?: "sm" | "md";
}) {
  const isPinned = useWorkbench((s) =>
    s.pins.some((p) => p.kind === kind && p.value === value),
  );
  const toggle = useWorkbench((s) => s.togglePin);
  const setVisible = useWorkbench((s) => s.setPinRailVisible);
  return (
    <button
      className={`btn btn-outline ${size === "sm" ? "btn-sm" : ""}`}
      onClick={() => {
        toggle(kind, value);
        if (!isPinned) setVisible(true);
      }}
      title={isPinned ? "Unpin" : "Pin to right rail"}
    >
      {isPinned ? "★ Pinned" : "☆ Pin"}
    </button>
  );
}
