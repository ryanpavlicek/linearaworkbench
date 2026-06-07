import { defineConfig } from "vitest/config";

// Tests target the pure analytical core in src/lib. None of it touches the
// DOM (localStorage access is try/catch-guarded), so a plain Node environment
// is enough — no jsdom, no React plugin. A dedicated vitest.config.ts (rather
// than reusing vite.config.ts) avoids pulling in the dev-server `open: true`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
