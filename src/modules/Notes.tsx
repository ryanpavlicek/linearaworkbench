import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkbench } from "../store/workbench";
import {
  refMarkdown,
  renderNoteHtml,
  noteRefs,
  type RefKind,
} from "../lib/notes";
import { wordToPhonetic } from "../lib/algorithms";
import { normalizeSignLabel } from "../lib/helpers";
import type { ResearchNote } from "../lib/types";

// One free-form Markdown note can reference any inscription, word, sign,
// annotation, collection, finding, or other note. References render as
// clickable chips both in the live preview and in the report export.

interface RefOption {
  kind: RefKind;
  value: string; // id or transliteration
  label: string;
  hint?: string;
}

const KIND_LABEL: Record<RefKind, string> = {
  ins: "inscription",
  word: "word",
  sign: "sign",
  annotation: "annotation",
  collection: "collection",
  finding: "finding",
  note: "note",
};

const KIND_COLOR: Record<RefKind, string> = {
  ins: "var(--ac)",
  word: "var(--gn)",
  sign: "var(--pu)",
  annotation: "var(--am)",
  collection: "var(--cy)",
  finding: "var(--mg)",
  note: "var(--text-dim)",
};

export default function Notes() {
  const notes = useWorkbench((s) => s.notes);
  const createNote = useWorkbench((s) => s.createNote);
  const updateNote = useWorkbench((s) => s.updateNote);
  const deleteNote = useWorkbench((s) => s.deleteNote);
  const annotations = useWorkbench((s) => s.annotations);
  const collections = useWorkbench((s) => s.collections);
  const findings = useWorkbench((s) => s.findings);
  const inscriptions = useWorkbench((s) => s.corpus.inscriptions);
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const signsByLabel = useWorkbench((s) => s.corpus.signsByLabel);
  const showInscription = useWorkbench((s) => s.showInscription);
  const showWord = useWorkbench((s) => s.showWord);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => notes[0]?.id ?? null,
  );
  const [showPreview, setShowPreview] = useState(true);
  const [q, setQ] = useState("");

  // Full-text filter over titles and bodies — case-insensitive substring.
  const visibleNotes = useMemo(() => {
    const u = q.trim().toLowerCase();
    if (!u) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(u) ||
        n.body.toLowerCase().includes(u),
    );
  }, [notes, q]);

  // Keep the selection on a surviving note.
  useEffect(() => {
    if (selectedId && !notes.find((n) => n.id === selectedId))
      setSelectedId(notes[0]?.id ?? null);
  }, [notes, selectedId]);

  const note = notes.find((n) => n.id === selectedId) ?? null;

  // Backlinks: any other note whose body contains a wb:note/<currentId>
  // reference. Tells the researcher where the current note is cited from —
  // turning notes into a real wiki rather than write-only.
  const backlinks = useMemo(() => {
    if (!note) return [];
    const needle = `wb:note/${note.id}`;
    return notes.filter((n) => n.id !== note.id && n.body.includes(needle));
  }, [notes, note]);

  function newNote() {
    const id = createNote();
    setSelectedId(id);
  }

  return (
    <div className="panel">
      <h2>Notes</h2>
      <div className="callout">
        <h4>Connective tissue for your research</h4>
        <p>
          Free-form Markdown notes for the long-form thinking that ties your
          structured work together. Click <b>+ Reference</b> to insert a link to
          any inscription, word, sign, annotation, collection, finding, or
          other note — rendered as a clickable chip in the preview and in the
          research report.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* List */}
        <div>
          <div className="toolbar">
            <button className="btn btn-sm" onClick={newNote}>
              + New note
            </button>
            <span style={{ flex: 1 }} />
            <span className="dim" style={{ fontSize: 11 }}>
              {q.trim() ? `${visibleNotes.length}/${notes.length}` : notes.length}
            </span>
          </div>
          <input
            className="input"
            placeholder="Search notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%", fontSize: 12, marginBottom: 6 }}
            title="Case-insensitive search over note titles and bodies"
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: "70vh",
              overflowY: "auto",
            }}
          >
            {notes.length === 0 && (
              <div className="dim" style={{ fontSize: 12, padding: 8 }}>
                No notes yet — click <b>+ New note</b> to start one.
              </div>
            )}
            {notes.length > 0 && visibleNotes.length === 0 && (
              <div className="dim" style={{ fontSize: 12, padding: 8 }}>
                No notes match “{q.trim()}”.
              </div>
            )}
            {visibleNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  border: `1px solid ${selectedId === n.id ? "var(--ac)" : "var(--border)"}`,
                  borderRadius: 4,
                  background:
                    selectedId === n.id ? "var(--ac-soft)" : "var(--surface-1)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 12,
                    color:
                      selectedId === n.id ? "var(--ac)" : "var(--text)",
                  }}
                >
                  {n.title || "Untitled"}
                </span>
                <span className="dim" style={{ fontSize: 10 }}>
                  {new Date(n.updatedAt).toLocaleDateString()} ·{" "}
                  {n.body.length} chars
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor + preview */}
        <div>
          {!note ? (
            <div className="card">
              <div className="dim">
                Pick a note on the left, or create one to begin.
              </div>
            </div>
          ) : (
            <NoteEditor
              key={note.id}
              note={note}
              backlinks={backlinks}
              showPreview={showPreview}
              onTogglePreview={() => setShowPreview((p) => !p)}
              onSave={(patch) => updateNote(note.id, patch)}
              onDelete={() => {
                if (
                  window.confirm(`Delete "${note.title || "Untitled"}"?`)
                )
                  deleteNote(note.id);
              }}
              candidates={() =>
                buildCandidates({
                  notes,
                  currentNoteId: note.id,
                  annotations,
                  collections,
                  findings,
                  inscriptions,
                  wordIndex,
                  signsByLabel,
                })
              }
              onNavigate={(kind, value) =>
                navigate(kind, value, {
                  showInscription,
                  showWord,
                  setActiveModule,
                  setSelectedId,
                  setActiveTab: (tab) =>
                    setActiveModule("annot", { tab }),
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Editor component ────────────────────────────────────────────────────
interface EditorProps {
  note: ResearchNote;
  backlinks: ResearchNote[];
  showPreview: boolean;
  onTogglePreview: () => void;
  onSave: (patch: Partial<Pick<ResearchNote, "title" | "body">>) => void;
  onDelete: () => void;
  candidates: () => RefOption[];
  onNavigate: (kind: RefKind, value: string) => void;
}

function NoteEditor({
  note,
  backlinks,
  showPreview,
  onTogglePreview,
  onSave,
  onDelete,
  candidates,
  onNavigate,
}: EditorProps) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [pickerOpen, setPickerOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Debounced autosave on body/title changes.
  useEffect(() => {
    const t = setTimeout(() => {
      if (title !== note.title || body !== note.body)
        onSave({ title, body });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    if (!ta) {
      setBody((b) => b + text);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  return (
    <div>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          style={{ flex: 1, fontWeight: 600, fontSize: 14, minWidth: 200 }}
        />
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setPickerOpen((p) => !p)}
          title="Insert a reference to an inscription, word, finding, etc."
        >
          + Reference
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={onTogglePreview}
          title="Toggle the live preview pane"
        >
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
        <button
          className="btn btn-outline btn-sm"
          style={{ color: "var(--rd)" }}
          onClick={onDelete}
          title="Delete this note"
        >
          ✕
        </button>
      </div>

      {pickerOpen && (
        <ReferencePicker
          options={candidates()}
          onPick={(o) => {
            insertAtCursor(refMarkdown(o.kind, o.value, o.label));
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: showPreview ? "1fr 1fr" : "1fr",
          gap: 10,
          marginTop: 8,
        }}
      >
        <textarea
          ref={taRef}
          className="input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your thoughts here. Markdown is supported. Use + Reference to insert a link to any saved item."
          spellCheck
          style={{
            width: "100%",
            minHeight: "55vh",
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.6,
            padding: 12,
            resize: "vertical",
          }}
        />
        {showPreview && (
          <div
            style={{
              padding: 12,
              minHeight: "55vh",
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflowY: "auto",
              fontFamily: "var(--serif)",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            {body.trim() ? (
              <NotePreview body={body} onRefClick={onNavigate} />
            ) : (
              <div className="dim">Preview appears here as you type.</div>
            )}
          </div>
        )}
      </div>

      {(() => {
        const refs = noteRefs(body);
        if (!refs.length) return null;
        return (
          <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            {refs.length} reference{refs.length === 1 ? "" : "s"}:{" "}
            {refs
              .map((r) => `${KIND_LABEL[r.kind]} ${r.value}`)
              .slice(0, 8)
              .join(" · ")}
            {refs.length > 8 ? " · …" : ""}
          </div>
        );
      })()}

      {backlinks.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--ac)",
            borderRadius: 4,
          }}
        >
          <div
            style={{
              font: "600 9px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Referenced by ({backlinks.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {backlinks.map((bn) => (
              <button
                key={bn.id}
                onClick={() => onNavigate("note", bn.id)}
                style={{
                  padding: "2px 8px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 3,
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--text-dim)",
                }}
                title={`Open "${bn.title || "Untitled"}"`}
              >
                {bn.title || "Untitled"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live preview renderer ─────────────────────────────────────────────────
const HOVER_DELAY = 300;

function NotePreview({
  body,
  onRefClick,
}: {
  body: string;
  onRefClick: (kind: RefKind, value: string) => void;
}) {
  const hoverEnabled = useWorkbench((s) => s.settings.hoverPreviews);
  const [hover, setHover] = useState<{
    kind: RefKind;
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render Markdown to HTML, swap our wb: links for clickable chips with a
  // data attribute the wrapping onClick handler delegates from.
  const html = useMemo(
    () =>
      renderNoteHtml(body, {
        refHtml: ({ kind, value, label }) =>
          `<button class="note-chip" data-ref-kind="${kind}" data-ref-value="${encodeURIComponent(
            value,
          )}" style="background:${KIND_COLOR[kind]}1f;color:${KIND_COLOR[kind]};border:1px solid ${KIND_COLOR[kind]}66;padding:0 5px;border-radius:3px;font-size:12px;font-family:var(--mono);cursor:pointer;">${label}</button>`,
      }),
    [body],
  );

  function chipFromEvent(e: React.MouseEvent): {
    chip: HTMLElement;
    kind: RefKind;
    value: string;
  } | null {
    const t = e.target as HTMLElement;
    const chip = t.closest("[data-ref-kind]") as HTMLElement | null;
    if (!chip) return null;
    const kind = chip.getAttribute("data-ref-kind") as RefKind;
    const value = decodeURIComponent(chip.getAttribute("data-ref-value") || "");
    return { chip, kind, value };
  }

  return (
    <>
      <div
        onClick={(e) => {
          const hit = chipFromEvent(e);
          if (!hit) return;
          e.preventDefault();
          onRefClick(hit.kind, hit.value);
        }}
        onMouseOver={(e) => {
          if (!hoverEnabled) return;
          const hit = chipFromEvent(e);
          if (!hit) return;
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          const r = hit.chip.getBoundingClientRect();
          const x = r.left;
          const y = r.bottom + 4;
          hoverTimer.current = setTimeout(() => {
            setHover({ kind: hit.kind, value: hit.value, x, y });
          }, HOVER_DELAY);
        }}
        onMouseOut={(e) => {
          const hit = chipFromEvent(e);
          if (!hit) return;
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          setHover(null);
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {hover &&
        createPortal(
          <ChipHoverCard
            kind={hover.kind}
            value={hover.value}
            x={hover.x}
            y={hover.y}
          />,
          document.body,
        )}
    </>
  );
}

// Floating preview card for a note chip — kind-specific bodies, sized to be a
// quick peek (the full thing is one click away). Renders via portal so it
// escapes the preview pane's overflow.
function ChipHoverCard({
  kind,
  value,
  x,
  y,
}: {
  kind: RefKind;
  value: string;
  x: number;
  y: number;
}) {
  const annotations = useWorkbench((s) => s.annotations);
  const collections = useWorkbench((s) => s.collections);
  const findings = useWorkbench((s) => s.findings);
  const notes = useWorkbench((s) => s.notes);
  const byId = useWorkbench((s) => s.corpus.byId);
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const signsByLabel = useWorkbench((s) => s.corpus.signsByLabel);
  const hypothesis = useWorkbench((s) => s.hypothesis);

  const vw = window.innerWidth;
  const cardWidth = 300;
  const left = Math.min(x, vw - cardWidth - 8);

  let body: React.ReactNode = (
    <span className="dim">No preview available.</span>
  );
  if (kind === "ins") {
    const ins = byId.get(value);
    if (ins) {
      body = (
        <>
          {ins.glyphs && (
            <div
              style={{
                fontFamily: "var(--glyph)",
                fontSize: 22,
                marginBottom: 4,
                color: "var(--text)",
                wordBreak: "break-all",
              }}
            >
              {ins.glyphs.slice(0, 60)}
            </div>
          )}
          <div style={{ fontWeight: 600 }}>{ins.id}</div>
          <div className="dim" style={{ fontSize: 11 }}>
            {[ins.site, ins.context, ins.scribe].filter(Boolean).join(" · ")}
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
            {ins.words.length} tokens
          </div>
        </>
      );
    }
  } else if (kind === "word") {
    const entry = wordIndex.get(value);
    const phonetic = wordToPhonetic(value, hypothesis);
    const glyphs = value
      .split("-")
      .map((p) => signsByLabel.get(normalizeSignLabel(p))?.glyph ?? "")
      .join("");
    body = (
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
        <div style={{ fontWeight: 600 }}>{value}</div>
        <div className="dim" style={{ fontSize: 11 }}>
          /{phonetic}/
          {entry &&
            ` · ×${entry.count} · ${entry.sites.size} site${entry.sites.size === 1 ? "" : "s"}`}
        </div>
      </>
    );
  } else if (kind === "sign") {
    const sd = signsByLabel.get(normalizeSignLabel(value));
    body = (
      <>
        {sd?.glyph && (
          <div
            style={{
              fontFamily: "var(--glyph)",
              fontSize: 28,
              marginBottom: 4,
              color: "var(--text)",
            }}
          >
            {sd.glyph}
          </div>
        )}
        <div style={{ fontWeight: 600 }}>{value}</div>
        <div className="dim" style={{ fontSize: 11 }}>
          {sd?.phonetic ? `/${sd.phonetic}/ · ` : ""}
          {sd ? `${sd.total} attestations` : "no sign data"}
        </div>
      </>
    );
  } else if (kind === "annotation") {
    const a = annotations.find((x) => x.id === value);
    if (a) {
      body = (
        <>
          <div style={{ fontWeight: 600 }}>
            {a.target.value}
            <span className="dim" style={{ fontWeight: 400 }}>
              {" "}
              ({a.target.kind})
            </span>
          </div>
          {a.proposedMeaning && (
            <div style={{ fontSize: 12, marginTop: 2 }}>
              {a.proposedMeaning}
            </div>
          )}
          <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
            confidence: {a.confidence}
          </div>
          {a.notes && (
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 12,
                marginTop: 4,
                color: "var(--text-dim)",
              }}
            >
              {a.notes.slice(0, 160)}
              {a.notes.length > 160 ? "…" : ""}
            </div>
          )}
        </>
      );
    }
  } else if (kind === "collection") {
    const c = collections.find((x) => x.id === value);
    if (c) {
      body = (
        <>
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          <div className="dim" style={{ fontSize: 11 }}>
            {c.items.length} item{c.items.length === 1 ? "" : "s"}
          </div>
          {c.items.length > 0 && (
            <div
              className="dim"
              style={{ fontSize: 11, marginTop: 4, fontFamily: "var(--mono)" }}
            >
              {c.items.slice(0, 6).map((it) => it.value).join(", ")}
              {c.items.length > 6 ? " …" : ""}
            </div>
          )}
        </>
      );
    }
  } else if (kind === "finding") {
    const f = findings.find((x) => x.id === value);
    if (f) {
      body = (
        <>
          <div style={{ fontWeight: 600 }}>{f.title}</div>
          <div className="dim" style={{ fontSize: 11 }}>
            {f.moduleLabel}
          </div>
          <div
            style={{
              fontSize: 12,
              marginTop: 4,
              color: "var(--text-dim)",
              whiteSpace: "pre-wrap",
            }}
          >
            {f.summary.slice(0, 200)}
            {f.summary.length > 200 ? "…" : ""}
          </div>
        </>
      );
    }
  } else if (kind === "note") {
    const n = notes.find((x) => x.id === value);
    if (n) {
      const plain = n.body.replace(/\s+/g, " ").trim();
      body = (
        <>
          <div style={{ fontWeight: 600 }}>{n.title || "Untitled note"}</div>
          {plain && (
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 12,
                marginTop: 4,
                color: "var(--text-dim)",
              }}
            >
              {plain.slice(0, 200)}
              {plain.length > 200 ? "…" : ""}
            </div>
          )}
          <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>
            {n.body.length} chars · updated{" "}
            {new Date(n.updatedAt).toLocaleDateString()}
          </div>
        </>
      );
    }
  }

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
        font: "12px var(--sans)",
      }}
    >
      <div
        style={{
          font: "600 9px var(--sans)",
          color: KIND_COLOR[kind],
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {KIND_LABEL[kind]}
      </div>
      {body}
    </div>
  );
}

// ── Reference picker ─────────────────────────────────────────────────────
function ReferencePicker({
  options,
  onPick,
  onClose,
}: {
  options: RefOption[];
  onPick: (o: RefOption) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<RefKind | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const u = q.toLowerCase().trim();
    return options
      .filter((o) => kindFilter === "all" || o.kind === kindFilter)
      .filter(
        (o) =>
          !u ||
          o.label.toLowerCase().includes(u) ||
          o.value.toLowerCase().includes(u) ||
          (o.hint ?? "").toLowerCase().includes(u),
      )
      .slice(0, 80);
  }, [options, q, kindFilter]);

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--ac)",
        borderRadius: 6,
        padding: 10,
        marginTop: 6,
      }}
    >
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          className="input"
          placeholder="Search inscriptions, words, signs, findings, collections, annotations, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered[0]) onPick(filtered[0]);
          }}
        />
        <select
          className="select"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as RefKind | "all")}
          style={{ fontSize: 11, padding: "3px 6px" }}
        >
          <option value="all">any kind</option>
          <option value="ins">inscription</option>
          <option value="word">word</option>
          <option value="sign">sign</option>
          <option value="annotation">annotation</option>
          <option value="collection">collection</option>
          <option value="finding">finding</option>
          <option value="note">note</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div
        style={{
          maxHeight: 260,
          overflowY: "auto",
          marginTop: 6,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 4,
        }}
      >
        {filtered.length === 0 && (
          <div className="dim" style={{ fontSize: 11, padding: 8 }}>
            No matches.
          </div>
        )}
        {filtered.map((o) => (
          <button
            key={`${o.kind}:${o.value}`}
            onClick={() => onPick(o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 11,
            }}
            title={o.hint}
          >
            <span
              style={{
                font: "600 9px var(--sans)",
                textTransform: "uppercase",
                color: KIND_COLOR[o.kind],
                minWidth: 56,
              }}
            >
              {KIND_LABEL[o.kind]}
            </span>
            <span style={{ flex: 1 }}>{o.label}</span>
          </button>
        ))}
      </div>
      <div className="dim" style={{ fontSize: 10, marginTop: 6 }}>
        Press Enter to insert the top match.
      </div>
    </div>
  );
}

// ── Candidates ─────────────────────────────────────────────────────────────
// Build the reference-picker option list from everything in the workbench.
function buildCandidates(args: {
  notes: ResearchNote[];
  currentNoteId: string;
  annotations: ReturnType<typeof useWorkbench.getState>["annotations"];
  collections: ReturnType<typeof useWorkbench.getState>["collections"];
  findings: ReturnType<typeof useWorkbench.getState>["findings"];
  inscriptions: ReturnType<typeof useWorkbench.getState>["corpus"]["inscriptions"];
  wordIndex: ReturnType<typeof useWorkbench.getState>["corpus"]["wordIndex"];
  signsByLabel: ReturnType<typeof useWorkbench.getState>["corpus"]["signsByLabel"];
}): RefOption[] {
  const out: RefOption[] = [];
  for (const n of args.notes)
    if (n.id !== args.currentNoteId)
      out.push({ kind: "note", value: n.id, label: n.title || "Untitled" });
  for (const a of args.annotations)
    out.push({
      kind: "annotation",
      value: a.id,
      label: `${a.target.value} — ${a.proposedMeaning || "annotation"}`,
      hint: a.notes,
    });
  for (const c of args.collections)
    out.push({
      kind: "collection",
      value: c.id,
      label: `${c.name} (${c.items.length})`,
    });
  for (const f of args.findings)
    out.push({
      kind: "finding",
      value: f.id,
      label: f.title,
      hint: f.moduleLabel,
    });
  // Corpus targets — cap for sanity, the search filter does the rest.
  for (const ins of args.inscriptions.slice(0, 1800))
    out.push({
      kind: "ins",
      value: ins.id,
      label: ins.id,
      hint: ins.site,
    });
  const words = [...args.wordIndex.entries()]
    .filter(([w]) => w.includes("-"))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 400);
  for (const [w, e] of words)
    out.push({
      kind: "word",
      value: w,
      label: w,
      hint: `${e.count}× across ${e.sites.size} site(s)`,
    });
  for (const [label] of args.signsByLabel)
    out.push({ kind: "sign", value: label, label });
  return out;
}

// ── Navigation ────────────────────────────────────────────────────────────
function navigate(
  kind: RefKind,
  value: string,
  ctx: {
    showInscription: (id: string) => void;
    showWord: (word: string) => void;
    setActiveModule: ReturnType<typeof useWorkbench.getState>["setActiveModule"];
    setSelectedId: (id: string) => void;
    setActiveTab: (tab: "notebook" | "collections" | "findings" | "notes") => void;
  },
) {
  if (kind === "ins") return ctx.showInscription(value);
  if (kind === "word") return ctx.showWord(value);
  if (kind === "sign")
    return ctx.setActiveModule("signref", { focus: value });
  if (kind === "annotation") return ctx.setActiveTab("notebook");
  if (kind === "collection") return ctx.setActiveTab("collections");
  if (kind === "finding") return ctx.setActiveTab("findings");
  if (kind === "note") return ctx.setSelectedId(value);
}
