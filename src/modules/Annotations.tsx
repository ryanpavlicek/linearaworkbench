import { useMemo, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { downloadFile } from "../lib/helpers";
import type { Annotation, AnnotationTarget } from "../lib/types";
import { WordToken } from "../components/WordToken";
import { InscriptionLink } from "../components/InscriptionLink";
import { Glyph } from "../components/Glyph";
import { useSort, SortHeader } from "../components/sort";

const CONF_COLOR = {
  high: "var(--gn)",
  medium: "var(--am)",
  low: "var(--text-muted)",
};
const CONF_RANK = { high: 3, medium: 2, low: 1 } as const;
type ConfFilter = "all" | "high" | "medium" | "low";

function TargetCell({ target }: { target: AnnotationTarget }) {
  if (target.kind === "word") return <WordToken word={target.value} />;
  if (target.kind === "inscription") return <InscriptionLink id={target.value} />;
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <Glyph sign={target.value} size={18} />
      <b className="dim">{target.value}</b>
    </span>
  );
}

export default function Annotations() {
  const annotations = useWorkbench((s) => s.annotations);
  const importEntries = useWorkbench((s) => s.importAnnotations);
  const remove = useWorkbench((s) => s.deleteAnnotation);
  const showWord = useWorkbench((s) => s.showWord);
  const showInscription = useWorkbench((s) => s.showInscription);
  const toast = useWorkbench((s) => s.toast_show);
  const fileRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "word" | "inscription">(
    "all",
  );
  const [confFilter, setConfFilter] = useState<ConfFilter>("all");
  const { sort, toggle, sortRows } = useSort("updated", "desc");

  const filtered = useMemo(() => {
    const u = q.toLowerCase();
    return annotations
      .filter((a) => kindFilter === "all" || a.target.kind === kindFilter)
      .filter((a) => confFilter === "all" || a.confidence === confFilter)
      .filter((a) => {
        if (!u) return true;
        return (
          a.proposedMeaning.toLowerCase().includes(u) ||
          a.notes.toLowerCase().includes(u) ||
          a.target.value.toLowerCase().includes(u)
        );
      });
  }, [annotations, q, kindFilter, confFilter]);

  const sorted = sortRows(filtered, {
    target: (a) => a.target.value,
    kind: (a) => a.target.kind,
    meaning: (a) => a.proposedMeaning,
    confidence: (a) => CONF_RANK[a.confidence],
    updated: (a) => new Date(a.updatedAt).getTime(),
  });

  function exportJson() {
    downloadFile(
      "linear_a_annotations.json",
      JSON.stringify(annotations, null, 2),
      "application/json",
    );
    toast(`Exported ${annotations.length} annotations`);
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Annotation[];
        if (!Array.isArray(data)) throw new Error("Not an array");
        const mode = window.confirm(
          `Import ${data.length} annotations.\n\nClick OK to MERGE with your existing annotations, or Cancel to REPLACE them.`,
        )
          ? "merge"
          : "replace";
        importEntries(data, mode);
        toast(`Imported ${data.length} annotations (${mode})`);
      } catch (err) {
        toast(`Import failed: ${err}`, "error");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  const counts = {
    total: annotations.length,
    high: annotations.filter((a) => a.confidence === "high").length,
    medium: annotations.filter((a) => a.confidence === "medium").length,
    low: annotations.filter((a) => a.confidence === "low").length,
  };

  return (
    <div className="panel">
      <h2>Annotations</h2>
      <div className="callout">
        <h4>Your decipherment notebook</h4>
        <p>
          Annotations attach proposed meanings, confidence levels, and free-text
          notes to any word, inscription, or sign. They persist in your
          browser's localStorage and surface inline throughout the workbench as
          small colored chips next to the annotated target. Export the full set
          as JSON to share with collaborators or back it up.
        </p>
      </div>
      <div className="stat-grid">
        {(
          [
            ["all", "Total", counts.total, undefined],
            ["high", "High confidence", counts.high, "var(--gn)"],
            ["medium", "Medium", counts.medium, "var(--am)"],
            ["low", "Low", counts.low, "var(--text-muted)"],
          ] as const
        ).map(([k, lbl, val, color]) => (
          <div
            key={k}
            className="stat-box"
            onClick={() => setConfFilter(confFilter === k ? "all" : k)}
            title={`Filter to ${lbl.toLowerCase()}`}
            style={{
              cursor: "pointer",
              outline:
                confFilter === k ? "1px solid var(--ac)" : undefined,
              outlineOffset: -1,
            }}
          >
            <span className="val" style={color ? { color } : undefined}>
              {val}
            </span>
            <span className="lbl">{lbl}</span>
          </div>
        ))}
      </div>
      <div className="toolbar">
        <input
          className="input"
          placeholder="Search annotations…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <div className="tab-row" style={{ marginBottom: 0, border: 0 }}>
          {(
            [
              ["all", "All"],
              ["word", "Words"],
              ["inscription", "Inscriptions"],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              className={`tab-btn${kindFilter === k ? " active" : ""}`}
              onClick={() => setKindFilter(k)}
            >
              {lbl}
            </button>
          ))}
        </div>
        <button className="btn btn-outline btn-sm" onClick={exportJson}>
          Export JSON
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => fileRef.current?.click()}
        >
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={onImport}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="dim">
            No annotations yet. Click any word or inscription in the workbench
            to open its detail view, then fill in the Annotation section.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader label="Target" sortKey="target" sort={sort} onToggle={toggle} />
                <SortHeader label="Kind" sortKey="kind" sort={sort} onToggle={toggle} />
                <SortHeader label="Proposed meaning" sortKey="meaning" sort={sort} onToggle={toggle} />
                <SortHeader label="Confidence" sortKey="confidence" sort={sort} onToggle={toggle} />
                <th>Notes</th>
                <SortHeader label="Updated" sortKey="updated" sort={sort} onToggle={toggle} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id}>
                  <td>
                    <TargetCell target={a.target} />
                  </td>
                  <td>
                    <span className="tag tag-domain">{a.target.kind}</span>
                  </td>
                  <td>
                    <b>{a.proposedMeaning || <span className="dim">—</span>}</b>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: CONF_COLOR[a.confidence],
                        }}
                      />
                      {a.confidence}
                    </span>
                  </td>
                  <td
                    style={{
                      maxWidth: 360,
                      whiteSpace: "normal",
                      fontFamily: "var(--serif)",
                    }}
                  >
                    {a.notes || <span className="dim">—</span>}
                  </td>
                  <td className="dim" style={{ fontSize: 10 }}>
                    {new Date(a.updatedAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          a.target.kind === "word"
                            ? showWord(a.target.value)
                            : a.target.kind === "inscription"
                              ? showInscription(a.target.value)
                              : null
                        }
                      >
                        Open
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: "var(--rd)" }}
                        onClick={() => remove(a.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
