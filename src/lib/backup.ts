// One-file backup / restore for everything the researcher creates in the
// workbench. All persistent state is namespaced under a single localStorage
// prefix, so the backup is a faithful round-trip — annotations, collections,
// findings, saved hypotheses, queries, pin rail, tablet reclassifications,
// settings (including theme + display toggles), the sidebar layout, the
// report builder layout, and any future keys added under the same prefix.
//
// Format is intentionally simple JSON so it can be inspected, hand-edited,
// or migrated by anything that reads JSON.

import { PREFIX } from "./persistence";

const BACKUP_VERSION = 1;
export const BACKUP_KIND = "linear-a-workbench-backup";
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export interface BackupFile {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string; // ISO timestamp
  app: { name: string; url?: string };
  // Map of namespaced key (without the prefix) → the JSON-parsed value held
  // under that key. We parse here so the file is human-readable, not just
  // strings-of-JSON-inside-JSON.
  data: Record<string, unknown>;
}

/** Snapshot every prefixed key into a versioned backup object. */
export function buildBackup(): BackupFile {
  const data = Object.create(null) as Record<string, unknown>;
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i);
    if (!fullKey || !fullKey.startsWith(PREFIX)) continue;
    const key = fullKey.slice(PREFIX.length);
    if (!key || FORBIDDEN_KEYS.has(key)) continue;
    const raw = localStorage.getItem(fullKey);
    if (raw === null) continue;
    let value: unknown = raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "string" && JSON.stringify(parsed) === raw) {
        value = parsed;
      }
    } catch {
      // Not valid JSON: keep the raw string (value already === raw).
    }
    data[key] = value;
  }
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: "Linear A Research Workbench" },
    data,
  };
}

export interface RestoreReport {
  applied: number; // keys written
  skipped: number; // keys ignored (e.g. malformed)
  cleared: number; // pre-existing keys removed in replace mode
}

export type RestoreMode = "merge" | "replace";

/**
 * Validate that an arbitrary parsed object looks like a backup file. Any
 * positive integer version ≤ current is accepted so older exports restore
 * cleanly after the format evolves.
 */
export function isBackupFile(x: unknown): x is BackupFile {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Partial<BackupFile>;
  return (
    o.kind === BACKUP_KIND &&
    typeof o.version === "number" &&
    Number.isInteger(o.version) &&
    o.version >= 1 &&
    o.version <= BACKUP_VERSION &&
    !!o.data &&
    typeof o.data === "object" &&
    !Array.isArray(o.data)
  );
}

/**
 * Apply a backup to localStorage. In `replace` mode, existing prefixed keys
 * are snapshotted in memory first so a mid-restore QuotaExceededError rolls
 * back cleanly instead of leaving user data wiped. In `merge` mode, only the
 * keys present in the backup are overwritten.
 */
export function applyBackup(
  file: BackupFile,
  mode: RestoreMode,
): RestoreReport {
  const previous = new Map<string, string>();
  let cleared = 0;
  if (mode === "replace") {
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(PREFIX)) {
        const val = localStorage.getItem(fullKey);
        if (val !== null) previous.set(fullKey, val);
      }
    }
    for (const k of previous.keys()) localStorage.removeItem(k);
    cleared = previous.size;
  }

  // Stage serialized pairs first so invalid/unserializable values are skipped
  // cleanly before mutating storage.
  const staged: [string, string][] = [];
  let skipped = 0;
  for (const [key, value] of Object.entries(file.data)) {
    if (typeof key !== "string" || !key || FORBIDDEN_KEYS.has(key)) {
      skipped++;
      continue;
    }
    try {
      const encoded = typeof value === "string" ? value : JSON.stringify(value);
      if (typeof encoded !== "string") {
        skipped++;
        continue;
      }
      staged.push([PREFIX + key, encoded]);
    } catch {
      skipped++;
    }
  }

  let applied = 0;
  const written: string[] = [];
  for (const [fullKey, encoded] of staged) {
    try {
      localStorage.setItem(fullKey, encoded);
      written.push(fullKey);
      applied++;
    } catch {
      if (mode === "replace") {
        // Roll back partial replace so pre-existing researcher data is not lost.
        for (const k of written) localStorage.removeItem(k);
        for (const [k, v] of previous) {
          try {
            localStorage.setItem(k, v);
          } catch {
            // best effort
          }
        }
        return { applied: 0, skipped: staged.length + skipped, cleared: 0 };
      }
      skipped++;
    }
  }
  return { applied, skipped, cleared };
}

/**
 * Factory reset: remove every workbench-namespaced localStorage key, wiping
 * all researcher-generated state and preferences back to a clean install.
 */
export function clearAllWorkbenchData(): number {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
  return toRemove.length;
}

/** Summarize what a backup contains, for the confirm-before-restore UI. */
export function summarizeBackup(file: BackupFile): {
  keys: number;
  bytes: number;
  highlights: { label: string; count: number }[];
} {
  const json = JSON.stringify(file);
  const d = file.data as Record<string, unknown>;
  const len = (k: string) => {
    const v = d[k];
    return Array.isArray(v)
      ? v.length
      : v && typeof v === "object"
        ? Object.keys(v as object).length
        : v
          ? 1
          : 0;
  };
  return {
    keys: Object.keys(d).length,
    bytes: json.length,
    highlights: [
      { label: "annotations", count: len("annotations") },
      { label: "notes", count: len("notes") },
      { label: "collections", count: len("collections") },
      { label: "findings", count: len("findings") },
      { label: "saved hypotheses", count: len("saved-hypotheses") },
      { label: "saved queries", count: len("saved-queries") },
      { label: "custom wordlists", count: len("custom-languages") },
      { label: "pinned items", count: len("pins") },
      { label: "reclassified tablets", count: len("tablet-categories") },
    ].filter((h) => h.count > 0),
  };
}
