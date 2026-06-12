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

// Pinned to the upstream commit the bundled corpus was built from
// (scripts/upstream.mjs), so a re-fetch is reproducible and an upstream
// change is a deliberate bump rather than a silent drift.
import { UPSTREAM_REPO, UPSTREAM_SHA } from "./upstream.mjs";

const URL = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_SHA}/LinearAInscriptions.js`;

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
