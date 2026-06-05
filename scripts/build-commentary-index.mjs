#!/usr/bin/env node
// Walk public/upstream/commentary/*.html and emit a slim search index:
//   public/corpus/commentary-index.json
//
// Shape per entry:
//   { id, site, type, num, filename, text }
//
//   id       — filename without .html (e.g. "HT1", "ARKH3", "APZa1")
//   site     — leading site code (HT, ARKH, AP, CR, ...) derived by regex
//   type     — secondary classifier code if present (Za, Zb, Wc, ...) — used
//              by the in-app filter chips; null for plain-numbered tablets
//   num      — numeric part as a number for natural sort; null if missing
//   filename — raw filename, what fetch() needs to retrieve the actual HTML
//   text     — tag-stripped, whitespace-collapsed text content, lowercased,
//              size-bounded. Powers the full-text search in the browser.
//
// Re-run after refreshing public/upstream/commentary/:
//   npm run commentary:index

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcDir = resolve(root, "public", "upstream", "commentary");
const outDir = resolve(root, "public", "corpus");
const outFile = resolve(outDir, "commentary-index.json");
mkdirSync(outDir, { recursive: true });

// Cap per-doc indexed text so the bundle index stays under ~3-4 MB total.
// 4000 chars covers the substance of every commentary file I've inspected;
// the largest tablet commentaries (HT102, ZA Zb 3) clock in around 2-3 KB.
const MAX_TEXT_CHARS = 4000;

// Filename → site/type/num parser. Linear A inscription IDs encode:
//   [site code, uppercase 2–4 chars][optional type code, Uppercase+lowercase][num]
// Type codes are things like Wa / Wc / Wd (roundels & sealings),
// Za / Zb / Zc / Zf / Zg (libation & inscribed objects).
//
// The bug to avoid: a greedy /^[A-Z]+/ match swallows the type marker's
// uppercase letter (HTWa → "HTW" instead of "HT"). Solution: take the leading
// uppercase run, then if the char following the run is lowercase, peel back
// one uppercase letter — that letter was actually the type marker's lead.
//
// Examples:
//   "HT1.html"         → { id:"HT1",         site:"HT",   type:null, num:1    }
//   "ARKH3.html"       → { id:"ARKH3",       site:"ARKH", type:null, num:3    }
//   "HTWa1001.html"    → { id:"HTWa1001",    site:"HT",   type:"Wa", num:1001 }
//   "ARKHZc8.html"     → { id:"ARKHZc8",     site:"ARKH", type:"Zc", num:8    }
//   "APZa1.html"       → { id:"APZa1",       site:"AP",   type:"Za", num:1    }
//   "ARGZg1.html"      → { id:"ARGZg1",      site:"ARG",  type:"Zg", num:1    }
//   "HT(_)Wc3022.html" → { id:"HT(_)Wc3022", site:"HT",   type:"Wc", num:3022 }
//   "CR(_)Zf1.html"    → { id:"CR(_)Zf1",    site:"CR",   type:"Zf", num:1    }
//   "16.html"          → { id:"16",          site:"?",    type:null, num:16   }  (misc/intro file)
function parseFilename(filename) {
  const id = filename.replace(/\.html$/i, "");
  // Leading uppercase run. If the next char is lowercase, the last letter of
  // the run is actually the type marker's first letter, so peel it back.
  let site = (id.match(/^[A-Z]+/) ?? [""])[0];
  if (site.length > 1 && /[a-z]/.test(id.charAt(site.length))) {
    site = site.slice(0, -1);
  }
  if (!site) site = "?";
  // After the site (and optional "(_)" separator), grab the type marker:
  // uppercase + optional lowercase, only if a digit follows.
  let rest = id.slice(site === "?" ? 0 : site.length).replace(/^\(_\)/, "");
  const typeMatch = rest.match(/^([A-Z][a-z]?)(?=\d)/);
  const type = typeMatch ? typeMatch[1] : null;
  // Num = trailing digit run (with optional fragment-letter suffix like "HT117a").
  const numMatch = id.match(/(\d+)[a-z]?$/);
  const num = numMatch ? Number(numMatch[1]) : null;
  return { id, site, type, num };
}

function stripHtml(html) {
  return html
    // Drop script / style entirely (defense in depth; bundle is vetted)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Decode the few HTML entities the upstream actually uses
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Strip every tag
    .replace(/<[^>]+>/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

const files = readdirSync(srcDir)
  .filter((f) => /\.html$/i.test(f))
  .sort();

const index = [];
let totalChars = 0;
for (const filename of files) {
  const raw = readFileSync(resolve(srcDir, filename), "utf8");
  const stripped = stripHtml(raw);
  const text = stripped.slice(0, MAX_TEXT_CHARS).toLowerCase();
  totalChars += text.length;
  index.push({ ...parseFilename(filename), filename, text });
}

// Sort: site asc, then type asc (nulls last), then num asc (nulls last)
index.sort((a, b) => {
  if (a.site !== b.site) return a.site < b.site ? -1 : 1;
  if (a.type !== b.type) {
    if (a.type === null) return 1;
    if (b.type === null) return -1;
    return a.type < b.type ? -1 : 1;
  }
  if (a.num !== b.num) {
    if (a.num === null) return 1;
    if (b.num === null) return -1;
    return a.num - b.num;
  }
  return a.id < b.id ? -1 : 1;
});

const payload = {
  _meta: {
    generated: new Date().toISOString(),
    source: "public/upstream/commentary/",
    count: index.length,
    maxTextChars: MAX_TEXT_CHARS,
    note: "Pre-2024 KU-era Younger commentary mirror via mwenge/lineara.xyz. Younger now publishes updated material as PDFs on academia.edu.",
  },
  docs: index,
};

writeFileSync(outFile, JSON.stringify(payload));
const sizeKB = (JSON.stringify(payload).length / 1024).toFixed(1);
console.log(
  `commentary-index.json: ${index.length} docs, ${(totalChars / 1024).toFixed(1)} KB indexed text, ${sizeKB} KB JSON`,
);
