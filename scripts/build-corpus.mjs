#!/usr/bin/env node
// Reads .corpus-raw.js (the upstream `var inscriptions = new Map([...])` file)
// and emits two normalized JSON files into public/corpus/:
//
//   inscriptions.json — one entry per tablet (transliteration, glyphs, metadata)
//   signs.json        — sign → Unicode glyph mapping derived by corpus alignment,
//                       with phonetic value and Linear-A/B classification
//
// Re-run with: node scripts/build-corpus.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { UPSTREAM_REPO, UPSTREAM_SHA } from "./upstream.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const rawPath = resolve(root, ".corpus-raw.js");
const outDir = resolve(root, "public", "corpus");
mkdirSync(outDir, { recursive: true });

const src = readFileSync(rawPath, "utf8");
const fn = new Function(src + "\nreturn inscriptions;");
const map = fn();

// Standard Linear B phonetic values for AB-shared signs. Signs not in this
// table are either Linear A-only (*-prefixed) or undeciphered.
const PHONETIC_MAP = {
  A: "a", E: "e", I: "i", O: "o", U: "u",
  DA: "da", DE: "de", DI: "di", DU: "du",
  JA: "ja", JE: "je", JU: "ju",
  KA: "ka", KE: "ke", KI: "ki", KO: "ko", KU: "ku",
  MA: "ma", ME: "me", MI: "mi", MU: "mu",
  NA: "na", NE: "ne", NI: "ni", NU: "nu",
  PA: "pa", PI: "pi", PO: "po", PU: "pu",
  QA: "kwa", QE: "kwe",
  RA: "ra", RE: "re", RI: "ri", RO: "ro", RU: "ru",
  SA: "sa", SE: "se", SI: "si", SU: "su",
  TA: "ta", TE: "te", TI: "ti", TO: "to", TU: "tu",
  WA: "wa", WE: "we", WI: "wi", WO: "wo",
  ZA: "dza", ZE: "dze", ZO: "dzo",
};

// Unicode codepoint classifiers
const isAegeanNumber = (cp) => cp >= 0x10100 && cp <= 0x1013f;
// The Linear A block is U+10600–U+1077F, but only three ranges carry assigned
// signs (enumerated from Unicode 16.0 unicodedata, Linear A code chart):
//   U+10600–10736  AB001..A664 (syllabograms, ideograms, composites)
//   U+10740–10755  A701a..A732 JE (fractions and fraction compounds)
//   U+10760–10767  A800..A807 (sign-group ligatures)
// U+10737–1073F, U+10756–1075F, and U+10768–1077F are UNASSIGNED; upstream
// uses the unassigned U+1076B as its damage/lacuna marker (2,257 occurrences
// in glyph streams), so a block-wide range would count damage marks as signs,
// desync the alignment count gate, and ship unassigned codepoints as glyphs.
// U+10780+ is Latin Extended-F, not Linear A at all.
const isSyllabicSign = (cp) =>
  (cp >= 0x10600 && cp <= 0x10736) ||
  (cp >= 0x10740 && cp <= 0x10755) ||
  (cp >= 0x10760 && cp <= 0x10767);

// AB-series membership: the signs Linear A shares with Linear B. Rule: a sign
// is AB-shared iff its modal glyph's codepoint carries a "LINEAR A SIGN ABnnn"
// name in the Unicode 16.0 code chart (enumerated with python unicodedata):
//   U+10600–1061A  AB001..AB028
//   U+1061C–10646  AB029..AB087
//   U+10648–10649  AB118, AB120
//   U+1064B–1064E  AB122..AB131B
//   U+10650–10654  AB164..AB191
// The gaps (U+1061B A028B, U+10647 A100-102, U+1064A A120B, U+1064F A131C)
// and everything from U+10655 up are Linear-A-only names. This replaces the
// old "phonetic value known" proxy, which missed AB signs without standard
// transliterations (RA₂, PA₃, TA₂, AU, NWA, ZU, *21F, *86, *118, *164, *188)
// and the AB-numbered ideograms (VIN, GRA, OLIV).
const isABSeries = (cp) =>
  (cp >= 0x10600 && cp <= 0x1061a) ||
  (cp >= 0x1061c && cp <= 0x10646) ||
  cp === 0x10648 ||
  cp === 0x10649 ||
  (cp >= 0x1064b && cp <= 0x1064e) ||
  (cp >= 0x10650 && cp <= 0x10654);

// Strip combining/diacritic marks from sign labels for normalization. Keep
// 2/3/4 subscripts as part of the label since those are semantically distinct
// signs in GORILA.
function normalizeSignLabel(s) {
  return s.replace(/[₂₃₄]/g, (c) => ({ "₂": "2", "₃": "3", "₄": "4" }[c]));
}

