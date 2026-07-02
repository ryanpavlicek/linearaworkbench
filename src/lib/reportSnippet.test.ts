import { describe, it, expect } from "vitest";
import {
  esc,
  snippetTable,
  snippetTableMd,
  snippetWrap,
  type SnippetColumn,
} from "./reportSnippet";

// The snippets these helpers build are spliced into the research report and
// the Findings panel, so esc() is an HTML-escaping trust boundary: known
// answers, not "it runs".

describe("esc", () => {
  it("escapes all five HTML metacharacters", () => {
    expect(esc('<td onclick="x">&\'</td>')).toBe(
      "&lt;td onclick=&quot;x&quot;&gt;&amp;&#39;&lt;/td&gt;",
    );
  });

  it("escapes the ampersand first, so pre-escaped entities re-escape rather than double-decode", () => {
    expect(esc("&amp;")).toBe("&amp;amp;");
    expect(esc("&lt;")).toBe("&amp;lt;");
  });

  it("passes Linear A glyphs (astral-plane code points) through untouched", () => {
    expect(esc("𐘇𐘾𐄁")).toBe("𐘇𐘾𐄁");
  });

  it("stringifies numbers and maps null/undefined to the empty string", () => {
    expect(esc(42)).toBe("42");
    expect(esc(0)).toBe("0");
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

interface Row {
  w: string;
  n: number;
}
const rows: Row[] = [
  { w: "KU-RO", n: 5 },
  { w: "A<B & \"C\"", n: 1 },
];
const cols: SnippetColumn<Row>[] = [
  { label: "Word", render: (r) => `<code>${esc(r.w)}</code>` },
  { label: "Count", render: (r) => esc(r.n), align: "right" },
];

describe("snippetTable", () => {
  it("builds the exact inline-styled table for a one-cell input", () => {
    const out = snippetTable([{ w: "KU-RO", n: 5 }], [cols[0]]);
    expect(out).toBe(
      '<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:12px;width:100%;">' +
        '<thead><tr><th style="text-align:left;padding:4px 8px;border-bottom:2px solid #cbd2db;font-weight:600;">Word</th></tr></thead>' +
        '<tbody><tr><td style="padding:3px 8px;vertical-align:top;border-bottom:1px solid #e2e5ea;text-align:left;"><code>KU-RO</code></td></tr></tbody>' +
        "</table></div>",
    );
  });

  it("escapes header labels but splices cell HTML as-is (render's contract)", () => {
    const out = snippetTable(rows, [
      { label: 'A<B & "C"', render: (r) => `<b>${esc(r.w)}</b>` },
    ]);
    expect(out).toContain(">A&lt;B &amp; &quot;C&quot;</th>");
    expect(out).toContain("<b>A&lt;B &amp; &quot;C&quot;</b>");
    expect(out).not.toContain("A<B");
  });

  it("honors right alignment in header and body cells", () => {
    const out = snippetTable(rows, cols);
    expect(out).toContain('<th style="text-align:right;');
    expect(out).toContain("text-align:right;\">5</td>");
  });
});

describe("snippetTableMd", () => {
  it("builds the exact pipe table with an alignment row", () => {
    const plain: Row[] = [
      { w: "KU-RO", n: 5 },
      { w: "KI-RO", n: 1 },
    ];
    expect(snippetTableMd(plain, cols)).toBe(
      ["| Word | Count |", "|---|---:|", "| KU-RO | 5 |\n| KI-RO | 1 |"].join(
        "\n",
      ),
    );
  });

  it("keeps the render()'s escaped entities in the default md fallback (tags stripped, entities kept)", () => {
    const out = snippetTableMd([rows[1]], [cols[0]]);
    expect(out.split("\n")[2]).toBe("| A&lt;B &amp; &quot;C&quot; |");
  });

  it("escapes pipes in labels and cell values so the table shape survives", () => {
    const out = snippetTableMd([{ w: "a|b", n: 2 }], [
      { label: "L|R", render: (r: Row) => esc(r.w), md: (r: Row) => r.w },
      cols[1],
    ]);
    expect(out).toContain("| L\\|R | Count |");
    expect(out).toContain("| a\\|b | 2 |");
  });

  it("derives the default md cell by stripping tags from the HTML render", () => {
    const out = snippetTableMd([{ w: "𐘇 KU-RO", n: 3 }], [
      { label: "Word", render: (r: Row) => `<code>${esc(r.w)}</code>` },
    ]);
    expect(out.split("\n")[2]).toBe("| 𐘇 KU-RO |");
  });
});

describe("snippetWrap", () => {
  it("escapes the meta line and splices the body verbatim", () => {
    expect(snippetWrap('5 items & <fun>', "<p>x</p>")).toBe(
      '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;">' +
        '<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">5 items &amp; &lt;fun&gt;</div>' +
        "<p>x</p></div>",
    );
  });
});
