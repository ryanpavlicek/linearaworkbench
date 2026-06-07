// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  useWorkbench,
  buildIndex,
  annotationFor,
  getAllLanguages,
  EMPTY_SCOPE,
} from "./workbench";
import type { Inscription, SignData } from "../lib/types";

// Reset the singleton store's mutable slices before each test so cases don't
// leak into one another. (The store is a module-level zustand instance.)
beforeEach(() => {
  localStorage.clear();
  useWorkbench.setState({
    annotations: [],
    pins: [],
    collections: [],
    tabletCategories: {},
    findings: [],
    notes: [],
    savedHypotheses: [],
    hypothesis: {},
    overrideEvidence: {},
    undoStack: [],
    scope: { ...EMPTY_SCOPE },
    toast: null,
  });
});

const store = () => useWorkbench.getState();

describe("buildIndex", () => {
  const inscriptions: Inscription[] = [
    blank("HT1", "HT", ["KU-RO", "KU-RO", "GRA"]),
    blank("HT2", "HT", ["KU-RO", "PA-I-TO"]),
    blank("ZA1", "ZA", ["PA-I-TO"]),
  ];

  it("indexes by id, aggregates word counts, and dedupes inscription ids", () => {
    const idx = buildIndex(inscriptions, []);
    expect(idx.byId.get("HT2")?.site).toBe("HT");

    const kuro = idx.wordIndex.get("KU-RO")!;
    expect(kuro.count).toBe(3); // 2 in HT1 + 1 in HT2 (occurrences)
    expect(kuro.inscriptionIds).toEqual(["HT1", "HT2"]); // distinct, deduped
    expect([...kuro.sites].sort()).toEqual(["HT"]);

    const paito = idx.wordIndex.get("PA-I-TO")!;
    expect([...paito.sites].sort()).toEqual(["HT", "ZA"]);
  });

  it("builds a site index with per-site counts", () => {
    const idx = buildIndex(inscriptions, []);
    expect(idx.siteIndex.get("HT")?.count).toBe(2);
    expect(idx.siteIndex.get("ZA")?.count).toBe(1);
  });

  it("maps signs by label", () => {
    const signs: SignData[] = [sign("KU"), sign("RO")];
    const idx = buildIndex([], signs);
    expect(idx.signsByLabel.get("KU")?.label).toBe("KU");
    expect(idx.signs).toHaveLength(2);
  });
});

