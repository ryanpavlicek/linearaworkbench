#!/usr/bin/env node
// Fetches the upstream Linear A inscription source from mwenge/lineara.xyz,
// then invokes build-corpus.mjs to normalize it into public/corpus/inscriptions.json.
//
// Run with: node scripts/fetch-corpus.mjs

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const rawPath = resolve(root, ".corpus-raw.js");

// Pinned to the upstream commit the bundled corpus was built from, so a
// re-fetch is reproducible and an upstream change is a deliberate bump
// (update the SHA, rebuild, and review the diff) rather than a silent drift.
const UPSTREAM_SHA = "568f452c7a5ec80fa292cb307ead2fc6f65d07fb"; // 2025-11-12
const URL = `https://raw.githubusercontent.com/mwenge/lineara.xyz/${UPSTREAM_SHA}/LinearAInscriptions.js`;

console.log(`Fetching ${URL}…`);
const res = await fetch(URL);
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const text = await res.text();
writeFileSync(rawPath, text);
console.log(`Saved ${(text.length / 1024) | 0} KB → ${rawPath}`);

const r = spawnSync("node", [resolve(__dirname, "build-corpus.mjs")], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
