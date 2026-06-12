# Changelog

Notable changes to the Linear A Research Workbench. Released versions pin
citations — `package.json`, `CITATION.cff`, and `WORKBENCH_VERSION` in
[`src/lib/citations.ts`](src/lib/citations.ts) stay in sync.

## Unreleased

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
