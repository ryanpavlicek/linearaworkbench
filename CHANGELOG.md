# Changelog

Notable changes to the Linear A Research Workbench. Released versions pin
citations — `package.json`, `CITATION.cff`, and `WORKBENCH_VERSION` in
[`src/lib/citations.ts`](src/lib/citations.ts) stay in sync.

## 1.5.1 — 2026-06-14

- **Offline & self-hosting note**: a short pointer on the Home page and in
  Help → Reference letting people know the workbench is open source — run
  it offline, host your own copy, or fork it from the GitHub repo (setup
  in the README). The downloadable app build (the `workbench-app` release
  asset) is rebuilt at 1.5.1 so the offline copy carries this note too.

## 1.5.0 — 2026-06-14

- **A domain of its own**: the workbench now lives at
  <https://linearaworkbench.xyz> — citations, the data API, embeds, and
  the social-preview metadata all point there. Old github.io links
  redirect.
- **A Home page instead of a popup**: the first-run welcome modal is
  gone; its content lives on a proper landing page (a new *Start*
  sidebar group) with the intro, feature cards, try-one-now buttons,
  and the corpus credit. Fresh visits land there; returning users keep
  whatever module they were in.
- **Chart legibility pass** from a visual review: the Commodity
  Catalog's correspondence-analysis biplot no longer renders empty in
  the scribal-hands mode (a zero-margin column made the analysis
  degenerate; columns are now pruned against the selected rows) and the
  periods mode now states plainly that there isn't enough data rather
  than showing a misleading near-empty plot — the commodity record is
  ~96% LM IB, so no correspondence analysis of ceramic phases is
  possible. Labels are collision-laid-out with only the heaviest
  commodities labeled, and axes scale to the bulk of the points with
  outliers pinned at the edge; the Timeline's overlapping bands became
  one swimlane per phase on a shared date axis (the phases genuinely
  nest — MM III contains IIIA/IIIB); and the Constellation gained
  zoom, pan, per-site legend toggles, and small deterministic rings
  that spread identical-vocabulary documents apart.
- **Commodity Catalog no longer hangs**: the biplot's label de-overlap
  pass could loop forever on the real corpus — `y + 13` rounds, in
  floating point, to a value a hair under 13 away from `y`, so a label
  kept re-colliding with the point it had just dodged and the whole
  page froze on a spinner. The vertical-overlap gap is now strictly
  smaller than the nudge step, which guarantees each nudge clears the
  point it dodged. (This same hang was what intermittently wedged the
  jsdom test worker; the full suite runs clean now.)
- **Constellation no longer collapses to a band**: the starfield scaled
  both axes by the single largest coordinate, so one outlier document
  (a correspondence-analysis first axis is usually dominated by one or
  two) crushed every other star into a thin vertical line near the
  origin — the "stacked" look the redesign was meant to cure. It now
  scales each axis to its own 90th-percentile coordinate and pins the
  rare points beyond it at the plot edge, filling the plane — the same
  treatment the Commodity Catalog biplot got.
