// Lint scope is deliberately narrow: the React hooks invariants
// (rules-of-hooks, exhaustive-deps) over the app source. Typechecking is
// tsc's job; formatting is nobody's job. The few deliberate exhaustive-deps
// exemptions in the codebase carry inline disable comments with reasons.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/",
      "coverage/",
      "public/",
      "reports/",
      ".stryker-tmp/",
      "node_modules/",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];
