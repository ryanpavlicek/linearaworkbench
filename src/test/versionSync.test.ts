import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WORKBENCH_VERSION } from "../lib/citations";

// The release version lives in three places that must be bumped together:
// package.json (npm), CITATION.cff (GitHub's "Cite this repository" box), and
// the WORKBENCH_VERSION constant in src/lib/citations.ts (the in-app
// self-citation). A drifted trio means citations pin the wrong release, so
// this test makes any partial bump a red build instead of a silent skew.

function repoFile(rel: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");
}

describe("release version sync", () => {
  const pkgVersion = (JSON.parse(repoFile("package.json")) as { version: string })
    .version;

  const cffMatch = repoFile("CITATION.cff").match(/^version:\s*["']?([^\s"']+)["']?\s*$/m);
  const cffVersion = cffMatch?.[1];

  it("package.json carries a plain semver version", () => {
    expect(pkgVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("CITATION.cff declares the same version as package.json", () => {
    expect(cffVersion).toBe(pkgVersion);
  });

  it("WORKBENCH_VERSION in citations.ts matches package.json", () => {
    expect(WORKBENCH_VERSION).toBe(pkgVersion);
  });
});
