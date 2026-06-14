import { useEffect, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { upstreamAsset, siglaUrl } from "../lib/helpers";
import { GORILA_CEFAEL_URL } from "../lib/citations";
import { Glyph } from "../components/Glyph";

// Autopsy mode: the published image large on the left, the
// transliteration line by line on the right, so a reading can be
// checked against the plate it came from. Facsimile drawings first
// (they're the edition's own reading), photographs after; prev/next
// walks every imaged document. Images stream from the upstream mirror
// on demand and stay under their EfA rights.

export default function PlateWorkbench() {
  const scoped = useScopedCorpus();
  const showInscription = useWorkbench((s) => s.showInscription);
  const initialIntent = useWorkbench.getState().moduleIntent;

  const imaged = useMemo(
    () =>
      scoped.inscriptions.filter(
        (i) => i.facsimileImages.length > 0 || i.images.length > 0,
      ),
    [scoped.inscriptions],
  );

  const [idx, setIdx] = useState(() => {
    if (initialIntent?.focus) {
      const k = imaged.findIndex((i) => i.id === initialIntent.focus);
      if (k >= 0) return k;
    }
    return 0;
  });
  const [imgIdx, setImgIdx] = useState(0);

  // Clamp idx when the Scope narrows the imaged set out from under it —
  // otherwise a stale high index points past the end and the component
  // falsely renders "No imaged inscriptions" while documents still exist.
  useEffect(() => {
    if (idx > imaged.length - 1) setIdx(Math.max(0, imaged.length - 1));
  }, [imaged.length, idx]);

  const ins = imaged[Math.min(idx, imaged.length - 1)];
  const images = useMemo(
    () => (ins ? [...ins.facsimileImages, ...ins.images] : []),
    [ins],
  );

  useEffect(() => setImgIdx(0), [idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") setIdx((i) => Math.min(imaged.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imaged.length]);

  if (!ins)
    return (
      <div className="panel">
        <h2>Plate Workbench</h2>
        <div className="dim">No imaged inscriptions in the current Scope.</div>
      </div>
    );

  return (
    <div className="panel" style={{ maxWidth: 1200 }}>
      <h2>Plate Workbench</h2>
      <div className="callout">
        <h4>Check the reading against the plate</h4>
        <p>
          Every transliteration in this corpus descends from a published
          image — here they sit side by side. Facsimile drawings come
          first (they are the edition's own reading, not neutral
          evidence); photographs after. Use ←/→ or the buttons to walk all{" "}
          {imaged.length.toLocaleString()} imaged documents, and the
          CEFAEL link to read the GORILA volumes themselves.
        </p>
      </div>

      <div className="toolbar">
        <button
          className="btn btn-outline btn-sm"
          disabled={idx === 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
        >
          ← Prev
        </button>
        <input
          className="input"
          list="plate-ids"
          value={ins.id}
          onChange={(e) => {
            const k = imaged.findIndex((i) => i.id === e.target.value.toUpperCase());
            if (k >= 0) setIdx(k);
          }}
          style={{ width: 130, fontFamily: "var(--mono)" }}
        />
        <datalist id="plate-ids">
          {imaged.map((i) => (
            <option key={i.id} value={i.id} />
          ))}
        </datalist>
        <button
          className="btn btn-outline btn-sm"
          disabled={idx >= imaged.length - 1}
          onClick={() => setIdx((i) => Math.min(imaged.length - 1, i + 1))}
        >
          Next →
        </button>
        <span className="dim" style={{ fontSize: 12 }}>
          {idx + 1} / {imaged.length} · {ins.site}
          {ins.support ? ` · ${ins.support}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-outline btn-sm"
          onClick={() => showInscription(ins.id)}
        >
          Full record
        </button>
        <a
          className="btn btn-outline btn-sm"
          href={siglaUrl(ins.id)}
          target="_blank"
          rel="noreferrer"
          title="Sign-by-sign paleography at SigLA"
        >
          ↗ SigLA
        </a>
        <a
          className="btn btn-outline btn-sm"
          href={GORILA_CEFAEL_URL}
          target="_blank"
          rel="noreferrer"
          title="The GORILA volumes, digitized at CEFAEL"
        >
          ↗ GORILA
        </a>
      </div>

      <div className="col2" style={{ gridTemplateColumns: "3fr 2fr" }}>
        <div className="card" style={{ textAlign: "center" }}>
          {images.length > 0 ? (
            <>
              <img
                key={images[imgIdx]}
                src={upstreamAsset(images[imgIdx])}
                alt={`${ins.id} — ${imgIdx < ins.facsimileImages.length ? "facsimile drawing" : "photograph"}`}
                style={{
                  maxWidth: "100%",
                  maxHeight: 560,
                  objectFit: "contain",
                  background: "var(--surface-1)",
                  borderRadius: 4,
                }}
              />
              {images.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    justifyContent: "center",
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {images.map((im, i) => (
                    <button
                      key={im}
                      className="btn btn-outline btn-sm"
                      style={{
                        fontSize: 10,
                        background: i === imgIdx ? "var(--surface-1)" : undefined,
                      }}
                      onClick={() => setImgIdx(i)}
                    >
                      {i < ins.facsimileImages.length
                        ? `drawing ${i + 1}`
                        : `photo ${i + 1 - ins.facsimileImages.length}`}
                    </button>
                  ))}
                </div>
              )}
              <div className="dim" style={{ fontSize: 10, marginTop: 6 }}>
                {ins.imageRights || "© École Française d'Athènes"}
                {ins.imageRightsURL && (
                  <>
                    {" · "}
                    <a href={ins.imageRightsURL} target="_blank" rel="noreferrer">
                      rights
                    </a>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="dim">No image files for this document.</div>
          )}
        </div>

        <div className="card">
          <h4>{ins.id} — transliteration</h4>
          <div style={{ display: "grid", gap: 6 }}>
            {ins.lines.map((line, li) => (
              <div
                key={li}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: 4,
                }}
              >
                <span className="dim" style={{ fontSize: 10, width: 20 }}>
                  .{li + 1}
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {line.map((tok, ti) => (
                    <span key={ti} style={{ textAlign: "center" }}>
                      {tok.includes("-") && (
                        <div>
                          {tok.split("-").map((p, pi) => (
                            <Glyph key={pi} sign={p} size={16} />
                          ))}
                        </div>
                      )}
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                        {tok}
                      </span>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          {ins.scribe && (
            <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
              hand: {ins.scribe}
              {ins.context ? ` · ${ins.context}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
