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
