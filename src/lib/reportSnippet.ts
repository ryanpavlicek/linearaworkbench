// Tiny helpers for building the HTML + Markdown captured-report snippets
// that modules attach to a finding via SaveFindingButton's `reportFn`. The
// snippets are spliced into the research report verbatim (HTML) or appended
// after the bare summary (Markdown), so they should be self-contained and
// styled inline (the report's outer stylesheet can't see them).

export function esc(s: string | number | undefined | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SnippetColumn<T> {
  label: string;
  render: (row: T) => string; // already-escaped HTML for the cell
  // Markdown rendering — defaults to a plain-text version of the same value
  // (strip HTML tags). Override for richer formatting.
  md?: (row: T) => string;
  align?: "left" | "right";
}

/**
 * Build a compact HTML table snippet for a result set. Inline styles only —
 * the snippet must look right when pasted into the report or shown in the
 * Findings panel without any surrounding CSS.
 */
export function snippetTable<T>(rows: T[], cols: SnippetColumn<T>[]): string {
  const thead = cols
    .map(
      (c) =>
        `<th style="text-align:${c.align ?? "left"};padding:4px 8px;border-bottom:2px solid #cbd2db;font-weight:600;">${esc(c.label)}</th>`,
    )
    .join("");
  const tbody = rows
    .map(
      (r) =>
        "<tr>" +
        cols
          .map(
            (c) =>
              `<td style="padding:3px 8px;vertical-align:top;border-bottom:1px solid #e2e5ea;text-align:${c.align ?? "left"};">${c.render(r)}</td>`,
          )
          .join("") +
        "</tr>",
    )
    .join("");
  return `<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:12px;width:100%;"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
}

/** Markdown equivalent of snippetTable. */
export function snippetTableMd<T>(rows: T[], cols: SnippetColumn<T>[]): string {
  const head = "| " + cols.map((c) => c.label.replace(/\|/g, "\\|")).join(" | ") + " |";
  const sep = "|" + cols.map((c) => (c.align === "right" ? "---:" : "---")).join("|") + "|";
  const body = rows
    .map(
      (r) =>
        "| " +
        cols
          .map((c) => {
            const v = c.md ? c.md(r) : c.render(r).replace(/<[^>]+>/g, "");
            return v.replace(/\|/g, "\\|");
          })
          .join(" | ") +
        " |",
    )
    .join("\n");
  return [head, sep, body].join("\n");
}

/** Top-and-tail wrapper: a small dim "N items" line above the table. */
export function snippetWrap(meta: string, body: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;"><div style="font-size:11px;color:#6b7280;margin-bottom:6px;">${esc(meta)}</div>${body}</div>`;
}
