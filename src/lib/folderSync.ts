// Folder-sync backup transport via the File System Access API.
//
// The researcher picks a folder once (e.g. their Google Drive / Dropbox /
// OneDrive *desktop-sync* folder, or any local folder). The workbench then
// writes its backup JSON there — manually or on an interval — and the cloud
// provider's own desktop client handles the actual upload + version history.
// No OAuth, no third-party API, no server: just the browser writing a file to
// a folder the user authorized.
//
// The chosen folder's directory handle is persisted in IndexedDB so it
// survives reloads. Permissions may need a one-click re-grant after a reload
// (browsers require a user gesture to re-authorize a persisted handle), which
// the UI surfaces as a "Reconnect" button.
//
// Chromium-only: Firefox and Safari don't implement showDirectoryPicker yet.
// Callers must feature-detect with isFolderSyncSupported() and fall back to
// the existing download/upload backup.

// Stable filename — a single rolling backup the cloud provider versions for
// us, rather than the app accumulating timestamped copies in the folder.
export const FOLDER_BACKUP_FILENAME = "linear-a-workbench-backup.json";

// Folder-sync bookkeeping (mode + last-synced) lives under its OWN key,
// deliberately NOT under the workbench backup prefix, so it never ends up
// inside the backups it produces (which would also defeat change-detection).
const SYNC_SETTINGS_KEY = "la-folder-sync-settings";

export type AutoMode = "off" | "5" | "15" | "30";

export interface SyncSettings {
  mode: AutoMode;
  lastSynced: string | null; // ISO timestamp of last successful write
  folderName: string | null; // remembered for display before the handle loads
}

const DEFAULT_SETTINGS: SyncSettings = {
  mode: "off",
  lastSynced: null,
  folderName: null,
};

export function loadSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(SYNC_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSyncSettings(s: SyncSettings): void {
  try {
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function isFolderSyncSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// ─── IndexedDB: persist the directory handle across reloads ──────────────
const DB_NAME = "linear-a-workbench-fs";
const STORE = "handles";
const HANDLE_KEY = "backup-folder";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise((resolve, reject) => {
    openDb()
      .then((db) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
      .catch(reject);
  });
}

// FileSystemDirectoryHandle is structured-cloneable, so it stores directly.
type DirHandle = FileSystemDirectoryHandle;

// queryPermission / requestPermission are part of the File System Access
// permissions extension and aren't in the standard lib.dom typings, so we
// describe just the bits we call.
interface PermissionedHandle {
  queryPermission?: (d: {
    mode: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (d: {
    mode: "read" | "readwrite";
  }) => Promise<PermissionState>;
}
interface DirectoryPickerWindow {
  showDirectoryPicker?: (opts?: {
    id?: string;
    mode?: "read" | "readwrite";
  }) => Promise<DirHandle>;
}

/** Open the OS folder picker and remember the chosen folder. Returns null if
 *  unsupported or the user cancels. */
export async function pickBackupFolder(): Promise<DirHandle | null> {
  const picker = (window as unknown as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return null;
  try {
    const handle = await picker({ id: "linear-a-backup", mode: "readwrite" });
    await idbReq("readwrite", (s) => s.put(handle, HANDLE_KEY));
    return handle;
  } catch {
    return null; // user dismissed the picker
  }
}

export async function getStoredFolderHandle(): Promise<DirHandle | null> {
  try {
    return (await idbReq<DirHandle | undefined>("readonly", (s) =>
      s.get(HANDLE_KEY),
    )) ?? null;
  } catch {
    return null;
  }
}

export async function clearStoredFolderHandle(): Promise<void> {
  try {
    await idbReq("readwrite", (s) => s.delete(HANDLE_KEY));
  } catch {
    /* ignore */
  }
}

/** Current permission on the handle WITHOUT prompting (safe to call on mount). */
export async function queryFolderPermission(
  handle: DirHandle,
): Promise<PermissionState> {
  const h = handle as unknown as PermissionedHandle;
  if (!h.queryPermission) return "granted"; // older impls grant implicitly
  try {
    return await h.queryPermission({ mode: "readwrite" });
  } catch {
    return "denied";
  }
}

/** Prompt for permission — MUST be called from a user gesture (a click). */
export async function requestFolderPermission(
  handle: DirHandle,
): Promise<boolean> {
  const h = handle as unknown as PermissionedHandle;
  if (!h.requestPermission) return true;
  try {
    return (await h.requestPermission({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

/** Write text to a file in the folder, creating or overwriting it. */
export async function writeFileToFolder(
  handle: DirHandle,
  filename: string,
  content: string,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** Read a file's text from the folder, or null if it isn't there. */
export async function readFileFromFolder(
  handle: DirHandle,
  filename: string,
): Promise<string | null> {
  try {
    const fileHandle = await handle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}
