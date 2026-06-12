import { describe, expect, it } from "vitest";
import { buildPermalink, parsePermalink } from "./permalink";

describe("buildPermalink", () => {
  it("encodes a bare module", () => {
    expect(
      buildPermalink({ module: "freq", detail: null, scope: {} }),
    ).toBe("#/m/freq");
  });

  it("encodes scope as query params", () => {
    const hash = buildPermalink({
      module: "search",
      detail: null,
      scope: { site: "Haghia Triada", period: "LMIB" },
    });
    expect(hash.startsWith("#/m/search?")).toBe(true);
    expect(hash).toContain("site=Haghia+Triada");
    expect(hash).toContain("period=LMIB");
  });

  it("encodes an inscription detail with the module preserved", () => {
    expect(
      buildPermalink({
        module: "freq",
        detail: { kind: "inscription", value: "HT13" },
        scope: {},
      }),
    ).toBe("#/i/HT13?m=freq");
  });

  it("encodes a word detail, escaping as needed", () => {
    const hash = buildPermalink({
      module: "search",
      detail: { kind: "word", value: "KU-RO" },
      scope: { collectionId: "c1" },
    });
    expect(hash).toBe("#/w/KU-RO?m=search&collection=c1");
  });
});

describe("parsePermalink", () => {
  it("round-trips every shape", () => {
    const cases = [
      { module: "freq", detail: null, scope: {} },
      {
        module: "search",
        detail: null,
        scope: { site: "Haghia Triada", scribe: "HT Scribe 9" },
      },
      {
        module: "concordance",
        detail: { kind: "inscription" as const, value: "ZA 4" },
        scope: { period: "LMIB" },
      },
      {
        module: "search",
        detail: { kind: "word" as const, value: "KU-RO" },
        scope: { collectionId: "abc" },
      },
    ];
    for (const c of cases) {
      const parsed = parsePermalink(buildPermalink(c));
      expect(parsed).not.toBeNull();
      expect(parsed!.module).toBe(c.module);
      expect(parsed!.detail ?? null).toEqual(c.detail);
      expect(parsed!.scope ?? {}).toEqual(c.scope);
    }
  });

  it("ignores non-permalink hashes (heading anchors, junk)", () => {
    expect(parsePermalink("")).toBeNull();
    expect(parsePermalink("#method-phonetic-distance")).toBeNull();
    expect(parsePermalink("#/")).toBeNull();
    expect(parsePermalink("#/m/")).toBeNull();
    expect(parsePermalink("#/x/abc")).toBeNull();
    expect(parsePermalink("#/i/%E0%A4%A")).toBeNull(); // malformed escape
  });

  it("parses a detail link without a module", () => {
    const p = parsePermalink("#/i/HT13");
    expect(p).not.toBeNull();
    expect(p!.module).toBeUndefined();
    expect(p!.detail).toEqual({ kind: "inscription", value: "HT13" });
  });
});
