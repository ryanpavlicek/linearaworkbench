# Changelog

Notable changes to the Linear A Research Workbench. Released versions pin
citations — `package.json`, `CITATION.cff`, and `WORKBENCH_VERSION` in
[`src/lib/citations.ts`](src/lib/citations.ts) stay in sync.

## Unreleased

- **Bring your own corpus**: `?corpus=<url>` (or *Data Export → Load
  corpus from file*) runs every module against an inscription set you
  supply for the session — a scoped export from this app, a pyaegean
  `to_workbench()` dump, or any JSON array where each record has an `id`
  and some text. Missing metadata gets defaults; the top bar flags the
  session with a "custom corpus" tag.
- **Obsidian vault export**: Data Export can write your research straight
  into a folder as a linked Markdown vault — notes with wikilinks, a
  Lexicon page, stub pages for every tablet and word your work touches
  (each linking back to the live app), collections, and findings.
  Chromium browsers only (File System Access API); re-exporting
  overwrites just the generated files.
- **Research bundle**: the same content as one self-contained Markdown
  document with live links — built for NotebookLM or any tool that takes
  a text source, and it downloads in every browser.
- **My Lexicon**: a new Research module that aggregates every annotation
  into a working glossary — proposed meaning, confidence, evidence, and
  live corpus attestation counts — with filters, CSV export, and
  save-to-findings.
- **Referenced by your research**: a tablet's detail view now shows where
  it figures in your own work — annotations citing it as evidence, the
  collections it belongs to, the notes that reference it.
- **Installable**: a web app manifest and icons make the workbench
  installable from the browser (it already worked offline); scope presets
  let you name the corpus slice you keep coming back to and re-apply it in
  one click; the command palette gained a "Random tablet" entry.
- README rewritten for newcomers (a "Use it right now" tour, plain-words
  Node.js install steps); the full module-by-module table moved to
  [docs/FEATURES.md](docs/FEATURES.md); two new step-by-step recipes in
  Help (building a case for a word's meaning; testing whether a tablet
  is a copy).

## 1.2.0 — 2026-06-12

- **Embed mode**: `?embed=1#/i/HT13` renders a chromeless single-tablet
  card (glyphs, transliteration, facsimile thumbnail, link back) sized for
  an iframe — course pages and blog posts get a live embed instead of a
  screenshot.
- **pyaegean integration**: the Query Builder and each tablet's detail view
  can copy ready-to-run pyaegean code (same field ids, same data);
  `public/corpus/manifest.json` stamps the upstream commit and a parity
  checksum both projects verify in CI; docs/DATA.md records the data
  contracts (corpus files, immutable release assets, shared test values);
  and a workflow publishes the built app as a release asset for pyaegean's
  `aegean workbench` command. The README and in-app credits note the
  Python toolkit.
- **Permalinks**: the URL now carries the active module, open tablet/word,
  and corpus scope (`#/i/HT13`, `#/m/freq?site=Haghia+Triada`) — links are
  shareable, bookmarkable, and back/forward retraces your steps. Detail
  modals gained a copy-link button.
- **Cite this tablet**: per-inscription citations (BibTeX / APA / Chicago /
  MLA) from the detail modal — GORILA as the edition of record plus the
  permalink, pinned to version and access date.
- **Static data API**: the build now publishes the schema-v1 corpus export
  at `api/v1/` (full corpus, per-inscription files, id manifest) — see
  [docs/API.md](docs/API.md).
- **Works offline**: all four UI font families (the Linear A glyph font
  included) are self-hosted, and a service worker caches the app shell,
  corpus, and fonts after the first visit. The fonts were the last external
  runtime dependency; there are now none.
- **Command palette searches the corpus**: Ctrl+K now jumps to tablets,
  words, and sites, not just modules.
- The first-run welcome offers three one-click starting recipes; updating
  to a new version shows a one-shot what's-new note.
- A module crash is now contained to the module pane (with retry) instead
  of blanking the whole app; imported custom wordlists persist like the
  rest of the research state; the corpus-load error screen gained a Retry.
- Sortable table headers are keyboard-accessible and announce their state
  (`aria-sort`); shared links unfurl with a proper social card.
- Under the hood: CI runs ESLint's react-hooks rules on Node 24, the Pages
  deploy only ships after CI passes, the imagery release recipe is
  deterministic with immutable tags, and the corpus fetch is pinned to the
  exact upstream commit.

## 1.1.0 — 2026-06-05

The workbench as initially published: 37 analysis modules over the full
1,721-inscription corpus — search, browsing, concordances, sign analysis,
accounting verification, cross-linguistic hypothesis testing, geography,
scribal comparison — with annotations, collections, findings, notes, report
export, one-file backup, and a self-contained GitHub Pages deployment that
bundles the upstream commentary and facsimile mirror.