// Walk a glyph string codepoint by codepoint, yielding only syllabic signs.
function* syllabicGlyphs(parsed) {
  for (const ch of parsed) {
    const cp = ch.codePointAt(0);
    if (cp && isSyllabicSign(cp)) yield ch;
  }
}

// ───────────────────────── Pass 1: inscriptions ─────────────────────────

const inscriptions = [];
for (const [id, data] of map) {
  const translit = (data.transliteratedWords || data.words || [])
    .map((w) => (typeof w === "string" ? w.trim() : ""))
    .filter((w) => w && w !== "\n");

  // translatedWords: editorial English glosses (e.g. "olive oil" for OLE+U,
  // "owed" for KI-RO). Aligned 1:1 with transliteratedWords. We preserve
  // the array so the UI can show a translation overlay.
  const translated = (data.translatedWords || data.transliteratedWords || [])
    .map((w) => (typeof w === "string" ? w.trim() : ""))
    .filter((w) => w && w !== "\n");

  // lines: the transliterated tokens grouped by the "\n" line breaks in the
  // upstream data. Preserves the tablet's physical line structure (lost in
  // the flat `words` array) so the accounting/commodity analyses can do
  // line-aware term→quantity association. Each line is an array of tokens
  // (words, ideograms, numerals, fractions, separators) minus blank lines.
  const lines = [];
  {
    let current = [];
    for (const raw of data.transliteratedWords || data.words || []) {
      const w = typeof raw === "string" ? raw.trim() : "";
      if (raw === "\n") {
        if (current.length) lines.push(current);
        current = [];
      } else if (w) {
        current.push(w);
      }
    }
    if (current.length) lines.push(current);
  }

  inscriptions.push({
    id,
    site: data.site || "",
    support: data.support || "",
    scribe: data.scribe || "",
    findspot: data.findspot || "",
    context: data.context || "",
    name: data.name || "",
    words: translit,
    translations: translated,
    lines,
    glyphs: data.parsedInscription || "",
    transcription: data.transcription || "",
    facsimileImages: data.facsimileImages || [],
    images: data.images || [],
    imageRights: data.imageRights || "",
    imageRightsURL: data.imageRightsURL || "",
  });
}

// ───────────────────────── Pass 2: derive sign → glyph mapping ─────────

const signTally = new Map(); // signLabel → { glyph → count }
const signTotal = new Map(); // signLabel → total count

// Only use inscriptions where transliterated syllabic-sign count == glyph
// syllabic-sign count. Misaligned inscriptions (typos, damaged readings,
// restored signs) would drift the iterator and corrupt the tally. This
// trades volume for accuracy — we end up with much sharper modal glyphs.
for (const ins of inscriptions) {
  if (!ins.glyphs) continue;
  const allGlyphs = [...syllabicGlyphs(ins.glyphs)];
  let expected = 0;
  for (const w of ins.words) {
    if (!w.includes("-")) continue;
    expected += w.split("-").length;
  }
  if (expected === 0 || expected !== allGlyphs.length) continue;

  let gi = 0;
  for (const word of ins.words) {
    if (!word.includes("-")) continue;
    for (const part of word.split("-").map(normalizeSignLabel)) {
      const glyph = allGlyphs[gi++];
      let tallies = signTally.get(part);
      if (!tallies) {
        tallies = new Map();
        signTally.set(part, tallies);
      }
      tallies.set(glyph, (tallies.get(glyph) || 0) + 1);
      signTotal.set(part, (signTotal.get(part) || 0) + 1);
    }
  }
}

// Pick the modal (most frequent) glyph per sign label. This gives us a robust
// mapping even when individual inscriptions have parsing issues.
const signs = [];
for (const [label, tallies] of signTally) {
  let bestGlyph = "";
  let bestCount = 0;
  let altGlyphs = [];
  const sortedTallies = [...tallies.entries()].sort((a, b) => b[1] - a[1]);
  for (const [g, c] of sortedTallies) {
    if (c > bestCount) {
      bestCount = c;
      bestGlyph = g;
    }
  }
  for (const [g, c] of sortedTallies) {
    if (g !== bestGlyph && c >= 2) altGlyphs.push({ glyph: g, count: c });
  }
  const total = signTotal.get(label) || 0;
  const confidence = total > 0 ? bestCount / total : 0;
  const phoneticKey = label.replace(/[₂₃₄*]/g, "");
  const phonetic = PHONETIC_MAP[phoneticKey] || null;
  const codepoint = bestGlyph ? bestGlyph.codePointAt(0) : null;
  const sharedWithLinearB = codepoint !== null && isABSeries(codepoint);
  signs.push({
    label,
    glyph: bestGlyph,
    codepoint,
    phonetic,
    sharedWithLinearB,
    // GORILA's *-prefixed labels are the signs without standard Linear B
    // transliterations; the ones that are nonetheless AB-series (*86, *118,
    // *164, *188, *21F) are shared, not Linear-A-only.
    linearAOnly: label.startsWith("*") && !sharedWithLinearB,
    total,
    confidence,
    altGlyphs: altGlyphs.slice(0, 3),
  });
}
signs.sort((a, b) => b.total - a.total);

