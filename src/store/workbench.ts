import { create } from "zustand";
import type {
  Annotation,
  AnnotationTarget,
  Collection,
  ComparisonLanguages,
  Confidence,
  CorpusScope,
  DisplaySettings,
  Finding,
  Inscription,
  ModuleId,
  ModuleIntent,
  OverrideEvidence,
  PhoneticOverrides,
  Pin,
  PinKind,
  ResearchNote,
  SavedHypothesis,
  SignData,
  SiteEntry,
  WordEntry,
} from "../lib/types";
import { COMPARISON_LANGUAGES } from "../data/languages";
import { KEYS, loadJson, saveJson } from "../lib/persistence";
import { normalizeCorpusJson } from "../lib/customCorpus";

export interface CorpusIndex {
  inscriptions: Inscription[];
  byId: Map<string, Inscription>;
  wordIndex: Map<string, WordEntry>;
  siteIndex: Map<string, SiteEntry>;
  signsByLabel: Map<string, SignData>;
  signs: SignData[];
}

interface UndoAction {
  inverse: () => void;
  description: string;
  at: number;
}

interface State {
  loaded: boolean;
  loadError: string | null;
  corpus: CorpusIndex;
  // Workbench-wide corpus filter (see CorpusScope). Read by analysis modules
  // through useScopedCorpus(); in-memory only (not persisted across reloads).
  scope: CorpusScope;
  hypothesis: PhoneticOverrides;
  overrideEvidence: Record<string, OverrideEvidence>;
  savedHypotheses: SavedHypothesis[];
  customLanguages: ComparisonLanguages;
  annotations: Annotation[];
  pins: Pin[];
  collections: Collection[];
  // Researcher overrides of a tablet's heuristic structural category, keyed by
  // inscription id → category key (see TabletStructure).
  tabletCategories: Record<string, string>;
  // Saved results/views captured from analysis modules (see SaveFindingButton).
  findings: Finding[];
  // Free-form Markdown notes that can cross-reference any annotation,
  // collection, finding, inscription, word, or other note (My Research › Notes).
  notes: ResearchNote[];
  settings: DisplaySettings;
  undoStack: UndoAction[];
  activeModule: ModuleId;
  moduleIntent: ModuleIntent | null;
  toast: { message: string; tone: "info" | "error" } | null;
  detail:
    | { kind: "word"; value: string }
    | { kind: "inscription"; value: string }
    | null;

  // Non-null when a bring-your-own corpus replaced the bundled one for this
  // session — the label shown in the top bar ("?corpus=" URL or a file name).
  corpusSource: string | null;

  loadCorpusFromUrl: (baseUrl: string) => Promise<void>;
  loadCorpusFromInscriptions: (
    data: Inscription[],
    signs: SignData[],
  ) => void;
  // Bring-your-own corpus: fetch one JSON document (array or schema-v1
  // export), normalize it, and load it against the bundled sign inventory.
  loadCorpusFromCustomUrl: (url: string, signsUrl: string) => Promise<void>;
  // Same normalization for already-parsed JSON (the local file picker).
  // Throws on unusable input; returns counts for the caller's toast.
  applyCustomCorpus: (
    raw: unknown,
    label: string,
  ) => { loaded: number; skipped: number };

  setScope: (patch: Partial<CorpusScope>) => void;
  clearScope: () => void;

  setActiveModule: (id: ModuleId, intent?: ModuleIntent | null) => void;
  showWord: (word: string) => void;
  showInscription: (id: string) => void;
  closeDetail: () => void;

  setOverride: (sign: string, value: string) => void;
  clearOverride: (sign: string) => void;
  resetHypothesis: () => void;
  setOverrideEvidence: (sign: string, patch: Partial<OverrideEvidence>) => void;
  saveHypothesis: (name: string) => void;
  loadHypothesis: (index: number) => void;
  deleteHypothesis: (index: number) => void;

  addCustomLanguage: (name: string, entries: ComparisonLanguages[string]) => void;
  removeCustomLanguage: (name: string) => void;

  upsertAnnotation: (
    target: AnnotationTarget,
    fields: {
      proposedMeaning?: string;
      confidence?: Confidence;
      notes?: string;
      evidenceIds?: string[];
    },
  ) => void;
  deleteAnnotation: (id: string) => void;
  importAnnotations: (entries: Annotation[], mode: "merge" | "replace") => void;

