// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
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

  it("undoing pins unwinds cleanly without re-recording (regression)", () => {
    // Pin inverses now mutate the slice directly, so the stack unwinds in pure
    // LIFO order rather than the inverse re-pushing a "re-pin" entry. (Guards
    // the bug the earlier characterization test had documented.)
    store().pin("word", "A");
    store().pin("word", "B");
    store().undoLast(); // removes B
    expect(store().pins.map((p) => p.value)).toEqual(["A"]);
    store().undoLast(); // removes A — does NOT re-add anything
    expect(store().pins).toHaveLength(0);
    store().undoLast(); // genuinely empty now
    expect(store().toast?.message).toBe("Nothing to undo");
  });

  it("undo of an unpin restores the pin at its original position", () => {
    store().pin("word", "A");
    store().pin("word", "B");
    store().pin("word", "C");
    const bId = store().pins[1].id;
    store().unpin(bId); // remove from the middle
    expect(store().pins.map((p) => p.value)).toEqual(["A", "C"]);
    store().undoLast(); // restore B at index 1, not appended at the end
    expect(store().pins.map((p) => p.value)).toEqual(["A", "B", "C"]);
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

describe("corpus loading", () => {
  it("loadCorpusFromInscriptions builds the index and flips loaded", () => {
    store().loadCorpusFromInscriptions(
      [blank("HT1", "HT", ["KU-RO"])],
      [sign("KU")],
    );
    expect(store().loaded).toBe(true);
    expect(store().corpus.byId.get("HT1")).toBeDefined();
    expect(store().corpus.signsByLabel.get("KU")).toBeDefined();
  });

  it("loadCorpusFromUrl fetches both files and loads them", async () => {
    const inscriptions = [blank("ZA1", "ZA", ["PA-I-TO"])];
    const signs = [sign("PA")];
    const fetchMock = vi.fn(async (url: string) =>
      ({
        ok: true,
        status: 200,
        json: async () => (url.includes("signs") ? signs : inscriptions),
      }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    await store().loadCorpusFromUrl("/corpus/");
    expect(store().loaded).toBe(true);
    expect(store().corpus.byId.get("ZA1")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("loadCorpusFromUrl records an error on a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response),
    );
    await store().loadCorpusFromUrl("/corpus/");
    expect(store().loaded).toBe(false);
    expect(store().loadError).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("loadCorpusFromCustomUrl normalizes the document and records the source", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      ({
        ok: true,
        status: 200,
        json: async () =>
          url.includes("signs")
            ? [sign("KU")]
            : [{ id: "MY1", words: ["KU-RO"] }], // minimal record, no metadata
      }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    await store().loadCorpusFromCustomUrl(
      "https://example.org/my.json",
      "/corpus/signs.json",
    );
    expect(store().loaded).toBe(true);
    expect(store().corpusSource).toBe("https://example.org/my.json");
    expect(store().corpus.byId.get("MY1")?.site).toBe("Unknown");
    vi.unstubAllGlobals();
  });

  it("loadCorpusFromCustomUrl surfaces unusable documents as loadError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({ ok: true, status: 200, json: async () => ({ nope: 1 }) }) as unknown as Response,
      ),
    );
    await store().loadCorpusFromCustomUrl("https://example.org/bad.json", "/s.json");
    expect(store().loaded).toBe(false);
    expect(store().loadError).toMatch(/Expected a JSON array/);
    vi.unstubAllGlobals();
  });

  it("applyCustomCorpus swaps the corpus, keeps signs, and resets detail/scope", () => {
    store().loadCorpusFromInscriptions(
      [blank("HT1", "HT", ["KU-RO"])],
      [sign("KU")],
    );
    store().showInscription("HT1");
    store().setScope({ site: "HT" });
    const result = store().applyCustomCorpus(
      [{ id: "MY1", words: ["A-B"] }, { words: ["no-id"] }],
      "my-file.json",
    );
    expect(result).toEqual({ loaded: 1, skipped: 1 });
    expect(store().corpusSource).toBe("my-file.json");
    expect(store().corpus.byId.has("MY1")).toBe(true);
    expect(store().corpus.byId.has("HT1")).toBe(false);
    expect(store().corpus.signsByLabel.get("KU")).toBeDefined(); // signs kept
    expect(store().detail).toBeNull();
    expect(store().scope).toEqual(EMPTY_SCOPE);
    // the bundled loader clears the marker again
    store().loadCorpusFromInscriptions([blank("HT1", "HT", ["KU-RO"])], [sign("KU")]);
    expect(store().corpusSource).toBeNull();
  });

  it("applyCustomCorpus throws on unusable input without touching the corpus", () => {
    store().loadCorpusFromInscriptions(
      [blank("HT1", "HT", ["KU-RO"])],
      [sign("KU")],
    );
    expect(() => store().applyCustomCorpus({ nope: 1 }, "bad.json")).toThrow();
    expect(store().corpus.byId.has("HT1")).toBe(true);
    expect(store().corpusSource).toBeNull();
  });
});

describe("findings", () => {
  const draft = {
    module: "compare" as const,
    moduleLabel: "Compare",
    title: "HT1 vs HT2",
    summary: "two tablets",
  };

  it("adds (newest first), updates, deletes, and undoes a delete", () => {
    store().addFinding(draft);
    const id = store().addFinding({ ...draft, title: "second" });
    expect(store().findings[0].title).toBe("second"); // prepended

    store().updateFinding(id, { title: "renamed" });
    expect(store().findings[0].title).toBe("renamed");

    store().deleteFinding(id);
    expect(store().findings).toHaveLength(1);
    store().undoLast();
    expect(store().findings.map((f) => f.title)).toContain("renamed");
  });
});

describe("research notes", () => {
  it("creates (newest first), updates, and deletes", () => {
    store().createNote("First");
    const id = store().createNote("Second");
    expect(store().notes[0].title).toBe("Second");

    store().updateNote(id, { body: "hello" });
    expect(store().notes[0].body).toBe("hello");

    store().deleteNote(id);
    expect(store().notes.map((n) => n.title)).toEqual(["First"]);
  });

  it("defaults an empty title to 'Untitled note'", () => {
    store().createNote("   ");
    expect(store().notes[0].title).toBe("Untitled note");
  });
});

describe("settings & custom languages", () => {
  it("updateSettings patches and setPinRailVisible flips the flag", () => {
    store().updateSettings({ theme: "light", compactTables: true });
    expect(store().settings.theme).toBe("light");
    expect(store().settings.compactTables).toBe(true);

    store().setPinRailVisible(true);
    expect(store().settings.pinRailVisible).toBe(true);
  });

  it("adds and removes a custom comparison language, persisting both ways", () => {
    const stored = () =>
      JSON.parse(
        localStorage.getItem("linear-a-workbench:custom-languages") ?? "{}",
      );
    store().addCustomLanguage("Etruscan", [{ w: "mi", m: "I", d: "pron" }]);
    expect(store().customLanguages.Etruscan).toHaveLength(1);
    expect(stored().Etruscan).toHaveLength(1);
    store().removeCustomLanguage("Etruscan");
    expect(store().customLanguages.Etruscan).toBeUndefined();
    expect(stored().Etruscan).toBeUndefined();
  });
});

describe("saved hypotheses & detail/module navigation", () => {
  it("deletes a saved hypothesis by index", () => {
    store().setOverride("KU", "gu");
    store().saveHypothesis("h1");
    store().setOverride("RO", "lo");
    store().saveHypothesis("h2");
    expect(store().savedHypotheses).toHaveLength(2);
    store().deleteHypothesis(0);
    expect(store().savedHypotheses.map((h) => h.name)).toEqual(["h2"]);
  });

  it("opens and closes word / inscription detail", () => {
    store().showWord("KU-RO");
    expect(store().detail).toEqual({ kind: "word", value: "KU-RO" });
    store().showInscription("HT1");
    expect(store().detail).toEqual({ kind: "inscription", value: "HT1" });
    store().closeDetail();
    expect(store().detail).toBeNull();
  });

  it("setActiveModule sets the module, clears detail, and persists", () => {
    store().showWord("X");
    store().setActiveModule("freq");
    expect(store().activeModule).toBe("freq");
    expect(store().detail).toBeNull();
    expect(localStorage.getItem("linear-a-workbench:active-module")).toContain(
      "freq",
    );
  });

  it("toast show/clear", () => {
    store().toast_show("hi", "error");
    expect(store().toast).toEqual({ message: "hi", tone: "error" });
    store().toast_clear();
    expect(store().toast).toBeNull();
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
