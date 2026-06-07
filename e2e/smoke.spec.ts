import { test, expect } from "@playwright/test";

// Real-browser smoke: boot the deployed build, run a search, open a tablet.
// Selectors mirror src/test/app.integration.test.tsx (verified against the real
// component DOM), so this stays in lockstep with the jsdom integration test.
test("boot → search → open a tablet detail", async ({ page }) => {
  await page.goto("/");

  // App boots by fetching the corpus, then renders the default Corpus Search.
  await expect(
    page.getByRole("heading", { name: /corpus search/i }),
  ).toBeVisible({ timeout: 30_000 });

  // Type a securely-attested term and confirm results render.
  await page.getByPlaceholder(/search words or inscription ids/i).fill("KU-RO");
  await expect(page.locator("table tbody tr").first()).toBeVisible();

  // Open the first result's detail modal.
  await page.locator(".word-link").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
