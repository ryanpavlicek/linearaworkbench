import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Guards the corpus manifest (public/corpus/manifest.json): the committed
// data must match the parity checksum the manifest declares. pyaegean
// bundles the same corpus and runs the identical check against the same
// manifest, so drift between the two projects fails CI on whichever side
// drifted instead of surfacing months later as mismatched query results.
const read = (f: string) =>
  readFileSync(new URL(`../../public/corpus/${f}`, import.meta.url), "utf8");

describe("corpus manifest", () => {
  it("matches the committed corpus (counts + parity checksum)", () => {
    const manifest = JSON.parse(read("manifest.json"));
    const inscriptions: Record<string, unknown>[] = JSON.parse(
      read("inscriptions.json"),
    );
    expect(inscriptions.length).toBe(manifest.inscriptionCount);

    const canonical = JSON.stringify(
      inscriptions.map((ins) =>
        Object.fromEntries(
          (manifest.parityFields as string[]).map((f) => [f, ins[f]]),
        ),
      ),
    );
    const sha = createHash("sha256").update(canonical, "utf8").digest("hex");
    expect(sha).toBe(manifest.paritySha256);
  });
});
