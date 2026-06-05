# Contributing

Thanks for taking an interest. Linear A is an undeciphered script — every
honest improvement to this workbench is welcome, especially around the
parts where domain expertise meets software craft.

## Quickstart

```bash
git clone https://github.com/<you>/linear-a-workbench.git
cd linear-a-workbench
npm install
npm run dev      # http://localhost:5173
```

To work with the inscription images and commentary locally:

```bash
npm run assets:fetch    # ~10–20 min, ~500 MB
```

## Code style

- TypeScript everywhere. The project type-checks cleanly on every commit;
  don't break that (`npm run typecheck`).
- React with hooks. No class components.
- Zustand for shared state. No Redux, no Context-as-state.
- Plain CSS with design tokens defined in [`src/styles.css`](src/styles.css).
  No Tailwind, no styled-components.
- One module per analysis panel in `src/modules/`. Lazy-loaded.
- Keep dependencies minimal — React, Zustand, Vite are the entire runtime
  stack and I intend to keep it that way.

## Where contributions are most welcome

- **Comparison wordlists** — if you read Akkadian, Hittite, Hurrian, Luwian,
  Ugaritic, Egyptian, or Proto-Indo-European at scholarly level, the lists
  in [`src/data/languages.ts`](src/data/languages.ts) could use your eye.
  Open an issue first to coordinate.
- **Sign mapping refinements** — the GORILA→Unicode glyph mapping is
  derived empirically from corpus alignment; corrections welcome.
- **Bug reports** — especially around the cross-linguistic comparator's
  phonetic distance heuristic, the PMI/log-likelihood collocation math,
  the alignment matrix display, or the sign concordance position counts.
- **Accessibility** — keyboard navigation, screen-reader labels, color
  contrast in tables. Always under-served.
- **New analysis modules** — if you have a quantitative method that would
  benefit Linear A research, propose it via issue first.

## What this project is NOT

- **Not a decipherment claim.** I make no editorial assertions about what
  Linear A actually means. The tools are exploratory.
- **Not a substitute for John Younger's scholarly database** or the GORILA
  publications. Both are cited prominently because both are authoritative.
- **Not paleographic.** The workbench uses idealized Unicode glyphs, not
  per-scribe variant drawings. If you need paleography, see SigLA.

## Pull request checklist

- [ ] Typecheck passes (`npm run typecheck`)
- [ ] Production build succeeds (`npm run build`)
- [ ] If you added data, cite the source in the same commit
- [ ] If you changed the corpus build script, regenerate the corpus and
      include both `inscriptions.json` and `signs.json` in the PR
- [ ] No personal config or local-only paths in the diff

## Issues

Use the templates. Reproductions and screenshots help. For data
disagreements (e.g. "I think KU-RO should map to glyph X, not Y"), please
include the inscriptions that motivate your reading.

