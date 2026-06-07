import { defineConfig } from "vitest/config";

// A trimmed Vitest config used only by Stryker mutation runs: just the fast,
// pure-Node unit tests that exercise the mutated modules. Excludes the jsdom
// component/integration tests so each mutant evaluates quickly.
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/lib/numerals.test.ts",
      "src/lib/signPattern.test.ts",
      "src/lib/compareAlign.test.ts",
    ],
  },
});
