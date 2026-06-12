// Lightweight namespaced localStorage helpers. All researcher-generated
// content (annotations, saved queries) goes through here.

const PREFIX = "linear-a-workbench:";

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn("localStorage save failed:", err);
  }
}

export function clearKey(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export const KEYS = {
  annotations: "annotations",
  savedQueries: "saved-queries",
  savedHypotheses: "saved-hypotheses",
  settings: "settings",
  pins: "pins",
  collections: "collections",
  tabletCategories: "tablet-categories",
  customLanguages: "custom-languages",
  scopePresets: "scope-presets",
  findings: "findings",
  sidebarCollapsed: "sidebar-collapsed",
  reportLayout: "report-layout",
  notes: "notes",
  activeModule: "active-module",
} as const;
