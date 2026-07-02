import { describe, it, expect } from "vitest";
import { phoneticKeyOf, lookupPhonetic } from "./signKeys";

describe("phoneticKeyOf", () => {
  it("strips only the '*' of unread sign labels", () => {
    expect(phoneticKeyOf("*118")).toBe("118");
    expect(phoneticKeyOf("*301")).toBe("301");
    expect(phoneticKeyOf("KU")).toBe("KU");
  });

  it("preserves subscripts — subscripted signs are distinct signs", () => {
    expect(phoneticKeyOf("RA₂")).toBe("RA₂");
    expect(phoneticKeyOf("PA₃")).toBe("PA₃");
    expect(phoneticKeyOf("TA₂")).toBe("TA₂");
    expect(phoneticKeyOf("PU₂")).toBe("PU₂");
  });
});

describe("lookupPhonetic", () => {
  it("reads plain-series signs from the base map", () => {
    expect(lookupPhonetic("RA")).toBe("ra");
    expect(lookupPhonetic("KU")).toBe("ku");
  });

  it("returns null for signs the map does not attest", () => {
    // Subscripted signs have no AB-shared value: they must not fall back
    // to the plain series.
    expect(lookupPhonetic("RA₂")).toBeNull();
    expect(lookupPhonetic("PU₂")).toBeNull();
    expect(lookupPhonetic("PA₃")).toBeNull();
    // Unread labels stay unread with or without the "*".
    expect(lookupPhonetic("*118")).toBeNull();
    expect(lookupPhonetic("*301")).toBeNull();
  });

  it("applies hypothesis overrides by exact sign key", () => {
    expect(lookupPhonetic("RA", { RA: "la" })).toBe("la");
    // An override for the plain sign never leaks to the subscripted one…
    expect(lookupPhonetic("RA₂", { RA: "la" })).toBeNull();
    // …and a subscripted sign reads exactly where the map attests it.
    expect(lookupPhonetic("RA₂", { "RA₂": "rya" })).toBe("rya");
    expect(lookupPhonetic("RA", { "RA₂": "rya" })).toBe("ra");
  });
});
