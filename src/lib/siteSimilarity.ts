// Shared-vocabulary similarity between find-sites: Jaccard overlap of the
// multi-sign words attested at each site. One implementation feeds both the
// Site Distribution table and the Findspot Map's site-links arcs, so the
// two views can't disagree on a number.

export interface SitePairSimilarity {
  a: string;
  b: string;
  sim: number; // Jaccard: |A ∩ B| / |A ∪ B|
  shared: number; // |A ∩ B|
}

/** Per-site sets of multi-sign words, from the corpus word index. */
export function siteWordSets(
  wordIndex: Map<string, { sites: Set<string> }>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [w, e] of wordIndex) {
    if (!w.includes("-")) continue;
    for (const s of e.sites) {
      let set = map.get(s);
      if (!set) {
        set = new Set();
        map.set(s, set);
      }
      set.add(w);
    }
  }
  return map;
}

/**
 * Jaccard similarity for every pair among `sites` (or every site in the
 * index when omitted), sorted by similarity descending. Pairs where both
 * sites are vocabulary-less are dropped (Jaccard is undefined); pairs that
 * merely share nothing stay, at similarity 0 — callers filter as needed.
 */
export function siteSimilarities(
  wordIndex: Map<string, { sites: Set<string> }>,
  sites?: string[],
): SitePairSimilarity[] {
  const vocab = siteWordSets(wordIndex);
  const names = sites ?? [...vocab.keys()];
  const out: SitePairSimilarity[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = vocab.get(names[i]) ?? new Set<string>();
      const b = vocab.get(names[j]) ?? new Set<string>();
      let shared = 0;
      for (const w of a) if (b.has(w)) shared++;
      const union = a.size + b.size - shared;
      if (union === 0) continue;
      out.push({ a: names[i], b: names[j], sim: shared / union, shared });
    }
  }
  out.sort((x, y) => y.sim - x.sim);
  return out;
}
