import { describe, it, expect } from "vitest";
import {
  csvEscape,
  classifyToken,
  normalizeSignLabel,
  canonicalCommentaryId,
  siglaDocumentId,
  commentaryUrl,
  siglaUrl,
  siglaSignListUrl,
  upstreamAsset,
  describeInscription,
} from "./helpers";
import type { Inscription } from "./types";

describe("csvEscape", () => {
  it("leaves plain values untouched", () => {
    expect(csvEscape("HT1")).toBe("HT1");
    expect(csvEscape(42)).toBe("42");
  });

  it("quotes and doubles embedded quotes for comma/quote/newline values", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("classifyToken", () => {
  it("distinguishes words, numerals, ideograms, separators, and text", () => {
    expect(classifyToken("KU-RO")).toBe("word");
    expect(classifyToken("123")).toBe("numeral");
    expect(classifyToken("OLE")).toBe("ideogram");
    expect(classifyToken("𐄁")).toBe("separator");
    expect(classifyToken("abc")).toBe("text");
  });
});

describe("normalizeSignLabel", () => {
  it("folds subscript digits to ASCII", () => {
    expect(normalizeSignLabel("RA₂")).toBe("RA2");
    expect(normalizeSignLabel("PA₃")).toBe("PA3");
    expect(normalizeSignLabel("KU")).toBe("KU");
  });
});

describe("canonicalCommentaryId", () => {
  it("collapses fragment / face IDs to the parent tablet", () => {
    expect(canonicalCommentaryId("HT6a")).toBe("HT6");
    expect(canonicalCommentaryId("HT127fr.1")).toBe("HT127");
    expect(canonicalCommentaryId("KH11b")).toBe("KH11");
  });

  it("leaves an already-canonical ID unchanged", () => {
    expect(canonicalCommentaryId("HT13")).toBe("HT13");
  });
});

describe("siglaDocumentId", () => {
  it("re-inserts the spaces SigLA expects in document IDs", () => {
    expect(siglaDocumentId("HT1")).toBe("HT 1");
    expect(siglaDocumentId("HTWa1001")).toBe("HT Wa 1001");
    expect(siglaDocumentId("ARKH1a")).toBe("ARKH 1a");
  });
});

describe("external link builders", () => {
  it("commentaryUrl points at the canonical parent .html under the mirror", () => {
    const url = commentaryUrl("HT6a");
    expect(url).toContain("/commentary/");
    expect(url).toContain("HT6.html");
  });

  it("siglaUrl encodes the spaced document id", () => {
    expect(siglaUrl("HT1")).toBe("https://sigla.phis.me/document/HT%201/");
  });

  it("siglaSignListUrl targets the sign's row via a text fragment", () => {
    expect(siglaSignListUrl()).toBe("https://sigla.phis.me/sign-list.html");
    expect(siglaSignListUrl("KU")).toContain("#:~:text=");
    // A-only star signs are coded A### in SigLA.
    expect(siglaSignListUrl("*301")).toContain("A301");
  });

  it("upstreamAsset resolves relative paths and passes through absolute URLs", () => {
    expect(upstreamAsset("images/HT1.jpg")).toContain("/upstream/images/HT1.jpg");
    expect(upstreamAsset("https://example.com/x.jpg")).toBe(
      "https://example.com/x.jpg",
    );
    expect(upstreamAsset("")).toBe("");
  });
});

describe("describeInscription", () => {
  it("joins the present metadata fields, skipping blanks", () => {
    const ins = {
      support: "tablet",
      scribe: "S1",
      findspot: "",
    } as Inscription;
    expect(describeInscription(ins)).toBe("tablet · S1");
  });
});
