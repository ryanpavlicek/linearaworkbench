#!/usr/bin/env node
// Generates the PWA/favicon icons: the Linear A sign A (AB08, U+10613) in
// the app's accent blue on a dark rounded square, rendered with the
// self-hosted Noto Sans Linear A font via headless Chromium (Playwright —
// already a devDependency for the e2e suite). Run once and commit the
// output; re-run only if the icon design or font changes.
//
// Run with: node scripts/make-icons.mjs

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

const fontB64 = readFileSync(
  resolve(root, "public", "fonts", "noto-sans-linear-a-linear-a-400.woff2"),
).toString("base64");

const html = `<!doctype html><style>
@font-face {
  font-family: "Noto Sans Linear A";
  src: url(data:font/woff2;base64,${fontB64}) format("woff2");
}
</style><body></body>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.evaluate(() =>
  document.fonts.load("400px 'Noto Sans Linear A'", "\u{10613}"),
);

const SIZES = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
  ["favicon-32.png", 32],
];

for (const [name, size] of SIZES) {
  const b64 = await page.evaluate((s) => {
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d");
    const r = s * 0.18;
    x.fillStyle = "#11151c";
    x.beginPath();
    x.moveTo(r, 0); x.lineTo(s - r, 0); x.arcTo(s, 0, s, r, r);
    x.lineTo(s, s - r); x.arcTo(s, s, s - r, s, r);
    x.lineTo(r, s); x.arcTo(0, s, 0, s - r, r);
    x.lineTo(0, r); x.arcTo(0, 0, r, 0, r);
    x.fill();
    x.fillStyle = "#5b9eff";
    x.font = `${Math.round(s * 0.62)}px 'Noto Sans Linear A'`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("\u{10613}", s / 2, s * 0.54);
    return c.toDataURL("image/png").split(",")[1];
  }, size);
  writeFileSync(resolve(outDir, name), Buffer.from(b64, "base64"));
  console.log(`${name} (${size}px)`);
}

await browser.close();
