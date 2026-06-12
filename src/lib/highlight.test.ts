import { describe, expect, it } from "vitest";
import { highlightHtml } from "./highlight";

describe("highlightHtml", () => {
  it("wraps case-insensitive matches in <mark>", () => {
    expect(highlightHtml("<p>The libation formula</p>", "libation")).toBe(
      "<p>The <mark>libation</mark> formula</p>",
    );
    expect(highlightHtml("<p>Libation and LIBATION</p>", "libation")).toBe(
      "<p><mark>Libation</mark> and <mark>LIBATION</mark></p>",
    );
  });

  it("never touches tags or attribute values", () => {
    const html = '<a href="libation.html" title="libation">see libation</a>';
    expect(highlightHtml(html, "libation")).toBe(
      '<a href="libation.html" title="libation">see <mark>libation</mark></a>',
    );
  });

  it("treats regex metacharacters in the term literally", () => {
    expect(highlightHtml("<p>sign *118 here</p>", "*118")).toBe(
      "<p>sign <mark>*118</mark> here</p>",
    );
  });

  it("matches across plain text spans but not across tag boundaries", () => {
    // "KU-RO" split by a tag is two separate text segments — no match.
    expect(highlightHtml("<p>KU-<b>RO</b></p>", "KU-RO")).toBe(
      "<p>KU-<b>RO</b></p>",
    );
  });

  it("returns the input unchanged for an empty or whitespace term", () => {
    const html = "<p>text</p>";
    expect(highlightHtml(html, "")).toBe(html);
    expect(highlightHtml(html, "   ")).toBe(html);
  });
});