- **Audit-pass fixes** (a fan-out review of every module's render and
  interaction paths, after the Commodity Catalog hang showed mount-only
  tests weren't enough):
  - *Compare Inscriptions* now shows the text when only one inscription
    is selected — the per-row "Compare" pivot from Tablet Structure and
    Query Builder deep-links a single id, which previously rendered an
    empty interlinear table (alignment needs ≥2); it now falls back to
    the per-inscription Columns layout with a hint to add another.
  - *Wordlist Manager* normalizes JSON uploads the way CSV uploads were
    already normalized, so a list whose entries omit `m`/`d` no longer
    crashes the entry filter; the filter is null-safe for older saved
    lists too.
  - Hardened unguarded `e.p!` phonetic-distance calls in *Hypothesis
    Workspace*, *Sound Shift*, and *Data Export* against custom-language
    entries that lack a precomputed form (matching Wordlist Manager's
    existing guard); *Annotations* validates imported files and reads
    fields null-safely; *Commentary Browser* resets the imagery toggle
    when the selected document changes, so a facsimile/photo mode can't
    carry over to a document that lacks that image.

Eleven new modules — the workbench now has **50**:

- **Corpus Health** — the dataset's own condition: metadata coverage
  bars with click-throughs, damaged-token share, per-site completeness.
  Check it before trusting any per-scribe or per-period claim.
- **Document Types** — the corpus by physical object, each class with a
  function note, writing profile, top vocabulary, and one-click Scope.
- **Account Dossiers** — follow a candidate account-holder: every
  counted entry a word heads, with the actual ledger lines, totals,
  commodity mix, and co-listed words (SA-RA₂'s fifteen entries lead).
- **Metrology Lab** — the fraction census and a counted-vs-measured
  table per commodity; people ~0% fractional, spices 58%.
- **Timeline** — the corpus on a date line by ceramic phase, with the
  honesty notes (dating-by-deposit, the LM IA debate, the undated share).
- **Constellation** — every substantial text in one correspondence-
  analysis starfield; libation texts and ledgers form visible asterisms.
- **Plate Workbench** — autopsy mode: the published image beside the
  line-by-line transliteration, ←/→ across all 1,721 imaged documents.
- A new **Learn** group: **Guided Reader** (a real tablet token by
  token, steps generated from the data — HT13's half-unit crux is lesson
  one), **Scribe School** (balance a real account with its KU-RO hidden;
  compose your own ledger and the total writes itself), **Sign Trainer**
  (Leitner flashcards, frequency-first), and **Write in Linear A** (your
  name in signs, with every adaptation the script forces listed).
- Also: the GORILA credits entry now links to the CEFAEL digitization.

New quantitative techniques, each with its caveats in
[METHODOLOGY](docs/METHODOLOGY.md):

- **Richness and diversity**: Lexical Statistics adds Chao1 (presented
  as the lower bound it is, with a 95% interval), MATTR, a permutation
  envelope and Heaps' fit on the vocabulary growth curve, and upgrades
  the Zipf–Mandelbrot fit to maximum likelihood with a KS statistic.
- **Entropy of the sign system** (Sign Transitions): H(sign) with a
  bootstrap interval, H(next|prev), adjacent-sign mutual information,
  and redundancy — Miller–Madow corrected, with the conditional shipped
  as a labeled floor rather than a confidently-wrong interval (60% of
  attested sign pairs occur once).
- **Morphology**: Baayen's hapax-based productivity index P per affix,
  and a Harris successor-variety "Boundary signals" card — candidate
  morpheme boundaries from branching structure alone, an independent
  check on the affix table.
- **Graphotactic surprisal** (Sign Transitions + the word detail): every
  lexical word scored leave-one-out under a Witten–Bell-smoothed sign
  bigram model; an "improbable words" reading list and a per-word badge
  ("top 1% unusual") — candidate loans, names, errors, or damage, with
  the honest note that the model can't tell those apart.
- **Linear A vs Linear B sign frequencies** (Sign Inventory): how
  differently the two scripts use the shared signary, per 1,000 sign
  tokens with a Spearman summary (ρ ≈ 0.15 — strikingly unalike). The
  Linear B side loads on demand from the DAMOS-derived dataset
  (CC BY-NC-SA — never bundled); the value-assignment circularity is
  documented, not hidden.
- **Multivariate exploration**: a correspondence-analysis biplot of the
  site/hand/period × commodity table (axis inertia in the title);
  vocabulary-profile dendrograms for sites and scribal hands with
  bootstrap support at every junction (low-support merges render
  dimmed); and label-propagation communities coloring the co-occurrence
  network.

Deeper analysis in the existing modules:

- **Word Frequency** learns dispersion (Gries' DP across find-sites),
  keyness against the rest of the corpus while a Scope is active, and
  *anchor* tags for the conventionally-read vocabulary (KU-RO, KI-RO,
  PO-TO-KU-RO, the libation formula words — one shared list with the
  accounting parser and structure classifier).
- **Lexical Statistics** adds Yule's K and Herdan's C, a fitted
  Zipf–Mandelbrot curve (s, β, R² reported on the chart), and a
  vocabulary-growth curve with CSV export.
- **Sign Transitions** gains a PMI heat mode (attraction blue, repulsion
  red), expected counts on never-cells, and a "strongest gaps" list —
  never-attested pairs of frequent signs ranked by how often they should
  occur, the candidate graphotactic constraints.
- **Sign Concordance** shows each sign's glyph, top carrier words, and a
  positional-entropy column (how locked to one slot a sign is).
- **Minimal Pairs** phonologically types every alternation under the
  conventional AB values (V-alternation — the inflection signature —
  C-alternation, CV, or unknowable), adds a vowel-alternation grid, and
  an on-demand chance baseline from randomized vocabularies.
- **Accounting & Metrology** tests KI-RO reconciliation (does the
  deficit line explain the arithmetic?), adds a worst-Δ column, a
  discrepancy-size histogram, and use-as-scope; zero reconciliations is
  reported as a result (HT 123's deficit column is damaged in the
  source transcription).
- **Commodity Catalog**: the undeciphered *NNN logograms are now
  first-class — same detail panel, scope, and map overlay as catalog
  commodities.
- **Tablet Structure** now uses the one shared classifier everywhere (a
  stale local copy disagreed), and adds a category-by-site cross-tab
  plus a review queue of the unclassified tablets with the most content.
- **Libation Formulas** replaces the naive slot table with an anchored
  alignment (canonical anchor order computed from the corpus), a
  what-fills-each-slot card, and a candidate-variants finder that
  surfaces the A-SA-SA-RA-ME family; U-NA-KA-NA-SI and I-PI-NA-MA join
  the shared formula list.
- **Name Candidates** counts shared counted-lines with the VIR/MUL
  person logograms (sortable, in CSV) and tallies recurring name
  endings across whatever verdict slice is shown.
- **Root Cognates** shows each member's vowel melody, badges families
  corroborated by attested minimal pairs, and lists vowel alternations
  recurring across independent families.
- **Cross-Linguistic** gains a corpus-context panel beside the matches
  (sites, tablets, neighbors — does the proposed meaning fit?), a
  *Chance* column calibrating each match against the whole corpus
  ("top <1%" vs "a third of the corpus matches this well"), and a
  reverse lookup — type `kupairos`, get KU-PA-RI.
- **Sound Shift**'s sign grid shows each sign's attestation count and
  top carrier inline, and the evaluation table can run against one of
  your word collections instead of the auto-selected words.
- **N-grams** rows expand to the tablets carrying the sequence.
- **KWIC** matches wildcards (`KU-*`, `?-RO-JA`), can sort by the
  keyword's position in its word (with a slot column), and lists the
  top in-window companion words under the table.
- **Stem Families** adds a *Kober grid* — stems × their most-shared
  endings, rows sorted by ending-set signature so stems inflecting the
  same way band together; a stem attesting 3+ endings is flagged as a
  triplet-class row, after Kober's Linear B triplets.
- **Scribes** adds a distinctive-vocabulary card — the words a hand
  over-uses against the rest of the corpus, smoothed log-ratio with the
  same significance option as the sign signature.
- **Diachronic** charts a per-phase trajectory for any word or sign
  from the comparison lists (KU-RO: 0/31 word tokens in LM IA tablets,
  35/844 in LM IB).
- **My Lexicon** reports corpus coverage (how far your glosses reach,
  by tokens and types), edits glosses inline, and reads whole tablets
  interlinearly through your lexicon — gloss under word, "?" where work
  remains.
- **Wordlist Manager** opens any wordlist for browsing and filtering
  in place, and previews how strongly a list engages the corpus (share
  of entries with a close phonetic match, with the best pairs listed).
- **Similarity** adds a *rarity overlap* column — shared vocabulary
  weighted by inverse document frequency, so sharing A-DU counts for
  more than sharing KU-RO.
- **Compare Inscriptions** shades near-matches (one sign apart) in the
  alignment grid and exports the alignment as CSV.
- **Commentary Browser** search results preview a snippet around the
  hit, and tablet references in the running text (HT 13, PK Za 11)
  become clickable corpus links.
- **Notes** are searchable; **Data Export** adds a one-row-per-token
  long-format CSV; **Corpus Search** gains exact / starts-with /
  ends-with match modes and can save a result set as a collection.

Statistical rigor, on by choice:

- A shared **Dunning's G²** keyness test (in
  [METHODOLOGY](docs/METHODOLOGY.md) terms: the log-likelihood ratio on a
  2×2 table) now backs a "rank by significance" option in **Diachronic**
  and **Scribes** — a 2-vs-0 fluke stops outranking a 30-vs-4 pattern;
  the raw log-ratio ranking stays the default.
- **Morphology** gains an *Edge G²* column: is a sequence genuinely
  over-represented at the word edge versus interior positions? A stronger
  affix signal than raw frequency, sortable, in the CSV.
- **Positional Grammar** gains a *Bias G²* column that tests each word's
  dominant position against the corpus-wide slot baseline — "mostly
  medial" because medial slots are common scores near zero.
- **N-grams** bigrams carry PMI and G² (a frequent pair of two frequent
  words is not evidence of association).
- The **Commodity Catalog**'s co-occurring terms can rank by PMI instead
  of raw count (KU-RO appears with everything; PMI surfaces what is
  *specifically* associated), and the **Semantic Classifier** can rank
  each ideogram group by exclusivity — the share of a word's ideogram
  co-occurrences that belong to that group.

Modules now hand off to each other:

- Every analysis surface that names a sign, word, or site can jump to
  the right tool already focused: Sign Inventory rows → Sign
  Transitions / Sign Concordance; Corpus Browser's glyph detail → the
  same (plus a complete CSV and a prev/next lightbox); KWIC →
  Co-occurrence in collocates-of mode; Co-occurrence table rows ↔ the
  Network graph (per-row "Graph", node search, "In table →" back);
  Morphology affixes → Stem Families; Name Candidates → Cross-Linguistic;
  Positional Grammar rows → KWIC.
- The **Commodity Catalog** detail lists the tablets, can adopt them as
  the global scope, and opens the Geography map with that commodity's
  overlay preset; a focused map site can become the scope in one click;
  the Site Distribution Jaccard table expands any pair to list the
  actual shared words.
- Saved findings and CSV export reach the remaining analysis surfaces:
  Sound Shift's evaluation table, Hypothesis Workspace diffs, Commentary
  Browser searches, the Network graph's edge list, and the Query
  Builder's result tables (now sortable, too).
- Saved findings **re-open live**: a finding records the parameters
  that produced it, and re-opening restores the module to that state —
  query, filters, thresholds — in Corpus Search, KWIC, and
  Co-occurrence, even when the module is already on screen.
- Research Report sections can be **curated**: a per-section checklist
  excludes individual annotations, findings, collections, or hypotheses
  from the built report without deleting them from the workspace.

Correctness fixes from a module-by-module review:

- **Accounting**: a PO-TO-KU-RO grand total is now checked against the
  stated KU-RO subtotals it restates (plus any trailing unsummed items)
  instead of an empty section, and a total with nothing to check against
  yields no check rather than a spurious discrepancy — the balance-rate
  stats no longer count false failures. KI-RO deficit lines still stay
  out of the sums. The table also says when it's showing 200 of more.
- **Co-occurrence**: the word filter and "collocates of" now apply
  before the top-250 display cap — previously collocates of any
  mid-frequency word were silently incomplete.
- **Sequence Patterns**: the tokenizer now uses the full ligature-aware
  commodity catalog (figs, cyperus, livestock and the rest no longer
  tokenize as words), the real numeral parser, PO-TO-KU-RO as a total,
  and a new deficit class for KI-RO; example tablets are de-duplicated.
- **Tablet classification**: the structure heuristic and Libation
  Formulas now share one libation word list (they used to disagree), and
  fraction-only tablets count as accounting documents.
- **Semantic Classifier**: ideogram groups now come from the shared
  commodity catalog (ligatures included) and count co-occurrence per
  line, not per tablet — matching how the Commodity Catalog reads
  entries.
- **Sound Shift**: editing a sign now evaluates the words that actually
  contain it (up to 50) instead of a fixed top-20 — rare-sign
  hypotheses no longer show an all-zero table; an unattested sign says
  so. The Hypothesis Workspace diff and compare-all views do the same.
- **Scribes**: the corpus and site-average baselines now exclude the
  selected scribe's own tablets, and the scribe count in the intro is
  computed, not hardcoded.
- **Scope, everywhere it was silently ignored**: Corpus Search, the
  Sign Inventory (attestation counts, top words, and an
  attested-in-scope tally), all Data Export cards, and Cross-Linguistic's
  Bulk view now honor the global Scope, each with a visible note;
  Diachronic gains an opt-in "respect Scope" toggle for site- or
  support-conditioned phase comparisons.
- **Diachronic**: specific phases list chronologically (MM before LM).
- **Wordlist Manager**: the documented CSV header row is no longer
  imported as a (bogus) vocabulary entry.
- Sign-target annotations and note references now open the Sign
  Inventory focused on the sign instead of doing nothing; Onomastics,
  Similarity, and Site Distribution tables use the shared sortable
  headers (Site Distribution gains a show-all-sites toggle, Onomastics
  says when the 250-row cap engages).

## 1.4.0 — 2026-06-12

- **A real coastline under the map**: the Findspot Map now draws Natural
  Earth's 1:10m land polygons (public domain, clipped and simplified at
  build time, bundled — still fully offline) instead of a hand-traced
  Crete outline. The Cyclades, mainland Greece, and the Anatolian coast
  now actually exist under their markers.
- **Map overlays beyond words**: the overlay can recolor sites by
  commodity logogram, scribe, dating phase, or tablet type, alongside the
  existing word overlay — where does wine cluster, which sites are active
  in MM vs LM, where do libation formulas live.
- **Site links**: a map toggle draws the most vocabulary-alike site pairs
  as arcs (shared-word Jaccard — one shared implementation with Site
  Distribution's table).
- **Pleiades links**: a focused site links out to its page in the
  Pleiades gazetteer of the ancient world (33 sites aligned).
- **GORILA, readable online**: the five GORILA volumes are digitized in
  the École française d'Athènes' CEFAEL library — the footer, the About
  panel, per-tablet citations (all four styles), and the docs now link
  there.
- **Python Toolkit page**: a new sidebar entry (under *Programmatic*)
  that puts pyaegean front and center — install line, copyable
  quick-start and round-trip snippets, PyPI / API-reference / Colab
  links, and the site's other programmatic doors (data API, embeds,
  bring-your-own corpus). 39 modules now.
- **Map zoom is Shift+scroll**: a plain wheel over the Geography map
  used to zoom the map *and* scroll the page at once on smaller
  screens. Plain scrolling now belongs to the page; hold Shift to zoom
  (the hint overlay and screen-reader label say so), or use the
  + / − keys with the map focused.

## 1.3.0 — 2026-06-12

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
- Commentary Browser search hits are now highlighted inside the rendered
  doc, not just counted in the results list.
- The Co-occurrence table and the Network graph now share one
  pair-counting implementation, so the two views can never disagree on a
  PMI value.
- SVG charts (the Zipf curve, both network graphs, the map and its
  minimap) carry descriptive labels for screen readers.

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
