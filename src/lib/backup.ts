// One-file backup / restore for everything the researcher creates in the
// workbench. All persistent state is namespaced under a single localStorage
// prefix, so the backup is a faithful round-trip — annotations, collections,
// findings, saved hypotheses, queries, pin rail, tablet reclassifications,
// settings (including theme + display toggles), the sidebar layout, the
// report builder layout, and any future keys added under the same prefix.
//
// Format is intentionally simple JSON so it can be inspected, hand-edited,
// or migrated by anything that reads JSON.

const PREFIX = "linear-a-workbench:";
const BACKUP_VERSION = 1;
export const BACKUP_KIND = "linear-a-workbench-backup";

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
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i);
    if (!fullKey || !fullKey.startsWith(PREFIX)) continue;
    const key = fullKey.slice(PREFIX.length);
    const raw = localStorage.getItem(fullKey);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      // Fall back to storing the raw string if it isn't valid JSON.
      data[key] = raw;
    }
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
 * Validate that an arbitrary parsed object looks like a backup file. We're
 * permissive about `version` (any number ≤ current is allowed) so older
 * exports can still be restored after the format evolves.
 */
export function isBackupFile(x: unknown): x is BackupFile {
  if (!x || typeof x !== "object") return false;
  const o = x as Partial<BackupFile>;
  return (
    o.kind === BACKUP_KIND &&
    typeof o.version === "number" &&
    o.version <= BACKUP_VERSION &&
    !!o.data &&
    typeof o.data === "object"
  );
}

/**
 * Apply a backup to localStorage. In `replace` mode, every existing prefixed
 * key is wiped first (so the restore is a true round-trip). In `merge` mode,
 * only the keys present in the backup are overwritten.
 */
export function applyBackup(
  file: BackupFile,
  mode: RestoreMode,
): RestoreReport {
  let cleared = 0;
  if (mode === "replace") {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(PREFIX)) toRemove.push(fullKey);
    }
    for (const k of toRemove) localStorage.removeItem(k);
    cleared = toRemove.length;
  }
  let applied = 0;
  let skipped = 0;
  for (const [key, value] of Object.entries(file.data)) {
    if (typeof key !== "string" || !key) {
      skipped++;
      continue;
    }
    try {
      localStorage.setItem(
        PREFIX + key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
      applied++;
    } catch {
      skipped++;
    }
  }
  return { applied, skipped, cleared };
}

/**
 * Factory reset: remove every workbench-namespaced localStorage key, wiping
 * all researcher-generated state and preferences back to a clean install —
 * annotations, collections, findings, saved hypotheses, queries, pins, tablet
 * reclassifications, notes, report/sidebar layout, display settings, and the
 * remembered active module. Returns the number of keys removed. The caller
 * should reload afterwards so the store re-hydrates from the clean slate.
 *
 * Note: keys NOT under the workbench prefix (e.g. the folder-sync pairing)
 * are left untouched, so a reset doesn't unpair a connected backup folder.
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
    return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v as object).length : v ? 1 : 0;
  };
  return {
    keys: Object.keys(d).length,
    bytes: json.length,
    highlights: [
      { label: "annotations", count: len("annotations") },
      { label: "collections", count: len("collections") },
      { label: "findings", count: len("findings") },
      { label: "saved hypotheses", count: len("saved-hypotheses") },
      { label: "saved queries", count: len("saved-queries") },
      { label: "pinned items", count: len("pins") },
      { label: "reclassified tablets", count: len("tablet-categories") },
    ].filter((h) => h.count > 0),
  };
}
