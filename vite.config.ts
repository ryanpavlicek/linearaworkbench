import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `BASE_URL` env var is set by the GitHub Pages deploy workflow to
// "/<repo-name>/" so that asset paths resolve under the project URL.
// Local dev and other deployment targets default to relative paths.
const base = process.env.BASE_URL || "./";

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    target: "es2020",
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
