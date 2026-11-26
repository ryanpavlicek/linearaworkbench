import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCorpusExport } from "./src/lib/corpusExport";
import type { Inscription, SignData, WordEntry } from "./src/lib/types";

// `BASE_URL` env var is set by the GitHub Pages deploy workflow to
// "/<repo-name>/" so that asset paths resolve under the project URL.
// Local dev and other deployment targets default to relative paths.
const base = process.env.BASE_URL || "./";

// Emits the documented static data API (docs/API.md) into dist/api/v1/ at
// build time: the same enriched schema-v1 export the in-app Data Export
// button builds — derived analyses and provenance included — plus one JSON
// per inscription and an id manifest. The Pages deploy then serves it at
// stable URLs, so the corpus is scriptable without ever opening the UI.
function staticApiPlugin(): Plugin {
  return {
    name: "emit-static-api",
    apply: "build",
    closeBundle() {
      const pub = (f: string) =>
        resolve(process.cwd(), "public", "corpus", f);
      const inscriptions: Inscription[] = JSON.parse(
        readFileSync(pub("inscriptions.json"), "utf8"),
      );
      const signs: SignData[] = JSON.parse(
        readFileSync(pub("signs.json"), "utf8"),
      );
      // Minimal word index — the same accumulation the store performs, for
      // the export's word-frequency block.
      const wordIndex = new Map<string, WordEntry>();
      for (const ins of inscriptions) {
        for (const w of ins.words) {
          let e = wordIndex.get(w);
          if (!e) {
            e = { count: 0, inscriptionIds: [], sites: new Set() };
            wordIndex.set(w, e);
          }
          e.count++;
          if (!e.inscriptionIds.includes(ins.id)) e.inscriptionIds.push(ins.id);
          if (ins.site) e.sites.add(ins.site);
        }
      }
      const full = buildCorpusExport(inscriptions, signs, wordIndex, {
        scope: {
          site: null,
          period: null,
          scribe: null,
          support: null,
          collectionId: null,
        },
        scopeSummary: "full corpus",
        includeUserState: false,
        includeSigns: true,
        includeWordFrequencies: true,
        hypothesis: {},
        annotations: [],
        collections: [],
        pins: [],
        tabletCategoryOverrides: {},
      });
      const out = resolve(process.cwd(), "dist", "api", "v1");
      mkdirSync(resolve(out, "inscriptions"), { recursive: true });
      writeFileSync(resolve(out, "corpus.json"), JSON.stringify(full));
      // Ids are mostly filename-safe; the manifest maps any that are not.
      const files: Record<string, string> = {};
      for (const exp of full.inscriptions) {
        const file = `${exp.id.replace(/[^A-Za-z0-9._-]+/g, "_")}.json`;
        files[exp.id] = file;
        writeFileSync(
          resolve(out, "inscriptions", file),
          JSON.stringify(exp),
        );
      }
      writeFileSync(
        resolve(out, "index.json"),
        JSON.stringify({
          schemaVersion: full._meta.schemaVersion,
          inscriptionCount: full._meta.inscriptionCount,
          files,
        }),
      );
      console.log(
        `api/v1: corpus.json + ${full.inscriptions.length} inscription files`,
      );
    },
  };
}

// Stamps the service worker's cache-name placeholder with package version +
// an 8-char content hash of built assets, and injects the full list of built
// JS/CSS chunks (including all lazy-loaded module chunks) into __PRECACHE_ASSETS__
// so every deploy rotates caches cleanly and works offline on first visit.
function swVersionPlugin(): Plugin {
  return {
    name: "stamp-sw-version",
    apply: "build",
    closeBundle() {
      const { version } = JSON.parse(
        readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
      ) as { version: string };
      const assetsDir = resolve(process.cwd(), "dist", "assets");
      const assetFiles = readdirSync(assetsDir)
        .filter((f) => /\.(?:js|css)$/.test(f))
        .sort()
        .map((f) => `assets/${f}`);
      const hash = createHash("sha256")
        .update(version)
        .update("\n")
        .update(assetFiles.join("\n"))
        .digest("hex")
        .slice(0, 8);
      const swPath = resolve(process.cwd(), "dist", "sw.js");
      const stamped = readFileSync(swPath, "utf8")
        .replaceAll("__WORKBENCH_VERSION__", `${version}-${hash}`)
        .replaceAll("__PRECACHE_ASSETS__", JSON.stringify(assetFiles));
      writeFileSync(swPath, stamped);
    },
  };
}

export default defineConfig({
  plugins: [react(), staticApiPlugin(), swVersionPlugin()],
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