  pin: (kind: PinKind, value: string) => void;
  unpin: (id: string) => void;
  togglePin: (kind: PinKind, value: string) => void;
  reorderPin: (id: string, toIndex: number) => void;
  clearPins: () => void;
  setPinRailVisible: (v: boolean) => void;

  createCollection: (name: string) => string;
  createCollectionWithItems: (
    name: string,
    items: { kind: "word" | "inscription"; value: string }[],
  ) => string;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addToCollection: (
    id: string,
    item: { kind: "word" | "inscription"; value: string },
  ) => void;
  removeFromCollection: (
    id: string,
    item: { kind: "word" | "inscription"; value: string },
  ) => void;

  setTabletCategory: (id: string, category: string) => void;
  clearTabletCategory: (id: string) => void;
  clearAllTabletCategories: () => void;

  addFinding: (finding: Omit<Finding, "id" | "createdAt">) => string;
  deleteFinding: (id: string) => void;
  updateFinding: (
    id: string,
    patch: Partial<Pick<Finding, "title" | "notes">>,
  ) => void;

  createNote: (title?: string) => string;
  updateNote: (
    id: string,
    patch: Partial<Pick<ResearchNote, "title" | "body">>,
  ) => void;
  deleteNote: (id: string) => void;

  updateSettings: (patch: Partial<DisplaySettings>) => void;

  undoLast: () => void;

  toast_show: (message: string, tone?: "info" | "error") => void;
  toast_clear: () => void;
}

function emptyCorpus(): CorpusIndex {
  return {
    inscriptions: [],
    byId: new Map(),
    wordIndex: new Map(),
    siteIndex: new Map(),
    signsByLabel: new Map(),
    signs: [],
  };
}

export const EMPTY_SCOPE: CorpusScope = {
  site: null,
  period: null,
  scribe: null,
  support: null,
  collectionId: null,
};

export function buildIndex(
  inscriptions: Inscription[],
  signs: SignData[],
): CorpusIndex {
  const byId = new Map<string, Inscription>();
  const wordIndex = new Map<string, WordEntry>();
  const siteIndex = new Map<string, SiteEntry>();

  for (const ins of inscriptions) {
    byId.set(ins.id, ins);
    const site = ins.site || "?";
    let s = siteIndex.get(site);
    if (!s) {
      s = { count: 0, inscriptionIds: [] };
      siteIndex.set(site, s);
    }
    s.count++;
    s.inscriptionIds.push(ins.id);

    for (const w of ins.words) {
      let e = wordIndex.get(w);
      if (!e) {
        e = { count: 0, inscriptionIds: [], sites: new Set<string>() };
        wordIndex.set(w, e);
      }
      e.count++; // total occurrences (may repeat within one inscription)
      // inscriptionIds holds DISTINCT inscriptions. All occurrences of a
      // given word within one inscription are processed consecutively here
      // (nothing else writes to this entry meanwhile), so guarding against
      // the last-pushed id is sufficient to dedupe.
      if (e.inscriptionIds[e.inscriptionIds.length - 1] !== ins.id)
        e.inscriptionIds.push(ins.id);
      e.sites.add(site);
    }
  }

  const signsByLabel = new Map<string, SignData>();
  for (const s of signs) signsByLabel.set(s.label, s);

  return { inscriptions, byId, wordIndex, siteIndex, signsByLabel, signs };
}

function targetKey(t: AnnotationTarget): string {
  return `${t.kind}:${t.value}`;
}

const MAX_UNDO = 30;
function pushUndo(
  state: State,
  inverse: () => void,
  description: string,
): UndoAction[] {
  const next = [...state.undoStack, { inverse, description, at: Date.now() }];
  if (next.length > MAX_UNDO) next.splice(0, next.length - MAX_UNDO);
  return next;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  showGlyphsInline: false,
  showPhoneticInline: false,
  showAnnotationChips: true,
  // On by default — every word carries the inline ✎ word-tools control
  // (annotate + add to collection + pin). Kept visually quiet (a faint glyph
  // that brightens on hover); supersedes the static annotation chip. Toggle
  // off for a cleaner read-only view.
  inlineWordTools: true,
  compactTables: false,
  // Off by default so a brand-new visitor with nothing pinned isn't shown
  // an empty rail. Pinning anything flips this on (see PinButton), and the
  // user can toggle it explicitly in Display settings.
  pinRailVisible: false,
  hoverPreviews: true,
  pinRailWidth: 300,
  theme: "dark",
};

