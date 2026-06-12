import { test, expect } from "@playwright/test";

// Mirrors the jsdom command-palette journey in src/test/app.integration.test.tsx
// so the two stay in lockstep; this is the real-browser proof.
test("command palette (Ctrl+K) jumps to another module", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /got it — let me explore/i })
    .click({ timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: /corpus search/i }),
  ).toBeVisible();

  await page.keyboard.press("Control+k");
  const palette = page.getByPlaceholder(/jump to a module/i);
  await expect(palette).toBeVisible();
  await palette.fill("Accounting");
  await palette.press("Enter");

  await expect(
    page.getByRole("heading", { name: /accounting & metrology/i }),
  ).toBeVisible();
});
