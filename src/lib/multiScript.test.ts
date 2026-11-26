import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getScriptProfile,
  normalizeScriptId,
  parseScriptId,
} from "../data/scripts";
import {
  checkBalances,
  LINEAR_B_MARKERS,
  markersForScript,
  parseAccountLines,
} from "./numerals";
import { normalizeCorpusJson, normalizeSignsJson } from "./customCorpus";
import { buildCorpusExport, heuristicCategory } from "./corpusExport";
import { wordToPhonetic } from "./algorithms";
import { lookupPhonetic, resetActivePhoneticMap } from "./signKeys";
import { EMPTY_SCOPE, useWorkbench } from "../store/workbench";
import type { Inscription, SignData } from "./types";

const store = () => useWorkbench.getState();

function makeSign(
  label: string,
  glyph: string | null,
  phonetic: string | null,
): SignData {
  return {
    label,
    glyph,
    codepoint: glyph ? (glyph.codePointAt(0) ?? null) : null,
    phonetic,
    sharedWithLinearB: false,
    linearAOnly: false,
    total: 1,
    confidence: 1,
    altGlyphs: [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetActivePhoneticMap();
  store().loadCorpusFromInscriptions([], []);
});

describe("script profiles", () => {
  it("normalizes canonical ids and common aliases", () => {
    expect(parseScriptId("lineara")).toBe("lineara");
    expect(parseScriptId("Linear-B")).toBe("linearb");
    expect(parseScriptId("linear_b")).toBe("linearb");
    expect(parseScriptId("cypriot-syllabic")).toBe("cypriot");
    expect(parseScriptId("Cypro_Minoan")).toBe("cyprominoan");
    expect(parseScriptId("unknown-script")).toBeNull();
    expect(normalizeScriptId("unknown-script")).toBe("lineara");
  });

  it("exposes script-specific accounting profiles", () => {
    expect(getScriptProfile("lineara").totalLabel).toBe("KU-RO");
    expect(getScriptProfile("linearb").totalLabel).toBe("TO-SO");
    expect(getScriptProfile("linearb").deficitLabel).toBe("O-PE-RO");
    expect(getScriptProfile("cypriot").status).toBe("deciphered");
    expect(getScriptProfile("cyprominoan").status).toBe("undeciphered");
  });
});

describe("multi-script accounting", () => {
  it("reconciles Linear B to-so totals and o-pe-ro deficits case-insensitively", () => {
    const lines = parseAccountLines(
      [
        ["wa-na-ka", "VIR", "10"],
        ["ra-wa-ke-ta", "VIR", "5"],
        ["o-pe-ro", "VIR", "2"],
        ["to-so", "VIR", "15"],
      ],
      markersForScript("linearb"),
    );
    expect(lines.map((l) => l.role)).toEqual([
      "item",
      "item",
      "deficit",
      "total",
    ]);
    const checks = checkBalances(lines, LINEAR_B_MARKERS);
    expect(checks).toHaveLength(1);
    expect(checks[0].balances).toBe(true);
    expect(checks[0].marker).toBe("to-so");
    expect(checks[0].computedSum).toBe(15);
    expect(checks[0].statedTotal).toBe(15);
  });

  it("classifies Linear B to-so tablets as accounting in heuristicCategory", () => {
    const ins: Inscription = {
      id: "PY_Ta_641",
      site: "Pylos",
      support: "tablet",
      scribe: "Hand 2",
      findspot: "",
      context: "LHIIIB",
      name: "PY Ta 641",
      words: ["to-so", "15"],
      translations: ["", ""],
      lines: [["to-so", "15"]],
      glyphs: "",
      transcription: "",
      facsimileImages: [],
      images: [],
      imageRights: "",
      imageRightsURL: "",
    };
    expect(heuristicCategory(ins, "linearb")).toBe("accounting");
    expect(heuristicCategory(ins, "lineara")).toBe("other");
  });
});

describe("multi-script custom corpus loading & export round-trip", () => {
  it("normalizes script metadata, signs, and phoneticMap from an export envelope", () => {
    const parsed = normalizeCorpusJson({
      _meta: { script: "linearb", schemaVersion: 1 },
      signs: [
        { label: "WA", glyph: "𐀷", phonetic: "wa" },
        { label: "NA", glyph: "𐀙", phonetic: "na" },
        { label: "KA", glyph: "𐀏", phonetic: "ka" },
      ],
      phoneticMap: { WA: "wa", NA: "na", KA: "ka" },
      inscriptions: [
        {
          id: "PY_An_1",
          site: "Pylos",
          words: ["wa-na-ka", "10", "to-so", "10"],
          lines: [
            ["wa-na-ka", "10"],
            ["to-so", "10"],
          ],
        },
      ],
    });
    expect(parsed.scriptId).toBe("linearb");
    expect(parsed.signs).toHaveLength(3);
    expect(parsed.signs?.[0].codepoint).toBe(0x10037);
    expect(parsed.phoneticMap).toEqual({ WA: "wa", NA: "na", KA: "ka" });
    expect(normalizeSignsJson([{ label: "PA", glyph: "𐠞" }])[0].codepoint).toBe(
      0x1081e,
    );
  });

  it("switches active script, sign inventory, and phonetic lookups, then resets cleanly to Linear A", () => {
    const fakeDoc = { documentElement: { dataset: {} as Record<string, string> } };
    vi.stubGlobal("document", fakeDoc);

    store().applyCustomCorpus(
      {
        _meta: { script: "cypriot" },
        signs: [
          makeSign("pa", "𐠞", "pa"),
          makeSign("si", "𐠪", "si"),
          makeSign("le", "𐠐", "le"),
        ],
        inscriptions: [
          {
            id: "ICS_217",
            site: "Idalion",
            words: ["pa-si-le"],
          },
        ],
      },
      "idalion.json",
    );

    expect(store().scriptId).toBe("cypriot");
    expect(fakeDoc.documentElement.dataset.script).toBe("cypriot");
    expect(store().corpus.signsByLabel.get("pa")?.glyph).toBe("𐠞");
    expect(lookupPhonetic("PA")).toBe("pa");
    expect(wordToPhonetic("PA-SI-LE")).toBe("pasile");

    // Structured export carries `_meta.script` so re-import stays Cypriot.
    const exported = buildCorpusExport(
      store().corpus.inscriptions,
      store().corpus.signs,
      store().corpus.wordIndex,
      {
        scope: EMPTY_SCOPE,
        scopeSummary: "whole corpus",
        includeUserState: false,
        includeSigns: true,
        includeWordFrequencies: false,
        hypothesis: {},
        scriptId: store().scriptId,
        annotations: [],
        collections: [],
        pins: [],
        tabletCategoryOverrides: {},
      },
    );
    expect(exported._meta.script).toBe("cypriot");
    expect(normalizeCorpusJson(exported).scriptId).toBe("cypriot");

    // Restoring Linear A resets both scriptId and the Linear A subscript rules.
    store().loadCorpusFromInscriptions([], [makeSign("KA", "𐘾", "ka")]);
    expect(store().scriptId).toBe("lineara");
    expect(lookupPhonetic("KU")).toBe("ku");
    expect(lookupPhonetic("RA₂")).not.toBe(lookupPhonetic("RA"));
  });

  it("supports ?script= and ?signs= overrides in loadCorpusFromCustomUrl", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      ({
        ok: true,
        status: 200,
        json: async () =>
          url.includes("custom-signs")
            ? [{ label: "CM001", glyph: "𐾐", phonetic: null }]
            : [{ id: "ENK_1", site: "Enkomi", words: ["CM001-CM001"] }],
      }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    await store().loadCorpusFromCustomUrl(
      "/api/local/corpus.json",
      "/corpus/signs.json",
      {
        script: "cyprominoan",
        customSignsUrl: "/api/local/custom-signs.json",
      },
    );

    expect(store().loaded).toBe(true);
    expect(store().scriptId).toBe("cyprominoan");
    expect(store().corpus.signsByLabel.get("CM001")?.glyph).toBe("𐾐");
    expect(fetchMock).toHaveBeenCalledWith("/api/local/custom-signs.json");
  });
});