export const useWorkbench = create<State>((set, get) => ({
  loaded: false,
  loadError: null,
  corpus: emptyCorpus(),
  scope: { ...EMPTY_SCOPE },
  hypothesis: {},
  overrideEvidence: {},
  savedHypotheses: loadJson<SavedHypothesis[]>(KEYS.savedHypotheses, []),
  customLanguages: loadJson<ComparisonLanguages>(KEYS.customLanguages, {}),
  annotations: loadJson<Annotation[]>(KEYS.annotations, []),
  pins: loadJson<Pin[]>(KEYS.pins, []),
  collections: loadJson<Collection[]>(KEYS.collections, []),
  tabletCategories: loadJson<Record<string, string>>(KEYS.tabletCategories, {}),
  findings: loadJson<Finding[]>(KEYS.findings, []),
  notes: loadJson<ResearchNote[]>(KEYS.notes, []),
  settings: { ...DEFAULT_SETTINGS, ...loadJson<Partial<DisplaySettings>>(KEYS.settings, {}) },
  undoStack: [],
  // Restore the module the researcher was last on across refreshes (the rest
  // of their working state already persists; the active view should too). The
  // transient moduleIntent (a one-shot focus/tab deep-link) is intentionally
  // NOT persisted, so a refresh restores the module without re-firing a stale
  // pivot. App.tsx falls back to "search" if a stored id is no longer valid.
  activeModule: loadJson<ModuleId>(KEYS.activeModule, "search"),
  moduleIntent: null,
  toast: null,
  detail: null,

  corpusSource: null,

  async loadCorpusFromUrl(baseUrl) {
    try {
      const [insRes, signRes] = await Promise.all([
        fetch(`${baseUrl}inscriptions.json`),
        fetch(`${baseUrl}signs.json`),
      ]);
      if (!insRes.ok || !signRes.ok)
        throw new Error(`HTTP ${insRes.status}/${signRes.status}`);
      const [data, signs] = await Promise.all([
        insRes.json() as Promise<Inscription[]>,
        signRes.json() as Promise<SignData[]>,
      ]);
      get().loadCorpusFromInscriptions(data, signs);
    } catch (err) {
      set({ loadError: String(err), loaded: false });
    }
  },

  loadCorpusFromInscriptions(data, signs) {
    set({
      corpus: buildIndex(data, signs),
      loaded: true,
      loadError: null,
      corpusSource: null,
    });
  },

  async loadCorpusFromCustomUrl(url, signsUrl) {
    try {
      const [insRes, signRes] = await Promise.all([fetch(url), fetch(signsUrl)]);
      if (!insRes.ok)
        throw new Error(`custom corpus fetch failed (HTTP ${insRes.status})`);
      if (!signRes.ok)
        throw new Error(`sign inventory fetch failed (HTTP ${signRes.status})`);
      const [raw, signs] = await Promise.all([
        insRes.json() as Promise<unknown>,
        signRes.json() as Promise<SignData[]>,
      ]);
      const { inscriptions } = normalizeCorpusJson(raw);
      set({
        corpus: buildIndex(inscriptions, signs),
        loaded: true,
        loadError: null,
        corpusSource: url,
      });
    } catch (err) {
      set({ loadError: String(err), loaded: false });
    }
  },

  applyCustomCorpus(raw, label) {
    const { inscriptions, skipped } = normalizeCorpusJson(raw);
    set((s) => ({
      corpus: buildIndex(inscriptions, s.corpus.signs),
      loaded: true,
      loadError: null,
      corpusSource: label,
      // The old corpus's open detail/scope would dangle against new ids.
      detail: null,
      scope: { ...EMPTY_SCOPE },
    }));
    return { loaded: inscriptions.length, skipped };
  },

  setScope: (patch) => set((s) => ({ scope: { ...s.scope, ...patch } })),
  clearScope: () => set({ scope: { ...EMPTY_SCOPE } }),

  setActiveModule: (id, intent = null) => {
    saveJson(KEYS.activeModule, id);
    set({ activeModule: id, moduleIntent: intent, detail: null });
  },
  showWord: (word) => set({ detail: { kind: "word", value: word } }),
  showInscription: (id) => set({ detail: { kind: "inscription", value: id } }),
  closeDetail: () => set({ detail: null }),

  setOverride: (sign, value) =>
    set((s) => ({ hypothesis: { ...s.hypothesis, [sign]: value } })),
  clearOverride: (sign) =>
    set((s) => {
      const nextH = { ...s.hypothesis };
      delete nextH[sign];
      const nextE = { ...s.overrideEvidence };
      delete nextE[sign];
      return { hypothesis: nextH, overrideEvidence: nextE };
    }),
  resetHypothesis: () => set({ hypothesis: {}, overrideEvidence: {} }),

  setOverrideEvidence: (sign, patch) =>
    set((s) => {
      const current = s.overrideEvidence[sign] ?? {
        note: "",
        evidenceWords: [],
        evidenceInscriptionIds: [],
      };
      return {
        overrideEvidence: {
          ...s.overrideEvidence,
          [sign]: { ...current, ...patch },
        },
      };
    }),

  saveHypothesis: (name) => {
    const { hypothesis, savedHypotheses, overrideEvidence } = get();
    const notes = Object.entries(hypothesis)
      .map(([k, v]) => `${k}→${v}`)
      .join(", ");
    const next = [
      ...savedHypotheses,
      {
        name: name || `Hypothesis ${savedHypotheses.length + 1}`,
        overrides: { ...hypothesis },
        timestamp: new Date().toISOString(),
        notes,
        evidence: { ...overrideEvidence },
      },
    ];
    set({ savedHypotheses: next });
    saveJson(KEYS.savedHypotheses, next);
  },
  loadHypothesis: (index) => {
    const h = get().savedHypotheses[index];
    if (h)
      set({
        hypothesis: { ...h.overrides },
        overrideEvidence: { ...(h.evidence ?? {}) },
      });
  },
  deleteHypothesis: (index) =>
    set((s) => {
      const next = s.savedHypotheses.filter((_, i) => i !== index);
      saveJson(KEYS.savedHypotheses, next);
      return { savedHypotheses: next };
    }),

  addCustomLanguage: (name, entries) =>
    set((s) => {
      const next = { ...s.customLanguages, [name]: entries };
      saveJson(KEYS.customLanguages, next);
      return { customLanguages: next };
    }),
  removeCustomLanguage: (name) =>
    set((s) => {
      const next = { ...s.customLanguages };
      delete next[name];
      saveJson(KEYS.customLanguages, next);
      return { customLanguages: next };
    }),

  upsertAnnotation: (target, fields) => {
    const state = get();
    const { annotations } = state;
    const key = targetKey(target);
    const now = new Date().toISOString();
    const existing = annotations.find((a) => targetKey(a.target) === key);
    let next: Annotation[];
    let undoInverse: () => void;
    if (existing) {
      const prev = existing;
      next = annotations.map((a) =>
        a.id === existing.id
          ? {
              ...a,
              ...fields,
              proposedMeaning:
                fields.proposedMeaning ?? a.proposedMeaning,
              confidence: fields.confidence ?? a.confidence,
              notes: fields.notes ?? a.notes,
              evidenceIds: fields.evidenceIds ?? a.evidenceIds,
              updatedAt: now,
            }
          : a,
      );
      undoInverse = () => {
        const cur = get().annotations.map((a) => (a.id === prev.id ? prev : a));
        set({ annotations: cur });
        saveJson(KEYS.annotations, cur);
      };
    } else {
      const newAnnotation: Annotation = {
        id: genId(),
        target,
        proposedMeaning: fields.proposedMeaning ?? "",
        confidence: fields.confidence ?? "medium",
        notes: fields.notes ?? "",
        evidenceIds: fields.evidenceIds ?? [],
        createdAt: now,
        updatedAt: now,
      };
      next = [...annotations, newAnnotation];
      undoInverse = () => {
        const cur = get().annotations.filter((a) => a.id !== newAnnotation.id);
        set({ annotations: cur });
        saveJson(KEYS.annotations, cur);
      };
    }
    const undoStack = pushUndo(
      state,
      undoInverse,
      existing ? `edit annotation ${target.value}` : `add annotation ${target.value}`,
    );
    set({ annotations: next, undoStack });
    saveJson(KEYS.annotations, next);
  },
  deleteAnnotation: (id) => {
    const state = get();
    const removed = state.annotations.find((a) => a.id === id);
    const next = state.annotations.filter((a) => a.id !== id);
    const undoStack = removed
      ? pushUndo(
          state,
          () => {
            const cur = [...get().annotations, removed];
            set({ annotations: cur });
            saveJson(KEYS.annotations, cur);
          },
          `delete annotation ${removed.target.value}`,
        )
      : state.undoStack;
    set({ annotations: next, undoStack });
    saveJson(KEYS.annotations, next);
  },
  importAnnotations: (entries, mode) => {
    const existing = get().annotations;
    let next: Annotation[];
    if (mode === "replace") {
      next = entries;
    } else {
      // Merge: incoming overrides on same target
      const byKey = new Map<string, Annotation>();
      for (const a of existing) byKey.set(targetKey(a.target), a);
      for (const a of entries) byKey.set(targetKey(a.target), a);
      next = [...byKey.values()];
    }
    set({ annotations: next });
    saveJson(KEYS.annotations, next);
  },

  // ---- Pins ------------------------------------------------------------
  pin: (kind, value) => {
    const state = get();
    if (state.pins.some((p) => p.kind === kind && p.value === value)) return;
    const newPin: Pin = {
      id: genId(),
      kind,
      value,
      pinnedAt: new Date().toISOString(),
    };
    const next = [...state.pins, newPin];
    // The inverse mutates the pins slice directly rather than calling the
    // public unpin() action — calling unpin() would record its OWN undo entry,
    // so undoing a pin would leave a "re-pin" on the stack and the next undo
    // would redo it instead of continuing back through history. Mirrors how
    // the annotation inverses are written.
    const undoStack = pushUndo(
      state,
      () => {
        const cur = get().pins.filter((p) => p.id !== newPin.id);
        set({ pins: cur });
        saveJson(KEYS.pins, cur);
      },
      `pin ${value}`,
    );
    set({ pins: next, undoStack });
    saveJson(KEYS.pins, next);
  },
  unpin: (id) => {
    const state = get();
    const idx = state.pins.findIndex((p) => p.id === id);
    const removed = idx >= 0 ? state.pins[idx] : undefined;
    const next = state.pins.filter((p) => p.id !== id);
    const undoStack = removed
      ? pushUndo(
          state,
          // Restore the removed pin at its original index, mutating directly so
          // the inverse doesn't re-record an undo entry (see pin() above).
          () => {
            const cur = [...get().pins];
            cur.splice(Math.min(idx, cur.length), 0, removed);
            set({ pins: cur });
            saveJson(KEYS.pins, cur);
          },
          `unpin ${removed.value}`,
        )
      : state.undoStack;
    set({ pins: next, undoStack });
    saveJson(KEYS.pins, next);
  },
  togglePin: (kind, value) => {
    const existing = get().pins.find((p) => p.kind === kind && p.value === value);
    if (existing) get().unpin(existing.id);
    else get().pin(kind, value);
  },
  reorderPin: (id, toIndex) => {
    const pins = [...get().pins];
    const idx = pins.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const [item] = pins.splice(idx, 1);
    pins.splice(Math.max(0, Math.min(pins.length, toIndex)), 0, item);
    set({ pins });
    saveJson(KEYS.pins, pins);
  },
  clearPins: () => {
    set({ pins: [] });
    saveJson(KEYS.pins, []);
  },
  setPinRailVisible: (v) => {
    const next = { ...get().settings, pinRailVisible: v };
    set({ settings: next });
    saveJson(KEYS.settings, next);
  },

  // ---- Collections -----------------------------------------------------
  createCollection: (name) => {
    const id = genId();
    const now = new Date().toISOString();
    const next: Collection[] = [
      ...get().collections,
      { id, name, items: [], createdAt: now, updatedAt: now },
    ];
    set({ collections: next });
    saveJson(KEYS.collections, next);
    return id;
  },
  createCollectionWithItems: (name, items) => {
    const id = genId();
    const now = new Date().toISOString();
    // de-duplicate by kind:value
    const seen = new Set<string>();
    const deduped = items.filter((it) => {
      const k = `${it.kind}:${it.value}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const next: Collection[] = [
      ...get().collections,
      { id, name, items: deduped, createdAt: now, updatedAt: now },
    ];
    set({ collections: next });
    saveJson(KEYS.collections, next);
    return id;
  },
  renameCollection: (id, name) => {
    const next = get().collections.map((c) =>
      c.id === id ? { ...c, name, updatedAt: new Date().toISOString() } : c,
    );
    set({ collections: next });
    saveJson(KEYS.collections, next);
  },
  deleteCollection: (id) => {
    const next = get().collections.filter((c) => c.id !== id);
    set({ collections: next });
    saveJson(KEYS.collections, next);
  },
  addToCollection: (id, item) => {
    const next = get().collections.map((c) => {
      if (c.id !== id) return c;
      if (c.items.some((i) => i.kind === item.kind && i.value === item.value))
        return c;
      return {
        ...c,
        items: [...c.items, item],
        updatedAt: new Date().toISOString(),
      };
    });
    set({ collections: next });
    saveJson(KEYS.collections, next);
  },
  removeFromCollection: (id, item) => {
    const next = get().collections.map((c) =>
      c.id === id
        ? {
            ...c,
            items: c.items.filter(
              (i) => !(i.kind === item.kind && i.value === item.value),
            ),
            updatedAt: new Date().toISOString(),
          }
        : c,
    );
    set({ collections: next });
    saveJson(KEYS.collections, next);
  },

  // ---- Tablet category overrides ---------------------------------------
  setTabletCategory: (id, category) => {
    const next = { ...get().tabletCategories, [id]: category };
    set({ tabletCategories: next });
    saveJson(KEYS.tabletCategories, next);
  },
  clearTabletCategory: (id) => {
    const next = { ...get().tabletCategories };
    delete next[id];
    set({ tabletCategories: next });
    saveJson(KEYS.tabletCategories, next);
  },
  clearAllTabletCategories: () => {
    set({ tabletCategories: {} });
    saveJson(KEYS.tabletCategories, {});
  },

  // ---- Findings (saved results/views) ----------------------------------
  addFinding: (finding) => {
    const id = genId();
    const entry: Finding = {
      ...finding,
      id,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...get().findings];
    set({ findings: next });
    saveJson(KEYS.findings, next);
    return id;
  },
  deleteFinding: (id) => {
    const state = get();
    const removed = state.findings.find((f) => f.id === id);
    const next = state.findings.filter((f) => f.id !== id);
    const undoStack = removed
      ? pushUndo(
          state,
          () => {
            const cur = [removed, ...get().findings];
            set({ findings: cur });
            saveJson(KEYS.findings, cur);
          },
          `delete finding "${removed.title}"`,
        )
      : state.undoStack;
    set({ findings: next, undoStack });
    saveJson(KEYS.findings, next);
  },
  updateFinding: (id, patch) => {
    const next = get().findings.map((f) =>
      f.id === id ? { ...f, ...patch } : f,
    );
    set({ findings: next });
    saveJson(KEYS.findings, next);
  },

  // ---- Research notes -------------------------------------------------
  createNote: (title) => {
    const id = genId();
    const now = new Date().toISOString();
    const note: ResearchNote = {
      id,
      title: title?.trim() || "Untitled note",
      body: "",
      createdAt: now,
      updatedAt: now,
    };
    const next = [note, ...get().notes];
    set({ notes: next });
    saveJson(KEYS.notes, next);
    return id;
  },
  updateNote: (id, patch) => {
    const next = get().notes.map((n) =>
      n.id === id
        ? { ...n, ...patch, updatedAt: new Date().toISOString() }
        : n,
    );
    set({ notes: next });
    saveJson(KEYS.notes, next);
  },
  deleteNote: (id) => {
    const next = get().notes.filter((n) => n.id !== id);
    set({ notes: next });
    saveJson(KEYS.notes, next);
  },

  // ---- Settings --------------------------------------------------------
  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    saveJson(KEYS.settings, next);
  },

  // ---- Undo ------------------------------------------------------------
  undoLast: () => {
    const stack = [...get().undoStack];
    const action = stack.pop();
    if (!action) {
      get().toast_show("Nothing to undo");
      return;
    }
    set({ undoStack: stack });
    action.inverse();
    get().toast_show(`Undid: ${action.description}`);
  },

  toast_show: (message, tone = "info") => set({ toast: { message, tone } }),
  toast_clear: () => set({ toast: null }),
}));

// Selector: combined built-in + custom comparison languages
export function getAllLanguages(
  customLanguages: ComparisonLanguages,
): ComparisonLanguages {
  return { ...COMPARISON_LANGUAGES, ...customLanguages };
}

export function annotationFor(
  annotations: Annotation[],
  target: AnnotationTarget,
): Annotation | undefined {
  const k = targetKey(target);
  return annotations.find((a) => targetKey(a.target) === k);
}
