import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderMarkdown } from "./markdown";

// The METHODOLOGY module's table of contents is generated from the heading
// ids that renderMarkdown assigns, and the doc's hand-written "Contents"
// links were authored against GitHub's anchor algorithm. These tests pin the
// slugger with known answers (via the toc, since slugify itself is module-
// private) and then prove the real doc's every in-page link resolves to a
// generated id — the property the TOC actually depends on.

/** Slug of a single heading, extracted through the public toc surface. */
function slug(heading: string): string {
  return renderMarkdown(`## ${heading}`).toc[0].id;
}

describe("heading slugs (GitHub anchor algorithm)", () => {
  it("lowercases and hyphenates plain headings", () => {
    expect(slug("Corpus normalization")).toBe("corpus-normalization");
    expect(slug("Known limitations")).toBe("known-limitations");
  });

  it("drops punctuation without collapsing the spaces it leaves behind", () => {
    // The documented example from the module header: the arrow drops out,
    // leaving two spaces → two hyphens. This is the exact id the doc's
    // hand-written "#sign--unicode-glyph-derivation" link targets.
    expect(slug("Sign → Unicode glyph derivation")).toBe(
      "sign--unicode-glyph-derivation",
    );
    // "&" sits between spaces, so its removal also yields a double hyphen.
    expect(slug("Accounting & metrology (total verification)")).toBe(
      "accounting--metrology-total-verification",
    );
  });

  it("strips punctuation that touches words without leaving a gap", () => {
    expect(slug("Interlinear alignment (Compare Inscriptions)")).toBe(
      "interlinear-alignment-compare-inscriptions",
    );
    expect(slug("Word frequency: dispersion and keyness")).toBe(
      "word-frequency-dispersion-and-keyness",
    );
    expect(slug("Fisher's exact (two-sided)")).toBe("fishers-exact-two-sided");
  });

  it("keeps hyphens and underscores", () => {
    expect(slug("Min-joint threshold")).toBe("min-joint-threshold");
    expect(slug("the load_corpus helper")).toBe("the-load_corpus-helper");
  });

  it("strips inline-code backticks the same way GitHub does", () => {
    expect(slug("The `ku-ro` totals")).toBe("the-ku-ro-totals");
  });

  it("trims leading/trailing punctuation runs to nothing", () => {
    expect(slug("...roadmap?")).toBe("roadmap");
  });

  it("keeps non-ASCII letters and numbers, like GitHub's slugger", () => {
    // A heading in Greek or Linear A anchors the same in-app as it would on
    // GitHub: Unicode letters and numbers survive, punctuation drops.
    expect(slug("Ideograms and λόγος")).toBe("ideograms-and-λόγος");
    // Linear A glyphs (astral plane, surrogate pairs) are letters too.
    expect(slug("Sign 𐘇 usage")).toBe("sign-𐘇-usage");
    // "G²": the superscript two is a Unicode number and is kept.
    expect(slug("Log-likelihood ratio (G²)")).toBe("log-likelihood-ratio-g²");
  });

  it("dedupes duplicate headings GitHub-style with -1/-2 suffixes", () => {
    // Repeated headings must not collide, or an in-page link can only reach
    // the first occurrence.
    const { toc } = renderMarkdown("## Notes\n\nbody\n\n## Notes\n\nbody\n\n## Notes");
    expect(toc.map((t) => t.id)).toEqual(["notes", "notes-1", "notes-2"]);
  });

  it("records heading level and raw text in the toc", () => {
    const { toc } = renderMarkdown("# Top\n\n### Deep dive");
    expect(toc).toEqual([
      { id: "top", level: 1, text: "Top" },
      { id: "deep-dive", level: 3, text: "Deep dive" },
    ]);
  });
});

describe("METHODOLOGY.md table of contents", () => {
  // The exact file the app bundles (Methodology.tsx imports it ?raw), so
  // this is the real contract, not a synthetic fixture.
  const src = readFileSync(
    fileURLToPath(new URL("../../docs/METHODOLOGY.md", import.meta.url)),
    "utf8",
  );

  it("resolves every hand-written in-page anchor to a generated heading id", () => {
    const { toc } = renderMarkdown(src);
    const ids = new Set(toc.map((t) => t.id));
    const anchors = [...src.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    // The Contents list links every major section; if this shrinks to a
    // handful the extraction regex has broken, not the doc.
    expect(anchors.length).toBeGreaterThanOrEqual(20);
    const unresolved = anchors.filter((a) => !ids.has(a));
    expect(unresolved).toEqual([]);
  });

  it("collects exactly the headings outside fenced code blocks", () => {
    // Independent fence-aware count: a mis-parsed code fence would either
    // invent toc entries from `# comment` lines or swallow real headings.
    let inFence = false;
    let expected = 0;
    for (const line of src.split(/\r?\n/)) {
      if (line.startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (!inFence && /^#{1,6}\s+\S/.test(line)) expected++;
    }
    const { toc } = renderMarkdown(src);
    expect(toc).toHaveLength(expected);
    expect(expected).toBeGreaterThanOrEqual(30);
  });
});
