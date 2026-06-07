import { describe, it, expect } from "vitest";
import {
  refUrl,
  parseRefUrl,
  refMarkdown,
  noteRefs,
  renderNoteHtml,
} from "./notes";

describe("workbench reference URLs", () => {
  it("round-trips kind + value through refUrl / parseRefUrl", () => {
    expect(refUrl("ins", "HT13")).toBe("wb:ins/HT13");
    expect(parseRefUrl("wb:ins/HT13")).toEqual({ kind: "ins", value: "HT13" });
  });

  it("percent-encodes and decodes values with reserved characters", () => {
    const url = refUrl("word", "KU-RO");
    expect(parseRefUrl(url)).toEqual({ kind: "word", value: "KU-RO" });
    // A word containing a slash must survive the round-trip intact.
    expect(parseRefUrl(refUrl("word", "A/B"))).toEqual({
      kind: "word",
      value: "A/B",
    });
  });

  it("rejects non-wb URLs and unknown kinds", () => {
    expect(parseRefUrl("https://example.com")).toBeNull();
    expect(parseRefUrl("wb:bogus/x")).toBeNull();
    expect(parseRefUrl("wb:ins")).toBeNull(); // no slash
  });

  it("refMarkdown produces a well-formed link and escapes ] in the label", () => {
    expect(refMarkdown("note", "n1", "see this")).toBe("[see this](wb:note/n1)");
    expect(refMarkdown("note", "n1", "a]b")).toBe("[a\\]b](wb:note/n1)");
  });
});

describe("noteRefs", () => {
  it("extracts every wb: reference from a note body", () => {
    const body =
      "Compare [HT13](wb:ins/HT13) with the word [KU-RO](wb:word/KU-RO) — see [my note](wb:note/n1).";
    const refs = noteRefs(body);
    expect(refs).toHaveLength(3);
    expect(refs[0]).toEqual({ kind: "ins", value: "HT13", label: "HT13" });
    expect(refs[1]).toEqual({ kind: "word", value: "KU-RO", label: "KU-RO" });
  });

  it("ignores ordinary links and returns [] for empty input", () => {
    expect(noteRefs("a [plain](https://example.com) link")).toEqual([]);
    expect(noteRefs("")).toEqual([]);
  });
});

describe("renderNoteHtml", () => {
  const opts = {
    refHtml: (r: { kind: string; value: string; label: string }) =>
      `<span class="chip" data-kind="${r.kind}" data-value="${r.value}">${r.label}</span>`,
  };

  it("renders headings, bold/italic, and lists", () => {
    expect(renderNoteHtml("# Title", opts)).toBe("<h1>Title</h1>");
    expect(renderNoteHtml("**bold** and *em*", opts)).toBe(
      "<p><strong>bold</strong> and <em>em</em></p>",
    );
    expect(renderNoteHtml("- one\n- two", opts)).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
  });

  it("routes wb: links through the caller's chip renderer", () => {
    const html = renderNoteHtml("ref [HT13](wb:ins/HT13)", opts);
    expect(html).toContain('class="chip"');
    expect(html).toContain('data-value="HT13"');
  });

  it("renders plain http links with target/rel and escapes the URL", () => {
    const html = renderNoteHtml("[x](https://example.com)", opts);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("escapes HTML so a note body cannot inject markup", () => {
    const html = renderNoteHtml("<script>alert(1)</script>", opts);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
