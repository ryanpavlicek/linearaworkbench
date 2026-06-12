import { test, expect } from "@playwright/test";

// Real-browser smoke: boot the deployed build, land on Home, run a search,
// open a tablet. Selectors mirror src/test/app.integration.test.tsx
// (verified against the real component DOM), so this stays in lockstep with
// the jsdom integration test.
test("boot → home → search → open a tablet detail", async ({ page }) => {
  await page.goto("/");

  // A fresh browser lands on the Home page (no first-run modal anymore).
  await expect(
    page.getByRole("heading", { name: /linear a research workbench/i }),
  ).toBeVisible({ timeout: 30_000 });

  // Navigate to Corpus Search via the sidebar, the way a new user would.
  await page.getByRole("button", { name: /^corpus search$/i }).click();
  await expect(
    page.getByRole("heading", { name: /corpus search/i }),
  ).toBeVisible();

  // Type a securely-attested term and confirm results render.
  await page.getByPlaceholder(/search words or inscription ids/i).fill("KU-RO");
  await expect(page.locator("table tbody tr").first()).toBeVisible();

  // Open the first result's detail modal.
  await page.locator(".word-link").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
