import { describe, expect, it } from "vitest";
import {
  bodyToObsidian,
  bodyToStandalone,
  buildResearchBundle,
  buildVault,
  fileSafe,
  LIVE_SITE,
  permalink,
  type VaultInput,
} from "./vaultExport";
import type { Annotation, Inscription } from "./types";

const INS: Inscription = {
  id: "HT13",
  site: "Haghia Triada",
  support: "tablet",
  scribe: "HT Scribe 8",
  findspot: "Villa Magazine",
  context: "LMIB",
  name: "HT13",
  words: ["KA-U-DE-TA", "KU-RO"],
  translations: ["", "total"],
  lines: [["KA-U-DE-TA"], ["KU-RO"]],
  glyphs: "",
  transcription: "",
  facsimileImages: [],
  images: [],
  imageRights: "",
  imageRightsURL: "",
};

function ann(partial: Partial<Annotation>): Annotation {
  return {
    id: "a1",
    target: { kind: "word", value: "KU-RO" },
    proposedMeaning: "total",
    confidence: "high",
    notes: "",
    evidenceIds: [],
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...partial,
  };
}

function input(partial: Partial<VaultInput>): VaultInput {
  return {
    generatedAt: "2026-06-12T10:00:00.000Z",
    notes: [],
    annotations: [],
    collections: [],
    findings: [],
    getInscription: (id) => (id === "HT13" ? INS : undefined),
    getWordStat: (w) =>
      w === "KU-RO" ? { count: 37, sites: ["Haghia Triada", "Zakros"] } : undefined,
    ...partial,
  };
}

describe("fileSafe", () => {
  it("strips characters Obsidian and the OS reject", () => {
    expect(fileSafe('a/b\\c:d*e?f"g<h>i|j#k^l[m]n')).toBe("a b c d✱e f g h i j k l m n");
  });

  it("maps * to a lookalike so sign numbers survive", () => {
    expect(fileSafe("DA-SI-*118")).toBe("DA-SI-✱118");
  });

  it("collapses whitespace, trims trailing dots, and never returns empty", () => {
    expect(fileSafe("  a   b. ")).toBe("a b");
    expect(fileSafe("???")).toBe("untitled");
  });
});

describe("bodyToObsidian", () => {
  const names = {
    noteNames: new Map([["n2", "Other note"]]),
    collectionNames: new Map([["c1", "Wine tablets"]]),
    findingNames: new Map<string, string>(),
  };

  it("converts tablet and word references to wikilinks", () => {
    expect(
      bodyToObsidian("See [the wine tablet](wb:ins/HT13) and [KU-RO](wb:word/KU-RO).", names),
    ).toBe("See [[HT13|the wine tablet]] and [[KU-RO]].");
  });

  it("routes annotation refs to the Lexicon and resolves note/collection ids", () => {
    expect(
      bodyToObsidian(
        "[my reading](wb:annotation/a1), [continued](wb:note/n2), [group](wb:collection/c1)",
        names,
      ),
    ).toBe("[[Lexicon|my reading]], [[Other note|continued]], [[Wine tablets|group]]");
  });

  it("leaves ordinary links and text alone", () => {
    const body = "Plain [link](https://example.org) and *italics*.";
    expect(bodyToObsidian(body, names)).toBe(body);
  });
});

describe("bodyToStandalone", () => {
  it("turns tablet/word refs into live URLs and flattens the rest", () => {
    const out = bodyToStandalone(
      "See [HT13](wb:ins/HT13), [KU-RO](wb:word/KU-RO), [reading](wb:annotation/a1).",
    );
    expect(out).toBe(
      `See [HT13](${LIVE_SITE}#/i/HT13), [KU-RO](${LIVE_SITE}#/w/KU-RO), reading.`,
    );
  });
});

