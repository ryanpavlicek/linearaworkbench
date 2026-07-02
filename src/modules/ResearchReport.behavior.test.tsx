// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import ResearchReport from "./ResearchReport";
import { loadRealCorpus } from "../test/corpusFixture";
import { useWorkbench } from "../store/workbench";
import { esc, snippetTable, snippetWrap } from "../lib/reportSnippet";
import type { Finding } from "../lib/types";

// Stored-XSS regression for the HTML report EXPORT. A finding's report.html
// restores verbatim from imported backup files; the in-app Findings panel
// sanitizes it before rendering, and the export must cross the same trust
// boundary — a payload smuggled in a backup used to ship executable in the
// downloaded report while the viewer showed it defanged.

const downloads: { name: string; content: string | Blob }[] = [];
vi.mock("../lib/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/helpers")>();
  return {
    ...actual,
    downloadFile: (name: string, content: string | Blob) => {
      downloads.push({ name, content });
    },
  };
});

beforeAll(() => {
  loadRealCorpus();
  // The export embeds a web font when it can fetch one; keep the test
  // offline and take the no-font fallback path.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false })),
  );
});

afterEach(() => {
  cleanup();
  downloads.length = 0;
  useWorkbench.setState({ findings: [] });
});

// A legitimate captured snippet, exactly as a module's reportFn builds it.
interface Row {
  w: string;
  n: number;
}
const snippet = snippetWrap(
  "2 words · full corpus",
  snippetTable<Row>(
    [
      { w: "KU-RO", n: 5 },
      { w: "PO-TO-KU-RO", n: 2 },
    ],
    [
      { label: "Word", render: (r) => `<code>${esc(r.w)}</code>` },
      { label: "Count", render: (r) => esc(r.n), align: "right" },
    ],
  ),
);

const finding: Finding = {
  id: "f-imported",
  module: "freq",
  moduleLabel: "Word Frequency",
  title: "Imported finding",
  summary: "Totals across the corpus",
  report: {
    html:
      '<img src=x onerror="alert(1)"><script>alert(2)</script>' + snippet,
  },
  createdAt: new Date().toISOString(),
};

describe("Research Report — HTML export of a finding's stored report.html", () => {
  it("neutralizes an injected payload while the captured snippet survives byte-for-byte", async () => {
    useWorkbench.setState({ findings: [finding] });

    const { getByText } = render(<ResearchReport />);
    fireEvent.click(getByText("Download .html"));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe("linear_a_research_report.html");
    const html = downloads[0].content as string;

    // The finding made it into the export…
    expect(html).toContain('<div class="finding-report">');
    expect(html).toContain("Imported finding");
    // …with the legitimate snippet spliced in unchanged…
    expect(html).toContain(snippet);
    // …and the payload defanged: no event handler, no script body. (The
    // report ships its own interactive <script>, so assert on the payload,
    // not on script tags per se.)
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("alert(2)");
  });
});
