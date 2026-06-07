import { defineConfig, devices } from "@playwright/test";

// Browser-level smoke test of the built app. Runs in CI (GitHub runners can
// download the browser); the same boot→search→open flow is also covered at the
// jsdom level by src/test/app.integration.test.tsx, which runs everywhere.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Build the app and serve dist/ via vite preview. Self-contained so
  // `npx playwright test` works without a separately-running dev server.
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
