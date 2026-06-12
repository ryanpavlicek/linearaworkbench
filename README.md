# Linear A Research Workbench

A computational research environment for the **Linear A** corpus — the
undeciphered Bronze Age Minoan script (~1800–1450 BCE). Built as a
zero-dependency-at-runtime browser SPA that you can use online, run
locally, or fork and extend.

**Status**: experimental research tool. Not authoritative. See
[Caveats](#caveats) below.

[![CI](https://github.com/ryanpavlicek/linearaworkbench/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanpavlicek/linearaworkbench/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](LICENSE)
[![Self-contained](https://img.shields.io/badge/deployment-self--contained-success)](#architecture)

---

## What this is

About **1,400–1,500 Linear A documents** survive — on clay tablets,
sealings, and libation tables, from sites across Crete and the Aegean.
The upstream transcription (mwenge/lineara.xyz, following GORILA)
splits these into **1,721 tagged entries** (separately-numbered
sealings, obverse/reverse faces, etc.) and that's what this workbench
loads and analyzes; see [Methodology](docs/METHODOLOGY.md#corpus-normalization)
for the count distinction. We can read most of the *sounds* (the script
shares ~60% of its signs with the deciphered Linear B), but not the
language. The corpus is small, fragmentary, and mostly administrative.

This workbench gives you **37 interactive modules** for analyzing that
corpus: searching, browsing, statistics, sign concordances, accounting verification,
cross-language phonetic alignment, hypothesis testing, annotation, mapping,
comparison. Everything is keyboard-accessible, mostly works offline, and
persists your work to
the browser.

## Highlights

| | |
|---|---|
| **Cross-linguistic alignment matrix** | Visual phoneme-by-phoneme comparison of any Linear A word against nine reference languages — including Mycenaean Greek (Linear B), the deciphered sister script that shares the sign values — color-coded by match quality. **Tuning sliders** adjust the vowel / consonant / indel substitution costs and match threshold and re-rank live. One-click **✎ Use** records a match as a proposed meaning (confidence from the score, source cited). |
| **Accounting & metrology** | Parses the decimal numerals and metrological fractions, sums each accounting tablet's line items, and verifies them against the stated KU-RO / PO-TO-KU-RO totals — flagging which balance and which don't. |
| **Commodity catalog** | Every commodity logogram (grain, oil, wine, figs, livestock, materials) with glosses, ligature variants, summed quantities, co-occurring terms, and distribution. |
| **Sign transitions** | Graphotactic heatmap + inspector: which signs follow/precede which within words, word-edge behavior, and the sparsity of the transition matrix. |
| **Sign patterns** | Wildcard graphotactic search: query any sequence of signs with `*` (one sign) and `**` (zero or more) to find every word matching the shape. The Query Builder includes the same engine as a `contains-pattern` field. Useful for asking "what word-shapes does the corpus prefer?" or "is `*-RO` (anything-ro) productive?". |
| **Statistical collocation** | PMI, log-likelihood (G²), Yates-corrected χ² with p-values, Bonferroni correction, on-demand Fisher's exact. Significance-only filter. |
| **KWIC concordance** | Keyword-in-context view with sortable left/right context columns, configurable window size, dispersion plot across the corpus. |
| **Lexical statistics** | Type–token ratio, hapax spectrum, and a Zipf rank–frequency log-log curve against the ideal — does the corpus behave like a language? **Compare-with** overlays a second slice (whole corpus, a site, or a period) on the Zipf curve with a side-by-side stats table. |
| **Stem families** | Heuristic lemmatization: clusters words that share a stem and differ only by productive suffixes. Candidate morphological paradigms. |
| **Minimal pairs** | Words differing by a single sign; aggregates recurring sign alternations by position — a lever on inflection and sign values. |
| **Name candidates** | Distributional onomastic heuristic: flags words that behave like counted entries (line-initial, quantified, local) — candidate personal names. |
| **Notes** | Free-form Markdown notes — the long-form thinking that ties everything together. A **+ Reference** picker searches every inscription, word, sign, annotation, collection, finding, and other note in the workbench, and inserts color-coded chips that are clickable in the live preview, **hover-previewable** (kind-specific peek card), and rendered into the report. A **Referenced by** footer on each note shows every other note that links to it. *(A tab of **My Research**.)* |
| **Research report builder** | Auto-compiles your annotations, hypotheses, collections, and findings, then lets you **reorder sections** and add your own **text, image, and note blocks** (with a cover title/subtitle/author). Collected tablets expand into full sheets — **glyphs, transliteration, glosses, metadata, and plate** (facsimile / photo / both, selectable). Findings now carry **captured result tables** — the actual interlinear comparisons, KWIC lines, ranked-match tables, alignment matrices, transition rankings, etc., rendered inline in the report rather than reduced to a one-line summary. The exported HTML is **interactive**: sticky filter input (`/` to focus), click-to-sort tables, click-to-highlight word/sign cross-references across the document, collapsible sections, scroll-spy TOC, light/dark toggle — all vanilla JS, single file, fully offline. Print stays clean. Export as **Markdown**, **HTML** (Linear A font + images base64-embedded), or **ZIP** (`report.html` + an `images/` folder — smaller for image-heavy reports). Layout persists. *(A tab of **My Research**.)* |
| **Scribes** | Per-scribe sign-frequency profile and pairwise comparison (Jaccard overlap, log-ratio of distinctive signs; deep-links to SigLA for sign-shape paleography), against another scribe, the corpus baseline, or **the scribe's own site average** (controls for regional vocabulary), plus a force-directed scribal network whose clusters suggest shared training. *(Comparison + Network tabs.)* |
| **Diachronic comparison** | Compare any two dating phases — the broad Middle vs Late Minoan buckets or specific sub-phases (e.g. LM IA vs LM IB): words and signs distinctive to each by log-ratio, with an automatic note when the sample is lopsided. |
| **Glyph keyboard search** | Pick Linear A signs from a palette to assemble a search query. Useful when you have a tablet in hand. |
| **Corpus browser** | A "browse, don't search" companion to Corpus Search, with three tabs: page through every tablet (sortable, scope-aware); a **By glyph** index (pick a sign → every word and inscription that carries it); and an **Imagery** contact sheet — a thumbnail grid of facsimile drawings, photographs, or both as pairs, with a click-to-enlarge lightbox. The Browse tab has an optional **Preview pane** toggle that adds a compact side-by-side card (metadata, glyphs, first transliterated lines, facsimile thumbnail) for the highlighted row, with `↑`/`↓` keyboard nav and `Enter` to open the full detail modal. |
| **Commentary browser** | A standalone read-the-scholarship surface over all **1,694 bundled commentary docs** from John Younger's pre-2024 KU-era archive (mirrored via mwenge/lineara.xyz). Two-pane: site-grouped list with full-text search (matches ranked by hit count) on the left; rendered commentary HTML on the right, themed to match the app. Each doc has an **Open inscription →** button if the ID maps to a corpus inscription, and a footer caveat points to Younger's current academia.edu folder for the latest readings. Complement to the inline commentary panel that already lives in every inscription detail modal. |
| **Global corpus scope** | A top-bar filter (site / period / scribe / support / collection) that restricts the corpus *every* analysis module sees — frequencies, collocations, n-grams, the map, scribes, and more all recompute over the selected slice. Set it once to ask "what does Haghia Triada look like?" or "just the LM IB tablets?". The active scope and its inscription count are always shown; one click clears it. |
| **Interactive analysis tables** | Every result table sorts by any column (click the header, click again to flip) and filters in place — free-text search plus metric thresholds (count, site spread, word length, confidence), category and position-bias filters per module. The row count updates live, and **Export CSV** / **Save to findings** always reflect the current filtered, sorted view. |
| **Inline word tools** | Every word carries a quiet ✎ control (on by default) to **annotate** (proposed meaning + confidence + notes), **add to a collection**, and **pin** — all in place, no detour through a detail view. From a word's detail, **Open in →** jumps to that word in the Concordance, Cross-Linguistic, or Co-occurrence module. Persisted in localStorage, exportable, and compiled into the research report. |
| **Hypothesis worksheets** | Reference modules double as workspaces: define your own semantic fields in the Semantic Classifier and sort words into them (your groupings show in place), or accept/dismiss name candidates in the Onomastics module to build a vetted list. Everything flows into the research report. |
| **Sound shift hypothesis testing** | Edit any sign's phonetic value, watch the change propagate to all cross-language matches. A **match-delta** summary scores whether your change moves the top words closer to or further from known-language words (per-word Δ + net change). Save snapshots with per-sign reasoning and compare them side-by-side. |
| **Compound query builder** | Stackable filters across inscription metadata (site, scribe, dating period) and word features (prefix, suffix, syllable count, contains-sign, co-occurs-with), combined with **and / or / not** per row. Saved queries persist. |
| **Co-occurrence network graph** | Force-directed visualization of word collocation by PMI. Drag nodes, focus neighborhoods. *(The **Network graph** tab of Co-occurrence, beside the statistics table.)* |
| **Findspot map** | Interactive geographic map with zoom, pan, minimap, and progressive label disclosure. Click a site, jump there, see all its inscriptions. A **word overlay** recolors the map by where a given word is attested (matching sites lit, others dimmed). **Save to findings** captures a PNG snapshot of the current view and embeds it in your research report. *(The **Map** tab of Geography, beside site-distribution stats.)* |
| **Light & dark themes** | Switch between the default dark IDE-style theme and a light theme tuned for paper / sunlit-room reading (higher-contrast accents, theme-aware map palette). |
| **Backup & restore** | One-click download of a single JSON file containing **all** of your workbench data — annotations, collections, findings, saved hypotheses, queries, pins, tablet reclassifications, report layout, sidebar layout, and display settings. Re-importable on this or another machine, with merge / replace modes. Browser cache cleared? You're covered. *(In Research › Data Export.)* |
| **Folder sync (auto-backup)** | On Chromium browsers, connect a folder once and the workbench writes the same all-in-one backup JSON there — manually or automatically every 5/15/30 min (only when your work changed). Point it at a **Google Drive / Dropbox / OneDrive desktop-sync folder** and the provider uploads + version-histories it for you: cloud backup with no login, no account, and no server. The folder handle persists across reloads (one-click re-authorize after a reload). *(In Research › Data Export.)* |
| **Structured corpus JSON** | One download dumps the entire enriched corpus as a versioned-schema JSON file ready for `pandas.read_json` / `jq` / R `jsonlite`. Every canonical field from the upstream transcription, plus a per-inscription `derived` block with the workbench's analyses (tablet-structure category with any researcher overrides, accounting balance check). `_meta` block carries provenance, schema version, scope, methodology URL. Optional flags include the 84-sign inventory, word frequencies, and your own annotations / collection memberships / pin state. Same schema per-inscription via a **JSON ↓** button in any tablet's detail modal. Turns the workbench into a clean starting point for downstream Python/R analysis. *(In Research › Data Export.)* |
| **Side-by-side compare** | Up to four inscriptions in parallel columns with shared multi-sign words auto-highlighted in matching colors. An **interlinear** view word-aligns the tablets (Needleman–Wunsch) so shared words line up row-by-row with gaps, plus a **shared-sign highlight** toggle and per-column metadata. Save a comparison as a named, reloadable **finding**, export it as CSV. |
| **Findings** | Save the *result* of an analysis — a comparison, a concordance, a scribe/diachronic comparison, a minimal-pair set, and more — as a named, tracked entry. Reload it, export the set as JSON/Markdown, and have it compiled into the research report. The general "capture what I built" layer, distinct from per-word annotations. |
| **Similarity clustering** | Token-level or consonant-skeleton Levenshtein over inscription word sequences. **Find similar** ranks against a pivot; **Clusters** groups mutually-similar inscriptions automatically (connected components, adjustable link threshold). Surfaces fragmentary copies and morphological cousins. |
| **Sign inventory** | Every sign with its Unicode glyph, GORILA label, Linear B value (where shared), and example words. Empirically derived from corpus alignment. Each row carries an **↗ SigLA** link that opens the canonical paleographic database scrolled to that sign — for per-scribe variant drawings (the *ductus* side this tool deliberately doesn't duplicate). Same link on every Sign Concordance row, plus per-inscription via the **Paleography ↗** button. |
| **Full glyph rendering** | Real Unicode Linear A characters via Noto Sans Linear A, alongside transliteration and editorial English glosses. |
| **Facsimile + photograph + commentary** | Per-inscription scholarly commentary (mirrored from lineara.xyz) plus tablet imagery, loaded from local mirror or upstream CDN. |
| **Comprehensive in-app help** | 35+ sections with searchable highlights, clickable navigation to every module, workflow recipes, and full keyboard-shortcut reference. |
| **In-app Methodology** | The full technical documentation (`docs/METHODOLOGY.md`) renders inside the app under Help, with a sticky filterable TOC, scroll-spy, smooth in-doc anchor jumps, and source-code links that point at GitHub. Same canonical file you'd cite — no drift between the GitHub copy and what the reader sees. Modules that touch loaded material (Cross-Linguistic, Co-occurrence, Sound Shift…) deep-link to the relevant section. |

## Try it

**Live demo**: <https://ryanpavlicek.github.io/linearaworkbench/>

**Run locally:**

```bash
git clone https://github.com/ryanpavlicek/linearaworkbench.git
cd linearaworkbench
npm install
npm run dev
```

Open <http://localhost:5173>.

**Everything works out of the box.** The repo ships with the full corpus
(~262 KB) plus the entire upstream auxiliary mirror (~500 MB) — commentary
HTML, facsimile images, GORILA PDFs — all of it. Search, sign inventory,
network graphs, hypothesis testing, the map, every facsimile button, every
Commentary ↗ link: zero external dependencies at runtime.

> ⚠️ Heads up: the repo is **~500 MB** because of the bundled auxiliary
> mirror. The trade-off is that the GitHub Pages deployment is fully
> self-contained — it will keep working forever, even if upstream sources
> go offline. See [Saving repo size](#saving-repo-size-optional) if you'd
> prefer a small repo with runtime CDN fallback instead.

## Saving repo size (optional)

If you'd rather keep the repo small (~5 MB), you can gitignore the 500 MB
`public/upstream/` mirror and have the app load commentary and facsimile
images from upstream CDNs at runtime:

```bash
echo "public/upstream/" >> .gitignore
git rm -r --cached public/upstream
cp .env.example .env.local
# uncomment the two VITE_ASSET_BASE / VITE_COMMENTARY_BASE lines
```

**Tradeoff**: you save ~500 MB but the deployed site now depends on
mwenge/lineara.xyz staying online. The analytical tools still work
regardless — only the Commentary ↗ and Facsimile/Photograph buttons
would break if the upstream went down.

To regenerate the bundled mirror later (after the gitignore change is
reverted):

```bash
npm run assets:fetch     # ~10–20 min, repopulates public/upstream/
```

## Architecture

- **Stack**: Vite + React 18 + TypeScript + Zustand. Zero non-essential
  runtime dependencies.
- **Code splitting**: each module ships as its own lazy chunk
  (1–6 KB gzipped). Main shell is ~64 KB gzipped.
- **State**: localStorage-backed for annotations, collections, saved
  queries, saved hypotheses, pins, display preferences. Namespaced under
  `linear-a-workbench:`.
- **Corpus**: pre-built JSON in `public/corpus/`. Regenerated via
  `npm run corpus:fetch` from the upstream
  [mwenge/lineara.xyz](https://github.com/mwenge/lineara.xyz) source.
- **Upstream mirror**: pre-fetched copy of commentary HTML, facsimile
  images, and GORILA PDFs lives in `public/upstream/` and is committed
  to the repo so deployments are fully self-contained. Regenerated via
  `npm run assets:fetch`.
- **Sign mapping**: derived empirically by aligning the upstream's
  transliterations with its parsed glyph strings codepoint-by-codepoint.
  Confidence scores per sign are reported in the Sign Inventory module.
- **Glyphs**: rendered via [Noto Sans Linear A](https://fonts.google.com/noto/specimen/Noto+Sans+Linear+A).
- **Asset paths**: configurable via `VITE_ASSET_BASE` and
  `VITE_COMMENTARY_BASE` env vars; default to the bundled local mirror.

See [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) for the math (phonetic
distance formula, PMI, alignment derivation) and known limitations.

## Keyboard

- `Ctrl + K` — Command palette (jump to any module by name)
- `Ctrl + /` — Corpus Search
- `Ctrl + Z` — Undo last reversible action
- `?` or `/` — Open the in-app help
- `Esc` — Close detail modal
- `Alt + ←` / `Alt + →` — Step inscription navigator (inside detail)
- On the Findspot Map (when focused): arrow keys pan, `+`/`-` zoom, `0` resets

## Project layout

```
linearaworkbench/
├── public/
│   ├── corpus/             # Pre-built inscription + sign JSON (~262 KB)
│   └── upstream/           # Bundled commentary + images + papers (~500 MB)
├── scripts/
│   ├── build-corpus.mjs    # Normalize upstream corpus → JSON
│   ├── fetch-corpus.mjs    # Pull upstream + rebuild
│   └── fetch-assets.mjs    # Re-mirror upstream commentary + images + PDFs
├── src/
│   ├── components/         # Shared UI (TopBar, Sidebar, DetailModal, ...)
│   ├── data/               # Sign data, language wordlists, site coords
│   ├── lib/                # Algorithms, helpers, types, persistence
│   ├── modules/            # The analysis panels (lazy-loaded)
│   └── store/              # Zustand workbench store
├── docs/
│   └── METHODOLOGY.md      # Technical detail on the analytical methods
├── .github/
│   ├── workflows/          # CI + Pages auto-deploy
│   └── ISSUE_TEMPLATE/     # Bug, feature, data correction templates
└── .env.example            # How to swap bundled assets for upstream CDN
```

## Citations

If you use this workbench in academic work, **primary citations should go
to the underlying corpus sources**:

- **GORILA**: Godart, L. & Olivier, J.-P. (1976–1985). *Recueil des
  inscriptions en linéaire A*. École Française d'Athènes.
- **mwenge/lineara.xyz**: the digital transcription of the corpus this
  tool builds on, at <https://github.com/mwenge/lineara.xyz>.
- **John Younger's Linear A material** (2024): scholarly commentary
  referenced throughout, now hosted as PDFs on academia.edu at
  <https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction>.
  Younger moved off the KU secondary server (his previous host) in 2024;
  the workbench bundles a mirror of his pre-2024 commentary HTML (via
  lineara.xyz) and renders it inline in every inscription detail.

The workbench itself is exploratory infrastructure on top of that scholarship.
Analytical claims in your paper should reference the primary sources above.

If your work specifically uses the workbench's analytical features (the
alignment matrix, sound-shift hypotheses, accounting reconciliations, the
report's captured result tables, etc.) or you want to enable reproducibility,
**please also cite the workbench itself**. A [`CITATION.cff`](CITATION.cff) is
provided — GitHub's "Cite this repository" button (right sidebar of the repo
page) generates APA / BibTeX in one click, and Zotero / Mendeley pick it up
automatically. The in-app Research Report's **+ Citation block** also emits
pre-formatted workbench citations alongside the corpus sources in BibTeX /
APA / Chicago / MLA — pinned to the version and snapshot date for
reproducibility.

## Caveats

- **No editorial authority.** I make no claims about what Linear A
  actually means. All comparisons, alignments, and statistics are
  exploratory tools. Every analytical module carries a small **Descriptive**
  or **Exploratory** badge at the top of its panel so the calibration is
  visible at the point of use, not just buried in the docs.
- **Comparison wordlists are illustrative.** The nine reference-language
  wordlists in `src/data/languages.ts` are short editorial collections;
  they are not exhaustive and have not been peer-reviewed by specialists.
- **Glyph mapping is empirical, not paleographic.** The workbench uses
  idealized Unicode characters. For per-scribe variant analysis, use
  [SigLA](https://sigla.phis.me) or similar paleographic resources.
- **Sign mapping confidence < 100%.** The corpus has some misaligned or
  uncertain readings; see the confidence column in the Sign Inventory.
- **Cross-language phonetic distance is heuristic.** The weighted
  Levenshtein formula reflects general typological intuitions, not a
  trained model. See the methodology doc — also available in-app under
  Help → Methodology.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, data corrections,
and new analysis modules all welcome.

## License

[Apache License 2.0](LICENSE). The Apache 2.0 terms apply to the code and
bundled corpus JSON. Attribution requirements (preserve copyright notices,
include a copy of the [NOTICE](NOTICE) file in derivative works) are
spelled out in the license itself.

Facsimile images and GORILA PDFs hosted via the upstream remain © École
Française d'Athènes and are loaded for academic reference only — they are
NOT redistributed under the Apache 2.0 license. See [NOTICE](NOTICE) for the
full third-party attribution list.

## Related work

- **[John Younger's Linear A material](https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction)**
  (2024, academia.edu) — the canonical scholarly online reference,
  reorganized as PDFs after the KU secondary server was retired in
  2024. Every inscription detail in the workbench renders the bundled
  pre-2024 commentary inline and points readers to the academia.edu
  folder for current material.
- **[mwenge/lineara.xyz](https://github.com/mwenge/lineara.xyz)** —
  visual catalog with tablet imagery and zoom. The workbench bundles their
  corpus transcription and commentary mirror; complementary tool overall.
- **[SigLA](https://sigla.phis.me)** — paleographic database of Linear A
  signs by scribe. Use this for sign-variant analysis.
- **[DAMOS](https://damos.hf.uio.no)** — the Mycenaean (Linear B) corpus
  at Oslo; sister-script database.
- **GORILA** — Godart, L. & Olivier, J.-P. (1976–1985). *Recueil des
  inscriptions en linéaire A* (École Française d'Athènes). The printed
  scholarly edition all digital projects derive from.

## Acknowledgements

This workbench would not exist without the volunteer labor of
[mwenge](https://github.com/mwenge), whose transcription of the GORILA
corpus into structured JSON is the data foundation here. John Younger's
decades of scholarly editorial work is the secondary literature source.
The École Française d'Athènes holds the rights to the facsimile imagery
mirrored from the upstream repository.

## About the author
Ryan Pavlicek

I'm a software engineer in Cincinnati, Ohio. My classical-languages credentials
start and end at amateur Koine Greek — 85-90% proficient enough to read the
Biblical New Testament in Greek, no further. I'm not a classicist, not a 
Linear A researcher, and I have no delusions about becoming one
in mid-life. Creating a tool for working with Linear A seemed like an
interesting engineering problem to tackle.

If something here is wrong, please open an issue on github.

**Email**: 'ryan [dot] pavlicek [dot] github [at] gmail [dot] com'
*(Replace `[at]` with `@` and `[dot]` with `.`)*
