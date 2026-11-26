import { describe, it, expect } from "vitest";
import {
  alignPhonetic,
  benjaminiHochberg,
  chiSquaredPValue,
  holmBonferroni,
} from "./algorithms";
import { isLexicalWord, commodityHead } from "../data/commodities";
import { safeHref, safeCorpusUrl, safeDataImageUri, safeReportImageSrc } from "./urlSafety";
import { parseRefUrl, renderNoteHtml } from "./notes";
import { evalQuery } from "./queryEngine";
import { trainSignBigramModel, wordSurprisal } from "./surprisal";
import type { Inscription, WordEntry } from "./types";

describe("v2.0 security & correctness regressions", () => {
  it("safeHref allows safe links and rejects javascript/data/vbscript/protocol-relative URIs", () => {
    expect(safeHref("https://pyaegean.xyz/")).toBe("https://pyaegean.xyz/");
    expect(safeHref("papers/GORILA-Vol1.pdf")).toBe("papers/GORILA-Vol1.pdf");
    expect(safeHref("#section-1")).toBe("#section-1");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("  JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHref("//evil.example/x")).toBeNull();
  });

  it("safeCorpusUrl permits same-origin, https, and loopback, and rejects data:/javascript:", () => {
    expect(safeCorpusUrl("/api/local/corpus.json")).toEqual({
      ok: true,
      url: "/api/local/corpus.json",
      external: false,
    });
    expect(safeCorpusUrl("https://example.org/c.json").ok).toBe(true);
    expect(safeCorpusUrl("http://127.0.0.1:8000/c.json").ok).toBe(true);
    expect(safeCorpusUrl("data:application/json,[]").ok).toBe(false);
    expect(safeCorpusUrl("javascript:alert(1)").ok).toBe(false);
    expect(safeCorpusUrl("http://insecure.example/c.json").ok).toBe(false);
  });

  it("safeDataImageUri and safeReportImageSrc reject attribute-breakout payloads", () => {
    expect(safeDataImageUri("data:image/png;base64,iVBORw0KGgo=")).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(
      safeDataImageUri('data:image/png" onerror="alert(1)" x="'),
    ).toBeNull();
    expect(safeReportImageSrc("images/HT13_facsimile.jpg")).toBe(
      "images/HT13_facsimile.jpg",
    );
    expect(safeReportImageSrc("images/../etc/passwd")).toBeNull();
    expect(safeReportImageSrc('images/a" onerror="alert(1)')).toBeNull();
  });

  it("isLexicalWord keeps hyphenated words containing syllabogram NI while keeping standalone NI as figs", () => {
    expect(commodityHead("NI")).toBe("NI");
    expect(isLexicalWord("KU-NI-SU")).toBe(true);
    expect(isLexicalWord("PA₃-NI-NA")).toBe(true);
    expect(isLexicalWord("WA-DU-NI-MI")).toBe(true);
    expect(isLexicalWord("NI-RA")).toBe(true);
    expect(isLexicalWord("GRA-PA")).toBe(false);
  });

  it("alignPhonetic terminates cleanly on non-integer indel weights (e.g. 0.3)", () => {
    const cells = alignPhonetic("bbbbbb", "", {
      vowel: 0.3,
      sameClass: 0.5,
      far: 1,
      indel: 0.3,
    });
    expect(cells).toHaveLength(6);
    expect(cells.every((c) => c.op === "del")).toBe(true);
  });

  it("chiSquaredPValue stays positive without catastrophic cancellation at chi² >= 75", () => {
    const p75 = chiSquaredPValue(75);
    expect(p75).toBeGreaterThan(0);
    expect(p75).toBeLessThan(1e-16);
  });

  it("benjaminiHochberg and holmBonferroni preserve order and monotonicity", () => {
    const ps = [0.001, 0.04, 0.2, 0.01];
    const bh = benjaminiHochberg(ps);
    const holm = holmBonferroni(ps);
    expect(bh[0]).toBeCloseTo(0.004, 6);
    expect(bh[3]).toBeCloseTo(0.02, 6);
    expect(bh[1]).toBeCloseTo(0.053333, 5);
    expect(bh[2]).toBeCloseTo(0.2, 6);
    expect(holm[0]).toBeCloseTo(0.004, 6);
    expect(holm[3]).toBeCloseTo(0.03, 6);
    expect(holm[1]).toBeCloseTo(0.08, 6);
    expect(holm[2]).toBeCloseTo(0.2, 6);
  });

  it("notes.ts handles malformed percent encodings without throwing and preserves *NNN sign labels", () => {
    expect(parseRefUrl("wb:ins/%E0%A4%A")).toBeNull();
    const html = renderNoteHtml("Compare *301 and *306 with `*301` and *emphasis*.", {
      refHtml: ({ label }) => `<span>${label}</span>`,
    });
    expect(html).toContain("*301 and *306");
    expect(html).toContain("<code>*301</code>");
    expect(html).toContain("<em>emphasis</em>");
  });

  it("queryEngine treats blank negated filter rows as neutral rather than matching zero records", () => {
    const ins: Inscription = {
      id: "HT1",
      site: "Haghia Triada",
      support: "tablet",
      scribe: "",
      findspot: "",
      context: "LMIB",
      name: "HT1",
      words: ["KU-RO"],
      translations: [""],
      lines: [["KU-RO"]],
      glyphs: "",
      transcription: "",
      facsimileImages: [],
      images: [],
      imageRights: "",
      imageRightsURL: "",
    };
    const wi = new Map<string, WordEntry>([
      ["KU-RO", { count: 1, sites: new Set(["Haghia Triada"]), inscriptionIds: ["HT1"] }],
    ]);
    const res = evalQuery(
      [{ rid: "1", field: "site-is", value: "", negate: true, connector: "and" }],
      "inscriptions",
      [ins],
      wi,
      new Set(),
      new Map(),
    );
    expect(res.inscriptions).toHaveLength(1);
  });

  it("surprisal leave-one-out decrements T(a) for all zeroed transitions from repeated contexts", () => {
    const model = trainSignBigramModel([
      { word: "A-B-A-C", count: 1 },
      { word: "A-D", count: 5 },
      { word: "X-Y", count: 5 },
    ]);
    // After removing A-B-A-C completely, context A only retains transition A->D (T(A)=1, ca=5).
    const loo = wordSurprisal(model, "A-B-A-C", 1);
    const refModel = trainSignBigramModel([
      { word: "A-D", count: 5 },
      { word: "X-Y", count: 5 },
    ]);
    const exact = wordSurprisal(refModel, "A-B-A-C", 0);
    expect(loo.mean).toBeCloseTo(exact.mean, 10);
  });
});
