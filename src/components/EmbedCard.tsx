import { useWorkbench } from "../store/workbench";
import { upstreamAsset } from "../lib/helpers";

// Chromeless single-tablet card for iframes (?embed=1#/i/HT13): glyphs,
// transliteration, the key metadata, an optional facsimile thumbnail, and a
// link back to the full workbench. Course pages and blog posts get a live
// citation-grade embed instead of a screenshot.
export function EmbedCard({ id }: { id: string }) {
  const ins = useWorkbench((s) => s.corpus.byId.get(id));
  if (!ins) {
    return (
      <div className="embed-card" role="alert">
        Unknown inscription: {id}
      </div>
    );
  }
  const back = `${window.location.origin}${window.location.pathname}#/i/${encodeURIComponent(ins.id)}`;
  const facsimile = ins.facsimileImages[0] ?? ins.images[0];
  return (
    <div
      className="embed-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        height: "100%",
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{ins.id}</h3>
        <span className="dim" style={{ fontSize: 12 }}>
          {ins.site}
          {ins.context ? ` · ${ins.context}` : ""}
          {ins.support ? ` · ${ins.support}` : ""}
        </span>
      </div>
      {ins.glyphs && (
        <div
          style={{
            font: "26px/1.6 'Noto Sans Linear A'",
            wordBreak: "break-word",
          }}
        >
          {ins.glyphs}
        </div>
      )}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 13,
          color: "var(--text-dim)",
          wordBreak: "break-word",
        }}
      >
        {ins.words.join(" ")}
      </div>
      {facsimile && (
        <img
          src={upstreamAsset(facsimile)}
          alt={`Facsimile of ${ins.id}`}
          loading="lazy"
          style={{
            maxWidth: "100%",
            maxHeight: 240,
            objectFit: "contain",
            alignSelf: "flex-start",
            borderRadius: 4,
          }}
        />
      )}
      <a
        href={back}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12, marginTop: "auto" }}
      >
        Open in the Linear A Research Workbench ↗
      </a>
    </div>
  );
}
