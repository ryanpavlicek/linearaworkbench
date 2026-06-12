// Hash permalinks: the URL carries the active module, an open detail view,
// and the global corpus scope, so any view can be shared, bookmarked, and
// retraced with back/forward. Shapes:
//
//   #/m/<moduleId>                       a module
//   #/i/<inscriptionId>?m=<moduleId>     an inscription detail (module kept)
//   #/w/<word>?m=<moduleId>              a word detail (module kept)
//
// plus the scope as query params (site, period, scribe, support, collection).
// Anything else — e.g. the Methodology page's in-text heading anchors — is
// not a permalink and parses to null, so it is left alone.

export interface PermalinkScope {
  site?: string;
  period?: string;
  scribe?: string;
  support?: string;
  collectionId?: string;
}

export interface PermalinkState {
  module?: string;
  detail?: { kind: "inscription" | "word"; value: string } | null;
  scope?: PermalinkScope;
}

const SCOPE_PARAMS: [keyof PermalinkScope, string][] = [
  ["site", "site"],
  ["period", "period"],
  ["scribe", "scribe"],
  ["support", "support"],
  ["collectionId", "collection"],
];

export function buildPermalink(state: {
  module: string;
  detail: { kind: "inscription" | "word"; value: string } | null;
  scope: PermalinkScope;
}): string {
  const q = new URLSearchParams();
  if (state.detail) q.set("m", state.module);
  for (const [key, param] of SCOPE_PARAMS) {
    const v = state.scope[key];
    if (v) q.set(param, v);
  }
  const path = state.detail
    ? `/${state.detail.kind === "inscription" ? "i" : "w"}/${encodeURIComponent(state.detail.value)}`
    : `/m/${encodeURIComponent(state.module)}`;
  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ""}`;
}

export function parsePermalink(hash: string): PermalinkState | null {
  if (!hash.startsWith("#/")) return null;
  const raw = hash.slice(1);
  const qIndex = raw.indexOf("?");
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = new URLSearchParams(qIndex === -1 ? "" : raw.slice(qIndex + 1));

  const segs = path.split("/"); // ["", kind, value]
  if (segs.length !== 3 || !segs[2]) return null;
  const [, kind, encoded] = segs;
  let value: string;
  try {
    value = decodeURIComponent(encoded);
  } catch {
    return null;
  }

  const scope: PermalinkScope = {};
  for (const [key, param] of SCOPE_PARAMS) {
    const v = query.get(param);
    if (v) scope[key] = v;
  }

  if (kind === "m") return { module: value, detail: null, scope };
  if (kind === "i" || kind === "w") {
    const m = query.get("m") ?? undefined;
    return {
      module: m,
      detail: { kind: kind === "i" ? "inscription" : "word", value },
      scope,
    };
  }
  return null;
}