// Known correction: upstream renders *903 with U+10102 AEGEAN CHECK MARK
// (Aegean Numbers block), which syllabicGlyphs skips — so the aligner drifts
// one glyph at *903 and tallies a neighboring sign's glyph (it wore the vowel
// I's 𐘚 until 1.5.5). The sign has no Linear A codepoint: keep it unrendered
// rather than wrong. (*904 = GORILA *319 and *905 = the fraction sign J used
// in a sign-group are genuine identifications carried under upstream's alias
// labels, not this error class — their glyphs stay.)
for (const s of signs) {
  if (s.label === "*903") {
    s.glyph = null;
    s.codepoint = null;
    s.altGlyphs = [];
    // Keep the classification consistent with the nulled codepoint: no glyph
    // means no AB-series evidence, and the * label keeps it Linear-A-only.
    s.sharedWithLinearB = false;
    s.linearAOnly = true;
  }
}

// Tripwire for the same error class: two labels sharing a modal glyph means
// the alignment drifted somewhere. Fail the build rather than ship a
// shadowed sign — this runs before any output is written.
const glyphOwners = new Map();
let duplicateGlyphs = 0;
for (const s of signs) {
  if (!s.glyph) continue;
  const prev = glyphOwners.get(s.glyph);
  if (prev) {
    duplicateGlyphs++;
    console.error(
      `ERROR: duplicate modal glyph ${s.glyph} for ${prev} and ${s.label} — alignment drift?`,
    );
  } else {
    glyphOwners.set(s.glyph, s.label);
  }
}
if (duplicateGlyphs > 0) {
  console.error(
    `Refusing to write outputs: ${duplicateGlyphs} duplicate modal glyph(s).`,
  );
  process.exit(1);
}

// ───────────────────────── Write outputs ─────────────────────────

writeFileSync(
  resolve(outDir, "inscriptions.json"),
  JSON.stringify(inscriptions),
);
writeFileSync(resolve(outDir, "signs.json"), JSON.stringify(signs, null, 2));

// The corpus manifest: which upstream snapshot this data reflects, plus a
// checksum over the canonical 12-field projection — the fields pyaegean's
// bundled copy of this corpus shares. Both repos recompute the same
// projection from their own data and compare against this value, so silent
// drift between the two fails CI on whichever side drifted. Deliberately
// deterministic (no timestamps): rebuilding unchanged data changes nothing.
const PARITY_FIELDS = [
  "id", "site", "support", "scribe", "findspot", "context", "name",
  "words", "translations", "lines", "glyphs", "transcription",
];
const canonical = JSON.stringify(
  inscriptions.map((ins) =>
    Object.fromEntries(PARITY_FIELDS.map((f) => [f, ins[f]])),
  ),
);
const paritySha256 = createHash("sha256").update(canonical, "utf8").digest("hex");
writeFileSync(
  resolve(outDir, "manifest.json"),
  JSON.stringify(
    {
      sourceRepo: UPSTREAM_REPO,
      sourceCommit: UPSTREAM_SHA,
      inscriptionCount: inscriptions.length,
      signCount: signs.length,
      parityFields: PARITY_FIELDS,
      paritySha256,
    },
    null,
    2,
  ),
);

const sites = new Set(inscriptions.map((i) => i.site).filter(Boolean));
const scribes = new Set(inscriptions.map((i) => i.scribe).filter(Boolean));
const periods = new Set(inscriptions.map((i) => i.context).filter(Boolean));
const sharedSigns = signs.filter((s) => s.sharedWithLinearB).length;
const aOnlySigns = signs.filter((s) => s.linearAOnly).length;

console.log(
  `inscriptions.json: ${inscriptions.length} entries · ${sites.size} sites · ${scribes.size} scribes · ${periods.size} periods`,
);
console.log(
  `signs.json: ${signs.length} unique signs · ${sharedSigns} AB-shared · ${aOnlySigns} Linear-A-only`,
);
