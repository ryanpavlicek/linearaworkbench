import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { BACKUP_KIND, type BackupFile } from "../src/lib/backup";

// Real-browser proof of the backup lifecycle the Data Export module promises:
// create work → download a backup (the real anchor-click download, captured
// via Playwright's download API) → wipe everything through the armed reset →
// restore the file through the real file-picker → the work comes back.
// The unit layer (src/lib/backup.test.ts) covers the round-trip in jsdom;
// this is the end-to-end version with the actual file on disk in the middle.
test("backup → reset → restore round-trips a research note", async ({
  page,
}, testInfo) => {
  // Two full page reloads (reset, restore) sit inside this journey; the
  // default 30 s per-test budget is not enough for build-cold Chromium.
  test.setTimeout(120_000);
  const NOTE_TITLE = "Backup lifecycle probe";
  const NOTE_BODY = "HT 13 recheck: the KU-RO line matches the item total.";

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: /linear a research workbench/i,
    }),
  ).toBeVisible({ timeout: 30_000 });

  // ── Create a note (My Research → Notes is the default tab) ─────────────
  await page.getByRole("button", { name: /^my research$/i }).click();
  await expect(page.getByRole("tab", { name: /^notes$/i })).toBeVisible();
  await page.getByRole("button", { name: "+ New note" }).click();
  await page.getByPlaceholder(/note title/i).fill(NOTE_TITLE);
  await page.getByPlaceholder(/write your thoughts here/i).fill(NOTE_BODY);
  // Autosave is debounced (350 ms); the note list re-renders from the store
  // once the save lands. Wait for the title to appear there before moving on,
  // otherwise navigating away could drop the pending edit.
  await expect(
    page.getByRole("button", { name: /backup lifecycle probe/i }),
  ).toBeVisible();

  // ── Download a backup via the real download path ───────────────────────
  await page.getByRole("button", { name: /^data export$/i }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download backup/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^linear_a_workbench_backup_\d{13}\.json$/,
  );
  const backupPath = testInfo.outputPath("backup.json");
  await download.saveAs(backupPath);

  // The file on disk is a valid backup and actually contains the note.
  const parsed = JSON.parse(readFileSync(backupPath, "utf8")) as BackupFile;
  expect(parsed.kind).toBe(BACKUP_KIND);
  const notes = parsed.data.notes as { title: string; body: string }[];
  expect(notes.some((n) => n.title === NOTE_TITLE && n.body === NOTE_BODY)).toBe(
    true,
  );

  // ── Wipe everything through the armed two-step reset ───────────────────
  await page.getByRole("button", { name: /reset everything/i }).click();
  await page.getByPlaceholder("CLEAR").fill("CLEAR");
  const resetReload = page.waitForEvent("load");
  await page.getByRole("button", { name: /erase everything/i }).click();
  await resetReload;

  // After the reload the URL module-sync brings the app back to Data Export;
  // what matters is that the researcher's data is gone. The reset card is
  // back in its disarmed state, and My Research shows no notes.
  await expect(
    page.getByRole("button", { name: /reset everything/i }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /^my research$/i }).click();
  await expect(page.getByText(/no notes yet/i)).toBeVisible();

  // ── Restore from the downloaded file ───────────────────────────────────
  await page.getByRole("button", { name: /^data export$/i }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /restore from file/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(backupPath);

  // The restore preview summarizes the file; apply it in replace mode (the
  // destructive path, guarded by a confirm dialog we accept).
  await expect(
    page.getByRole("heading", { name: /restore preview/i }),
  ).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  const restoreReload = page.waitForEvent("load");
  await page.getByRole("button", { name: /replace everything/i }).click();
  await restoreReload;

  // The note is back: listed, auto-selected, body intact in the editor.
  await page.getByRole("button", { name: /^my research$/i }).click();
  await expect(
    page.getByRole("button", { name: /backup lifecycle probe/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByPlaceholder(/write your thoughts here/i)).toHaveValue(
    NOTE_BODY,
  );
});
