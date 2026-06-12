import { describe, expect, it } from "vitest";
import { highlightHtml, linkifyTabletRefs } from "./highlight";

describe("linkifyTabletRefs", () => {
  const ids = new Set(["HT13", "HT123+124a", "PKZa11", "HT9"]);
  const resolve = (cand: string) => {
    if (ids.has(cand)) return cand;
    const base = cand.replace(/[a-z]$/, "");
    return base !== cand && ids.has(base) ? base : null;
  };

  it("links spaced and unspaced references that resolve to corpus ids", () => {
    expect(linkifyTabletRefs("<p>see HT 13 and HT13</p>", resolve)).toBe(
      '<p>see <a class="word-link" data-ins="HT13" title="Open HT13 in the corpus">HT 13</a> and <a class="word-link" data-ins="HT13" title="Open HT13 in the corpus">HT13</a></p>',
    );
  });

  it("handles support-series letters and joins", () => {
    const out = linkifyTabletRefs("<p>PK Za 11; HT 123+124a</p>", resolve);
    expect(out).toContain('data-ins="PKZa11"');
    expect(out).toContain('data-ins="HT123+124a"');
  });

  it("resolves fragment letters to the base tablet", () => {
    // HT9a isn't a corpus id but HT9 is — the link lands on the tablet.
    expect(linkifyTabletRefs("<p>HT 9a</p>", resolve)).toContain(
      'data-ins="HT9"',
    );
  });

  it("never links prose that merely looks like a reference", () => {
    const html = "<p>MM 2 pottery; GORILA 1, 22; ZA 99</p>";
    expect(linkifyTabletRefs(html, resolve)).toBe(html);
  });

  it("never touches tags or attribute values", () => {
    const html = '<img src="HT13.jpg" alt="HT 13"> photo';
    expect(linkifyTabletRefs(html, resolve)).toBe(html + ""); // tag untouched
  });
});

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
