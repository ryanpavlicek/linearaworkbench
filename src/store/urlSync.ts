import { useWorkbench } from "./workbench";
import { MODULE_COMPONENTS } from "../modules/registry";
import type { CorpusScope, ModuleId } from "../lib/types";
import {
  buildPermalink,
  parsePermalink,
  type PermalinkScope,
} from "../lib/permalink";

// Two-way sync between the URL hash and the shareable slice of the store —
// active module, open detail view, corpus scope (see lib/permalink.ts for
// the format). Store changes write the hash (a history entry for module and
// detail transitions, an in-place replace for scope tweaks); back/forward
// and pasted links apply the hash to the store. Non-permalink hashes (the
// Methodology page's heading anchors) are ignored in both directions.

let applying = false;

function scopeFromPermalink(p: PermalinkScope): CorpusScope {
  return {
    site: p.site ?? null,
    period: p.period ?? null,
    scribe: p.scribe ?? null,
    support: p.support ?? null,
    collectionId: p.collectionId ?? null,
  };
}

function scopeToPermalink(s: CorpusScope): PermalinkScope {
  const out: PermalinkScope = {};
  if (s.site) out.site = s.site;
  if (s.period) out.period = s.period;
  if (s.scribe) out.scribe = s.scribe;
  if (s.support) out.support = s.support;
  if (s.collectionId) out.collectionId = s.collectionId;
  return out;
}

function applyHash(hash: string): void {
  const p = parsePermalink(hash);
  if (!p) return;
  const st = useWorkbench.getState();
  applying = true;
  try {
    if (
      p.module &&
      p.module in MODULE_COMPONENTS &&
      p.module !== st.activeModule
    ) {
      st.setActiveModule(p.module as ModuleId);
    }
    const next = scopeFromPermalink(p.scope ?? {});
    const cur = st.scope;
    if (
      next.site !== cur.site ||
      next.period !== cur.period ||
      next.scribe !== cur.scribe ||
      next.support !== cur.support ||
      next.collectionId !== cur.collectionId
    ) {
      st.setScope(next);
    }
    if (p.detail) {
      const { kind, value } = p.detail;
      if (kind === "inscription") {
        if (st.corpus.byId.has(value)) st.showInscription(value);
      } else if (st.corpus.wordIndex.has(value)) {
        st.showWord(value);
      }
    } else if (st.detail) {
      st.closeDetail();
    }
  } finally {
    applying = false;
  }
}

function currentHash(): string {
  const s = useWorkbench.getState();
  return buildPermalink({
    module: s.activeModule,
    detail: s.detail,
    scope: scopeToPermalink(s.scope),
  });
}

/**
 * Start the sync. Call once after mount; returns a cleanup function. The
 * initial hash is applied as soon as the corpus is loaded (a pasted link
 * needs the index to resolve its inscription/word).
 */
export function initUrlSync(): () => void {
  let unsubLoaded: (() => void) | null = null;

  const initial = () => {
    if (window.location.hash) {
      applyHash(window.location.hash);
    }
    // Reflect the (possibly just-applied) state so copying the address bar
    // works from the first paint, without adding a history entry.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + currentHash(),
    );
  };

  if (useWorkbench.getState().loaded) {
    initial();
  } else {
    unsubLoaded = useWorkbench.subscribe((s) => {
      if (s.loaded) {
        unsubLoaded?.();
        unsubLoaded = null;
        initial();
      }
    });
  }

  const unsubStore = useWorkbench.subscribe((s, prev) => {
    if (applying || !s.loaded) return;
    const navChanged =
      s.activeModule !== prev.activeModule || s.detail !== prev.detail;
    if (!navChanged && s.scope === prev.scope) return;
    const hash = currentHash();
    if (window.location.hash === hash) return;
    if (navChanged) {
      window.location.hash = hash; // history entry: back/forward retraces it
    } else {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search + hash,
      );
    }
  });

  const onPopState = () => applyHash(window.location.hash);
  window.addEventListener("popstate", onPopState);

  return () => {
    unsubStore();
    unsubLoaded?.();
    window.removeEventListener("popstate", onPopState);
  };
}
