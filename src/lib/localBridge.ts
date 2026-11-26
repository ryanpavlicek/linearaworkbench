// Optional loopback bridge for `aegean workbench --state <workspace.json>`.
// Active only when the page is served from localhost / 127.0.0.1 and opened
// with `?localState=1`. Never runs on deployed public origins.

import { applyBackup, buildBackup, isBackupFile } from "./backup";

export function isLocalStateEnabled(): boolean {
  try {
    const host = window.location.hostname;
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("localState") === "1";
  } catch {
    return false;
  }
}

/**
 * Hydrate localStorage from the local Python server's `/api/local/backup`
 * endpoint before React mounts the store. No-op when not in local-state mode
 * or when the server returns 204 / non-backup JSON.
 */
export async function hydrateLocalState(): Promise<void> {
  if (!isLocalStateEnabled()) return;
  try {
    const res = await fetch("/api/local/backup", { cache: "no-store" });
    if (!res.ok || res.status === 204) return;
    const raw: unknown = await res.json();
    if (isBackupFile(raw)) {
      applyBackup(raw, "replace");
    }
  } catch {
    // Local server may not have an initial state file yet; fall back cleanly.
  }
}

/** Push the current workbench backup to the local Python server. */
export async function pushLocalState(): Promise<void> {
  if (!isLocalStateEnabled()) return;
  try {
    await fetch("/api/local/backup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBackup()),
    });
  } catch {
    // Ignore transient errors (e.g. server shut down while tab still open).
  }
}
