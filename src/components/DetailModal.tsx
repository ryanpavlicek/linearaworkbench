import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useFocusTrap } from "../lib/useFocusTrap";
import { wordToPhonetic, extractRoot } from "../lib/algorithms";
import { trainSignBigramModel, wordSurprisal } from "../lib/surprisal";
import { isLexicalWord } from "../data/commodities";
import {
  describeInscription,
  downloadFile,
  normalizeSignLabel,
  commentaryUrl,
  siglaUrl,
  siglaSignListUrl,
  upstreamAsset,
} from "../lib/helpers";
import { WordToken } from "./WordToken";
import { InscriptionLink } from "./InscriptionLink";
import { Glyph, GlyphRun } from "./Glyph";
import { AnnotationEditor } from "./AnnotationEditor";
import { PinButton } from "./PinRail";
import { CollectionPicker } from "./CollectionPicker";
import { CopyLinkButton } from "./CopyLinkButton";
import { CiteButton } from "./CiteButton";
import { WhatLinksHere } from "./WhatLinksHere";
import { inscriptionSnippet } from "../lib/pyaegean";
import { CommentaryPanel } from "./CommentaryPanel";
import {
  buildInscriptionExport,
  SCHEMA_VERSION,
  TOOL_NAME,
  TOOL_REPO,
  METHODOLOGY_URL,
} from "../lib/corpusExport";

// Images in the corpus are relative paths like "images/HT1-Facsimile.jpg".
// Resolve them through the shared upstream-asset helper which points at
// the local public/upstream/ mirror by default.
const imageUrl = upstreamAsset;

export function DetailModal() {
  const detail = useWorkbench((s) => s.detail);
  const close = useWorkbench((s) => s.closeDetail);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useFocusTrap(Boolean(detail), modalRef);

  if (!detail) return null;

  return (
    <div className="modal-scrim" onClick={close}>
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={
          detail.kind === "word"
            ? `Word detail: ${detail.value}`
            : `Inscription detail: ${detail.value}`
        }
        onClick={(e) => e.stopPropagation()}
      >
        {detail.kind === "word" ? (
          <WordDetailBody word={detail.value} />
        ) : (
          <InscriptionDetailBody id={detail.value} />
        )}
      </div>
    </div>
  );
}

