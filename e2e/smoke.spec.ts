import { test, expect } from "@playwright/test";

// Real-browser smoke: boot the deployed build, run a search, open a tablet.
// Selectors mirror src/test/app.integration.test.tsx (verified against the real
// component DOM), so this stays in lockstep with the jsdom integration test.
test("boot → search → open a tablet detail", async ({ page }) => {
  await page.goto("/");

  // A fresh browser always shows the first-run Welcome modal; its scrim covers
  // the page, so dismiss it the way a new user would before interacting.
  await page
    .getByRole("button", { name: /got it — let me explore/i })
    .click({ timeout: 30_000 });

  // App boots by fetching the corpus, then renders the default Corpus Search.
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
