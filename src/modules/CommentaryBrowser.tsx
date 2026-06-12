import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useScopedCorpus } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import {
  fetchCommentaryFile,
  loadCommentaryIndex,
  YOUNGER_ACADEMIA_URL,
  type CommentaryDoc,
  type CommentaryIndex,
} from "../lib/commentary";
import { upstreamAsset } from "../lib/helpers";
import { highlightHtml, linkifyTabletRefs } from "../lib/highlight";
import { SaveFindingButton } from "../components/SaveFindingButton";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "../lib/reportSnippet";
import type { Inscription, WordEntry } from "../lib/types";

// 4-state imagery toggle for the right pane. Off is the default — keeps the
// reading surface uncluttered and avoids fetching imagery the researcher
// didn't ask for. The non-off states mirror what Corpus Browser's Imagery
// tab uses so the controls feel the same across the app.
type ImageMode = "off" | "facsimile" | "photograph" | "both";

// Standalone browse/search surface over the 1,694 commentary HTML files
// bundled in public/upstream/commentary/. Complement to the inline
// CommentaryPanel that lives inside each inscription detail modal — that
// surface is "I'm looking at HT13, show me the commentary on HT13"; this
// one is "let me read across the commentary archive itself" (browse by site,
// full-text search, jump to corpus inscription if there's a match).
//
// Index is a slim pre-built JSON (~558 KB) emitted by
// scripts/build-commentary-index.mjs and loaded once on mount; full-text
// search runs in-memory against the lowercased stripped text. Rendered
// commentary HTML is lazy-fetched per selected doc and cached.

interface SearchHit {
  doc: CommentaryDoc;
  /** Number of times the query string appears in the doc's text. 0 means
   *  the doc passed the site filter but the search hasn't matched it. */
  hits: number;
}

const TEXT_CACHE = new Map<string, string | null>();

