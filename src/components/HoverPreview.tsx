import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useWorkbench } from "../store/workbench";
import { wordToPhonetic } from "../lib/algorithms";
import { normalizeSignLabel } from "../lib/helpers";

interface Props {
  kind: "word" | "inscription";
  value: string;
  children: ReactNode;
  delay?: number;
}

const HOVER_DELAY = 300;

// Lightweight hover tooltip-card for words and inscriptions. Renders via
// portal to escape table overflow clipping. Click anywhere in the trigger
// still fires the original onClick — the preview is just a peek.
export function HoverPreview({
  kind,
  value,
  children,
  delay = HOVER_DELAY,
}: Props) {
  const enabled = useWorkbench((s) => s.settings.hoverPreviews);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onEnter() {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ x: r.left, y: r.bottom + 4 });
      setOpen(true);
    }, delay);
  }
  function onLeave() {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  }

  return (
    <span
      ref={wrapRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ display: "inline" }}
    >
      {children}
      {open &&
        createPortal(
          <PreviewCard
            kind={kind}
            value={value}
            x={pos.x}
            y={pos.y}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </span>
  );
}

function PreviewCard({
  kind,
  value,
  x,
  y,
}: {
  kind: "word" | "inscription";
  value: string;
  x: number;
  y: number;
  onClose: () => void;
}) {
  // Position adjustment to keep card on-screen
  const vw = window.innerWidth;
  const cardWidth = 280;
  const left = Math.min(x, vw - cardWidth - 8);
  return (
    <div
      style={{
        position: "fixed",
        left,
        top: y,
        zIndex: 200,
        width: cardWidth,
        background: "var(--surface-0)",
        border: "1px solid var(--border-strong)",
        borderRadius: 8,
        padding: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        pointerEvents: "none",
        animation: "fadeIn 80ms ease",
        font: "12px var(--sans)",
      }}
    >
      {kind === "word" ? (
        <WordPreviewBody word={value} />
      ) : (
        <InscriptionPreviewBody id={value} />
      )}
    </div>
  );
}

function WordPreviewBody({ word }: { word: string }) {
  const entry = useWorkbench((s) => s.corpus.wordIndex.get(word));
  const byId = useWorkbench((s) => s.corpus.byId);
  const hypothesis = useWorkbench((s) => s.hypothesis);
  const signsByLabel = useWorkbench((s) => s.corpus.signsByLabel);
  if (!entry) {
    return <div className="dim">No data for {word}</div>;
  }
  const phonetic = wordToPhonetic(word, hypothesis);
  const glyphs = word
    .split("-")
    .map((p) => signsByLabel.get(normalizeSignLabel(p))?.glyph ?? "")
    .join("");
  const cooc = new Map<string, number>();
  for (const id of entry.inscriptionIds.slice(0, 50)) {
    const ins = byId.get(id);
    if (!ins) continue;
    for (const w of ins.words) {
      if (w === word || !w.includes("-")) continue;
      cooc.set(w, (cooc.get(w) ?? 0) + 1);
    }
  }
  const top = [...cooc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <>
      {glyphs && (
        <div
          style={{
            fontFamily: "var(--glyph)",
            fontSize: 22,
            marginBottom: 4,
            color: "var(--text)",
          }}
        >
          {glyphs}
        </div>
      )}
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{word}</div>
      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
        /{phonetic}/ · ×{entry.count} · {entry.sites.size} site
        {entry.sites.size === 1 ? "" : "s"}
      </div>
      {top.length > 0 && (
        <>
          <div
            className="dim"
            style={{
              font: "600 9px var(--sans)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 2,
            }}
          >
            Top co-occurrences
          </div>
          <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            {top.map(([w, c]) => `${w} ×${c}`).join(" · ")}
          </div>
        </>
      )}
    </>
  );
}

function InscriptionPreviewBody({ id }: { id: string }) {
  const ins = useWorkbench((s) => s.corpus.byId.get(id));
  if (!ins) return <div className="dim">No data for {id}</div>;
  return (
    <>
      {ins.glyphs && (
        <div
          style={{
            fontFamily: "var(--glyph)",
            fontSize: 18,
            marginBottom: 6,
            color: "var(--text)",
            whiteSpace: "pre-wrap",
            maxHeight: 80,
            overflow: "hidden",
          }}
        >
          {ins.glyphs}
        </div>
      )}
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{ins.id}</div>
      <div className="dim" style={{ fontSize: 11 }}>
        {ins.site}
        {ins.context && ` · ${ins.context}`}
        {ins.scribe && ` · ${ins.scribe}`}
      </div>
      <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
        {ins.words.filter((w) => w.includes("-")).length} multi-sign words ·{" "}
        {ins.support || "unknown support"}
      </div>
    </>
  );
}