describe("annotations — upsert / delete / undo", () => {
  const target = { kind: "word", value: "KU-RO" } as const;

  it("creates, then edits in place on a second upsert (same target)", () => {
    store().upsertAnnotation(target, { proposedMeaning: "total", confidence: "low" });
    expect(store().annotations).toHaveLength(1);
    const a = annotationFor(store().annotations, target)!;
    expect(a.proposedMeaning).toBe("total");

    store().upsertAnnotation(target, { confidence: "high" });
    expect(store().annotations).toHaveLength(1); // upsert, not append
    const edited = annotationFor(store().annotations, target)!;
    expect(edited.confidence).toBe("high");
    expect(edited.proposedMeaning).toBe("total"); // unspecified field preserved
  });

  it("persists annotations to localStorage", () => {
    store().upsertAnnotation(target, { proposedMeaning: "x" });
    const raw = localStorage.getItem("linear-a-workbench:annotations");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it("undo reverses an add (removes the new annotation)", () => {
    store().upsertAnnotation(target, { proposedMeaning: "total" });
    expect(store().annotations).toHaveLength(1);
    store().undoLast();
    expect(store().annotations).toHaveLength(0);
  });

  it("undo reverses an edit (restores the previous value)", () => {
    store().upsertAnnotation(target, { proposedMeaning: "first" });
    store().upsertAnnotation(target, { proposedMeaning: "second" });
    expect(annotationFor(store().annotations, target)!.proposedMeaning).toBe("second");
    store().undoLast();
    expect(annotationFor(store().annotations, target)!.proposedMeaning).toBe("first");
  });

  it("delete removes it and undo brings it back", () => {
    store().upsertAnnotation(target, { proposedMeaning: "total" });
    const id = store().annotations[0].id;
    store().deleteAnnotation(id);
    expect(store().annotations).toHaveLength(0);
    store().undoLast();
    expect(store().annotations).toHaveLength(1);
    expect(store().annotations[0].id).toBe(id);
  });

  it("importAnnotations merges by target and replaces wholesale", () => {
    store().upsertAnnotation(target, { proposedMeaning: "keep" });
    const other = { kind: "word", value: "PA-I-TO" } as const;
    store().importAnnotations(
      [
        {
          id: "imp1",
          target: other,
          proposedMeaning: "imported",
          confidence: "medium",
          notes: "",
          evidenceIds: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
      "merge",
    );
    expect(store().annotations).toHaveLength(2);

    store().importAnnotations([], "replace");
    expect(store().annotations).toHaveLength(0);
  });
});

describe("pins — toggle / dedupe / reorder / undo", () => {
  it("togglePin adds then removes; duplicates are ignored", () => {
    store().togglePin("word", "KU-RO");
    expect(store().pins).toHaveLength(1);
    store().pin("word", "KU-RO"); // duplicate
    expect(store().pins).toHaveLength(1);
    store().togglePin("word", "KU-RO");
    expect(store().pins).toHaveLength(0);
  });

  it("undo reverses a pin", () => {
    store().pin("inscription", "HT1");
    store().undoLast();
    expect(store().pins).toHaveLength(0);
  });

  it("reorderPin moves an item to a new index", () => {
    store().pin("word", "A");
    store().pin("word", "B");
    store().pin("word", "C");
    const cId = store().pins[2].id;
    store().reorderPin(cId, 0);
    expect(store().pins.map((p) => p.value)).toEqual(["C", "A", "B"]);
  });
});

describe("collections", () => {
  it("creates, adds (deduped), removes items, and deletes", () => {
    const id = store().createCollection("My tablets");
    store().addToCollection(id, { kind: "inscription", value: "HT1" });
    store().addToCollection(id, { kind: "inscription", value: "HT1" }); // dup
    expect(store().collections[0].items).toHaveLength(1);

    store().removeFromCollection(id, { kind: "inscription", value: "HT1" });
    expect(store().collections[0].items).toHaveLength(0);

    store().deleteCollection(id);
    expect(store().collections).toHaveLength(0);
  });

  it("createCollectionWithItems de-duplicates the seed items", () => {
    store().createCollectionWithItems("seeded", [
      { kind: "word", value: "KU-RO" },
      { kind: "word", value: "KU-RO" },
      { kind: "word", value: "PA-I-TO" },
    ]);
    expect(store().collections[0].items).toHaveLength(2);
  });
});

describe("tablet category overrides", () => {
  it("sets, clears one, and clears all", () => {
    store().setTabletCategory("HT1", "libation");
    store().setTabletCategory("HT2", "list");
    expect(store().tabletCategories).toEqual({ HT1: "libation", HT2: "list" });

    store().clearTabletCategory("HT1");
    expect(store().tabletCategories).toEqual({ HT2: "list" });

    store().clearAllTabletCategories();
    expect(store().tabletCategories).toEqual({});
  });
});

describe("hypothesis overrides", () => {
  it("sets, clears, and resets sign sound overrides + evidence", () => {
    store().setOverride("KU", "gu");
    store().setOverrideEvidence("KU", { note: "a guess" });
    expect(store().hypothesis.KU).toBe("gu");
    expect(store().overrideEvidence.KU.note).toBe("a guess");

    store().clearOverride("KU");
    expect(store().hypothesis.KU).toBeUndefined();
    expect(store().overrideEvidence.KU).toBeUndefined();

    store().setOverride("RO", "lo");
    store().resetHypothesis();
    expect(store().hypothesis).toEqual({});
  });

  it("saves and reloads a named hypothesis snapshot", () => {
    store().setOverride("KU", "gu");
    store().saveHypothesis("guess 1");
    store().resetHypothesis();
    expect(store().hypothesis).toEqual({});
    store().loadHypothesis(0);
    expect(store().hypothesis.KU).toBe("gu");
  });
});

describe("undo stack ordering", () => {
  it("undoes the most recent action first (LIFO) and reports empty", () => {
    // Annotation inverses mutate state directly (no re-recording), so the
    // stack unwinds cleanly — use them to exercise pure LIFO ordering.
    store().upsertAnnotation({ kind: "word", value: "A" }, { proposedMeaning: "x" });
    store().upsertAnnotation({ kind: "word", value: "B" }, { proposedMeaning: "y" });
    store().undoLast(); // reverses the B annotation
    expect(store().annotations.map((a) => a.target.value)).toEqual(["A"]);
    store().undoLast(); // reverses the A annotation
    expect(store().annotations).toHaveLength(0);
    store().undoLast(); // nothing left
    expect(store().toast?.message).toBe("Nothing to undo");
  });

  // CHARACTERIZATION — documents a real quirk, not desired behavior. Unlike the
  // annotation inverses, pin/unpin inverses call the *public* unpin()/pin()
  // actions, which each push their own undo entry. So undoing a pin records a
  // fresh "re-pin" inverse: a second undo REDOES the pin instead of continuing
  // to unwind history. Flagged for the maintainer — see the test report.
  it("[known quirk] undoing a pin re-records onto the undo stack", () => {
    store().pin("word", "A");
    store().undoLast(); // unpin() removes A but pushes a re-pin inverse
    expect(store().pins).toHaveLength(0);
    store().undoLast(); // re-adds A rather than unwinding further
    expect(store().pins.map((p) => p.value)).toEqual(["A"]);
  });
});

describe("scope", () => {
  it("patches individual dimensions and clears back to empty", () => {
    store().setScope({ site: "HT" });
    store().setScope({ period: "LMIB" });
    expect(store().scope.site).toBe("HT");
    expect(store().scope.period).toBe("LMIB");
    store().clearScope();
    expect(store().scope).toEqual(EMPTY_SCOPE);
  });
});

describe("selectors", () => {
  it("getAllLanguages merges custom languages over the built-ins", () => {
    const merged = getAllLanguages({ Klingon: [{ w: "tlh", m: "x", d: "y" }] });
    expect(merged.Klingon).toHaveLength(1);
    // built-ins are still present alongside the custom entry
    expect(Object.keys(merged).length).toBeGreaterThan(1);
  });
});

// ── fixtures ──────────────────────────────────────────────────────────────
function blank(id: string, site: string, words: string[]): Inscription {
  return {
    id,
    site,
    support: "",
    scribe: "",
    findspot: "",
    context: "",
    name: id,
    words,
    translations: [],
    lines: [],
    glyphs: "",
    transcription: "",
    facsimileImages: [],
    images: [],
    imageRights: "",
    imageRightsURL: "",
  };
}

function sign(label: string): SignData {
  return {
    label,
    glyph: "",
    codepoint: null,
    phonetic: null,
    sharedWithLinearB: false,
    linearAOnly: false,
    total: 0,
    confidence: 0,
    altGlyphs: [],
  };
}
