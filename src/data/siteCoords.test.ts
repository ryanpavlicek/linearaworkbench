import { describe, it, expect } from "vitest";
import { SITE_COORDS } from "./siteCoords";

describe("SITE_COORDS", () => {
  it("places every Crete find-site inside the Crete bounding box", () => {
    // Crete spans ~34.8-35.7 N, ~23.5-26.3 E; a generous box catches gross
    // errors (sign flips, lat/lon transposition, wrong island).
    for (const [key, c] of Object.entries(SITE_COORDS)) {
      if (c.region !== "crete") continue;
      expect(c.lat, `${key} lat`).toBeGreaterThanOrEqual(34.7);
      expect(c.lat, `${key} lat`).toBeLessThanOrEqual(35.8);
      expect(c.lon, `${key} lon`).toBeGreaterThanOrEqual(23.4);
      expect(c.lon, `${key} lon`).toBeLessThanOrEqual(26.5);
    }
  });

  it("aligns Kardamoutsa with its linked Pleiades point (589839)", () => {
    // Pleiades 589839 representative point is 35.207 N, 25.458 E. The site had
    // been recorded at 35.0/25.5, ~23 km off its own gazetteer link.
    const k = SITE_COORDS["Kardamoutsa"];
    expect(k.lat).toBeCloseTo(35.207, 2);
    expect(k.lon).toBeCloseTo(25.458, 2);
  });

  it("places Kythera on the SE coast of the island (Pleiades 570400)", () => {
    // Pleiades 570400 "Kythera (settlement)" repr. point is 36.230 N, 23.029 E.
    // The site had been recorded at 36.27/22.95, ~8-10 km inland to the NW of
    // the real find-spot area (the Minoan site lies on the SE/E coast).
    const k = SITE_COORDS["Kythera"];
    expect(k.lat).toBeCloseTo(36.23, 2);
    expect(k.lon).toBeCloseTo(23.03, 2);
  });

  it("flags Margiana as a contested, non-genuine find-spot", () => {
    // The inscription (MARGWa1-26) stays in the corpus for upstream/parity
    // fidelity, but Margiana is not an accepted Linear A find-spot, so its
    // gazetteer entry must carry the `contested` reason that the map renders.
    const m = SITE_COORDS["Margiana"];
    expect(m).toBeDefined();
    expect(m.contested).toBeTruthy();
    expect(m.contested).toMatch(/disputed/i);
  });
});
