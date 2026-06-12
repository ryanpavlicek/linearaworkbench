# Methodology

Technical documentation of the analytical methods used in the Linear A
Research Workbench. Skim this if you intend to cite or argue with any
analysis the tool produces.

## Contents

- [Corpus normalization](#corpus-normalization)
- [Sign → Unicode glyph derivation](#sign--unicode-glyph-derivation)
- [Phonetic representation](#phonetic-representation)
- [Cross-linguistic distance](#cross-linguistic-distance)
- [Phoneme alignment matrix](#phoneme-alignment-matrix)
- [Co-occurrence statistics](#co-occurrence-statistics)
- [Scribal Network](#scribal-network)
- [Inscription similarity](#inscription-similarity)
- [Interlinear alignment (Compare Inscriptions)](#interlinear-alignment-compare-inscriptions)
- [Stem families (heuristic morphological clustering)](#stem-families-heuristic-morphological-clustering)
- [Consonant-skeleton roots](#consonant-skeleton-roots)
- [Sign pattern matching (wildcards)](#sign-pattern-matching-wildcards)
- [Sequence pattern tokenization](#sequence-pattern-tokenization)
- [Tablet structure classification](#tablet-structure-classification)
- [Accounting & metrology (total verification)](#accounting--metrology-total-verification)
- [Lexical statistics](#lexical-statistics)
- [Sign transitions (graphotactics)](#sign-transitions-graphotactics)
- [Scribe sign-frequency comparison](#scribe-sign-frequency-comparison)
- [Site distribution (Jaccard)](#site-distribution-jaccard)
- [Commentary archive index](#commentary-archive-index)
- [Comparison wordlist provenance](#comparison-wordlist-provenance)
- [Known limitations](#known-limitations)

---

## Corpus normalization

The upstream corpus at [mwenge/lineara.xyz](https://github.com/mwenge/lineara.xyz)
ships as a JavaScript `Map` of inscription objects. The build pipeline:

1. Evaluates the file to obtain the Map directly (preserves array structure,
   no regex parsing).
2. For each inscription, retains: `id`, `site`, `support`, `scribe`,
   `findspot`, `context` (LM/MM period), `name`, transliterated word
   tokens (`transliteratedWords`, filtered to drop `\n` markers and empty
   strings), parallel editorial English glosses (`translatedWords`),
   the raw Unicode glyph string (`parsedInscription`), the transcription
   without line breaks, facsimile and photograph image URLs, image rights
   metadata, and the image rights citation URL.
3. Writes to `public/corpus/inscriptions.json`.

This is a lossless re-shape — no semantic transformations applied at this
stage.

### A note on the corpus count

The loaded corpus contains **1,721 entries**. Published Linear A
scholarship typically cites a corpus of **~1,400–1,500 documents** —
the difference is real and worth understanding before quoting either
number:

- The upstream transcription (mwenge/lineara.xyz, following
  [GORILA](https://cefael.efa.gr/result.php?serie_title_operator=con&volume_number_operator=%3D&issue_year_operator=%3D&section_title=Recueil+des+inscriptions+en+lin%C3%A9aire+A&section_title_operator=con&author_lastname_operator=con&publisher_name_operator=con&site_id=1&actionID=advanced&operator=AND),
  whose five volumes are digitized at CEFAEL) assigns a separate entry
  to each *tagged fragment* — a roundel face, a separately-numbered
  sealing, an obverse/reverse distinguished by `a`/`b` suffixes, etc.
- Print scholarship usually aggregates these into a single document
  count: one tablet with face `a` and face `b` is one document, not two.

Neither count is wrong; they answer different questions ("how many
distinct surfaces can I analyze?" vs. "how many documents are in the
corpus?"). The workbench's analyses operate on the upstream's per-entry
shape because that's the unit at which sites, scribes, supports, and
contexts are individually tagged. If you're writing about the corpus
size in a publication context, the conventional **~1,400–1,500** figure
is more appropriate than the loaded count.

## Sign → Unicode glyph derivation

The GORILA label → Unicode codepoint mapping is derived **empirically by
alignment**, rather than from a published table. The rationale: published
sign tables are not always Unicode-consistent and some sign variants don't
have agreed-upon codepoints. Aligning against the corpus itself produces a
mapping that's correct for *this* corpus.

Algorithm in [`scripts/build-corpus.mjs`](../scripts/build-corpus.mjs):

1. For each inscription with both `transliteratedWords` and
   `parsedInscription`:
   - Extract syllabic glyphs from the parsed string (Unicode codepoints in
     the Linear A block `U+10600 – U+107FF`, excluding the Aegean Numbers
     block `U+10100 – U+1013F` and word separators).
   - Count expected syllabic signs from the multi-sign word transliterations.
   - **Use only inscriptions where syllabic-glyph count equals
     expected-sign count.** This filters out tablets with damaged
     readings, restored signs, or transcription gaps that would corrupt
     the alignment.
2. For each clean alignment, walk transliteration and glyph in parallel.
   For each sign label seen, tally which glyph appeared at the
   corresponding position.
3. The modal (most frequent) glyph per sign is recorded as that sign's
   canonical mapping. **Confidence** = modal-glyph count / total
   observations.

Sign labels with subscript digits (`RA₂`, `PA₃`) are normalized to ASCII
(`RA2`, `PA3`) in the mapping store but preserved literally in the
transliteration tokens. The lookup helper in
[`src/lib/helpers.ts`](../src/lib/helpers.ts) handles the normalization.

The final dataset (`public/corpus/signs.json`) contains 84 unique signs
attested in cleanly-aligned inscriptions: 47 AB-shared (with known Linear B
phonetic values), 22 Linear A-only (starting with `*`), and 15 variant
forms (subscripted) without standard phonetic values.

**Caveat**: only inscriptions with perfect alignment contribute to the
mapping. A given sign may be attested in many more inscriptions in the
full corpus than its `total` field reflects.

## Phonetic representation

Linear A signs that are shape-shared with Linear B (the "AB" series in
GORILA) take their Linear B phonetic values by scholarly convention. The
default map is in [`src/data/phoneticMap.ts`](../src/data/phoneticMap.ts).

A Linear A word like `KU-RO` is rendered phonetically as `kuro`. Sign
labels prefixed with `*` (Linear A-only) have no phonetic value and pass
through lowercased.

The Sound Shift module lets you override any sign's phonetic value; the
override propagates to all phonetic-distance comparisons through the
[`wordToPhonetic`](../src/lib/algorithms.ts) helper, which composes the
default map with the override map per call.

## Cross-linguistic distance

The Cross-Linguistic module compares Linear A phonetic readings against
reference-language entries using **weighted Levenshtein distance**,
normalized to `[0, 1]`:

```
distance(a, b) = edit_cost(a, b) / max(|a|, |b|, 1)
```

Edit costs:
- **Match** (identical character): `0`
- **Vowel ↔ vowel substitution**: `0.3`
- **Same-class consonant substitution**: `0.5`
- **All other substitutions, insertions, deletions**: `1.0`

Vowel set: `a e i o u` plus their macron, circumflex, and acute variants
(`ā ē ī ō ū`, `â ê î ô û`, `á é í ó ú`, and `ḗ ṓ`). The accented variants
matter because the comparison wordlists store accented transliterations
(Greek/PIE `ō`, `ḗ`, `ṓ`; acute `ó`, `é`); without them an accented vowel
would be charged the full mismatch cost against a plain vowel.

Consonant classes (substitution within a class costs 0.5):
- Stops by place: `{p, b}`, `{t, d, ṭ, ṯ, ḏ}`, `{k, g, q, ḱ, ǵ, ḫ, ḥ}`
- Sibilants: `{s, z, š, ṣ, ž}`
- Nasals: `{m, n, ṇ}`
- Liquids: `{l, r}`
- Glides: `{j, w}`

The classes encode mild typological knowledge — that voiced and voiceless
stops at the same place of articulation often correspond across related
languages, that sibilant variants represent close phonetic neighbors,
etc. Crucially, the tables are sized to the **comparison-language
inventory**, not just Linear A's own (small) phoneme set: characters that
only appear on the reference side are grouped with their nearest Linear A
articulatory neighbor so they score a near-miss rather than a full
mismatch. Specifically — the emphatic `ṭ` and the interdentals `ṯ ḏ` (θ/ð)
join the dental stops; the palatovelars `ḱ ǵ` and the velar/pharyngeal
fricatives `ḫ ḥ` (common in Akkadian, Hittite, Hurrian, Ugaritic) join the
velars; the voiced postalveolar `ž` joins the sibilants. The genuinely
"weak" glottal and Egyptian consonants (`ʾ ʿ ꜣ ꜥ`) are deliberately left
unclassed (full mismatch), since they have no clear Linear A correspondent.

Before comparison, reference forms are stripped of pure-notation marks that
have no segmental value on the Linear A side: the reconstruction asterisk
(`*`), PIE laryngeal subscripts (`₁₂₃`), the labialization/aspiration
modifier letters (`ʷ ʰ`), and the combining syllabic ring (`U+0325`, as in
`r̥`). So PIE `*ǵʰésr̥` is compared as `ǵésr`. This mirrors the asterisk /
subscript stripping already applied to the Linear A side in
`wordToPhonetic`.

None of this is based on a trained model or attested sound correspondences
for Linear A specifically; it is a heuristic.

**Researcher-configurable scheme.** A handful of these groupings are genuine
linguistic judgment calls rather than settled correspondences, so they are
exposed in the Cross-Linguistic module as a *phonetic scheme* the researcher
can change, with defensible defaults pre-selected. The four choices are:
whether the interdentals `ṯ ḏ` join the dental stops, the sibilants, or
neither; whether the pharyngeal `ḥ` joins the velars; whether the voiced
postalveolar `ž` joins the sibilants; and whether the notation marks are
stripped. The core classes (Linear A's own inventory plus the unambiguous
extensions `ṭ ḱ ǵ ḫ` and the full vowel set) are always on and are not
configurable. The active scheme re-ranks results live and is recorded in any
saved finding or exported report, so a ranking remains reproducible. See
`PhoneticScheme` / `buildPhoneticClasses` in
[`src/lib/algorithms.ts`](../src/lib/algorithms.ts).

The reported "match score" in the UI is `(1 - distance) × 100%`.

**Implementation**: [`phoneticDistance`](../src/lib/algorithms.ts).

## Phoneme alignment matrix

The Alignment Matrix view (Cross-Linguistic module) recovers the
phoneme-by-phoneme correspondence between a Linear A word's phonetic form
and each reference-language match. Method:

1. Run the same weighted Levenshtein DP as above, but retain the full
   matrix.
2. Backtrace from `(|a|, |b|)` to `(0, 0)`. At each cell, pick the
   predecessor with minimal cost:
   - Match / substitution → diagonal
   - Insertion (gap in `a`) → left
   - Deletion (gap in `b`) → up
3. Emit an `AlignCell` per step with one of six operations: `match`,
   `sub-vowel`, `sub-class`, `sub-far`, `ins`, `del`.

The UI renders each cell as a small column with the two characters
stacked and a background color encoding the operation.

**Implementation**: [`alignPhonetic`](../src/lib/algorithms.ts).

## Co-occurrence statistics

The Co-occurrence module ranks word pairs by one of four measures (PMI,
G², Yates-corrected χ², raw joint count) and reports a χ²-based p-value
with optional Bonferroni correction and on-demand Fisher's exact.

For each inscription, treat its multi-sign words as a *set* (presence
matters, not multiplicity). Let:
- `N` = number of inscriptions containing any multi-sign word
- `f(a)` = number of inscriptions containing word `a`
- `f(a, b)` = number of inscriptions containing both `a` and `b`
- `p(a) = f(a) / N`, `p(b) = f(b) / N`, `p(a, b) = f(a, b) / N`

### Pointwise Mutual Information (PMI)

```
PMI(a, b) = log₂(p(a, b) / (p(a) · p(b)))
```

High PMI means the pair co-occurs much more than chance would predict
given the marginal frequencies. **Best general-purpose collocation
measure** for finding meaningful word associations.

### Log-likelihood ratio (G²)

The Dunning (1993) log-likelihood ratio — the corpus-linguistics standard
collocation statistic — summed over all four cells of the 2×2 contingency
table:

```
G²(a, b) = 2 · Σ O_ij · ln(O_ij / E_ij)     over the four cells i, j

  cells:    O₁₁ = f(a, b)                    E₁₁ = f(a)·f(b) / N
            O₁₂ = f(a) − f(a, b)             E₁₂ = f(a)·(N − f(b)) / N
            O₂₁ = f(b) − f(a, b)             E₂₁ = (N − f(a))·f(b) / N
            O₂₂ = N − f(a) − f(b) + f(a, b)  E₂₂ = (N − f(a))·(N − f(b)) / N
```

Cells with `O_ij = 0` contribute 0 (the `x·ln x → 0` limit). Compared to
PMI, G² is more robust for the sparse, low-count pairs typical of a small
corpus; unlike the single-cell shortcut sometimes used, this full four-cell
form is asymptotically χ²-distributed with 1 degree of freedom. Standard in
corpus linguistics for keyword and collocation extraction.

The same statistic, applied to a frequency-vs-frequency 2×2 table
(item count and remainder in corpus A vs corpus B), backs the **keyness
rankings** elsewhere in the workbench: Diachronic's and Scribes' "rank by
significance" options, Morphology's edge bias (edge slot vs interior
windows), Positional Grammar's position bias (a word's dominant slot vs
the corpus-wide slot baseline), and the N-grams bigram G² column. In all
of these the χ² reference thresholds (3.84 ≈ p<.05, 6.63 ≈ p<.01,
10.83 ≈ p<.001) are shown as guidance, not as formal hypothesis tests —
with hundreds of items per view, treat them as a ranking aid and apply
your own multiple-comparison caution.

### Raw count

`f(a, b)`. Useful as a sanity check but biased toward pairs involving
high-frequency words.

### Chi-squared with Yates correction

The standard test of independence on the 2×2 contingency table:

```
                  has b              no b
   has a    |  f(a, b)         |  f(a) - f(a, b)
   no  a    |  f(b) - f(a, b)  |  N - f(a) - f(b) + f(a, b)
```

With the Yates continuity correction (subtract ½ from the absolute
deviation before squaring, clamped at 0 so a within-half-a-count deviation
yields χ² = 0 rather than a small spurious positive) to reduce
over-rejection at small expected counts:

```
χ² = N · max(0, |a₁₁·a₂₂ - a₁₂·a₂₁| - N/2)² / (f(a) · f(b) · (N - f(a)) · (N - f(b)))
```

p-value computed from the χ² distribution with 1 degree of freedom:
`P(X² ≥ x) = erfc(√(x/2))`. The `erf` is approximated via the
Abramowitz & Stegun 7.1.26 polynomial (accuracy ~1.5 × 10⁻⁷).

### Bonferroni correction

With thousands of pairs being tested at once, raw p-values vastly
overstate significance. The Bonferroni-corrected p multiplies the raw p
by the total number of tests (clamped at 1), controlling the family-wise
error rate — the probability of any false positive across the entire
test family. Enabled by default in the Co-occurrence UI. Conservative
relative to FDR-based methods (Benjamini-Hochberg) but unambiguous and
trivial to compute.

### Fisher's exact (two-sided)

Sums the hypergeometric probabilities of all 2×2 tables with the same
marginals whose probability is ≤ the observed table's:

```
p(k) = C(f(a), k) · C(N - f(a), f(b) - k) / C(N, f(b))
```

For each k in `[max(0, f(a) + f(b) - N), min(f(a), f(b))]`. The
hypergeometric coefficients are computed in log-space using a Lanczos
approximation of the log-gamma function to avoid overflow at large N.

Fisher's is the gold standard for individual 2×2 tables, especially
when expected counts are small (≤ 5) where the χ² approximation
breaks down. It is O(N) per pair, so the Co-occurrence module computes
it only on demand (the `F` button per row).

### Min-joint threshold

The module's `min joint count` slider filters pairs with `f(a, b) < N`.
Higher thresholds give more reliable estimates but fewer pairs.

### Wilson-score PMI confidence interval

Toggling the **95% CI** checkbox displays bounds on each pair's PMI
computed by Wilson-score interval on the joint probability:

```
p̂ = joint / N
denom = 1 + z²/N
center = (p̂ + z²/(2N)) / denom
half   = (z / denom) · √( p̂(1-p̂)/N + z²/(4N²) )
[p_low, p_high] = [center - half, center + half]    (z = 1.96 for 95%)
```

These bounds are propagated into PMI by holding the marginals f(a) and
f(b) fixed:

```
PMI_low  = log₂(p_low  / (p(a) · p(b)))
PMI_high = log₂(p_high / (p(a) · p(b)))
```

The Wilson interval is preferred over the textbook
`p̂ ± z·√(p̂(1-p̂)/n)` because it stays inside [0, 1] and has good
coverage at small joint counts. The PMI lower bound is clamped at −20
(in log₂ space) when the Wilson lower bound on the joint probability
hits zero.

**Implementation**: `chiSquared2x2`, `chiSquaredPValue`, `fishersExact`,
`wilsonInterval`, `pmiInterval` in
[`src/lib/algorithms.ts`](../src/lib/algorithms.ts); UI in
[`src/modules/Cooccurrence.tsx`](../src/modules/Cooccurrence.tsx).

## Scribal Network

The Scribal Network view (the **Scribes › Network** tab) visualizes which
scribes share sign vocabularies via force-directed layout:

1. **Profile** each scribe by their set of distinct signs across all
   their inscriptions (using the normalized sign labels from the sign
   inventory).
2. **Filter** to scribes with ≥ `minCount` inscriptions (default 5) —
   small-sample profiles are too noisy to network.
3. **Pairwise Jaccard** over those scribes' sign vocabularies:
   `J(A, B) = |signs(A) ∩ signs(B)| / |signs(A) ∪ signs(B)|`.
4. **Edge keep-rule**: include the edge if `J ≥ minJaccard` (default 0.35).
5. **Force-directed layout**: same physics as the Co-occurrence Network
   (repulsion + spring attraction along edges + central pull + damping).
   Edge spring strength scales with Jaccard weight.

Node color encodes the scribe's primary find-site; size encodes
inscription count.

**Limitations**:
- Vocabulary similarity is necessary but not sufficient evidence for
  shared scribal identity. Two scribes might share a vocabulary because
  they wrote about the same subjects.
- The Jaccard is over the set of distinct signs, not weighted by
  frequency. For per-sign frequency comparison (the more diagnostic
  view), use the pairwise Scribe Comparison view (**Scribes › Comparison**).

**Implementation**: [`ScribeNetwork.tsx`](../src/modules/ScribeNetwork.tsx).

## Inscription similarity

The Similarity module ranks inscriptions by similarity to a chosen pivot
using **sequence-level Levenshtein** over multi-sign word tokens:

```
similarity = 1 - editDistance(pivot_words, candidate_words) /
             max(|pivot_words|, |candidate_words|, 1)
```

Two modes:

- **Exact tokens**: words match only on identical transliteration.
  `KU-RO ≠ KU-RA`.
- **Consonant skeleton (fuzzy)**: every word is first transformed via the
  consonant-skeleton extractor (vowels stripped from phonetic form), so
  `KU-RO` and `KA-RA` both reduce to `kr` and count as matches. Surfaces
  morphological cousins and lexical families.

The skeleton mode respects the active Sound Shift hypothesis: changing
a sign's reading affects which words reduce to the same skeleton.

Restricted to inscriptions with at least `min words` multi-sign tokens
(default 3) to filter out short fragments where similarity scores are
unstable.

**Implementation**: [`sequenceDistance`](../src/lib/algorithms.ts) and
[`Similarity.tsx`](../src/modules/Similarity.tsx).

## Interlinear alignment (Compare Inscriptions)

The Compare Inscriptions interlinear view aligns the word sequences of 2–4
inscriptions into a single column-per-tablet table so that shared words sit on
the same row. It uses **progressive multiple-sequence alignment** over word
tokens:

1. Seed the alignment with the first inscription's word sequence (one column
   per position).
2. Add each remaining inscription with a **Needleman–Wunsch** global alignment
   against the current profile. The cell score is `+2` when the incoming word
   equals the position's representative token (its first non-gap word), `0` for
   a substitution (different words sharing a slot), and `−1` per inserted or
   deleted gap. Back-tracing yields a new profile with the inscription folded
   in — matching words share a row, divergences become substitution columns,
   and missing words become gaps (`·`).

Tokens are compared on exact transliteration (including numerals, ideograms,
and the separator `𐄁`), so the alignment surfaces the shared formulaic
backbone of e.g. libation tables while showing where individual tablets depart
from it. A row in which a single token occupies ≥2 columns is flagged as a
match. This is a heuristic visualization — progressive alignment is order- and
repeat-sensitive and not guaranteed globally optimal beyond the pairwise case —
not a claim about textual descent.

**Implementation**: `alignSequences` in
[`compareAlign.ts`](../src/lib/compareAlign.ts).

## Stem families (heuristic morphological clustering)

The Stem Families module groups multi-sign words that appear to share a
stem and differ only by a *productive* suffix — one attested across many
distinct corpus words. The output is a set of candidate morphological
families, not lemmas in the strict sense, because Linear A's grammar is
unknown.

Algorithm in [`findMorphologicalClusters`](../src/lib/algorithms.ts):

1. **Suffix productivity tally.** For every multi-sign word, generate
   suffixes of length 1 … `maxSuffixLen` signs. Record the set of
   distinct words ending in each suffix.
2. **Productive suffixes.** Keep only suffixes attested across at least
   `minSuffixProductivity` distinct words (default 5).
3. **Stem-suffix links.** For every word `W` and every productive suffix
   `S` it ends with, check whether `W − S` (the prefix part) is itself
   attested as a corpus word. If so, link `W ↔ W − S` in a Union-Find
   data structure. Path compression and union-by-size keep this near
   O(α(N)).
4. **Connected components.** Each component is reported as a "stem
   family." The shortest member (fewest signs) is treated as the
   candidate stem; ties broken by highest attestation count.
5. **Suffix attribution.** For each non-stem member, the difference
   between its sign sequence and the stem's is reported as that member's
   suffix. If the link came transitively and the member doesn't literally
   prefix-extend the stem, the suffix is flagged as `≠` to indicate
   indirect membership.

**What this catches**: pairs like `DA-RU` / `DA-RU-MA` where `-MA` is
attested across many other words, or `KI-NA` / `KI-NA-SI` / `KI-NA-TE`
where multiple productive endings stack on the same stem.

**What this doesn't catch**: morphological pairs where the shorter form
isn't separately attested, or where the suffix is rare. Also doesn't
distinguish inflection from derivation from phonological accident.

**Tuning**:
- `minSuffixProductivity` (default 5): raise for stricter families with
  fewer members but higher confidence.
- `minClusterSize` (default 2): minimum members to report a family.
- `maxSuffixLen` (default 2): in signs. Higher allows multi-sign
  suffixes like `-RA-NA`.

**Compared to Root Cognates**: Root Cognates groups by vowel-stripped
consonant skeleton (very fuzzy, language-agnostic). Stem Families
requires both the stem and the suffix to be empirically attested in the
corpus, so it has fewer false positives at the cost of missing pairs
where the shorter stem doesn't appear standalone.

## Consonant-skeleton roots

The Root Cognates module groups words by their consonant skeleton —
their phonetic form with all vowels removed:

```
root("KU-RO") = "kr"
root("KA-RA-NA") = "krn"
```

Skeletons of length ≥2 are retained; shorter ones discard too many words
to be useful. Words sharing a skeleton (≥2 distinct words per root) form
a candidate "morphological family."

**Caveats**:
- Skeleton-collision rates are high for short words; many "families" are
  coincidental.
- The method assumes the linguistic root is consonantal (a reasonable
  prior for Semitic and Indo-European languages, but not universal).

**Implementation**: [`extractRoot`](../src/lib/algorithms.ts).

## Sign pattern matching (wildcards)

The Sign Patterns module (and the `word contains pattern` field in Query
Builder) implements a small wildcard matcher over normalized sign sequences.
Patterns are tokenized on `-` like regular Linear A transliterations, with
two reserved tokens:

- `*` — matches exactly one sign of any identity.
- `**` — matches zero or more signs (greedy, with backtracking).

Examples:

```
KU-*-RO       matches three-sign words starting KU- and ending -RO
JA-**         matches any word starting with JA (length ≥ 1)
**-RO-**      matches any word containing RO at any position
**            matches every multi-sign word in the corpus
```

The matcher is a hand-rolled recursive descent (no regex compilation) so
the algorithmic cost stays predictable: `O(|word| × |pattern|)` worst-case
per match, with the `**` branch using prefix-length enumeration bounded by
remaining word length to avoid runaway recursion.

Sign labels on both sides are normalized through the same
`normalizeSignLabel` helper used elsewhere (`RA₂` → `RA2`,
case-insensitive on alphabetic portions) so patterns written in any
casing or with Unicode subscripts still match the canonical store.

**Implementation**: [`signPattern.ts`](../src/lib/signPattern.ts).

## Sequence pattern tokenization

The Sequence Patterns module tokenizes each inscription into a sequence
of structural types:

| Token | Type | Meaning |
|-------|------|---------|
| `W` | word | Multi-sign syllabic word |
| `N` | number | Aegean numeral |
| `T` | total | The word `KU-RO` (proposed total marker) |
| `I` | ideogram | Known commodity ideogram (`OLE`, `GRA`, `VIN`, `FIC`, `AES`, `AUR`, `ARG`) |
| `S` | separator | The Linear A separator `𐄁` |

It then extracts all contiguous sub-sequences of length 2–6 with at
least 3 attestations, filtering out pure-`W` patterns (uninformative).
Surfaces formulaic templates without committing to specific words.

## Tablet structure classification

The Tablet Structure module assigns each inscription to one of five
heuristic categories:

| Category | Trigger |
|---|---|
| **Accounting** | Contains `KU-RO`, OR contains numerals AND more than 2 multi-sign words |
| **Libation** | Contains any of `{A-TA-I-*301-WA-JA, JA-SA-SA-RA-ME, A-DI-KI-TE-TE-DU}` (well-known libation-formula words) |
| **Lists** | More than 3 separator marks (`𐄁`) and no numerals |
| **Text / Other** | More than 4 multi-sign words and no numerals (and not libation) |
| **Unclassified** | Anything else (typically short or ambiguous) |

These are pragmatic heuristics, not a trained classifier. Edge cases:
inscriptions with both accounting and libation features get classified as
accounting (KU-RO is checked first). Misclassifications are expected.

## Accounting & metrology (total verification)

The Accounting module parses numeric values out of the token stream and
checks tablet arithmetic.

**Numeral parsing** ([`src/lib/numerals.ts`](../src/lib/numerals.ts)):
the upstream transcription already renders Linear A decimal numerals as
ordinary integers (`197`) and the metrological fractions as Unicode
built-up fractions — superscript numerator + U+2044 fraction slash +
subscript denominator, e.g. `³⁄₄`. `parseValue` handles integers,
built-up fractions (mapping super/subscript digit ranges), and a fallback
table of precomposed vulgar fractions (½ ¼ ¾ …). A line's quantity is the
sum of its numeric tokens, so an integer followed by a fraction token
(`5`, `³⁄₄`) naturally combines to 5.75.

**Line roles**: each physical line of the tablet (from the new `lines`
field in the corpus) is tagged as `header` (no number), `item`,
`total` (contains `KU-RO`), `grand-total` (`PO-TO-KU-RO`), or `deficit`
(`KI-RO`). These markers are among the most secure lexical
identifications in Linear A scholarship.

**Balance check**: walking the lines top to bottom, item-line values
accumulate into a running sum; when a total line is reached, the running
sum is compared against the total's stated value and the running sum
resets. Deficit (`KI-RO`) and header lines are excluded. A tablet
"balances" when computed sum equals stated total within 1e-6.

**Caveats**: section boundaries are heuristic (reset at each total), so
tablets with interleaved sub-totals, multi-column layouts, or damaged
readings may not parse cleanly — the itemized view exposes the parse for
inspection. Discrepancies are not necessarily tool errors: many are
genuine scribal mistakes or reflect unresolved questions about the
fraction system.

## Lexical statistics

The Lexical Statistics module reports standard vocabulary measures over the
multi-sign words:

- **Type–token ratio** = distinct words / total word occurrences.
- **Frequency spectrum** = for each frequency *n*, the number of words
  occurring exactly *n* times. The *n*=1 value is the hapax legomena count.
- **Zipf rank–frequency curve**: words ranked by descending frequency,
  plotted on log₁₀(rank) vs log₁₀(frequency) axes. A dashed reference line
  shows the ideal Zipf relation (frequency ∝ 1/rank, anchored at the
  top-frequency word). Zipfian corpora plot as a roughly straight line
  parallel to the reference.

These are descriptive, not inferential — no curve fitting or goodness-of-fit
test is computed; the plots are for visual assessment. A high hapax fraction
is expected both for small corpora and for proper-name-rich administrative
texts, so it does not by itself indicate non-linguistic structure.

**Implementation**: [`LexicalStats.tsx`](../src/modules/LexicalStats.tsx).

## Sign transitions (graphotactics)

The Sign Transitions module builds a first-order transition model over the
signs of multi-sign words. For each word (split into normalized sign
labels) and each adjacent pair `a → b`, the transition count is incremented
by the word's attestation count — so the model reflects token frequency,
not just type frequency. Word-initial and word-final sign tallies are kept
alongside, and example words are recorded per transition.

Reported statistics:
- **Attested transitions**: distinct ordered `a → b` pairs that occur.
- **Matrix density**: attested transitions / signs², i.e. the fraction of
  the full transition space that is actually used. Linear A's is low —
  most sign pairs never occur adjacently, which is itself a structural
  signal (syllable-shape constraints, edge-restricted signs).

The heatmap shows the top signs by frequency with log-scaled cell shading;
the inspector gives the full ranked outgoing/incoming distributions for any
sign. This is graphotactics (sign-sequence structure) rather than
phonotactics, since the phonetic values of many signs are unknown.

**Implementation**: [`SignTransitions.tsx`](../src/modules/SignTransitions.tsx).

## Scribe sign-frequency comparison

The Scribe Comparison view (the **Scribes › Comparison** tab) profiles each
scribe's sign-usage frequencies and supports pairwise comparison. The output is a
quantitative proxy for paleography — useful for surfacing candidate
scribal-style relationships — but does **not** analyze sign shape (the
SigLA project owns that territory; the workbench links out to it per inscription).

For each scribe S:

1. Collect all multi-sign words across S's inscriptions.
2. Tokenize each word into individual signs, normalized to SigLA-style
   labels (e.g. `RA₂` → `RA2`).
3. Tally per-sign occurrence counts: `signCounts[S][sign] = ...` and the
   total sign-token count `T[S]`.

For pairwise comparison between scribe A and either another scribe B or
the corpus-wide baseline, two measures are reported:

- **Jaccard overlap** of sign vocabularies: `|signs(A) ∩ signs(B)| / |signs(A) ∪ signs(B)|`.
  Captures whether the two scribes drew on the same sign repertoire at all.
- **Per-sign log-ratio of relative frequencies** with add-one smoothing:

  ```
  f̃(sign | X) = (count(sign, X) + 1) / (T[X] + |V|) · 1000
  log-ratio(sign) = log₂(f̃(sign | A) / f̃(sign | B))
  ```

  where `|V|` is the size of the union vocabulary. Smoothing avoids
  log-of-zero blowups when one scribe never uses a given sign. The
  "Most distinctive signs" view ranks by `|log-ratio|`.

The result distinguishes signs A *over-uses* (positive log-ratio,
green) from signs A *under-uses* (negative log-ratio, amber) relative
to the comparison side.

**Limitations**:
- Frequency similarity is necessary but not sufficient evidence for
  shared scribal identity or training — two scribes might share a
  vocabulary because they wrote about the same subjects.
- Small-sample scribes (≤ 2–3 inscriptions) have unstable profiles. The
  module reports raw counts in the bar tooltips so you can spot when
  the apparent divergence is driven by a single inscription.
- This is **not** sign-shape paleography. For per-scribe drawings of
  variant sign forms, follow the `Paleography ↗` link to SigLA.

**Implementation**: [`ScribeComparison.tsx`](../src/modules/ScribeComparison.tsx).

## Site distribution (Jaccard)

The Site Distribution view (the **Geography › Site distribution** tab) computes
pairwise Jaccard similarity over the multi-sign-word vocabulary of the top 10
sites:

```
J(A, B) = |words(A) ∩ words(B)| / |words(A) ∪ words(B)|
```

High Jaccard means two sites share most of their vocabulary; low Jaccard
means the vocabularies are largely disjoint. Useful for spotting
administrative networks vs. peripheral local traditions.

## Commentary archive index

The Commentary Browser module reads from a slim search index built at
`npm run commentary:index` time by
[`scripts/build-commentary-index.mjs`](../scripts/build-commentary-index.mjs).
The script walks every `*.html` file in
`public/upstream/commentary/` (1,694 docs in the current bundle —
Younger's pre-2024 KU-era archive mirrored via mwenge/lineara.xyz),
parses each filename into a structured id, strips the HTML to plain text,
and emits a single `public/corpus/commentary-index.json` (~558 KB).

Filename parser:

```
[site code: 2–4 uppercase letters][optional type code: Uppercase+lowercase][num]
e.g. HTWa1001 → { site: "HT", type: "Wa", num: 1001 }
     ARKHZc8  → { site: "ARKH", type: "Zc", num: 8 }
     HT1      → { site: "HT", type: null, num: 1 }
```

The parser is careful about a wrinkle: a greedy `/^[A-Z]+/` would swallow
the type marker's first letter (HTWa → "HTW"), so it peels back one
uppercase letter when the next char is lowercase. Misc files with no
leading uppercase (e.g. `16.html`, `2.html`) bucket under site `?`.

Text extraction is regex-based tag-stripping (no HTML parser dependency)
plus a handful of entity decodes (`&nbsp;`, `&amp;`, etc.) and whitespace
collapse, capped at 4,000 chars per doc. The total indexed text is
~410 KB across all 1,694 docs, well within the bundle budget.

Full-text search at runtime is a straightforward substring count of the
query against each doc's lowercased text — matches are ranked by hit
count, no inverted index or stemming. The cost stays acceptable because
the index loads once and stays in memory; even un-optimized,
`indexOf`-based search across 1,694 short strings completes in single-digit
milliseconds on modern hardware.

This is a **data presentation surface**, not an analytical method — the
algorithm content is in the parser and the in-memory search, both of which
are intentionally simple.

## Comparison wordlist provenance

The nine reference-language wordlists in
[`src/data/languages.ts`](../src/data/languages.ts) are **editorial
collections** (≈ 340 entries total) of common, well-attested vocabulary
compiled from standard introductory grammars and dictionaries. They cover
religion, administration, kinship, body parts, agriculture, vessels,
commodities, animals, numbers, basic verbs, and toponyms. They are not
exhaustive and have **not been peer-reviewed by specialists** in each
language — treat matches as illustrative leads, not evidence.

**Mycenaean Greek (Linear B) is the best-calibrated set.** Because the
workbench reads Linear A using Linear B sign values, a Linear A phonetic
form and a Mycenaean Greek word are expressed in the *same* syllabic
values — so their comparison is genuinely apples-to-apples, unlike the
others where the phonetic systems differ. Mycenaean entries are stored in
the conventional hyphenated transliteration (`wa-na-ka`); the comparison
key strips the hyphens to match the Linear A side (`wanaka`), exactly as
`wordToPhonetic` concatenates Linear A syllables.

Sources consulted:

- **Mycenaean Greek (Linear B)**: Ventris & Chadwick, *Documents in
  Mycenaean Greek* (2nd ed., 1973); Aura Jorro, *Diccionario Micénico*.
- **Akkadian**: Huehnergard, *A Grammar of Akkadian* (3rd ed., 2011); CAD.
- **Hittite**: Hoffner & Melchert, *A Grammar of the Hittite Language* (2008).
- **Luwian**: Melchert, *The Luwians* (2003); CLL.
- **Hurrian**: Wegner, *Einführung in die hurritische Sprache* (2007).
- **Ugaritic**: Bordreuil & Pardee, *A Manual of Ugaritic* (2009); DULAT.
- **Pre-Greek**: Beekes, *Etymological Dictionary of Greek* (2010);
  Furnée, *Die wichtigsten konsonantischen Erscheinungen des
  Vorgriechischen* (1972).
- **Proto-Indo-European**: Fortson, *Indo-European Language and Culture*
  (2nd ed., 2010); LIV², NIL.
- **Egyptian**: Allen, *Middle Egyptian* (3rd ed., 2014); Faulkner,
  *Concise Dictionary of Middle Egyptian* (1962).

The Wordlist Manager module supports uploading custom wordlists in JSON
or CSV format for ad-hoc comparison against any reference vocabulary.

## Known limitations

- **No paleography.** The workbench uses Unicode-block glyphs, which are
  idealized forms. Per-scribe sign variants and hand-tracing analysis are
  not supported; use [SigLA](https://sigla.phis.me) for paleographic work.
- **No lemmatization.** Linear A is undeciphered so true lemmas are
  unknown; the workbench approximates with consonant-skeleton families.
  This conflates true cognates with phonological collisions.
- **Comparison wordlists are illustrative.** See the provenance note
  above; the lists are not authoritative editions.
- **Phonetic distance is heuristic.** The weights encode general
  typological intuitions, not validated sound correspondences for any
  specific language family pairing.
- **Sign mapping reflects clean alignments only.** Inscriptions with
  damaged transcriptions don't contribute to the mapping, even though
  they are still searchable and analyzable elsewhere in the workbench.
- **Statistical significance** is reported via Yates-corrected χ² +
  p-values, optional Bonferroni correction, on-demand Fisher's exact,
  and a small-N warning glyph on pairs whose joint count ≤ 5 (where the
  χ² normal approximation breaks down). Wilson-score 95% confidence
  intervals on PMI are available via a toggle. Confidence intervals on
  G² are not yet computed.
- **Numeral parsing is partial.** The Accounting & Metrology module parses
  decimal integers and the common metrological fractions and verifies
  KU-RO / PO-TO-KU-RO sums (see that section). Rarer or compound fraction
  signs and damaged numerals may not parse; the sequence-pattern tokenizer
  still treats numerals as opaque `N` symbols.
- **Linear B is a comparison wordlist, not a loaded corpus.** Mycenaean
  Greek is included as a reference language for the comparator, but the
  workbench does not load the full Linear B tablet corpus (see DAMOS for
  that); the tool stays focused on Linear A.

If any of these limitations is a blocker for your research, please open
an issue — most are addressable with focused work.
