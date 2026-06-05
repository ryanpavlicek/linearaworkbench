import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { useScopedCorpus } from "../store/scope";
import { WordToken } from "../components/WordToken";
import { WordTools } from "../components/WordTools";

const IDEOGRAMS: Record<string, string> = {
  OLE: "Oil / liquid",
  GRA: "Grain / cereal",
  VIN: "Wine / vine",
  FIC: "Figs",
  "*301": "Offering?",
  "*302": "Unknown commodity",
  "*303": "Unknown commodity",
  KU: "Bronze?",
  AES: "Bronze",
  AUR: "Gold",
  ARG: "Silver",
};

const PREVIEW = 20;

export default function SemanticClassifier() {
  const inscriptions = useScopedCorpus().inscriptions;
  const collections = useWorkbench((s) => s.collections);
  const annotations = useWorkbench((s) => s.annotations);
  const createCollection = useWorkbench((s) => s.createCollection);
  const addToCollection = useWorkbench((s) => s.addToCollection);
  const removeFromCollection = useWorkbench((s) => s.removeFromCollection);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const toast = useWorkbench((s) => s.toast_show);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; words: Map<string, number> }>();
    for (const ins of inscriptions) {
      const ws = ins.words.filter((w) => w.includes("-"));
      for (const w of ins.words) {
        if (!IDEOGRAMS[w]) continue;
        let g = map.get(w);
        if (!g) {
          g = { label: IDEOGRAMS[w], words: new Map() };
          map.set(w, g);
        }
        for (const ww of ws) {
          if (ww === w) continue;
          g.words.set(ww, (g.words.get(ww) ?? 0) + 1);
        }
      }
    }
    return [...map.entries()].sort(
      (a, b) => b[1].words.size - a[1].words.size,
    );
  }, [inscriptions]);

  // The active field is a collection; treat a stale id (deleted elsewhere) as
  // "none selected".
  const activeField = collections.find((c) => c.id === activeId) ?? null;
  const activeWords = activeField
    ? activeField.items.filter((i) => i.kind === "word").map((i) => i.value)
    : [];

  const wordCount = (cid: string) =>
    collections
      .find((c) => c.id === cid)
      ?.items.filter((i) => i.kind === "word").length ?? 0;

  const inActiveField = (w: string) =>
    !!activeField &&
    activeField.items.some((i) => i.kind === "word" && i.value === w);

  // Progress: distinct words you've sorted into any field + proposed meanings.
  const { classifiedWords, proposedMeanings } = useMemo(() => {
    const inFields = new Set<string>();
    for (const c of collections)
      for (const i of c.items) if (i.kind === "word") inFields.add(i.value);
    const meanings = annotations.filter(
      (a) => a.target.kind === "word" && a.proposedMeaning.trim(),
    ).length;
    return { classifiedWords: inFields.size, proposedMeanings: meanings };
  }, [collections, annotations]);

  function toggleWord(w: string) {
    if (!activeField) return;
    if (inActiveField(w)) {
      removeFromCollection(activeField.id, { kind: "word", value: w });
    } else {
      addToCollection(activeField.id, { kind: "word", value: w });
    }
  }

  function createField() {
    const name = newName.trim();
    if (!name) return;
    const id = createCollection(name);
    setActiveId(id);
    setNewName("");
    toast(`Field "${name}" created — now click ＋ next to words`);
  }

  return (
    <div className="panel">
      <h2>Semantic Classifier</h2>
      <div className="callout">
        <h4>Commodity domain inference</h4>
        <p>
          Words grouped by their co-occurring ideograms. Multi-sign words that
          appear alongside <code>GRA</code> likely relate to grain accounting;
          those with <code>OLE</code> to oil, and so on. These groupings are{" "}
          <strong>attested</strong> — read straight off the tablets, not
          interpreted.
        </p>
      </div>

      {/* ── Hypothesis worksheet ─────────────────────────────────────── */}
      <div className="card">
        <h4 style={{ marginTop: 0 }}>
          Your semantic fields{" "}
          <span className="dim">(saved as collections)</span>
        </h4>
        <p className="sub" style={{ marginTop: 0 }}>
          The attested groups are a starting point — your <em>interpretation</em>{" "}
          is the hypothesis. Pick or create a field, then click{" "}
          <span className="mono">＋</span> beside any word to sort it into your
          field. Use <span className="mono">✎</span> to record a proposed
          meaning and confidence. Both feed your{" "}
          <button
            className="link-btn"
            onClick={() => setActiveModule("report")}
          >
            Research Report
          </button>
          .
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {collections.length === 0 && (
            <span className="dim" style={{ fontSize: 12 }}>
              No fields yet — name one to begin:
            </span>
          )}
          {collections.map((c) => (
            <button
              key={c.id}
              className={`btn btn-sm ${
                c.id === activeId ? "" : "btn-outline"
              }`}
              onClick={() => setActiveId(c.id === activeId ? null : c.id)}
              title={
                c.id === activeId
                  ? "Active field — click to deselect"
                  : "Make this the active field"
              }
            >
              {c.name}{" "}
              <span className="dim" style={{ fontSize: 10 }}>
                {wordCount(c.id)}
              </span>
            </button>
          ))}
          <input
            className="input"
            placeholder="New field…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createField();
            }}
            style={{ width: 150, fontSize: 12 }}
          />
          <button
            className="btn btn-sm"
            disabled={!newName.trim()}
            onClick={createField}
          >
            + Field
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 10,
            fontSize: 12,
          }}
        >
          <span className="dim">
            {classifiedWords} word{classifiedWords === 1 ? "" : "s"} sorted into
            fields · {proposedMeanings} proposed meaning
            {proposedMeanings === 1 ? "" : "s"}
          </span>
          <span style={{ flex: 1 }} />
          <button
            className="link-btn"
            onClick={() => setActiveModule("collections")}
          >
            Manage fields →
          </button>
        </div>

        {activeField ? (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--border)",
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
              In “{activeField.name}” ({activeWords.length}) — click{" "}
              <span className="mono">＋</span> beside any word below to add more
            </div>
            {activeWords.length === 0 ? (
              <div className="dim" style={{ fontSize: 12 }}>
                No words yet. Click <span className="mono">＋</span> next to a
                word in the attested groups below to sort it into this field.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px 4px",
                  alignItems: "center",
                }}
              >
                {activeWords.map((w) => (
                  <span
                    key={w}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                      padding: "2px 4px 2px 8px",
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <WordToken word={w} />
                    <WordTools
                      target={{ kind: "word", value: w }}
                      suggestions={[`${activeField.name} (semantic field)`]}
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        removeFromCollection(activeField.id, {
                          kind: "word",
                          value: w,
                        })
                      }
                      title={`Remove from “${activeField.name}”`}
                      style={{ padding: "0 6px", minWidth: 0, color: "var(--rd)" }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          collections.length > 0 && (
            <div className="dim" style={{ marginTop: 8, fontSize: 12 }}>
              Select a field above to see and edit its words.
            </div>
          )
        )}
      </div>

      {groups.length === 0 && (
        <div className="card">
          <div className="dim">
            No ideogram associations found in the corpus.
          </div>
        </div>
      )}
      {groups.map(([ideo, g]) => {
        const all = [...g.words.entries()].sort((a, b) => b[1] - a[1]);
        const isOpen = expanded[ideo];
        const sorted = isOpen ? all : all.slice(0, PREVIEW);
        const suggestions = [`${g.label} (commodity)`, `${ideo}-associated`];
        return (
          <div key={ideo} className="card">
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h4 style={{ margin: 0 }}>
                <span style={{ color: "var(--am)" }}>{ideo}</span> — {g.label}{" "}
                <span className="dim">({all.length} words)</span>
              </h4>
              <span style={{ flex: 1 }} />
              {all.length > PREVIEW && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setExpanded((s) => ({ ...s, [ideo]: !s[ideo] }))
                  }
                >
                  {isOpen ? "Show fewer" : `Show all ${all.length}`}
                </button>
              )}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: "4px 2px",
                alignItems: "center",
                maxHeight: isOpen ? "55vh" : undefined,
                overflowY: isOpen ? "auto" : undefined,
              }}
            >
              {sorted.map(([w, c]) => {
                const member = inActiveField(w);
                return (
                  <span
                    key={w}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <WordToken word={w} />
                    <span className="dim" style={{ fontSize: 11 }}>
                      ×{c}
                    </span>
                    {activeField && (
                      <button
                        className={`btn btn-sm ${member ? "" : "btn-outline"}`}
                        onClick={() => toggleWord(w)}
                        title={
                          member
                            ? `Remove from "${activeField.name}"`
                            : `Add to "${activeField.name}"`
                        }
                        style={{
                          padding: "0 6px",
                          marginLeft: 2,
                          minWidth: 0,
                        }}
                      >
                        {member ? "✓" : "＋"}
                      </button>
                    )}
                    <WordTools
                      target={{ kind: "word", value: w }}
                      suggestions={suggestions}
                    />
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
