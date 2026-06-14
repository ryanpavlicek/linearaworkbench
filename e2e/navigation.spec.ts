import { test, expect } from "@playwright/test";

// Mirrors the jsdom command-palette journey in src/test/app.integration.test.tsx
// so the two stay in lockstep; this is the real-browser proof.
test("command palette (Ctrl+K) jumps to another module", async ({ page }) => {
  await page.goto("/");
  // Fresh browser lands on Home (no first-run modal anymore). Match the
  // page's own level-2 heading; the top bar carries an h1 with the same text.
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: /linear a research workbench/i,
    }),
  ).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press("Control+k");
  const palette = page.getByPlaceholder(/jump to a module/i);
  await expect(palette).toBeVisible();
  await palette.fill("Accounting");
  await palette.press("Enter");

  await expect(
    page.getByRole("heading", { name: /accounting & metrology/i }),
  ).toBeVisible();
});
