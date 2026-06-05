import { useWorkbench } from "../store/workbench";
import type { Finding, ModuleId } from "../lib/types";
import { sanitizeHtmlFragment } from "../lib/sanitizeHtml";

// Findings carry pre-rendered report HTML. In normal use that HTML is
// app-generated and fully escaped (see lib/reportSnippet). But findings can
// also arrive from an imported backup file, so a tampered backup could smuggle
// an auto-executing payload (e.g. <img onerror=…>). Sanitize via the DOM
// before rendering — defense-in-depth so an untrusted backup can't run script
// in the session. App-generated report snippets are static table markup with
// inline styles only, so nothing legitimate is removed.

interface Props {
  /** Filter to one module's findings (e.g. show only saved comparisons). */
  module?: ModuleId;
  /**
   * Explicit list to render. When provided it overrides the store-derived list
   * (used by the aggregate view to apply its own search/filter/sort).
   */
  items?: Finding[];
  /** If provided, each finding gets a "Load" button calling this with it. */
  onLoad?: (f: Finding) => void;
  /** Show the source-module tag on each row (for the aggregate list). */
  showModuleLabel?: boolean;
  emptyHint?: string;
}

/**
 * Reusable list of saved findings. Used inline in a module (filtered to that
 * module, with a Load action) and as the aggregate Findings list in My
 * Research (all modules, with Open + delete).
 */
export function FindingsPanel({
  module,
  items,
  onLoad,
  showModuleLabel,
  emptyHint,
}: Props) {
  const findings = useWorkbench((s) => s.findings);
  const deleteFinding = useWorkbench((s) => s.deleteFinding);
  const setActiveModule = useWorkbench((s) => s.setActiveModule);
  const toast = useWorkbench((s) => s.toast_show);
  const list =
    items ?? (module ? findings.filter((f) => f.module === module) : findings);

  if (list.length === 0) {
    return (
      <div className="dim" style={{ fontSize: 12 }}>
        {emptyHint ?? "No findings saved yet."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((f) => (
        <div
          key={f.id}
          className="card"
          style={{ margin: 0, padding: "10px 12px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <b style={{ fontSize: 13 }}>{f.title}</b>
            {showModuleLabel && (
              <span className="tag tag-domain" style={{ fontSize: 9 }}>
                {f.moduleLabel}
              </span>
            )}
            <span className="dim" style={{ fontSize: 10 }}>
              {new Date(f.createdAt).toLocaleString()}
            </span>
            <span style={{ flex: 1 }} />
            {onLoad && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onLoad(f)}
                title="Reload this result"
              >
                Load
              </button>
            )}
            {!onLoad && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setActiveModule(f.module)}
                title={`Open ${f.moduleLabel}`}
              >
                Open {f.moduleLabel} →
              </button>
            )}
            <button
              className="btn btn-outline btn-sm"
              style={{ color: "var(--rd)" }}
              onClick={() => {
                deleteFinding(f.id);
                toast("Finding deleted — Ctrl+Z to undo");
              }}
              title="Delete finding"
            >
              ✕
            </button>
          </div>
          <div
            style={{
              fontSize: 12,
              marginTop: 4,
              whiteSpace: "pre-wrap",
              color: "var(--text-dim)",
            }}
          >
            {f.summary}
          </div>
          {(() => {
            const snap = (f.payload as { snapshot?: string } | undefined)
              ?.snapshot;
            if (!snap || typeof snap !== "string" || !snap.startsWith("data:image"))
              return null;
            return (
              <img
                src={snap}
                alt={`${f.title} snapshot`}
                style={{
                  display: "block",
                  marginTop: 6,
                  maxWidth: "100%",
                  maxHeight: 260,
                  objectFit: "contain",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  background: "var(--surface-0)",
                }}
              />
            );
          })()}
          {f.report?.html && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                background: "var(--surface-0)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                fontSize: 12,
                maxHeight: 300,
                overflow: "auto",
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtmlFragment(f.report.html) }}
            />
          )}
          {f.notes && (
            <div
              style={{
                fontSize: 12,
                marginTop: 4,
                fontFamily: "var(--serif)",
                color: "var(--text-dim)",
              }}
            >
              {f.notes}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