describe("buildVault", () => {
  it("plans README only for an empty workspace", () => {
    const files = buildVault(input({}));
    expect(files.map((f) => f.path)).toEqual(["README.md"]);
    expect(files[0].content).toContain("Obsidian vault");
  });

  it("plans the full layout from annotations, notes, collections, findings", () => {
    const files = buildVault(
      input({
        annotations: [
          ann({ id: "a1", evidenceIds: ["HT13"] }),
          ann({
            id: "a2",
            target: { kind: "inscription", value: "HT13" },
            proposedMeaning: "wine record",
            confidence: "medium",
          }),
        ],
        notes: [
          {
            id: "n1",
            title: "On KU-RO",
            body: "It precedes sums on [HT13](wb:ins/HT13).",
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-02T00:00:00.000Z",
          },
        ],
        collections: [
          {
            id: "c1",
            name: "Wine tablets",
            items: [{ kind: "inscription", value: "HT13" }],
            createdAt: "",
            updatedAt: "",
          },
        ],
        findings: [
          {
            id: "f1",
            module: "kwic",
            moduleLabel: "Concordance (KWIC)",
            title: "KU-RO contexts",
            summary: "37 rows.",
            report: { html: "<table/>", markdown: "| a |\n|---|" },
            createdAt: "2026-06-03T00:00:00.000Z",
          },
        ],
      }),
    );
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([
      "README.md",
      "Lexicon.md",
      "Notes/On KU-RO.md",
      "Tablets/HT13.md",
      "Words/KU-RO.md",
      "Collections/Wine tablets.md",
      "Findings/KU-RO contexts.md",
    ]);

    const tablet = files.find((f) => f.path === "Tablets/HT13.md")!.content;
    expect(tablet).toContain("site: Haghia Triada");
    expect(tablet).toContain("period: LMIB");
    expect(tablet).toContain("**Transliteration:** KA-U-DE-TA KU-RO");
    expect(tablet).toContain("## Your reading");
    expect(tablet).toContain("- **wine record** (medium)");
    expect(tablet).toContain("## Cited as evidence for");
    expect(tablet).toContain("[[KU-RO]] — total");
    expect(tablet).toContain(permalink("ins", "HT13"));

    const word = files.find((f) => f.path === "Words/KU-RO.md")!.content;
    expect(word).toContain("**Attestation:** 37 occurrences across 2 sites");
    expect(word).toContain("**Proposed meaning:** total (high)");
    expect(word).toContain("Evidence: [[HT13]]");

    const note = files.find((f) => f.path === "Notes/On KU-RO.md")!.content;
    expect(note).toContain("created: 2026-06-01");
    expect(note).toContain("[[HT13]]");
    expect(note).not.toContain("wb:");

    const lexicon = files.find((f) => f.path === "Lexicon.md")!.content;
    expect(lexicon).toContain("| [[HT13]] | inscription | wine record | medium |");
  });

  it("creates stub pages for evidence-only tablets", () => {
    const files = buildVault(
      input({ annotations: [ann({ evidenceIds: ["HT9a"] })] }),
    );
    expect(files.map((f) => f.path)).toContain("Tablets/HT9a.md");
    // unknown to the lookup → no frontmatter, still has the permalink
    const stub = files.find((f) => f.path === "Tablets/HT9a.md")!.content;
    expect(stub).not.toContain("site:");
    expect(stub).toContain(permalink("ins", "HT9a"));
  });

  it("dedupes colliding note titles", () => {
    const note = (id: string) => ({
      id,
      title: "Same Title",
      body: "x",
      createdAt: "",
      updatedAt: "",
    });
    const files = buildVault(input({ notes: [note("n1"), note("n2")] }));
    const paths = files.map((f) => f.path);
    expect(paths).toContain("Notes/Same Title.md");
    expect(paths).toContain("Notes/Same Title 2.md");
  });

  it("uses the filename-safe form in word paths and the links pointing at them", () => {
    const files = buildVault(
      input({
        annotations: [
          ann({ target: { kind: "word", value: "DA-SI-*118" }, proposedMeaning: "?" }),
        ],
      }),
    );
    expect(files.map((f) => f.path)).toContain("Words/DA-SI-✱118.md");
    const lexicon = files.find((f) => f.path === "Lexicon.md")!.content;
    expect(lexicon).toContain("[[DA-SI-✱118]]");
  });
});

describe("buildResearchBundle", () => {
  it("produces one self-contained document with live URLs and no wb: refs", () => {
    const bundle = buildResearchBundle(
      input({
        annotations: [ann({ evidenceIds: ["HT13"] })],
        notes: [
          {
            id: "n1",
            title: "On KU-RO",
            body: "See [HT13](wb:ins/HT13).",
            createdAt: "",
            updatedAt: "",
          },
        ],
        collections: [
          {
            id: "c1",
            name: "Wine tablets",
            items: [{ kind: "inscription", value: "HT13" }],
            createdAt: "",
            updatedAt: "",
          },
        ],
        findings: [
          {
            id: "f1",
            module: "kwic",
            moduleLabel: "Concordance (KWIC)",
            title: "KU-RO contexts",
            summary: "37 rows.",
            createdAt: "2026-06-03T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(bundle).toContain("# Linear A research notes");
    expect(bundle).toContain("## Lexicon — proposed meanings");
    expect(bundle).toContain("## Note: On KU-RO");
    expect(bundle).toContain("## Finding: KU-RO contexts");
    expect(bundle).toContain("## Collection: Wine tablets");
    expect(bundle).toContain(`${LIVE_SITE}#/i/HT13`);
    expect(bundle).not.toContain("wb:");
    expect(bundle).not.toContain("[[");
  });
});
