// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { sanitizeHtmlFragment } from "./sanitizeHtml";

describe("sanitizeHtmlFragment", () => {
  it("removes <script> elements", () => {
    const out = sanitizeHtmlFragment("<p>hi</p><script>alert(1)</script>");
    expect(out).toContain("<p>hi</p>");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("neutralizes the nested <scr<script>ipt> trick that defeats regex", () => {
    // The classic bypass: a regex that strips <script>…</script> would leave a
    // freshly-reassembled <script> behind. The DOM sanitizer never does string
    // removal, so the real contract is "no executable <script> element survives
    // when the output is parsed" — not "the literal text '<script>' is absent".
    const out = sanitizeHtmlFragment("<scr<script>ipt>alert(1)</script>");
    const reparsed = new DOMParser().parseFromString(out, "text/html");
    expect(reparsed.querySelector("script")).toBeNull();
    // And it is idempotent: a second pass still yields no script element.
    const twice = new DOMParser().parseFromString(
      sanitizeHtmlFragment(out),
      "text/html",
    );
    expect(twice.querySelector("script")).toBeNull();
  });

  it("strips on* event-handler attributes", () => {
    const out = sanitizeHtmlFragment('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
  });

  it("drops javascript: URLs on href/src", () => {
    const out = sanitizeHtmlFragment('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("removes style/iframe/object and other dangerous elements", () => {
    const out = sanitizeHtmlFragment(
      "<style>body{}</style><iframe src='x'></iframe><object></object><p>ok</p>",
    );
    expect(out.toLowerCase()).not.toContain("<style");
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out.toLowerCase()).not.toContain("<object");
    expect(out).toContain("<p>ok</p>");
  });

  it("preserves legitimate table / inline-style / font markup", () => {
    const html =
      '<table><tr><td style="color:red"><font color="blue">cell</font></td></tr></table>';
    const out = sanitizeHtmlFragment(html);
    expect(out).toContain("<table>");
    expect(out).toContain("cell");
    expect(out).toContain("color:red");
  });
});

describe("sanitizeHtmlFragment — XSS vectors that bypassed the hand-rolled sanitizer", () => {
  // Regression for the three holes the quality audit found in the previous
  // scheme-regex sanitizer; DOMPurify closes all three.
  const reparse = (out: string) =>
    new DOMParser().parseFromString(out, "text/html");

  it("drops data:text/html URLs, not just javascript:", () => {
    const out = sanitizeHtmlFragment(
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    );
    const href = reparse(out).querySelector("a")?.getAttribute("href") ?? "";
    expect(href).not.toMatch(/^\s*data:/i);
  });

  it("drops javascript: obfuscated with an embedded control character", () => {
    // Browsers strip TAB/newline from a URL before resolving its scheme, so the
    // raw value does not literally start with "javascript:".
    const out = sanitizeHtmlFragment('<a href="java\tscript:alert(1)">x</a>');
    const href = reparse(out).querySelector("a")?.getAttribute("href") ?? "";
    expect(href.replace(/[\t\n\r\0]/g, "").toLowerCase()).not.toContain(
      "javascript:",
    );
  });

  it("neutralizes the SVG SMIL <animate> href vector", () => {
    const out = sanitizeHtmlFragment(
      '<svg><a><animate attributeName="href" to="javascript:alert(1)"/></a></svg>',
    );
    expect(out.toLowerCase()).not.toContain("javascript:");
    const to = reparse(out).querySelector("animate")?.getAttribute("to") ?? "";
    expect(to).not.toMatch(/javascript:/i);
  });

  it("drops vbscript: URLs", () => {
    const out = sanitizeHtmlFragment('<a href="vbscript:msgbox(1)">x</a>');
    expect(out.toLowerCase()).not.toContain("vbscript:");
  });
});