function WordDetailBody({ word }: { word: string }) {
  const entry = useWorkbench((s) => s.corpus.wordIndex.get(word));
  const byId = useWorkbench((s) => s.corpus.byId);
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const signsByLabel = useWorkbench((s) => s.corpus.signsByLabel);
  const hypothesis = useWorkbench((s) => s.hypothesis);
  const close = useWorkbench((s) => s.closeDetail);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);

  // Graphotactic surprisal of this word against the whole corpus —
  // leave-one-out, percentile-ranked among multi-sign words. Cheap enough
  // to compute per open (the model is ~2,700 transitions), memoized so
  // unrelated store updates don't redo it. Before the early return: hooks
  // must run unconditionally.
  const surprisalInfo = useMemo(() => {
    if (!isLexicalWord(word)) return null;
    const list: { word: string; count: number }[] = [];
    for (const [w, e] of wordIndex)
      if (isLexicalWord(w)) list.push({ word: w, count: e.count });
    if (list.length < 20) return null;
    const model = trainSignBigramModel(list);
    const mine = wordSurprisal(model, word, wordIndex.get(word)?.count ?? 0);
    let moreSurprising = 0;
    for (const item of list) {
      if (wordSurprisal(model, item.word, item.count).mean > mine.mean)
        moreSurprising++;
    }
    return {
      mean: mine.mean,
      topPct: Math.min(
        100,
        Math.ceil((100 * (moreSurprising + 1)) / list.length),
      ),
    };
  }, [wordIndex, word]);

  if (!entry) return null;

  const phonetic = wordToPhonetic(word, hypothesis);
  const signParts = word.split("-");

  // Top contexts
  const insSlice = entry.inscriptionIds.slice(0, 20);

  // Co-occurrence — O(1) byId lookups rather than linear scans
  const cooc = new Map<string, number>();
  for (const id of entry.inscriptionIds) {
    const ins = byId.get(id);
    if (!ins) continue;
    for (const w of ins.words) {
      if (w === word || !w.includes("-")) continue;
      cooc.set(w, (cooc.get(w) ?? 0) + 1);
    }
  }
  const topCooc = [...cooc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Root cognates
  const root = extractRoot(word, hypothesis);
  const cognates: { word: string; count: number }[] = [];
  if (root.length >= 2) {
    for (const [w, e] of wordIndex) {
      if (w === word || !w.includes("-")) continue;
      if (extractRoot(w, hypothesis) === root)
        cognates.push({ word: w, count: e.count });
    }
    cognates.sort((a, b) => b.count - a.count);
  }

  return (
    <>
      <div className="modal-head">
        <div>
          <h3>{word}</h3>
          <div className="meta">
            phonetic <b style={{ color: "var(--text)" }}>/{phonetic}/</b> · count{" "}
            <b style={{ color: "var(--text)" }}>{entry.count}</b>
            {surprisalInfo && (
              <>
                {" "}
                · graphotactics{" "}
                <b
                  style={{
                    color:
                      surprisalInfo.topPct <= 10
                        ? "var(--am)"
                        : "var(--text)",
                  }}
                  title={`Mean leave-one-out surprisal under a corpus-wide sign-bigram model: ${surprisalInfo.mean.toFixed(2)} bits per transition — more improbable than all but ${surprisalInfo.topPct}% of multi-sign words. A high value means the sign sequence is unlike what the rest of the corpus writes (loanword? name? damaged reading?). Sequence-level only — no claim about sound or meaning.`}
                >
                  {surprisalInfo.mean.toFixed(1)} bits/step
                  {surprisalInfo.topPct <= 10
                    ? ` (top ${surprisalInfo.topPct}% unusual)`
                    : ""}
                </b>
              </>
            )}{" "}
            · sites{" "}
            {[...entry.sites].map((s) => (
              <span className="tag tag-site" key={s}>
                {s}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
          <PinButton kind="word" value={word} />
          <CollectionPicker kind="word" value={word} />
          <CopyLinkButton />
          <button
            className="modal-close"
            onClick={close}
            aria-label="Close"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="modal-body">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <span
            className="dim"
            style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}
          >
            Open in
          </span>
          {(
            [
              ["kwic", "Concordance"],
              ["comp", "Cross-linguistic"],
              ["cooc", "Co-occurrence"],
            ] as const
          ).map(([mod, label]) => (
            <button
              key={mod}
              className="btn btn-outline btn-sm"
              onClick={() => setActiveModule(mod, { focus: word })}
              title={`Open ${word} in ${label}`}
            >
              {label} →
            </button>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: "12px 16px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {signParts.map((sign, i) => {
            const data = signsByLabel.get(normalizeSignLabel(sign));
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  minWidth: 48,
                }}
                title={data?.phonetic ? `/${data.phonetic}/` : undefined}
              >
                <Glyph sign={sign} size={36} />
                <span
                  style={{
                    font: "500 11px var(--mono)",
                    color: "var(--text-dim)",
                  }}
                >
                  {sign}
                </span>
                {data?.phonetic && (
                  <span
                    style={{
                      font: "10px var(--mono)",
                      color: "var(--gn)",
                    }}
                  >
                    /{data.phonetic}/
                  </span>
                )}
                <a
                  href={siglaSignListUrl(sign)}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open SigLA's sign list and scroll to ${sign} — per-scribe variant drawings`}
                  style={{
                    font: "9px var(--sans)",
                    color: "var(--text-dim)",
                    textDecoration: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    padding: "1px 4px",
                  }}
                >
                  SigLA ↗
                </a>
              </div>
            );
          })}
        </div>

        {cognates.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <span className="dim">Root cognates /{root}/: </span>
            {cognates.slice(0, 8).map((c) => (
              <span key={c.word}>
                <WordToken word={c.word} /> <span className="dim">×{c.count}</span>{" "}
              </span>
            ))}
          </div>
        )}

        {topCooc.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h4
              style={{
                font: "600 10px var(--sans)",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 6,
              }}
            >
              Top co-occurrences
            </h4>
            {topCooc.map(([w, c]) => (
              <span key={w}>
                <WordToken word={w} /> <span className="dim">×{c}</span>{" "}
              </span>
            ))}
          </div>
        )}

        <h4
          style={{
            font: "600 10px var(--sans)",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 6,
          }}
        >
          Inscriptions ({entry.inscriptionIds.length})
        </h4>
        {insSlice.map((id) => {
          const ins = byId.get(id);
          if (!ins) return null;
          return (
            <div key={id} className="match-row">
              <span style={{ minWidth: 92 }}>
                <InscriptionLink id={id} />
              </span>
              <span className="dim" style={{ flex: 1 }}>
                {ins.words.map((w, i) =>
                  w === word ? (
                    <b style={{ color: "var(--ac)" }} key={i}>
                      {w}{" "}
                    </b>
                  ) : (
                    <span key={i}>{w} </span>
                  ),
                )}
              </span>
            </div>
          );
        })}

        <AnnotationEditor target={{ kind: "word", value: word }} />
      </div>
    </>
  );
}

