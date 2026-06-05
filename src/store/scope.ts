import { useMemo } from "react";
import { useWorkbench, buildIndex, type CorpusIndex } from "./workbench";
import type { CorpusScope, Inscription } from "../lib/types";
import type { MultiWordEntry } from "../lib/helpers";

// ── Global corpus scope ────────────────────────────────────────────────────
// A workbench-wide filter restricting which inscriptions the analysis modules
// see. The full corpus index is built once at load; when a scope is active we
// rebuild a smaller index over the filtered inscriptions (memoized, so it only
// recomputes when the scope or corpus actually changes). When no scope is
// active we hand back the full index unchanged — zero cost.

export function isScopeActive(scope: CorpusScope): boolean {
  return (
    scope.site !== null ||
    scope.period !== null ||
    scope.scribe !== null ||
    scope.support !== null ||
    scope.collectionId !== null
  );
}

/** Stable string key for memoization. */
function scopeKey(scope: CorpusScope): string {
  return [
    scope.site,
    scope.period,
    scope.scribe,
    scope.support,
    scope.collectionId,
  ].join("§");
}

/** Does an inscription pass the active scope? */
function matches(
  ins: Inscription,
  scope: CorpusScope,
  collectionIds: Set<string> | null,
): boolean {
  if (scope.site !== null && ins.site !== scope.site) return false;
  if (scope.period !== null && ins.context !== scope.period) return false;
  if (scope.scribe !== null && ins.scribe !== scope.scribe) return false;
  if (scope.support !== null && ins.support !== scope.support) return false;
  if (collectionIds !== null && !collectionIds.has(ins.id)) return false;
  return true;
}

/**
 * The corpus index the analysis modules should read. Identical to the full
 * `corpus` when no scope is active; otherwise a freshly built index over the
 * inscriptions that pass the scope. The signary (`signs`) is always the full
 * corpus signary — its attestation counts are precomputed over the whole
 * alignment and aren't re-derived per scope.
 */
export function useScopedCorpus(): CorpusIndex {
  const corpus = useWorkbench((s) => s.corpus);
  const scope = useWorkbench((s) => s.scope);
  const collections = useWorkbench((s) => s.collections);

  const key = scopeKey(scope);

  return useMemo(() => {
    if (!isScopeActive(scope)) return corpus;
    let collectionIds: Set<string> | null = null;
    if (scope.collectionId !== null) {
      const c = collections.find((c) => c.id === scope.collectionId);
      collectionIds = new Set(
        (c?.items ?? [])
          .filter((it) => it.kind === "inscription")
          .map((it) => it.value),
      );
    }
    const filtered = corpus.inscriptions.filter((ins) =>
      matches(ins, scope, collectionIds),
    );
    return buildIndex(filtered, corpus.signs);
    // `key` captures every scope field; `collections` matters only when a
    // collection is scoped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpus, key, collections]);
}

/** Multi-sign words within the active scope, sorted by count desc. */
export function useScopedMultiWords(): MultiWordEntry[] {
  const { wordIndex } = useScopedCorpus();
  return useMemo(() => {
    const list: MultiWordEntry[] = [];
    for (const [word, entry] of wordIndex) {
      if (word.includes("-")) list.push({ word, entry });
    }
    list.sort((a, b) => b.entry.count - a.entry.count);
    return list;
  }, [wordIndex]);
}

export interface ScopeOptions {
  sites: string[];
  periods: string[];
  scribes: string[];
  supports: string[];
}

/** Distinct, sorted values for each scope dimension across the full corpus. */
export function useScopeOptions(): ScopeOptions {
  const inscriptions = useWorkbench((s) => s.corpus.inscriptions);
  return useMemo(() => {
    const sites = new Set<string>();
    const periods = new Set<string>();
    const scribes = new Set<string>();
    const supports = new Set<string>();
    for (const ins of inscriptions) {
      if (ins.site) sites.add(ins.site);
      if (ins.context) periods.add(ins.context);
      if (ins.scribe) scribes.add(ins.scribe);
      if (ins.support) supports.add(ins.support);
    }
    const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
    return {
      sites: sort(sites),
      periods: sort(periods),
      scribes: sort(scribes),
      supports: sort(supports),
    };
  }, [inscriptions]);
}

/** Short human-readable summary of the active scope (for chips / labels). */
export function scopeSummary(scope: CorpusScope): string {
  const parts: string[] = [];
  if (scope.site) parts.push(scope.site);
  if (scope.period) parts.push(scope.period);
  if (scope.scribe) parts.push(scope.scribe);
  if (scope.support) parts.push(scope.support);
  if (scope.collectionId) parts.push("collection");
  return parts.join(" · ");
}
