import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useWorkbench } from "../store/workbench";
import type { Inscription, SignData } from "../lib/types";

// Load the real bundled corpus from public/corpus so the smoke / integration
// tests exercise the modules against genuine data shapes (1,721 inscriptions,
// 84 signs), not a hand-built toy that might dodge real edge cases.
let cache: { inscriptions: Inscription[]; signs: SignData[] } | null = null;

export function realCorpus(): { inscriptions: Inscription[]; signs: SignData[] } {
  if (cache) return cache;
  const root = process.cwd();
  const inscriptions = JSON.parse(
    readFileSync(resolve(root, "public/corpus/inscriptions.json"), "utf8"),
  ) as Inscription[];
  const signs = JSON.parse(
    readFileSync(resolve(root, "public/corpus/signs.json"), "utf8"),
  ) as SignData[];
  cache = { inscriptions, signs };
  return cache;
}

/** Load the real corpus into the live store (used by integration/smoke tests). */
export function loadRealCorpus(): void {
  const { inscriptions, signs } = realCorpus();
  useWorkbench.getState().loadCorpusFromInscriptions(inscriptions, signs);
}
