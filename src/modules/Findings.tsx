import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { FindingsPanel } from "../components/FindingsPanel";
import { downloadFile } from "../lib/helpers";

type SortKey = "newest" | "oldest" | "title" | "module";

export default function Findings() {
  const findings = useWorkbench((s) => s.findings);
  const toast = useWorkbench((s) => s.toast_show);
  const [q, setQ] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  // Distinct source modules represented in the saved findings.
  const moduleOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of findings) m.set(f.module, f.moduleLabel);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [findings]);

  const shown = useMemo(() => {
    const u = q.toLowerCase();
    const rows = findings.filter((f) => {
      if (moduleFilter !== "all" && f.module !== moduleFilter) return false;
      if (!u) return true;
      return (
        f.title.toLowerCase().includes(u) ||
        f.summary.toLowerCase().includes(u) ||
        (f.notes ?? "").toLowerCase().includes(u)
      );
    });
    rows.sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      if (sortKey === "module") return a.moduleLabel.localeCompare(b.moduleLabel);
      const d =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortKey === "oldest" ? d : -d;
    });
    return rows;
  }, [findings, q, moduleFilter, sortKey]);

  function exportJson() {
    downloadFile(
      "linear_a_findings.json",
      JSON.stringify(shown, null, 2),
      "application/json",
    );
    toast("Findings exported (JSON)");
  }

  function exportMarkdown() {
    const lines: string[] = ["# Linear A — Findings", ""];
    for (const f of shown) {
      lines.push(`## ${f.title}`);
      lines.push(
        `*${f.moduleLabel} · ${new Date(f.createdAt).toLocaleString()}*`,
      );
      lines.push("");
      lines.push(f.summary);
      if (f.notes) {
        lines.push("");
        lines.push(`> ${f.notes}`);
      }
      lines.push("");
    }
    downloadFile("linear_a_findings.md", lines.join("\n"), "text/markdown");
    toast("Findings exported (Markdown)");
  }

  return (
    <div className="panel">
      <h2>Findings</h2>
      <div className="callout">
        <h4>Saved results from across the workbench</h4>
        <p>
          Anything you "save to findings" in an analysis module — a comparison,
          a co-occurrence ranking, a query result — lands here as a tracked,
          named entry. Findings are compiled into your{" "}
          <b>Research report</b> and export as JSON or Markdown.
        </p>
      </div>
      {findings.length > 0 && (
        <div className="toolbar" style={{ flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="Search findings…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
          <label
            className="dim"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title="Filter by source module"
          >
            module
            <select
              className="select"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              style={{ fontSize: 11, padding: "3px 6px" }}
            >
              <option value="all">all</option>
              {moduleOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label
            className="dim"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title="Sort findings"
          >
            sort
            <select
              className="select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              style={{ fontSize: 11, padding: "3px 6px" }}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title (A→Z)</option>
              <option value="module">Module</option>
            </select>
          </label>
          <span className="dim" style={{ fontSize: 11 }}>
            {shown.length}/{findings.length}
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-outline btn-sm" onClick={exportMarkdown}>
            Export Markdown
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportJson}>
            Export JSON
          </button>
        </div>
      )}
      <FindingsPanel
        items={findings.length > 0 ? shown : undefined}
        showModuleLabel
        emptyHint={
          findings.length > 0
            ? "No findings match these filters."
            : "No findings yet. In a module like Compare Inscriptions, build a result and click “Save to findings”."
        }
      />
    </div>
  );
}
