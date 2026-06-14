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
    // Run test files in forked child processes rather than the default
    // worker_threads (tinypool) pool: the thread pool crashes with
    // "Worker exited unexpectedly" under the heavy jsdom behavior tests on
    // newer Node (observed on v26). Forks are slower to spawn but stable.
    pool: "forks",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Keeps jsdom's localStorage visible on Nodes that define their own
    // experimental webstorage getter (see the file for the full story).
    setupFiles: ["src/test/jsdomStorageFix.ts"],
    // Headroom for jsdom component/integration tests under coverage
    // instrumentation (which slows renders) so CI can't flake on a timeout.
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      // Gate the analytical/serialization core (src/lib) and the Zustand store
      // (src/store) — the app's logic layer. The React UI is smoke-tested for
      // crash-free mount (see modules.smoke.test.tsx) but isn't under the
      // numeric line/branch gate; that's the job of the E2E layer.
      include: ["src/lib/**", "src/store/**"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
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
