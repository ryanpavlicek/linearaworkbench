import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useScopedCorpus } from "../store/scope";
import { useWorkbench } from "../store/workbench";
import {
  csvEscape,
  downloadFile,
  normalizeSignLabel,
  upstreamAsset,
} from "../lib/helpers";
import { InscriptionLink } from "../components/InscriptionLink";
import { WordToken } from "../components/WordToken";
import { Glyph } from "../components/Glyph";
import { SaveFindingButton } from "../components/SaveFindingButton";
import { useSort, SortHeader } from "../components/sort";
import type { Inscription } from "../lib/types";

type Tab = "browse" | "glyph" | "imagery";
type ImageMode = "facsimile" | "photo" | "both";

const PAGE_SIZE = 50;
const DETAIL_CAP = 150;
const IMG_PAGE_SIZE = 48;

export default function CorpusBrowser() {
  const scoped = useScopedCorpus();
  const inscriptions = scoped.inscriptions;
  const wordIndex = scoped.wordIndex;
  const signsByLabel = scoped.signsByLabel;
  const showInscription = useWorkbench((s) => s.showInscription);
  const initialIntent = useWorkbench.getState().moduleIntent;

  const [tab, setTab] = useState<Tab>(
    initialIntent?.tab === "glyph"
      ? "glyph"
      : initialIntent?.tab === "imagery"
        ? "imagery"
        : "browse",
  );

  // ── Browse tab ────────────────────────────────────────────────────────
  const { sort, toggle, sortRows } = useSort("id", "asc");
  const [page, setPage] = useState(0);
  // When a caller deep-links to a specific inscription (e.g. Tablet
  // Structure's per-row Browse pivot passes focus=HT12), remember the id so
  // we can both jump to the page containing it AND visually highlight the
  // row. Cleared after first scroll so manual paging doesn't keep re-jumping.
  const [focusedId, setFocusedId] = useState<string | null>(() => {
    const focus = initialIntent?.focus;
    if (!focus || !initialIntent || initialIntent.tab === "glyph") return null;
    return focus;
  });

  const sorted = useMemo(
    () =>
      sortRows(inscriptions, {
        id: (i) => i.id,
        site: (i) => i.site || "",
        period: (i) => i.context || "",
        scribe: (i) => i.scribe || "",
        support: (i) => i.support || "",
        tokens: (i) => i.words.length,
      }),
    // sortRows is recreated each render but varies only with `sort`, which
    // is the dependency that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inscriptions, sort],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  // Preview-pane mode: off by default so the modal stays the primary detail
  // surface. When on, the table shrinks and a right-pane shows a compact
  // preview of whichever row is highlighted. Arrow keys walk rows; Enter
  // (or clicking the inscription ID link) still opens the full modal.
  //
  // Per-session state on purpose — matches the Commentary Browser imagery
  // toggle convention. Bump to localStorage if it becomes a "I always want
  // this on" request.
  const [previewOn, setPreviewOn] = useState(false);
  const [previewRowId, setPreviewRowId] = useState<string | null>(null);

  // If we arrived with a focused inscription id, find which page contains
  // it under the current sort and jump there. Runs once at mount (and again
  // if the sort changes while still focused) — clears focusedId after.
  useEffect(() => {
    if (!focusedId) return;
    const idx = sorted.findIndex((i) => i.id === focusedId);
    if (idx < 0) return;
    setPage(Math.floor(idx / PAGE_SIZE));
    // Open the detail modal for the focused inscription so the researcher
    // immediately sees the thing they clicked to. The Browse table behind
    // it still shows the row in context.
    showInscription(focusedId);
    setFocusedId(null);
  }, [focusedId, sorted, showInscription]);

  const safePage = Math.min(page, pageCount - 1);
  const pageItems = sorted.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  // When preview is enabled, auto-pick the first row on the current page if
  // nothing is selected (or the previous selection has scrolled off-page).
  // Without this, turning the toggle on shows an empty pane until the user
  // clicks something — bad first impression.
  useEffect(() => {
    if (!previewOn) return;
    if (pageItems.length === 0) {
      setPreviewRowId(null);
      return;
    }
    if (!previewRowId || !pageItems.some((i) => i.id === previewRowId)) {
      setPreviewRowId(pageItems[0].id);
    }
  }, [previewOn, pageItems, previewRowId]);

  // Resolve the selected inscription record for the preview pane.
  const previewInscription = useMemo(
    () =>
      previewOn && previewRowId
        ? pageItems.find((i) => i.id === previewRowId) ?? null
        : null,
    [previewOn, previewRowId, pageItems],
  );

  // Arrow-key row navigation while preview is on. Up/Down step within the
  // current page; Home/End jump to top/bottom of page; Enter opens the full
  // detail modal for the highlighted row. Bounds clamp (so the user pages
  // explicitly via ← Prev / Next → rather than auto-paging on key-press).
  useEffect(() => {
    if (!previewOn) return;
    function onKey(e: KeyboardEvent) {
      // Don't hijack typing in inputs / textareas / contenteditable.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (!pageItems.length) return;
      const idx = pageItems.findIndex((i) => i.id === previewRowId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = idx < 0 ? 0 : Math.min(idx + 1, pageItems.length - 1);
        setPreviewRowId(pageItems[next].id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = idx < 0 ? 0 : Math.max(idx - 1, 0);
        setPreviewRowId(pageItems[next].id);
      } else if (e.key === "Home") {
        e.preventDefault();
        setPreviewRowId(pageItems[0].id);
      } else if (e.key === "End") {
        e.preventDefault();
        setPreviewRowId(pageItems[pageItems.length - 1].id);
      } else if (e.key === "Enter" && previewRowId) {
        e.preventDefault();
        showInscription(previewRowId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOn, pageItems, previewRowId, showInscription]);

  function exportBrowseCsv() {
    const rows: (string | number)[][] = [
      ["inscription", "site", "support", "period", "scribe", "tokens", "text"],
    ];
    for (const ins of sorted) {
      rows.push([
        ins.id,
        ins.site,
        ins.support,
        ins.context,
        ins.scribe,
        ins.words.length,
        ins.words.join(" "),
      ]);
    }
    downloadFile(
      "linear_a_corpus_browse.csv",
      rows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    );
  }

  // ── By-glyph tab ──────────────────────────────────────────────────────
  const [selectedSign, setSelectedSign] = useState<string | null>(
    initialIntent?.tab === "glyph" ? (initialIntent.focus ?? null) : null,
  );
  const [signFilter, setSignFilter] = useState("");

  // Every sign attested in the scoped corpus → the set of inscriptions that
  // contain it (so the grid can rank signs by how many tablets carry them).
  const signTiles = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ins of inscriptions) {
      const local = new Set<string>();
      for (const w of ins.words)
        for (const p of w.split("-")) {
          const norm = normalizeSignLabel(p);
          // Only real signary entries — excludes numerals, separators, and
          // ligature fragments that aren't catalogued signs.
          if (signsByLabel.has(norm)) local.add(norm);
        }
      for (const s of local) {
        let set = m.get(s);
        if (!set) {
          set = new Set();
          m.set(s, set);
        }
        set.add(ins.id);
      }
    }
    return [...m.entries()]
      .map(([sign, set]) => ({ sign, insCount: set.size }))
      .sort((a, b) => b.insCount - a.insCount || a.sign.localeCompare(b.sign));
  }, [inscriptions, signsByLabel]);

  const visibleTiles = useMemo(() => {
    const u = signFilter.toUpperCase().trim();
    if (!u) return signTiles;
    return signTiles.filter((t) => t.sign.toUpperCase().includes(u));
  }, [signTiles, signFilter]);

  const glyphDetail = useMemo(() => {
    if (!selectedSign) return null;
    const s = selectedSign;
    const insList = inscriptions.filter((ins) =>
      ins.words.some((w) =>
        w.split("-").map(normalizeSignLabel).includes(s),
      ),
    );
    const wordList: { word: string; count: number }[] = [];
    for (const [word, entry] of wordIndex) {
      if (word.split("-").map(normalizeSignLabel).includes(s))
        wordList.push({ word, count: entry.count });
    }
    wordList.sort((a, b) => b.count - a.count);
    return { insList, wordList };
  }, [selectedSign, inscriptions, wordIndex]);

  // ── Imagery tab ───────────────────────────────────────────────────────
  const [imgMode, setImgMode] = useState<ImageMode>("facsimile");
  const [imgPage, setImgPage] = useState(0);
  const [lightbox, setLightbox] = useState<Inscription | null>(null);

  const imageryCount = useMemo(
    () =>
      inscriptions.filter(
        (i) => i.facsimileImages.length > 0 || i.images.length > 0,
      ).length,
    [inscriptions],
  );

  const withImagery = useMemo(
    () =>
      inscriptions.filter((ins) => {
        const hasF = ins.facsimileImages.length > 0;
        const hasP = ins.images.length > 0;
        if (imgMode === "facsimile") return hasF;
        if (imgMode === "photo") return hasP;
        return hasF && hasP;
      }),
    [inscriptions, imgMode],
  );

  const imgPageCount = Math.max(
    1,
    Math.ceil(withImagery.length / IMG_PAGE_SIZE),
  );
  const safeImgPage = Math.min(imgPage, imgPageCount - 1);
  const imgItems = withImagery.slice(
    safeImgPage * IMG_PAGE_SIZE,
    safeImgPage * IMG_PAGE_SIZE + IMG_PAGE_SIZE,
  );

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <div className="panel">
      <h2>Corpus Browser</h2>
      <div className="callout">
        <h4>Walk the corpus — no query required</h4>
        <p>
          Where <b>Corpus Search</b> answers "find this", the browser is for
          orientation and serendipity: page through every tablet (sortable by
          site, period, scribe, support, or length), or pivot to the{" "}
          <b>By glyph</b> view to pick a sign and see every word and inscription
          that carries it. Everything here respects the active corpus scope.
        </p>
      </div>

      <div className="tab-row">
        <button
          className={`tab-btn${tab === "browse" ? " active" : ""}`}
          onClick={() => setTab("browse")}
        >
          Browse corpus ({inscriptions.length})
        </button>
        <button
          className={`tab-btn${tab === "glyph" ? " active" : ""}`}
          onClick={() => setTab("glyph")}
        >
          By glyph ({signTiles.length})
        </button>
        <button
          className={`tab-btn${tab === "imagery" ? " active" : ""}`}
          onClick={() => setTab("imagery")}
        >
          Imagery ({imageryCount})
        </button>
      </div>

      {tab === "browse" && (
        <>
          <div className="toolbar">
            <span className="dim" style={{ fontSize: 11 }}>
              {sorted.length} inscriptions · page {safePage + 1} of {pageCount}
            </span>
            <span style={{ flex: 1 }} />
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                font: "12px var(--sans)",
                color: "var(--text-dim)",
                cursor: "pointer",
                marginRight: 4,
              }}
              title="Show a compact preview of the highlighted row in a side pane. Use ↑/↓ to walk rows, Enter to open the full detail modal."
            >
              <input
                type="checkbox"
                checked={previewOn}
                onChange={(e) => setPreviewOn(e.target.checked)}
              />
              Preview pane
            </label>
            <button
              className="btn btn-outline btn-sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              ← Prev
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next →
            </button>
            <button className="btn btn-outline btn-sm" onClick={exportBrowseCsv}>
              Export CSV
            </button>
            <SaveFindingButton
              module="browse"
              moduleLabel="Corpus Browser"
              defaultTitle="Corpus browse"
              summary={`${sorted.length} inscriptions in the current scope.\nFirst: ${sorted
                .slice(0, 12)
                .map((i) => i.id)
                .join(", ")}${sorted.length > 12 ? ", …" : "."}`}
            />
          </div>
          {/* When preview is on, lay out as table + preview-pane grid. The
              table shrinks but stays sortable and scrollable; the preview
              sticks beside it. On narrow viewports the grid collapses to
              single-column so the preview stacks below — see corresponding
              @media rule in styles.css (.browse-with-preview). */}
          <div
            className={previewOn ? "browse-with-preview" : ""}
            style={
              previewOn
                ? {
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 1fr)",
                    gap: 12,
                    alignItems: "start",
                  }
                : undefined
            }
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortHeader label="ID" sortKey="id" sort={sort} onToggle={toggle} />
                    <SortHeader label="Site" sortKey="site" sort={sort} onToggle={toggle} />
                    <SortHeader label="Period" sortKey="period" sort={sort} onToggle={toggle} />
                    <SortHeader label="Scribe" sortKey="scribe" sort={sort} onToggle={toggle} />
                    <SortHeader label="Support" sortKey="support" sort={sort} onToggle={toggle} />
                    <SortHeader label="Tokens" sortKey="tokens" sort={sort} onToggle={toggle} />
                    {!previewOn && <th>Preview</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((ins) => {
                    const isPreview = previewOn && previewRowId === ins.id;
                    return (
                      <tr
                        key={ins.id}
                        // Click anywhere in the row selects it for the preview
                        // pane (only when preview is on — otherwise the row is
                        // passive and only the ID link is interactive).
                        onClick={
                          previewOn
                            ? () => setPreviewRowId(ins.id)
                            : undefined
                        }
                        style={
                          previewOn
                            ? {
                                background: isPreview
                                  ? "var(--ac-soft, rgba(120,160,220,0.12))"
                                  : undefined,
                                cursor: "pointer",
                                outline: isPreview
                                  ? "1px solid var(--ac)"
                                  : undefined,
                              }
                            : undefined
                        }
                      >
                        <td>
                          <InscriptionLink id={ins.id} />
                        </td>
                        <td className="site-text">{ins.site}</td>
                        <td className="dim">{ins.context}</td>
                        <td className="dim">{ins.scribe}</td>
                        <td className="dim">{ins.support}</td>
                        <td className="numeral">{ins.words.length}</td>
                        {!previewOn && (
                          <td
                            style={{
                              maxWidth: 460,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {ins.words.slice(0, 10).map((w, i) => (
                              <WordToken key={i} word={w} />
                            ))}
                            {ins.words.length > 10 && (
                              <span className="dim">+{ins.words.length - 10}</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {pageItems.length === 0 && (
                    <tr>
                      <td colSpan={previewOn ? 6 : 7} className="dim" style={{ padding: 12 }}>
                        No inscriptions in the current scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {previewOn && (
              <BrowsePreviewPane
                ins={previewInscription}
                onOpenFull={() =>
                  previewInscription && showInscription(previewInscription.id)
                }
              />
            )}
          </div>
        </>
      )}

      {tab === "glyph" && (
        <div className="col2" style={{ alignItems: "start" }}>
          <div>
            <div className="toolbar">
              <input
                className="input"
                placeholder="Filter signs…"
                value={signFilter}
                onChange={(e) => setSignFilter(e.target.value)}
                style={{ flex: 1 }}
              />
              <span className="dim" style={{ fontSize: 11 }}>
                {visibleTiles.length} signs
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                maxHeight: 520,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {visibleTiles.map(({ sign, insCount }) => (
                <button
                  key={sign}
                  onClick={() => setSelectedSign(sign)}
                  title={`${sign} — in ${insCount} inscription${insCount === 1 ? "" : "s"}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    width: 58,
                    padding: "6px 2px",
                    cursor: "pointer",
                    background:
                      selectedSign === sign
                        ? "var(--ac-soft)"
                        : "var(--surface-1)",
                    border: `1px solid ${selectedSign === sign ? "var(--ac)" : "var(--border)"}`,
                    borderRadius: 4,
                  }}
                >
                  <Glyph sign={sign} size={22} />
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--mono)",
                      color: "var(--text-dim)",
                      maxWidth: 54,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sign}
                  </span>
                  <span className="dim" style={{ fontSize: 9 }}>
                    {insCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            {!selectedSign || !glyphDetail ? (
              <div className="card">
                <div className="dim">
                  Pick a sign on the left to see every word and inscription that
                  contains it.
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <Glyph sign={selectedSign} size={34} />
                  <b style={{ font: "600 18px var(--mono)" }}>{selectedSign}</b>
                  <span className="dim">
                    {glyphDetail.wordList.length} words ·{" "}
                    {glyphDetail.insList.length} inscriptions
                  </span>
                  <span style={{ flex: 1 }} />
                  <SaveFindingButton
                    module="browse"
                    moduleLabel="Corpus Browser"
                    defaultTitle={`Sign ${selectedSign} — distribution`}
                    summary={`Sign ${selectedSign}: in ${glyphDetail.wordList.length} distinct words and ${glyphDetail.insList.length} inscriptions (current scope).`}
                    payload={{ tab: "glyph", sign: selectedSign }}
                  />
                </div>

                <div
                  style={{
                    font: "600 9px var(--sans)",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    margin: "8px 0 4px",
                  }}
                >
                  Words containing {selectedSign} ({glyphDetail.wordList.length})
                </div>
                <div style={{ lineHeight: 1.9 }}>
                  {glyphDetail.wordList.slice(0, DETAIL_CAP).map((e) => (
                    <span key={e.word} style={{ marginRight: 4 }}>
                      <WordToken word={e.word} />
                      <span className="dim" style={{ fontSize: 10 }}>
                        ×{e.count}
                      </span>
                    </span>
                  ))}
                  {glyphDetail.wordList.length > DETAIL_CAP && (
                    <span className="dim">
                      … +{glyphDetail.wordList.length - DETAIL_CAP} more
                    </span>
                  )}
                </div>

                <div
                  style={{
                    font: "600 9px var(--sans)",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    margin: "12px 0 4px",
                  }}
                >
                  Inscriptions ({glyphDetail.insList.length})
                </div>
                <div style={{ lineHeight: 2 }}>
                  {glyphDetail.insList.slice(0, DETAIL_CAP).map((ins, i) => (
                    <span key={ins.id}>
                      {i > 0 ? ", " : ""}
                      <InscriptionLink id={ins.id} />
                    </span>
                  ))}
                  {glyphDetail.insList.length > DETAIL_CAP && (
                    <span className="dim">
                      , … +{glyphDetail.insList.length - DETAIL_CAP} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "imagery" && (
        <>
          <div className="toolbar" style={{ flexWrap: "wrap" }}>
            <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
              {(
                [
                  ["facsimile", "Facsimile"],
                  ["photo", "Photograph"],
                  ["both", "Both (pairs)"],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  className={`tab-btn${imgMode === k ? " active" : ""}`}
                  onClick={() => {
                    setImgMode(k);
                    setImgPage(0);
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <span className="dim" style={{ fontSize: 11 }}>
              {withImagery.length} inscriptions · page {safeImgPage + 1} of{" "}
              {imgPageCount}
            </span>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn-outline btn-sm"
              disabled={safeImgPage === 0}
              onClick={() => setImgPage(safeImgPage - 1)}
            >
              ← Prev
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={safeImgPage >= imgPageCount - 1}
              onClick={() => setImgPage(safeImgPage + 1)}
            >
              Next →
            </button>
          </div>
          <div className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
            Click any thumbnail to enlarge.{" "}
            {imgMode === "both"
              ? "Each tile pairs the facsimile (left) with the photograph (right)."
              : `Showing ${imgMode === "facsimile" ? "facsimile drawings" : "tablet photographs"}.`}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${imgMode === "both" ? 210 : 132}px, 1fr))`,
              gap: 8,
            }}
          >
            {imgItems.map((ins) => (
              <button
                key={ins.id}
                onClick={() => setLightbox(ins)}
                title={`${ins.id} — ${ins.site}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: 6,
                  cursor: "pointer",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    justifyContent: "center",
                    width: "100%",
                  }}
                >
                  {(imgMode === "facsimile" || imgMode === "both") &&
                    ins.facsimileImages[0] && (
                      <img
                        src={upstreamAsset(ins.facsimileImages[0])}
                        alt={`${ins.id} facsimile`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                        style={{
                          width: imgMode === "both" ? "50%" : "100%",
                          height: 120,
                          objectFit: "contain",
                          background: "var(--surface-2)",
                          borderRadius: 3,
                        }}
                      />
                    )}
                  {(imgMode === "photo" || imgMode === "both") &&
                    ins.images[0] && (
                      <img
                        src={upstreamAsset(ins.images[0])}
                        alt={`${ins.id} photograph`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                        style={{
                          width: imgMode === "both" ? "50%" : "100%",
                          height: 120,
                          objectFit: "contain",
                          background: "var(--surface-2)",
                          borderRadius: 3,
                        }}
                      />
                    )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--mono)",
                    color: "var(--text-dim)",
                  }}
                >
                  {ins.id}
                </span>
              </button>
            ))}
            {imgItems.length === 0 && (
              <div className="dim" style={{ padding: 12 }}>
                No {imgMode === "both" ? "facsimile+photo pairs" : "imagery"} for
                this selection in the current scope.
              </div>
            )}
          </div>
        </>
      )}

      {lightbox &&
        createPortal(
          <div
            onClick={() => setLightbox(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.82)",
              zIndex: 2000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxWidth: "92vw",
                maxHeight: "92vh",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#fff",
                }}
              >
                <b style={{ fontFamily: "var(--mono)", fontSize: 15 }}>
                  {lightbox.id}
                </b>
                <span style={{ opacity: 0.7, fontSize: 12 }}>
                  {lightbox.site}
                  {lightbox.context ? ` · ${lightbox.context}` : ""}
                  {lightbox.scribe ? ` · ${lightbox.scribe}` : ""}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const id = lightbox.id;
                    setLightbox(null);
                    showInscription(id);
                  }}
                >
                  Open inscription →
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setLightbox(null)}
                >
                  Close ✕
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  overflow: "auto",
                }}
              >
                {(imgMode === "facsimile" || imgMode === "both") &&
                  lightbox.facsimileImages[0] && (
                    <figure style={{ margin: 0, textAlign: "center" }}>
                      <img
                        src={upstreamAsset(lightbox.facsimileImages[0])}
                        alt={`${lightbox.id} facsimile`}
                        style={{
                          maxWidth: imgMode === "both" ? "44vw" : "88vw",
                          maxHeight: "78vh",
                          objectFit: "contain",
                          background: "#fff",
                          borderRadius: 4,
                        }}
                      />
                      <figcaption
                        style={{ color: "#bbb", fontSize: 11, marginTop: 4 }}
                      >
                        Facsimile
                      </figcaption>
                    </figure>
                  )}
                {(imgMode === "photo" || imgMode === "both") &&
                  lightbox.images[0] && (
                    <figure style={{ margin: 0, textAlign: "center" }}>
                      <img
                        src={upstreamAsset(lightbox.images[0])}
                        alt={`${lightbox.id} photograph`}
                        style={{
                          maxWidth: imgMode === "both" ? "44vw" : "88vw",
                          maxHeight: "78vh",
                          objectFit: "contain",
                          background: "#fff",
                          borderRadius: 4,
                        }}
                      />
                      <figcaption
                        style={{ color: "#bbb", fontSize: 11, marginTop: 4 }}
                      >
                        Photograph
                      </figcaption>
                    </figure>
                  )}
              </div>
              {lightbox.imageRights && (
                <div
                  style={{ color: "#999", fontSize: 10, textAlign: "center" }}
                >
                  {lightbox.imageRights}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// Compact card for the Browse-tab preview pane. Shows the highlighted row's
// metadata, facsimile thumbnail (if bundled), full glyph string, the first
// few lines of transliteration with editorial gloss, and an "Open full
// detail →" button that opens the same modal a click on the ID would.
//
// Deliberately a summary, not a duplicate of the modal — if you need the
// full detail (commentary, annotation editor, paleography links, etc.),
// the button is right there. The preview is for fast scan-and-skim.
function BrowsePreviewPane({
  ins,
  onOpenFull,
}: {
  ins: Inscription | null;
  onOpenFull: () => void;
}) {
  if (!ins) {
    return (
      <div
        style={{
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface-0)",
          color: "var(--text-dim)",
          fontSize: 13,
        }}
      >
        Pick a row on the left to preview it here.
        <div style={{ marginTop: 8, fontSize: 11 }}>
          <kbd>↑</kbd>/<kbd>↓</kbd> step rows · <kbd>Home</kbd>/<kbd>End</kbd>{" "}
          jump to first/last on page · <kbd>Enter</kbd> opens the full detail
          modal.
        </div>
      </div>
    );
  }
  const hasFacsimile = ins.facsimileImages.length > 0;
  const hasPhoto = ins.images.length > 0;
  const previewLines = ins.lines.slice(0, 3);
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--surface-0)",
        position: "sticky",
        top: 8,
        maxHeight: "calc(100vh - 160px)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header — ID + metadata badges */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <b style={{ font: "600 16px var(--mono)" }}>{ins.id}</b>
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-sm"
            onClick={onOpenFull}
            title="Open the full detail modal (commentary, annotation editor, paleography links, etc.)"
          >
            Open full detail →
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            fontSize: 11,
          }}
        >
          {ins.site && <Chip>{ins.site}</Chip>}
          {ins.context && <Chip>{ins.context}</Chip>}
          {ins.scribe && <Chip>scribe {ins.scribe}</Chip>}
          {ins.support && <Chip>{ins.support}</Chip>}
        </div>
      </div>

      {/* Counts */}
      <div className="dim" style={{ fontSize: 11 }}>
        {ins.words.length} word token{ins.words.length === 1 ? "" : "s"} ·{" "}
        {ins.lines.length} line{ins.lines.length === 1 ? "" : "s"}
        {hasFacsimile || hasPhoto
          ? ` · ${hasFacsimile ? "facsimile" : ""}${hasFacsimile && hasPhoto ? " + " : ""}${hasPhoto ? "photograph" : ""} bundled`
          : ""}
      </div>

      {/* Glyphs */}
      {ins.glyphs && (
        <div>
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 4,
            }}
          >
            Glyphs
          </div>
          <div
            style={{
              font: "20px var(--linear-a, var(--mono))",
              lineHeight: 1.4,
              wordBreak: "break-all",
            }}
          >
            {ins.glyphs}
          </div>
        </div>
      )}

      {/* First few transliterated lines */}
      {previewLines.length > 0 && (
        <div>
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 4,
            }}
          >
            Transliteration {ins.lines.length > 3 ? "(first 3 lines)" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {previewLines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 4,
                  fontSize: 13,
                }}
              >
                <span
                  className="dim"
                  style={{
                    font: "11px var(--mono)",
                    minWidth: 18,
                    textAlign: "right",
                  }}
                >
                  {i + 1}
                </span>
                {line.map((w, j) => (
                  <WordToken key={j} word={w} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Facsimile thumbnail — small, click-through to full modal */}
      {hasFacsimile && (
        <div>
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 4,
            }}
          >
            Facsimile
          </div>
          <button
            onClick={onOpenFull}
            title="Open full detail to see this image at full size"
            style={{
              display: "block",
              width: "100%",
              padding: 4,
              background: "#f4f1ea",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            <img
              src={upstreamAsset(ins.facsimileImages[0])}
              alt={`${ins.id} facsimile`}
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                maxHeight: 220,
                objectFit: "contain",
                margin: "0 auto",
              }}
            />
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        font: "11px var(--sans)",
        padding: "1px 6px",
        borderRadius: 10,
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        color: "var(--text-dim)",
      }}
    >
      {children}
    </span>
  );
}
