import { describe, it, expect } from "vitest";
import {
  buildInscriptionExport,
  buildCorpusExport,
  SCHEMA_VERSION,
} from "./corpusExport";
import type {
  Annotation,
  Collection,
  CorpusScope,
  Inscription,
  Pin,
  WordEntry,
} from "./types";

// A small balancing accounting tablet: GRA 10 + VIN 5 = KU-RO 15.
function accountingTablet(): Inscription {
  return {
    id: "HT1",
    site: "HT",
    support: "tablet",
    scribe: "S1",
    findspot: "Haghia Triada",
    context: "LMIB",
    name: "HT 1",
    words: ["GRA", "10", "VIN", "5", "KU-RO", "15"],
    translations: [],
    lines: [
      ["GRA", "10"],
      ["VIN", "5"],
      ["KU-RO", "15"],
    ],
    glyphs: "",
    transcription: "",
    facsimileImages: [],
    images: [],
    imageRights: "",
    imageRightsURL: "",
  };
}

const noUserState = {
  includeUserState: false as const,
  annotations: [] as Annotation[],
  collections: [] as Collection[],
  pins: [] as Pin[],
  tabletCategoryOverrides: {} as Record<string, string>,
};

describe("buildInscriptionExport — derived block", () => {
  it("counts multi-sign words, classifies, and reconciles the accounting", () => {
    const rec = buildInscriptionExport(accountingTablet(), noUserState);
    expect(rec.derived.multiSignWordCount).toBe(1); // only KU-RO has a hyphen
    expect(rec.derived.tabletStructureHeuristic).toBe("accounting");
    expect(rec.derived.tabletStructureCategory).toBe("accounting");
    expect(rec.derived.tabletStructureOverridden).toBe(false);

    const balance = rec.derived.balance!;
    expect(balance.hasTotal).toBe(true);
    expect(balance.totalsChecked).toBe(1);
    expect(balance.allBalance).toBe(true);
    expect(balance.checks[0].marker).toBe("KU-RO");
    expect(balance.checks[0].computedSum).toBe(15);
    expect(balance.checks[0].difference).toBe(0);
  });

  it("records a researcher override and flags it as overridden", () => {
    const rec = buildInscriptionExport(accountingTablet(), {
      ...noUserState,
      tabletCategoryOverrides: { HT1: "libation" },
    });
    expect(rec.derived.tabletStructureHeuristic).toBe("accounting");
    expect(rec.derived.tabletStructureCategory).toBe("libation");
    expect(rec.derived.tabletStructureOverridden).toBe(true);
  });

  it("ignores an invalid override value", () => {
    const rec = buildInscriptionExport(accountingTablet(), {
      ...noUserState,
      tabletCategoryOverrides: { HT1: "not-a-category" },
    });
    expect(rec.derived.tabletStructureCategory).toBe("accounting");
  });

  it("omits userState unless requested, and includes it when on", () => {
    const plain = buildInscriptionExport(accountingTablet(), noUserState);
    expect(plain.userState).toBeUndefined();

    const annotations: Annotation[] = [
      {
        id: "a1",
        target: { kind: "inscription", value: "HT1" },
        proposedMeaning: "ration list",
        confidence: "low",
        notes: "",
        evidenceIds: [],
        createdAt: "",
        updatedAt: "",
      },
    ];
    const collections: Collection[] = [
      {
        id: "c1",
        name: "My tablets",
        items: [{ kind: "inscription", value: "HT1" }],
        createdAt: "",
        updatedAt: "",
      },
    ];
    const pins: Pin[] = [
      { id: "p1", kind: "inscription", value: "HT1", pinnedAt: "" },
    ];
    const withState = buildInscriptionExport(accountingTablet(), {
      includeUserState: true,
      annotations,
      collections,
      pins,
      tabletCategoryOverrides: {},
    });
    expect(withState.userState).toBeDefined();
    expect(withState.userState!.annotations[0].proposedMeaning).toBe(
      "ration list",
    );
    expect(withState.userState!.collections).toEqual(["My tablets"]);
    expect(withState.userState!.pinned).toBe(true);
  });
});

describe("buildCorpusExport", () => {
  const scope: CorpusScope = {
    site: null,
    period: null,
    scribe: null,
    support: null,
    collectionId: null,
  };

  function baseOpts() {
    return {
      scope,
      scopeSummary: "whole corpus",
      includeUserState: false,
      includeSigns: false,
      includeWordFrequencies: false,
      hypothesis: {},
      annotations: [],
      collections: [],
      pins: [],
      tabletCategoryOverrides: {},
    };
  }

  it("wraps inscriptions with a versioned _meta block", () => {
    const out = buildCorpusExport([accountingTablet()], [], new Map(), baseOpts());
    expect(out._meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out._meta.inscriptionCount).toBe(1);
    expect(out._meta.scopeSummary).toBe("whole corpus");
    expect(out.inscriptions).toHaveLength(1);
    expect(out.signs).toBeUndefined();
    expect(out.wordFrequencies).toBeUndefined();
  });

  it("emits word frequencies (multi-sign only) sorted by count when requested", () => {
    const wordIndex = new Map<string, WordEntry>([
      ["KU-RO", { count: 3, inscriptionIds: ["HT1"], sites: new Set(["HT"]) }],
      ["PA-I-TO", { count: 7, inscriptionIds: ["HT1"], sites: new Set(["HT"]) }],
      ["GRA", { count: 99, inscriptionIds: ["HT1"], sites: new Set(["HT"]) }], // no hyphen → excluded
    ]);
    const out = buildCorpusExport([accountingTablet()], [], wordIndex, {
      ...baseOpts(),
      includeWordFrequencies: true,
    });
    const freqs = out.wordFrequencies!;
    expect(freqs.map((f) => f.word)).toEqual(["PA-I-TO", "KU-RO"]); // sorted desc, GRA dropped
    expect(freqs[0].phonetic).toBe("paito");
  });
});
