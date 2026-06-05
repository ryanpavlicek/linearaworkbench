import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { buildBackup, isBackupFile, type BackupFile } from "../lib/backup";
import {
  isFolderSyncSupported,
  pickBackupFolder,
  getStoredFolderHandle,
  clearStoredFolderHandle,
  queryFolderPermission,
  requestFolderPermission,
  writeFileToFolder,
  readFileFromFolder,
  loadSyncSettings,
  saveSyncSettings,
  FOLDER_BACKUP_FILENAME,
  type AutoMode,
} from "../lib/folderSync";

// Folder-sync backup: write the workbench backup JSON to a user-chosen folder
// (manually or on an interval). If that folder is a Drive/Dropbox/OneDrive
// desktop-sync folder, the provider uploads + versions it — cloud backup with
// no OAuth and no server. Reuses the exact backup payload as the file
// download/upload path; this is just a different transport.

type Perm = "granted" | "prompt" | "denied" | "none";

const AUTO_OPTIONS: { value: AutoMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "5", label: "5 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleString();
}

export function FolderSyncCard({
  onLoadBackup,
}: {
  onLoadBackup: (f: BackupFile) => void;
}) {
  const toast = useWorkbench((s) => s.toast_show);
  const supported = isFolderSyncSupported();

  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [perm, setPerm] = useState<Perm>("none");
  const [mode, setMode] = useState<AutoMode>("off");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Last-written backup `data` JSON, so the interval only writes on change.
  const lastDataRef = useRef<string | null>(null);

  // Rehydrate stored handle + settings on mount (no permission prompt here —
  // that needs a user gesture, surfaced as the Reconnect button).
  useEffect(() => {
    if (!supported) return;
    const s = loadSyncSettings();
    setMode(s.mode);
    setLastSynced(s.lastSynced);
    setFolderName(s.folderName);
    let cancelled = false;
    getStoredFolderHandle().then(async (h) => {
      if (cancelled || !h) return;
      const p = await queryFolderPermission(h);
      if (cancelled) return;
      setHandle(h);
      setFolderName(h.name);
      setPerm(p as Perm);
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const persist = useCallback(
    (patch: Partial<{ mode: AutoMode; lastSynced: string | null; folderName: string | null }>) => {
      const cur = loadSyncSettings();
      saveSyncSettings({ ...cur, ...patch });
    },
    [],
  );

  async function connect() {
    setBusy(true);
    try {
      const h = await pickBackupFolder();
      if (!h) return; // cancelled / unsupported
      const ok = await requestFolderPermission(h);
      setHandle(h);
      setFolderName(h.name);
      setPerm(ok ? "granted" : "prompt");
      persist({ folderName: h.name });
      lastDataRef.current = null; // force a write on next backup
      if (ok) toast(`Folder connected: ${h.name}`);
    } finally {
      setBusy(false);
    }
  }

  async function reconnect() {
    if (!handle) return;
    setBusy(true);
    try {
      const ok = await requestFolderPermission(handle);
      setPerm(ok ? "granted" : "denied");
      if (ok) toast(`Reconnected: ${handle.name}`);
      else toast("Folder access was not granted.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await clearStoredFolderHandle();
    setHandle(null);
    setPerm("none");
    setFolderName(null);
    setMode("off");
    persist({ folderName: null, mode: "off" });
    toast("Folder disconnected. Auto-backup off.");
  }

  // Shared write. `force` ignores the change-detection (used by manual backup).
  const writeBackup = useCallback(
    async (h: FileSystemDirectoryHandle, force: boolean): Promise<boolean> => {
      const file = buildBackup();
      const dataStr = JSON.stringify(file.data);
      if (!force && dataStr === lastDataRef.current) return false; // unchanged
      await writeFileToFolder(
        h,
        FOLDER_BACKUP_FILENAME,
        JSON.stringify(file, null, 2),
      );
      lastDataRef.current = dataStr;
      const now = new Date().toISOString();
      setLastSynced(now);
      persist({ lastSynced: now });
      return true;
    },
    [persist],
  );

  async function backupNow() {
    if (!handle) return;
    setBusy(true);
    try {
      if (perm !== "granted") {
        const ok = await requestFolderPermission(handle);
        setPerm(ok ? "granted" : "denied");
        if (!ok) {
          toast("Folder access was not granted.", "error");
          return;
        }
      }
      await writeBackup(handle, true);
      toast(`Backed up to ${handle.name}/${FOLDER_BACKUP_FILENAME}`);
    } catch {
      toast("Couldn't write the backup file.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function restoreFromFolder() {
    if (!handle) return;
    setBusy(true);
    try {
      if (perm !== "granted") {
        const ok = await requestFolderPermission(handle);
        setPerm(ok ? "granted" : "denied");
        if (!ok) {
          toast("Folder access was not granted.", "error");
          return;
        }
      }
      const text = await readFileFromFolder(handle, FOLDER_BACKUP_FILENAME);
      if (text === null) {
        toast(`No ${FOLDER_BACKUP_FILENAME} in that folder yet.`, "error");
        return;
      }
      const parsed = JSON.parse(text);
      if (!isBackupFile(parsed)) {
        toast("That file isn't a workbench backup.", "error");
        return;
      }
      onLoadBackup(parsed); // hands off to the shared restore-preview flow
    } catch {
      toast("Couldn't read the backup file.", "error");
    } finally {
      setBusy(false);
    }
  }

  // Auto-backup interval. Only runs while connected, permitted, and a non-off
  // interval is chosen; writes only when the backup data has actually changed.
  useEffect(() => {
    if (mode === "off" || !handle || perm !== "granted") return;
    const ms = Number(mode) * 60_000;
    const id = setInterval(() => {
      writeBackup(handle, false).catch(() => {
        /* transient write failure — try again next tick */
      });
    }, ms);
    return () => clearInterval(id);
  }, [mode, handle, perm, writeBackup]);

  function chooseMode(m: AutoMode) {
    setMode(m);
    persist({ mode: m });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!supported) {
    return (
      <div
        className="card"
        style={{ borderLeft: "3px solid var(--border-strong)", marginTop: 12 }}
      >
        <h4>Folder sync — auto-backup to a folder</h4>
        <p className="sub" style={{ marginTop: 4 }}>
          Your browser doesn't support the File System Access API (currently
          Chrome, Edge, and other Chromium browsers only). Use{" "}
          <b>Download backup</b> above instead — or open the workbench in a
          Chromium browser to auto-save backups straight to a folder.
        </p>
      </div>
    );
  }

  const connected = !!handle;
  const needsReconnect = connected && perm !== "granted";

  return (
    <div
      className="card"
      style={{ borderLeft: "3px solid var(--gn)", marginTop: 12 }}
    >
      <h4>Folder sync — auto-backup to a folder</h4>
      <p className="sub" style={{ marginTop: 4 }}>
        Pick a folder once and the workbench writes its backup file there —
        manually or on an interval. Point it at your{" "}
        <b>Google Drive, Dropbox, or OneDrive desktop-sync folder</b> and that
        provider uploads and version-histories it for you: cloud backup with no
        login and no server. The file is the same all-in-one JSON as{" "}
        <b>Download backup</b>; only the destination differs.
      </p>

      {!connected && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={connect} disabled={busy}>
            🗂 Connect a folder…
          </button>
        </div>
      )}

      {connected && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: needsReconnect ? "var(--am)" : "var(--gn)",
                flex: "0 0 auto",
              }}
            />
            <b style={{ fontFamily: "var(--mono)" }}>{folderName}</b>
            <span className="dim" style={{ fontSize: 12 }}>
              {needsReconnect
                ? "needs reconnecting after reload"
                : `last backup: ${relativeTime(lastSynced)}`}
            </span>
          </div>

          {needsReconnect ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn btn-sm" onClick={reconnect} disabled={busy}>
                🔓 Reconnect folder
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={disconnect}
                disabled={busy}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <button className="btn btn-sm" onClick={backupNow} disabled={busy}>
                  ⬇ Back up now
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={restoreFromFolder}
                  disabled={busy}
                  title={`Read ${FOLDER_BACKUP_FILENAME} from the folder and restore it`}
                >
                  ⬆ Restore from folder
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={disconnect}
                  disabled={busy}
                >
                  Disconnect
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span className="dim" style={{ fontSize: 12 }}>
                  Auto-backup when changed, every:
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {AUTO_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => chooseMode(o.value)}
                      style={{
                        font: "11px var(--sans)",
                        padding: "2px 8px",
                        borderRadius: 12,
                        border: `1px solid ${mode === o.value ? "var(--ac)" : "var(--border)"}`,
                        background: mode === o.value ? "var(--ac)" : "transparent",
                        color: mode === o.value ? "var(--bg)" : "var(--text-dim)",
                        cursor: "pointer",
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {mode !== "off" && (
                <p className="dim" style={{ fontSize: 11, margin: "8px 0 0" }}>
                  While this tab is open, the workbench checks every {mode}{" "}
                  minutes and writes a fresh backup only if your work has
                  changed. Closing the tab pauses auto-backup until you reopen
                  it.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
