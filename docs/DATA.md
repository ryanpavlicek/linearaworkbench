# Data contracts

What this repo publishes that other software depends on — currently
[pyaegean](https://github.com/ryanpavlicek/pyaegean), which bundles the same
corpus and fetches the imagery and app assets from this repo's releases.
Anything listed here changes deliberately, never casually.

## The corpus files (`public/corpus/`)

| File | Contents |
| --- | --- |
| `inscriptions.json` | 1,721 entries, the app's internal shape (16 fields incl. image references). Rebuilt by `npm run corpus:build` from the pinned upstream snapshot (`scripts/upstream.mjs`). |
| `signs.json` | The empirically derived sign → glyph mapping with confidence scores. |
| `commentary-index.json` | Full-text index over the bundled commentary mirror. |
| `manifest.json` | **The cross-project contract**: upstream repo + commit, counts, and `paritySha256` — a checksum over the canonical 12-field projection (`parityFields`) that pyaegean's bundled copy shares. |

Both projects recompute the parity checksum from their own data in CI and
compare it to `manifest.json` (here: `src/lib/corpusManifest.test.ts`), so
silent drift fails the build on whichever side drifted. The stable,
documented public surface for *consumers* is the deployed
[static API](API.md) (`api/v1/`), not these internal files.

## Release assets (immutable)

pyaegean pins each asset's **URL and sha256**, so a published asset is never
replaced in place — new content ships under a bumped tag and gets re-pinned
downstream. Both workflows refuse to overwrite an existing release and build
their tarballs deterministically (sorted entries, zeroed owner/mtime,
`gzip -n`), so identical input bytes always produce an identical checksum.

| Tag pattern | Asset | Built by | Contents |
| --- | --- | --- | --- |
| `lineara-images-v<N>` | `lineara-images.tar.gz` | `release-images.yml` | `public/upstream/images/` — the facsimile/photograph mirror (© École Française d'Athènes; academic reference only). Fetched by `aegean.data.fetch("lineara-images")`. |
| `workbench-app-v<semver>` | `workbench-app.tar.gz` | `release-app.yml` | The built app (relative base, self-hosted fonts, corpus + commentary + static API included; the images and papers mirrors excluded — pyaegean serves the imagery from its own cached `lineara-images` asset at `upstream/images/`). |

## The parity fixtures

The expected values in `src/lib/algorithms.test.ts` and
`src/lib/compareAlign.test.ts` are extracted into pyaegean's golden fixtures
(`tests/fixtures/golden/`), so its Python ports can never silently diverge
from this implementation. Changing an expected value here is a cross-project
event: re-extract the fixtures there in the same change.
