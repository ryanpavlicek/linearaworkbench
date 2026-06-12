// The single source of truth for which upstream snapshot the bundled corpus
// reflects. fetch-corpus.mjs downloads exactly this commit; build-corpus.mjs
// stamps it into public/corpus/manifest.json. Bumping upstream = change the
// SHA here, re-run corpus:fetch, and review the diff.
export const UPSTREAM_REPO = "mwenge/lineara.xyz";
export const UPSTREAM_SHA = "568f452c7a5ec80fa292cb307ead2fc6f65d07fb"; // 2025-11-12
