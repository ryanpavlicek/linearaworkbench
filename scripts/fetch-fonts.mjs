#!/usr/bin/env node
// Self-host the app's webfonts. Downloads the Google Fonts CSS for the four
// families the UI uses (incl. Noto Sans Linear A — the script itself),
// fetches the referenced woff2 files for the latin, latin-ext, greek, and
// Linear A unicode ranges, and writes public/fonts/fonts.css with local
// url()s. Run once and commit the output; the app then has no external
// runtime dependency at all.
//
// Run with: node scripts/fetch-fonts.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "fonts");
mkdirSync(outDir, { recursive: true });

const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Noto+Sans+Linear+A&display=swap";

// A modern UA so Google serves woff2 with unicode-range splits.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Keep the subsets the UI can actually show: Latin for the interface,
// latin-ext for romanized comparison forms with diacritics, greek for the
// commentary corpus, and the Linear A block itself. Everything else
// (cyrillic, vietnamese, …) is dead weight.
const KEEP_SUBSETS = new Set(["latin", "latin-ext", "greek", "linear-a"]);

const res = await fetch(CSS_URL, { headers: { "User-Agent": UA } });
if (!res.ok) {
  console.error(`CSS fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const css = await res.text();

// The CSS is a sequence of `/* subset */ @font-face { ... }` blocks.
const blocks = [...css.matchAll(/\/\*\s*\[?([\w-]+)\]?\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
if (blocks.length === 0) {
  console.error("No @font-face blocks found — did Google change the CSS shape?");
  process.exit(1);
}

let out = "";
let downloaded = 0;
const seen = new Set();
for (const [, subset, block] of blocks) {
  if (!KEEP_SUBSETS.has(subset)) continue;
  const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  const family = block.match(/font-family:\s*'([^']+)'/)?.[1];
  const style = block.match(/font-style:\s*(\w+)/)?.[1] ?? "normal";
  const weight = block.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
  if (!url || !family) continue;
  const slug = family.toLowerCase().replace(/\s+/g, "-");
  const file = `${slug}-${subset}-${weight}${style === "italic" ? "-italic" : ""}.woff2`;
  if (!seen.has(file)) {
    seen.add(file);
    const fres = await fetch(url, { headers: { "User-Agent": UA } });
    if (!fres.ok) {
      console.error(`woff2 fetch failed for ${file}: ${fres.status}`);
      process.exit(1);
    }
    writeFileSync(resolve(outDir, file), Buffer.from(await fres.arrayBuffer()));
    downloaded++;
  }
  out += `/* ${subset} */\n` + block.replace(url, `./${file}`) + "\n";
}

writeFileSync(resolve(outDir, "fonts.css"), out);
console.log(`Wrote ${downloaded} woff2 files + fonts.css → public/fonts/`);
