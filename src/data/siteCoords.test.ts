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
});