function InscriptionNavigator({ id }: { id: string }) {
  const inscriptions = useWorkbench((s) => s.corpus.inscriptions);
  const byId = useWorkbench((s) => s.corpus.byId);
  const show = useWorkbench((s) => s.showInscription);
  const [axis, setAxis] = useState<"corpus" | "site" | "scribe" | "period">(
    "corpus",
  );

  const current = byId.get(id);
  const peers = current
    ? axis === "corpus"
      ? inscriptions
      : axis === "site"
        ? inscriptions.filter((i) => i.site === current.site)
        : axis === "scribe"
          ? inscriptions.filter((i) => i.scribe === current.scribe && current.scribe)
          : inscriptions.filter((i) => i.context === current.context && current.context)
    : [];
  const idx = peers.findIndex((i) => i.id === id);
  const prev = idx > 0 ? peers[idx - 1] : null;
  const next = idx >= 0 && idx < peers.length - 1 ? peers[idx + 1] : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        show(prev.id);
      }
      if (e.altKey && e.key === "ArrowRight" && next) {
        e.preventDefault();
        show(next.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, show]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        border: "1px solid var(--border)",
        borderRadius: 4,
        background: "var(--surface-1)",
      }}
      title={`Step through inscriptions by ${axis} (Alt+←/→)`}
    >
      <button
        className="btn btn-outline btn-sm"
        disabled={!prev}
        onClick={() => prev && show(prev.id)}
        style={{ borderRadius: "4px 0 0 4px", border: 0 }}
      >
        ←
      </button>
      <span
        className="dim"
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          paddingLeft: 4,
          pointerEvents: "none",
        }}
      >
        by
      </span>
      <select
        className="select"
        value={axis}
        onChange={(e) => setAxis(e.target.value as typeof axis)}
        title="Choose what the ← / → arrows step through"
        style={{
          fontSize: 10,
          padding: "2px 4px",
          border: 0,
          background: "transparent",
        }}
      >
        <option value="corpus">corpus order</option>
        <option value="site">same site</option>
        <option value="scribe">same scribe</option>
        <option value="period">same period</option>
      </select>
      <button
        className="btn btn-outline btn-sm"
        disabled={!next}
        onClick={() => next && show(next.id)}
        style={{ borderRadius: "0 4px 4px 0", border: 0 }}
      >
        →
      </button>
    </div>
  );
}

