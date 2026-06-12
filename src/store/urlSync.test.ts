// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_SCOPE, useWorkbench } from "./workbench";
import { initUrlSync } from "./urlSync";

// Minimal corpus so detail links can resolve against the index.
function seed() {
  useWorkbench.getState().loadCorpusFromInscriptions(
    [
      {
        id: "HT13",
        site: "Haghia Triada",
        support: "Tablet",
        scribe: "",
        context: "LMIB",
        findspot: "",
        name: "",
        words: ["KU-RO"],
        translations: [],
        lines: [["KU-RO"]],
        glyphs: "",
        transcription: "",
        facsimileImages: [],
        images: [],
        imageRights: "",
        imageRightsURL: "",
      },
    ],
    [],
  );
}

let cleanup: (() => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "";
  useWorkbench.setState({
    scope: { ...EMPTY_SCOPE },
    activeModule: "search",
    detail: null,
  });
  seed();
});

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe("urlSync — store to URL", () => {
  it("reflects module changes as history-entry hashes", () => {
    cleanup = initUrlSync();
    useWorkbench.getState().setActiveModule("freq");
    expect(window.location.hash).toBe("#/m/freq");
  });

  it("reflects an open detail and the scope", () => {
    cleanup = initUrlSync();
    useWorkbench.getState().setScope({ site: "Haghia Triada" });
    useWorkbench.getState().showInscription("HT13");
    expect(window.location.hash).toBe("#/i/HT13?m=search&site=Haghia+Triada");
    useWorkbench.getState().closeDetail();
    expect(window.location.hash).toBe("#/m/search?site=Haghia+Triada");
  });
});

describe("urlSync — URL to store", () => {
  it("applies a pasted permalink on init", () => {
    window.location.hash = "#/i/HT13?m=freq&period=LMIB";
    cleanup = initUrlSync();
    const s = useWorkbench.getState();
    expect(s.activeModule).toBe("freq");
    expect(s.detail).toEqual({ kind: "inscription", value: "HT13" });
    expect(s.scope.period).toBe("LMIB");
  });

  it("applies back/forward navigation via popstate", () => {
    cleanup = initUrlSync();
    window.location.hash = "#/m/kwic";
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(useWorkbench.getState().activeModule).toBe("kwic");
  });

  it("ignores heading anchors and unknown ids", () => {
    cleanup = initUrlSync();
    window.location.hash = "#some-heading";
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(useWorkbench.getState().activeModule).toBe("search");

    window.location.hash = "#/i/NOPE99";
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(useWorkbench.getState().detail).toBeNull();
  });
});
