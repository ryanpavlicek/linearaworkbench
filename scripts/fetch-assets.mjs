#!/usr/bin/env node
// Populate public/upstream/ with everything the workbench needs at runtime:
//   commentary/<ID>.html    — per-inscription commentary HTML
//   images/*.jpg            — facsimile + photograph plates
//   papers/*.pdf            — GORILA volume PDFs cited from image rights
//
// This is the "go full local" setup: once it finishes, the app makes zero
// network calls at runtime — corpus, signs, glyphs, commentary, facsimiles,
// citations all come from local disk.
//
// Idempotent — skips any file already present and >0 bytes.
// Usage: node scripts/fetch-assets.mjs

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { UPSTREAM_REPO, UPSTREAM_SHA } from "./upstream.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const corpusPath = resolve(root, "public", "corpus", "inscriptions.json");
const outRoot = resolve(root, "public", "upstream");

// Pinned to the same upstream commit as the corpus text (scripts/upstream.mjs)
// so images and papers can never drift ahead of the inscriptions they belong to.
const UPSTREAM_RAW = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_SHA}`;
const COMMENTARY_HOST = "https://lineara.xyz/commentary";
const CONCURRENCY = 12;

// Mirrors src/lib/helpers.ts canonicalCommentaryId — upstream commentary
// is keyed by parent tablet, not per-fragment inscription.
function canonicalCommentaryId(id) {
  return id
    .replace(/\.?(?:fr|tab)\.\d+$/i, "")
    .replace(/\.?bis$/i, "")
    .replace(/(\d)[a-z]$/, "$1")
    .replace(/\?$/, "");
}

if (!existsSync(corpusPath)) {
  console.error(
    `inscriptions.json not found at ${corpusPath}. Run \`npm run corpus:build\` first.`,
  );
  process.exit(1);
}

const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));

// ─── Build job list ───────────────────────────────────────────────────
// Each job: { url, dest, label }
const jobs = [];
const imageSet = new Set();
const paperSet = new Set();
const commentarySet = new Set();

for (const ins of corpus) {
  // Commentary — one HTML per parent tablet (sides/fragments share)
  const canonicalId = canonicalCommentaryId(ins.id);
  if (!commentarySet.has(canonicalId)) {
    commentarySet.add(canonicalId);
    jobs.push({
      url: `${COMMENTARY_HOST}/${encodeURIComponent(canonicalId)}.html`,
      dest: join(outRoot, "commentary", `${canonicalId}.html`),
      label: `commentary/${canonicalId}`,
    });
  }
  // Images
  for (const path of [...ins.facsimileImages, ...ins.images]) {
    if (!path) continue;
    if (imageSet.has(path)) continue;
    imageSet.add(path);
    jobs.push({
      url: `${UPSTREAM_RAW}/${path.replace(/^\/+/, "")}`,
      dest: join(outRoot, path),
      label: path,
    });
  }
  // Papers (strip #fragment from imageRightsURL)
  if (ins.imageRightsURL) {
    const cleaned = ins.imageRightsURL.replace(/#.*$/, "");
    if (cleaned && !paperSet.has(cleaned)) {
      paperSet.add(cleaned);
      jobs.push({
        url: `${UPSTREAM_RAW}/${cleaned.replace(/^\/+/, "")}`,
        dest: join(outRoot, cleaned),
        label: cleaned,
      });
    }
  }
}

console.log(
  `Planning ${jobs.length} downloads (${commentarySet.size} commentary · ${imageSet.size} images · ${paperSet.size} papers)`,
);

// ─── Concurrent download with progress ───────────────────────────────
let completed = 0;
let skipped = 0;
let failed = 0;
const failures = [];

function alreadyHave(dest) {
  try {
    const s = statSync(dest);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

async function fetchOne(job) {
  if (alreadyHave(job.dest)) {
    skipped++;
    return;
  }
  try {
    const res = await fetch(job.url);
    if (!res.ok) {
      failed++;
      failures.push(`${res.status} ${job.url}`);
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(dirname(job.dest), { recursive: true });
    writeFileSync(job.dest, buf);
    completed++;
  } catch (e) {
    failed++;
    failures.push(`${e.message} ${job.url}`);
  }
}

async function worker(queue) {
  while (queue.length) {
    const job = queue.shift();
    if (!job) return;
    await fetchOne(job);
    const total = jobs.length;
    const done = completed + skipped + failed;
    if (done % 25 === 0 || done === total) {
      process.stdout.write(
        `\r  ${done}/${total}  · ${completed} fetched · ${skipped} skipped · ${failed} failed   `,
      );
    }
  }
}

const queue = [...jobs];
const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
await Promise.all(workers);
process.stdout.write("\n");

console.log(
  `\nDone. ${completed} fetched · ${skipped} already present · ${failed} failed`,
);
if (failures.length) {
  console.log(`\nFirst few failures (${failures.length} total):`);
  for (const f of failures.slice(0, 8)) console.log(`  · ${f}`);
  // Persist the full failure list so it can be reviewed and acted on.
  const failurePath = resolve(outRoot, "fetch-failures.log");
  writeFileSync(
    failurePath,
    failures.join("\n") + "\n",
    "utf8",
  );
  console.log(`Full failure list written to: ${failurePath}`);
}

console.log(`\nFiles written under: ${outRoot}`);
process.exit(failed > 0 ? 2 : 0);