export default function CommentaryBrowser() {
  const { wordIndex } = useScopedCorpus();
  const inscriptionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of useWorkbench.getState().corpus.byId.keys()) ids.add(id);
    return ids;
  }, []);
  const showInscription = useWorkbench((s) => s.showInscription);

  const [index, setIndex] = useState<CommentaryIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null | undefined>(undefined);
  // Per-session imagery toggle — defaults to off so the reading surface is
  // uncluttered and the module loads with no extra image fetches.
  const [imageMode, setImageMode] = useState<ImageMode>("off");
  // Click-to-enlarge lightbox for the imagery thumbnails.
  const [lightbox, setLightbox] = useState<{
    src: string;
    alt: string;
    caption: React.ReactNode;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCommentaryIndex()
      .then((idx) => {
        if (!cancelled) setIndex(idx);
      })
      .catch((e) => {
        if (!cancelled) setIndexError(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazy-fetch the selected doc's full HTML.
  useEffect(() => {
    if (!selectedId || !index) return;
    const doc = index.docs.find((d) => d.id === selectedId);
    if (!doc) return;
    if (TEXT_CACHE.has(doc.filename)) {
      setHtml(TEXT_CACHE.get(doc.filename) ?? null);
      return;
    }
    let cancelled = false;
    setHtml(undefined);
    fetchCommentaryFile(doc.filename).then((cleaned) => {
      TEXT_CACHE.set(doc.filename, cleaned);
      if (!cancelled) setHtml(cleaned);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, index]);

  // Site filter chip set: each unique site + its doc count, in count-desc
  // then alpha order (matches how researchers think — "what big sites do I
  // have material for first").
  const siteCounts = useMemo(() => {
    if (!index) return [];
    const m = new Map<string, number>();
    for (const d of index.docs) m.set(d.site, (m.get(d.site) ?? 0) + 1);
    return [...m.entries()]
      .map(([site, count]) => ({ site, count }))
      .sort((a, b) => b.count - a.count || a.site.localeCompare(b.site));
  }, [index]);

  // The pipeline: site filter → full-text search → group by site.
  const { groupedHits, totalShown, totalMatched } = useMemo(() => {
    if (!index) return { groupedHits: [], totalShown: 0, totalMatched: 0 };
    const q = query.trim().toLowerCase();
    let docs: CommentaryDoc[] = index.docs;
    if (siteFilter) docs = docs.filter((d) => d.site === siteFilter);

    const hits: SearchHit[] = [];
    let matched = 0;
    for (const d of docs) {
      if (!q) {
        hits.push({ doc: d, hits: 0 });
      } else {
        const n = countOccurrences(d.text, q);
        if (n > 0) {
          hits.push({ doc: d, hits: n });
          matched++;
        }
      }
    }

    // When a query is active, sort all matched docs by hit count desc.
    // When not, preserve the index's site/type/num natural order.
    if (q) hits.sort((a, b) => b.hits - a.hits || a.doc.id.localeCompare(b.doc.id));

    // Group by site (keeps the same order the sort produced — first
    // appearance of each site wins).
    const groupOrder: string[] = [];
    const groups = new Map<string, SearchHit[]>();
    for (const h of hits) {
      if (!groups.has(h.doc.site)) {
        groups.set(h.doc.site, []);
        groupOrder.push(h.doc.site);
      }
      groups.get(h.doc.site)!.push(h);
    }
    return {
      groupedHits: groupOrder.map((site) => ({ site, docs: groups.get(site)! })),
      totalShown: hits.length,
      totalMatched: matched,
    };
  }, [index, query, siteFilter]);

  const selectedDoc = useMemo(
    () => (index && selectedId ? index.docs.find((d) => d.id === selectedId) ?? null : null),
    [index, selectedId],
  );

  // Does the selected commentary doc's id resolve to a loaded inscription?
  // The commentary archive covers more inscriptions than the workbench loads
  // (it includes some that mwenge's transcription skips), so we check.
  const selectedHasInscription = useMemo(() => {
    if (!selectedDoc) return false;
    if (inscriptionIds.has(selectedDoc.id)) return true;
    // Also check for "HT1a" → "HT1" style fragment commentaries
    const base = selectedDoc.id.replace(/[a-z]$/, "");
    return inscriptionIds.has(base);
  }, [selectedDoc, inscriptionIds]);

  const selectedInscriptionId = useMemo(() => {
    if (!selectedDoc) return null;
    if (inscriptionIds.has(selectedDoc.id)) return selectedDoc.id;
    const base = selectedDoc.id.replace(/[a-z]$/, "");
    if (inscriptionIds.has(base)) return base;
    return null;
  }, [selectedDoc, inscriptionIds]);

  // Pull the full inscription record for the matched id so we can read its
  // image arrays. Done via getState() rather than a selector because the
  // corpus byId Map is stable — no re-render needed when selection changes.
  const selectedInscription: Inscription | null = useMemo(() => {
    if (!selectedInscriptionId) return null;
    return useWorkbench.getState().corpus.byId.get(selectedInscriptionId) ?? null;
  }, [selectedInscriptionId]);

  const hasFacsimile = (selectedInscription?.facsimileImages.length ?? 0) > 0;
  const hasPhoto = (selectedInscription?.images.length ?? 0) > 0;
  const showFacsimile = imageMode === "facsimile" || imageMode === "both";
  const showPhoto = imageMode === "photograph" || imageMode === "both";

  // Used in the right pane to surface word-cloud-style stats about the
  // selected doc (how many distinct Linear A word tokens the workbench has
  // loaded for the corresponding inscription).
  const selectedWordCount = useMemo(() => {
    if (!selectedInscriptionId) return 0;
    let n = 0;
    for (const entry of wordIndex.values() as IterableIterator<WordEntry>) {
      if (entry.inscriptionIds.includes(selectedInscriptionId)) n++;
    }
    return n;
  }, [selectedInscriptionId, wordIndex]);

  if (indexError) {
    return (
      <div className="panel">
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Commentary Browser</h3>
          <p className="dim">
            Couldn't load the commentary search index:{" "}
            <code>{indexError}</code>.
          </p>
          <p className="dim" style={{ fontSize: 12 }}>
            If you're running locally, try{" "}
            <code>npm run commentary:index</code> to (re)build{" "}
            <code>public/corpus/commentary-index.json</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!index) {
    return (
      <div className="panel">
        <div style={{ padding: 16 }} className="dim">
          Loading {`1,694`} commentary docs…
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Commentary Browser</h3>
          <span
            title="Descriptive: presents source material as-is, no derived analysis"
            style={{
              font: "600 10px var(--sans)",
              color: "var(--gn)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              border: "1px solid var(--gn)",
              borderRadius: 3,
              padding: "1px 5px",
            }}
          >
            Descriptive
          </span>
          <span className="dim" style={{ fontSize: 12 }}>
            {index.docs.length.toLocaleString()} bundled commentary docs · pre-2024 KU
            mirror via mwenge/lineara.xyz
          </span>
        </div>
        <p className="dim" style={{ fontSize: 13, margin: "6px 0 0", maxWidth: 720 }}>
          Browse John Younger's per-tablet commentary directly. The archive
          covers more inscriptions than the workbench's loaded corpus —
          including ones whose transliterations the upstream skipped — so use
          this as the read-the-scholarship-itself surface.
        </p>
      </div>

      {/* Search + filter row */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search commentary text (e.g. libation, Hagia Triada, KU-RO)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, padding: "6px 10px", font: "13px var(--sans)" }}
          />
          {query && (
            <button className="btn btn-outline" onClick={() => setQuery("")} title="Clear search">
              ✕
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="dim" style={{ fontSize: 11, marginRight: 4 }}>
            Site:
          </span>
          <SiteChip
            label="All"
            count={index.docs.length}
            active={siteFilter === null}
            onClick={() => setSiteFilter(null)}
          />
          {siteCounts.slice(0, 12).map(({ site, count }) => (
            <SiteChip
              key={site}
              label={site}
              count={count}
              active={siteFilter === site}
              onClick={() => setSiteFilter(siteFilter === site ? null : site)}
            />
          ))}
          {siteCounts.length > 12 && (
            <span className="dim" style={{ fontSize: 11 }}>
              + {siteCounts.length - 12} smaller sites
            </span>
          )}
        </div>
        <div
          className="dim"
          style={{
            fontSize: 11,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>
            {query
              ? `${totalMatched.toLocaleString()} doc${totalMatched === 1 ? "" : "s"} match "${query.trim()}"${siteFilter ? ` in ${siteFilter}` : ""}`
              : `Showing ${totalShown.toLocaleString()} doc${totalShown === 1 ? "" : "s"}${siteFilter ? ` from ${siteFilter}` : ""}`}
          </span>
          {query.trim() && totalMatched > 0 && (
            <SaveFindingButton
              module="commentary"
              moduleLabel="Commentary Browser"
              defaultTitle={`Commentary search: ${query.trim()}`}
              summary={
                `"${query.trim()}" matches ${totalMatched} commentary doc${totalMatched === 1 ? "" : "s"}${siteFilter ? ` at ${siteFilter}` : ""}.\nTop: ` +
                (groupedHits
                  .flatMap((g) => g.docs)
                  .slice(0, 10)
                  .map((h) => `${h.doc.id} (${h.hits}×)`)
                  .join(", ") || "none") +
                "."
              }
              payload={{ query: query.trim(), siteFilter }}
              reportFn={() => {
                const slice = groupedHits
                  .flatMap((g) => g.docs)
                  .slice(0, 60);
                type R = (typeof slice)[number];
                const cols: SnippetColumn<R>[] = [
                  {
                    label: "Document",
                    render: (h) => `<code>${esc(h.doc.id)}</code>`,
                  },
                  { label: "Site", render: (h) => esc(h.doc.site) },
                  {
                    label: "Hits",
                    render: (h) => esc(h.hits),
                    align: "right",
                  },
                ];
                const meta = `Younger's commentary: "${query.trim()}" matches ${totalMatched} docs${siteFilter ? ` at ${siteFilter}` : ""}, ranked by hit count. ${slice.length < totalMatched ? `Showing the first ${slice.length}.` : ""}`;
                return {
                  html: snippetWrap(meta, snippetTable(slice, cols)),
                  markdown: `_${meta}_\n\n` + snippetTableMd(slice, cols),
                };
              }}
            />
          )}
        </div>
      </div>

      {/* Two-pane body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(220px, 320px) 1fr", minHeight: 0 }}>
        {/* Left pane: doc list */}
        <div
          style={{
            overflowY: "auto",
            borderRight: "1px solid var(--border)",
            background: "var(--surface-0)",
          }}
        >
          {groupedHits.length === 0 && (
            <div className="dim" style={{ padding: 16, fontSize: 12 }}>
              No commentary docs match.
            </div>
          )}
          {groupedHits.map(({ site, docs }) => (
            <div key={site}>
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--surface-1)",
                  padding: "4px 10px",
                  font: "600 10px var(--sans)",
                  color: "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  borderBottom: "1px solid var(--border)",
                  zIndex: 1,
                }}
              >
                {site} <span style={{ opacity: 0.6 }}>· {docs.length}</span>
              </div>
              {docs.map(({ doc, hits }) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  hits={hits}
                  query={query}
                  selected={doc.id === selectedId}
                  onClick={() => setSelectedId(doc.id)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Right pane: reader */}
        <div style={{ overflowY: "auto", padding: 16, minWidth: 0 }}>
          {!selectedDoc && (
            <div className="dim" style={{ fontSize: 13 }}>
              Select a commentary doc on the left to read it here.
              <ul style={{ marginTop: 12, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>
                  Type in the search box to find all commentary mentioning a
                  word or phrase (matches are ranked by hit count).
                </li>
                <li>
                  Use the site chips to narrow to one findspot's docs.
                </li>
                <li>
                  Each doc's body renders with the original{" "}
                  <code>&lt;font color&gt;</code> annotations re-themed to the
                  app palette. The <b>standalone ↗</b> link opens the raw
                  bundled HTML in a new tab.
                </li>
              </ul>
            </div>
          )}

          {selectedDoc && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <h4 style={{ margin: 0, fontSize: 18 }}>{selectedDoc.id}</h4>
                <span className="dim" style={{ fontSize: 11 }}>
                  {selectedDoc.filename} · site {selectedDoc.site}
                  {selectedDoc.type ? ` · type ${selectedDoc.type}` : ""}
                </span>
                <span style={{ flex: 1 }} />
                {selectedInscriptionId && (
                  <button
                    className="btn btn-outline"
                    onClick={() => showInscription(selectedInscriptionId)}
                    title="Open the corresponding inscription's detail modal (transliteration, glyphs, facsimile…)"
                  >
                    Open inscription →
                  </button>
                )}
                <a
                  href={`${import.meta.env.BASE_URL?.replace(/\/+$/, "") ?? ""}/upstream/commentary/${encodeURIComponent(selectedDoc.filename)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dim"
                  style={{ fontSize: 11 }}
                  title="Open the raw bundled HTML file in a new tab"
                >
                  standalone ↗
                </a>
              </div>

              {/* Imagery toggle row — only meaningful when the doc has a
                  matching loaded inscription, since otherwise there are no
                  bundled images. Disabled-but-visible in that case so users
                  understand why the toggle has no effect on those docs. */}
              <ImageToggleRow
                mode={imageMode}
                setMode={setImageMode}
                hasInscription={!!selectedInscriptionId}
                hasFacsimile={hasFacsimile}
                hasPhoto={hasPhoto}
              />

              {/* Imagery strip — stacks above the commentary when toggled on
                  and the matched inscription actually has the chosen image
                  type(s). Facsimile drawings have a light background painted
                  in so dark-theme transparency doesn't render them invisible;
                  photographs sit on the app surface unchanged. */}
              {selectedInscription && imageMode !== "off" && (hasFacsimile || hasPhoto) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    marginBottom: 12,
                    alignItems: "flex-start",
                  }}
                >
                  {showFacsimile && hasFacsimile && (
                    <ImageThumb
                      src={upstreamAsset(selectedInscription.facsimileImages[0])}
                      alt={`${selectedInscription.id} facsimile drawing`}
                      bg="#f4f1ea"
                      captionColor="#666"
                      caption={<>Facsimile · {selectedInscription.id}</>}
                      onOpen={(src, alt, caption) => setLightbox({ src, alt, caption })}
                    />
                  )}
                  {showPhoto && hasPhoto && (
                    <ImageThumb
                      src={upstreamAsset(selectedInscription.images[0])}
                      alt={`${selectedInscription.id} photograph`}
                      bg="var(--surface-1)"
                      caption={
                        <>
                          Photograph · {selectedInscription.id}
                          {selectedInscription.imageRights && (
                            <>
                              {" · "}
                              <span style={{ fontStyle: "italic" }}>
                                {selectedInscription.imageRights.startsWith("©")
                                  ? selectedInscription.imageRights
                                  : `© ${selectedInscription.imageRights}`}
                              </span>
                            </>
                          )}
                        </>
                      }
                      onOpen={(src, alt, caption) => setLightbox({ src, alt, caption })}
                    />
                  )}
                  {/* Honest no-imagery hint when the inscription is loaded
                      but doesn't have the image type(s) the user picked.
                      (imageMode is already narrowed to non-"off" by the
                      enclosing conditional.) */}
                  {((showFacsimile && !hasFacsimile) ||
                    (showPhoto && !hasPhoto)) && (
                      <div
                        className="dim"
                        style={{ fontSize: 11, fontStyle: "italic", flexBasis: "100%" }}
                      >
                        {!hasFacsimile && showFacsimile && !hasPhoto && !showPhoto
                          ? `No facsimile bundled for ${selectedInscription.id}.`
                          : !hasPhoto && showPhoto && !hasFacsimile && !showFacsimile
                            ? `No photograph bundled for ${selectedInscription.id}.`
                            : imageMode === "both"
                              ? `Only ${hasFacsimile ? "facsimile" : "photograph"} bundled for ${selectedInscription.id}.`
                              : null}
                      </div>
                    )}
                </div>
              )}

              {/* Edge case: inscription loaded but has zero imagery of any
                  kind, AND the toggle is on. Surface honestly. */}
              {selectedInscription &&
                imageMode !== "off" &&
                !hasFacsimile &&
                !hasPhoto && (
                  <div
                    className="dim"
                    style={{
                      fontSize: 11,
                      fontStyle: "italic",
                      marginBottom: 12,
                    }}
                  >
                    The workbench has no facsimile or photograph bundled for{" "}
                    {selectedInscription.id}.
                  </div>
                )}

              {!selectedHasInscription && (
                <div
                  className="dim"
                  style={{
                    fontSize: 11,
                    fontStyle: "italic",
                    background: "var(--surface-1)",
                    border: "1px dashed var(--border)",
                    borderRadius: 4,
                    padding: "4px 8px",
                    marginBottom: 10,
                  }}
                >
                  This commentary doc covers an inscription the workbench's
                  loaded corpus doesn't include. You can still read the
                  commentary; the workbench just has no transliteration /
                  glyphs / facsimile for it.
                </div>
              )}

              {selectedInscriptionId && selectedWordCount > 0 && (
                <div className="dim" style={{ fontSize: 11, marginBottom: 10 }}>
                  This inscription is loaded with <b>{selectedWordCount}</b>{" "}
                  distinct word token{selectedWordCount === 1 ? "" : "s"}.
                  Open the inscription to see them aligned with the
                  facsimile and glyphs.
                </div>
              )}

              {html === undefined && (
                <div className="dim" style={{ fontSize: 12 }}>
                  Loading commentary…
                </div>
              )}
              {html === null && (
                <div className="dim" style={{ fontSize: 12 }}>
                  Couldn't load <code>{selectedDoc.filename}</code>. If you're
                  running with{" "}
                  <code>VITE_COMMENTARY_BASE</code> pointing at upstream, the
                  file may not be on the remote.
                </div>
              )}
              {html !== undefined && html !== null && (
                <div
                  className="commentary-panel"
                  // Trusted: bundled mirror + sanitized in lib/commentary.
                  // Tablet references that resolve to loaded corpus ids
                  // become clickable (delegated below); an active search
                  // gets its hits marked in the text.
                  onClick={(e) => {
                    const a = (e.target as HTMLElement).closest(
                      "[data-ins]",
                    );
                    const id = a?.getAttribute("data-ins");
                    if (id) {
                      e.preventDefault();
                      showInscription(id);
                    }
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightHtml(
                      linkifyTabletRefs(html, (cand) => {
                        if (inscriptionIds.has(cand)) return cand;
                        const base = cand.replace(/[a-z]$/, "");
                        return base !== cand && inscriptionIds.has(base)
                          ? base
                          : null;
                      }),
                      query,
                    ),
                  }}
                />
              )}

              <div
                className="dim"
                style={{
                  marginTop: 14,
                  paddingTop: 10,
                  borderTop: "1px dashed var(--border)",
                  fontSize: 11,
                  fontStyle: "italic",
                }}
              >
                Commentary mirrored from Younger's pre-2024 KU-hosted site
                (via mwenge/lineara.xyz). Younger now publishes updated
                material as PDFs on{" "}
                <a href={YOUNGER_ACADEMIA_URL} target="_blank" rel="noopener noreferrer">
                  academia.edu
                </a>{" "}
                — check there for the most current readings.
              </div>
            </>
          )}
        </div>
      </div>

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

// Compact, clickable image thumbnail for the imagery row. Sits side-by-side
// with its sibling (facsimile + photograph share a row); click opens the
// full-resolution lightbox.
function ImageThumb({
  src,
  alt,
  bg,
  caption,
  captionColor,
  onOpen,
}: {
  src: string;
  alt: string;
  bg: string;
  caption: React.ReactNode;
  captionColor?: string;
  onOpen: (src: string, alt: string, caption: React.ReactNode) => void;
}) {
  return (
    <figure style={{ margin: 0, maxWidth: 280 }}>
      <button
        onClick={() => onOpen(src, alt, caption)}
        title="Click to enlarge"
        style={{
          display: "block",
          padding: 6,
          background: bg,
          border: "1px solid var(--border)",
          borderRadius: 4,
          cursor: "zoom-in",
          lineHeight: 0,
        }}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            display: "block",
            maxHeight: 200,
            maxWidth: 260,
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </button>
      <figcaption
        className="dim"
        style={{
          fontSize: 10,
          marginTop: 4,
          textAlign: "right",
          color: captionColor,
        }}
      >
        {caption}{" "}
        <span style={{ opacity: 0.65 }}>· click to enlarge ⤢</span>
      </figcaption>
    </figure>
  );
}

// Full-resolution image overlay. Shows the source image scaled to fit the
// viewport (no thumbnail downscaling), with a link to open the raw file in a
// new tab for true full fidelity. Esc or click-away closes.
function ImageLightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  caption: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        cursor: "zoom-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: "96vw",
          maxHeight: "96vh",
          alignItems: "stretch",
          cursor: "default",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#fff",
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.85 }}>{caption}</span>
          <span style={{ flex: 1 }} />
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#9cf", fontSize: 12 }}
            title="Open the original image file in a new tab (full resolution)"
          >
            open original ↗
          </a>
          <button className="btn btn-sm btn-outline" onClick={onClose}>
            Close ✕
          </button>
        </div>
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: "96vw",
            maxHeight: "86vh",
            objectFit: "contain",
            background: "#fff",
            borderRadius: 4,
          }}
        />
      </div>
    </div>,
    document.body,
  );
}

// KWIC-style snippet: the text around the query's first occurrence, with
// the match itself emphasized. Gives the result list scannable context
// instead of bare hit counts.
function snippetFor(text: string, q: string): {
  before: string;
  match: string;
  after: string;
} | null {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - 48);
  const end = Math.min(text.length, idx + q.length + 48);
  return {
    before: (start > 0 ? "…" : "") + text.slice(start, idx),
    match: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length, end) + (end < text.length ? "…" : ""),
  };
}

function DocRow({
  doc,
  hits,
  query,
  selected,
  onClick,
}: {
  doc: CommentaryDoc;
  hits: number;
  query: string;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Scroll the selected row into view when it changes — useful when the user
  // jumped to a doc via search or pivoted in from elsewhere.
  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);
  const snippet =
    hits > 0 && query.trim() ? snippetFor(doc.text, query.trim()) : null;
  return (
    <button
      ref={ref}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 1,
        width: "100%",
        textAlign: "left",
        padding: "4px 12px",
        border: "none",
        background: selected ? "var(--surface-2)" : "transparent",
        color: selected ? "var(--text)" : "var(--text-dim)",
        cursor: "pointer",
        font: "13px var(--mono)",
        borderLeft: selected ? "2px solid var(--ac)" : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--surface-1)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ flex: 1 }}>{doc.id}</span>
        {hits > 0 && (
          <span
            className="dim"
            style={{
              fontSize: 10,
              font: "600 10px var(--sans)",
              color: "var(--am)",
            }}
          >
            {hits}×
          </span>
        )}
      </span>
      {snippet && (
        <span
          style={{
            font: "10px var(--sans)",
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={`${snippet.before}${snippet.match}${snippet.after}`}
        >
          {snippet.before}
          <b style={{ color: "var(--am)" }}>{snippet.match}</b>
          {snippet.after}
        </span>
      )}
    </button>
  );
}

function SiteChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        font: "11px var(--sans)",
        padding: "2px 8px",
        borderRadius: 12,
        border: `1px solid ${active ? "var(--ac)" : "var(--border)"}`,
        background: active ? "var(--ac)" : "transparent",
        color: active ? "var(--bg)" : "var(--text-dim)",
        cursor: "pointer",
      }}
      title={`${count.toLocaleString()} commentary doc${count === 1 ? "" : "s"}`}
    >
      {label} <span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}

// 4-state toggle row for imagery. When there's no matching inscription, the
// chips are disabled and a small note explains why. When the inscription
// has only one of facsimile/photograph, the missing type's chip is also
// disabled so the user doesn't pick something that can't render.
function ImageToggleRow({
  mode,
  setMode,
  hasInscription,
  hasFacsimile,
  hasPhoto,
}: {
  mode: ImageMode;
  setMode: (m: ImageMode) => void;
  hasInscription: boolean;
  hasFacsimile: boolean;
  hasPhoto: boolean;
}) {
  const noImagery = hasInscription && !hasFacsimile && !hasPhoto;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 10,
        flexWrap: "wrap",
      }}
    >
      <span className="dim" style={{ fontSize: 11, marginRight: 2 }}>
        Imagery:
      </span>
      <ToggleChip
        label="Off"
        active={mode === "off"}
        disabled={false}
        onClick={() => setMode("off")}
      />
      <ToggleChip
        label="Facsimile"
        active={mode === "facsimile"}
        disabled={!hasInscription || !hasFacsimile}
        onClick={() => setMode("facsimile")}
        title={
          !hasInscription
            ? "Commentary doc has no matching loaded inscription"
            : !hasFacsimile
              ? "No facsimile drawing bundled for this inscription"
              : "Show the editorial line drawing above the commentary"
        }
      />
      <ToggleChip
        label="Photograph"
        active={mode === "photograph"}
        disabled={!hasInscription || !hasPhoto}
        onClick={() => setMode("photograph")}
        title={
          !hasInscription
            ? "Commentary doc has no matching loaded inscription"
            : !hasPhoto
              ? "No photograph bundled for this inscription"
              : "Show the photograph above the commentary"
        }
      />
      <ToggleChip
        label="Both"
        active={mode === "both"}
        disabled={!hasInscription || (!hasFacsimile && !hasPhoto)}
        onClick={() => setMode("both")}
        title={
          !hasInscription
            ? "Commentary doc has no matching loaded inscription"
            : !hasFacsimile && !hasPhoto
              ? "No imagery bundled for this inscription"
              : "Stack both image types above the commentary"
        }
      />
      {!hasInscription && (
        <span className="dim" style={{ fontSize: 11, fontStyle: "italic" }}>
          (no loaded inscription matches this doc)
        </span>
      )}
      {noImagery && (
        <span className="dim" style={{ fontSize: 11, fontStyle: "italic" }}>
          (no imagery bundled)
        </span>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  active,
  disabled,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        font: "11px var(--sans)",
        padding: "2px 8px",
        borderRadius: 12,
        border: `1px solid ${active ? "var(--ac)" : "var(--border)"}`,
        background: active ? "var(--ac)" : "transparent",
        color: disabled
          ? "var(--text-dim)"
          : active
            ? "var(--bg)"
            : "var(--text-dim)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while (true) {
    const i = haystack.indexOf(needle, pos);
    if (i < 0) return count;
    count++;
    pos = i + needle.length;
  }
}
