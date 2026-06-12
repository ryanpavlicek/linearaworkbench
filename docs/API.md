# Static data API

The deployed site publishes the corpus as static JSON at stable URLs — the
same enriched export the in-app **Data Export › Full corpus JSON** button
builds, regenerated on every deploy. No server, no keys, no rate limits
beyond GitHub Pages itself; `curl` it, load it in pandas, cache it freely.

Base URL: `https://ryanpavlicek.github.io/linearaworkbench/api/v1/`

| Path | Contents |
| --- | --- |
| `api/v1/corpus.json` | The full corpus in export schema v1: every inscription with canonical metadata, the flat word sequence and physical lines, glyphs, and the workbench's derived analyses (tablet-structure category, KU-RO accounting balance where parseable, multi-sign word count) — plus the sign inventory and corpus-wide word frequencies. `_meta` carries provenance, the schema version, and field notes. |
| `api/v1/inscriptions/<file>` | One JSON per inscription, same shape as the entries in `corpus.json`. |
| `api/v1/index.json` | The manifest: schema version, inscription count, and the id → filename map (most ids are their own filename; the map is authoritative for the few that need sanitizing). |

## Stability

The schema is versioned (`_meta.schemaVersion`, currently 1) and `/v1/` is
frozen: fields may be added, never removed or repurposed. A breaking change
would ship as `/api/v2/` with `/v1/` left in place. The `_meta.notes` array
in `corpus.json` documents the field semantics; the methodology behind the
derived blocks is [docs/METHODOLOGY.md](METHODOLOGY.md).

## Examples

One tablet:

```bash
curl -s https://ryanpavlicek.github.io/linearaworkbench/api/v1/inscriptions/HT13.json | jq '.derived.balance'
```

Word frequencies into pandas:

```python
import pandas as pd, requests

corpus = requests.get(
    "https://ryanpavlicek.github.io/linearaworkbench/api/v1/corpus.json"
).json()
words = pd.DataFrame(corpus["wordFrequencies"])
print(words.head())
```

Every inscription id:

```bash
curl -s https://ryanpavlicek.github.io/linearaworkbench/api/v1/index.json | jq '.files | keys | length'
```

If you'd rather work against the raw upstream-shaped data the app itself
loads, `corpus/inscriptions.json` and `corpus/signs.json` are also served —
but they are an internal format and may change without a version bump; the
`api/v1/` surface is the stable one.

Cite the data, not just the tool: the corpus derives from GORILA (Godart &
Olivier 1976–1985) via [mwenge/lineara.xyz](https://github.com/mwenge/lineara.xyz);
the in-app Research Report's Citation block emits ready-made entries for
both, and `_meta.corpusSource` repeats the provenance in every export.
