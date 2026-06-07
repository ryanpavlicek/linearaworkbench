import { defineConfig } from "vitest/config";

// Tests target the pure analytical/serialization core in src/lib plus the
// Zustand store. Most of it never touches the DOM (localStorage access is
// try/catch-guarded), so the default environment is Node; the few files that
// need a DOM (the HTML sanitizer, the store's localStorage persistence) opt
// into jsdom per-file via an `// @vitest-environment jsdom` pragma. A
// dedicated vitest.config.ts (rather than reusing vite.config.ts) avoids
// pulling in the dev-server `open: true`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Gate the analytical/serialization core. The store has its own
      // dedicated tests (store/workbench.test.ts) but isn't under the numeric
      // gate yet — several actions remain uncovered.
      include: ["src/lib/**"],
      exclude: [
        "src/lib/**/*.test.ts",
        "src/lib/types.ts", // type declarations only — nothing to execute
        // Browser/IO-bound glue: File System Access, DOM download, fetch
        // loaders, React hooks, SVG rasterization. These need integration /
        // E2E coverage, not unit tests, so they're out of the unit gate.
        "src/lib/folderSync.ts",
        "src/lib/svgSnapshot.ts",
        "src/lib/popover.ts",
        "src/lib/useFocusTrap.ts",
        "src/lib/commentary.ts",
        "src/lib/backup.ts",
        "src/lib/reportSnippet.ts",
        "src/lib/markdown.tsx",
        "src/lib/persistence.ts",
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
});