function InscriptionDetailBody({ id }: { id: string }) {
  const ins = useWorkbench((s) => s.corpus.byId.get(id));
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const close = useWorkbench((s) => s.closeDetail);
  // For the per-inscription JSON export — same builder the bulk export uses,
  // so the schema is identical. Includes the researcher's annotations,
  // collection memberships, and pin state by default (they're looking at one
  // specific tablet — if they save it, they probably want their notes).
  const annotations = useWorkbench((s) => s.annotations);
  const collections = useWorkbench((s) => s.collections);
  const pins = useWorkbench((s) => s.pins);
  const tabletCategories = useWorkbench((s) => s.tabletCategories);
  const toast = useWorkbench((s) => s.toast_show);
  const [showImage, setShowImage] = useState<"facsimile" | "photo" | null>(
    null,
  );
  const [showGlosses, setShowGlosses] = useState(false);

  if (!ins) return null;

  function exportJson() {
    if (!ins) return;
    const record = buildInscriptionExport(ins, {
      includeUserState: true,
      annotations,
      collections,
      pins,
      tabletCategoryOverrides: tabletCategories,
    });
    const wrapped = {
      _meta: {
        exportedAt: new Date().toISOString(),
        tool: TOOL_NAME,
        toolRepo: TOOL_REPO,
        methodologyUrl: METHODOLOGY_URL,
        schemaVersion: SCHEMA_VERSION,
        inscriptionCount: 1,
        notes: [
          "Single-inscription export. Same schema as the full corpus export — `inscriptions[]` is just length 1 here.",
          "`derived.tabletStructureCategory` reflects any researcher override; `userState` carries annotations / collections / pin state at export time.",
        ],
      },
      inscriptions: [record],
    };
    downloadFile(
      `linear_a_${ins.id.replace(/[^A-Za-z0-9]+/g, "_")}.json`,
      JSON.stringify(wrapped, null, 2),
      "application/json",
    );
    toast(`Exported ${ins.id} as JSON`);
  }

  const facsimile = ins.facsimileImages[0];
  const photo = ins.images[0];
  // Editorial English glosses differ from transliteration at positions where
  // the upstream maps a sign or word to a known meaning (e.g. OLE+U → "olive
  // oil"). If the arrays are identical there's nothing to show.
  const hasGlosses =
    ins.translations.length > 0 &&
    ins.translations.some((t, i) => t !== ins.words[i]);

  return (
    <>
      <div className="modal-head">
        <div>
          <h3>{ins.id}</h3>
          <div className="meta">
            site <b style={{ color: "var(--text)" }}>{ins.site}</b>
            {ins.context && (
              <>
                {" "}
                · period{" "}
                <b style={{ color: "var(--text)" }}>{ins.context}</b>
              </>
            )}
            {ins.scribe && (
              <>
                {" "}
                · <b style={{ color: "var(--text)" }}>{ins.scribe}</b>
              </>
            )}
            <br />
            {describeInscription(ins)} · {ins.words.length} tokens
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
          <InscriptionNavigator id={ins.id} />
          <a
            className="btn btn-outline btn-sm"
            href={commentaryUrl(ins.id)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the bundled commentary file in a standalone tab. The same commentary is also rendered inline below."
          >
            Commentary ↗
          </a>
          <a
            className="btn btn-outline btn-sm"
            href={siglaUrl(ins.id)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the paleographic record for this inscription on SigLA (signs of Linear A — per-scribe sign drawings)"
          >
            Paleography ↗
          </a>
          <button
            className="btn btn-outline btn-sm"
            onClick={exportJson}
            title="Download this inscription as structured JSON — all canonical metadata, the workbench's derived analyses (tablet-structure category, accounting balance check), and your annotations / collection memberships / pin state. Same schema as Data Export › Full corpus JSON."
          >
            JSON ↓
          </button>
          <CiteButton id={ins.id} site={ins.site} />
          <button
            className="btn btn-outline btn-sm"
            title="Copy a pyaegean snippet that loads this inscription in Python (pip install pyaegean — the toolkit that ports this workbench's analysis)"
            onClick={() => {
              if (!navigator.clipboard) {
                toast("Copying needs a secure (https) context", "error");
                return;
              }
              navigator.clipboard.writeText(inscriptionSnippet(ins.id)).then(
                () => toast("pyaegean snippet copied"),
                () => toast("Couldn't copy the snippet", "error"),
              );
            }}
          >
            Py ⧉
          </button>
          <PinButton kind="inscription" value={ins.id} />
          <CollectionPicker kind="inscription" value={ins.id} />
          <CopyLinkButton />
          <button
            className="modal-close"
            onClick={close}
            aria-label="Close"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="modal-body">
        {ins.glyphs && (
          <div
            style={{
              padding: "16px 18px",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              marginBottom: 16,
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
              Glyphs (parsed inscription)
            </div>
            <GlyphRun glyphs={ins.glyphs} size={26} />
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
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
            {showGlosses ? "Editorial glosses" : "Transliteration"}
          </span>
          {hasGlosses && (
            <button
              className="btn btn-outline btn-sm"
              style={{ padding: "2px 8px", fontSize: 10 }}
              onClick={() => setShowGlosses((g) => !g)}
              title="Toggle transliteration vs. English glosses"
            >
              {showGlosses ? "Show GORILA" : "Show English"}
            </button>
          )}
        </div>
        <div className="inscription-content" style={{ marginBottom: 16 }}>
          {showGlosses
            ? ins.translations.map((t, i) => {
                const orig = ins.words[i] ?? "";
                const isTranslated = t !== orig;
                if (isTranslated)
                  return (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        padding: "1px 5px",
                        margin: "0 2px 2px 0",
                        background: "#3ddc9112",
                        border: "1px solid #3ddc9140",
                        borderRadius: 3,
                        font: "italic 12px var(--serif)",
                        color: "var(--gn)",
                      }}
                      title={`GORILA: ${orig}`}
                    >
                      {t.replace(/^"|"$/g, "")}
                    </span>
                  );
                if (!orig.includes("-"))
                  return (
                    <span key={i} className="dim">
                      {t}{" "}
                    </span>
                  );
                return <WordToken key={i} word={orig} />;
              })
            : ins.words.map((w, i) => {
                const entry = wordIndex.get(w);
                const f = entry?.count ?? 0;
                const cls =
                  f > 20
                    ? "word-freq-hi"
                    : f > 5
                      ? "word-freq-md"
                      : "word-freq-lo";
                return <WordToken key={i} word={w} freqClass={cls} />;
              })}
        </div>

        {(facsimile || photo) && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 8,
                alignItems: "center",
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
                Imagery
              </span>
              {facsimile && (
                <button
                  className={`tab-btn${showImage === "facsimile" ? " active" : ""}`}
                  onClick={() =>
                    setShowImage(showImage === "facsimile" ? null : "facsimile")
                  }
                >
                  Facsimile
                </button>
              )}
              {photo && (
                <button
                  className={`tab-btn${showImage === "photo" ? " active" : ""}`}
                  onClick={() =>
                    setShowImage(showImage === "photo" ? null : "photo")
                  }
                >
                  Photograph
                </button>
              )}
              {ins.imageRights && (
                <span
                  className="dim"
                  style={{ flex: 1, fontSize: 10, textAlign: "right" }}
                >
                  {ins.imageRightsURL ? (
                    <a
                      href={upstreamAsset(ins.imageRightsURL)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ins.imageRights}
                    </a>
                  ) : (
                    ins.imageRights
                  )}
                </span>
              )}
            </div>
            {showImage && (
              <img
                src={imageUrl(showImage === "facsimile" ? facsimile : photo!)}
                alt={`${ins.id} ${showImage}`}
                style={{
                  width: "100%",
                  maxHeight: 480,
                  objectFit: "contain",
                  borderRadius: 6,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              />
            )}
          </div>
        )}

        <WhatLinksHere inscriptionId={ins.id} />

        <CommentaryPanel inscriptionId={ins.id} />

        <AnnotationEditor target={{ kind: "inscription", value: ins.id }} />
      </div>
    </>
  );
}
