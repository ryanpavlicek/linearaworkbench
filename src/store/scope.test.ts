// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  isScopeActive,
  scopeSummary,
  useScopedCorpus,
  useScopedMultiWords,
  useScopeOptions,
} from "./scope";
import { useWorkbench, EMPTY_SCOPE } from "./workbench";
import type { Inscription } from "../lib/types";

function ins(id: string, site: string, context: string, words: string[]): Inscription {
  return {
    id,
    site,
    support: "tablet",
    scribe: "",
    findspot: "",
    context,
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

beforeEach(() => {
  useWorkbench.getState().loadCorpusFromInscriptions(
    [
      ins("HT1", "HT", "LMIB", ["KU-RO", "PA-I-TO"]),
      ins("HT2", "HT", "MMIII", ["KU-RO"]),
      ins("ZA1", "ZA", "LMIB", ["PA-I-TO", "A-DU"]),
    ],
    [],
  );
  useWorkbench.setState({ scope: { ...EMPTY_SCOPE }, collections: [] });
});

describe("isScopeActive / scopeSummary", () => {
  it("detects an active scope on any dimension", () => {
    expect(isScopeActive(EMPTY_SCOPE)).toBe(false);
    expect(isScopeActive({ ...EMPTY_SCOPE, site: "HT" })).toBe(true);
  });

  it("summarizes the active dimensions", () => {
    expect(scopeSummary(EMPTY_SCOPE)).toBe("");
    expect(
      scopeSummary({ ...EMPTY_SCOPE, site: "HT", period: "LMIB" }),
    ).toBe("HT · LMIB");
    expect(scopeSummary({ ...EMPTY_SCOPE, collectionId: "c1" })).toBe(
      "collection",
    );
  });
});

describe("useScopedCorpus", () => {
  it("returns the full corpus when no scope is active", () => {
    const { result } = renderHook(() => useScopedCorpus());
    expect(result.current.inscriptions).toHaveLength(3);
  });

  it("filters by site", () => {
    useWorkbench.setState({ scope: { ...EMPTY_SCOPE, site: "HT" } });
    const { result } = renderHook(() => useScopedCorpus());
    expect(result.current.inscriptions.map((i) => i.id).sort()).toEqual([
      "HT1",
      "HT2",
    ]);
  });

  it("filters by period across sites", () => {
    useWorkbench.setState({ scope: { ...EMPTY_SCOPE, period: "LMIB" } });
    const { result } = renderHook(() => useScopedCorpus());
    expect(result.current.inscriptions.map((i) => i.id).sort()).toEqual([
      "HT1",
      "ZA1",
    ]);
  });

  it("filters by a scoped collection's inscription members", () => {
    useWorkbench.setState({
      collections: [
        {
          id: "c1",
          name: "mine",
          items: [{ kind: "inscription", value: "ZA1" }],
          createdAt: "",
          updatedAt: "",
        },
      ],
      scope: { ...EMPTY_SCOPE, collectionId: "c1" },
    });
    const { result } = renderHook(() => useScopedCorpus());
    expect(result.current.inscriptions.map((i) => i.id)).toEqual(["ZA1"]);
  });
});

describe("useScopedMultiWords / useScopeOptions", () => {
  it("lists multi-sign words in the active scope, sorted by count", () => {
    const { result } = renderHook(() => useScopedMultiWords());
    const words = result.current.map((w) => w.word);
    expect(words).toContain("KU-RO");
    expect(words).toContain("PA-I-TO");
  });

  it("derives distinct sorted option lists for each dimension", () => {
    const { result } = renderHook(() => useScopeOptions());
    expect(result.current.sites).toEqual(["HT", "ZA"]);
    expect(result.current.periods).toEqual(["LMIB", "MMIII"]);
    expect(result.current.supports).toEqual(["tablet"]);
  });
});
