import { useEffect, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { downloadFile, upstreamAsset } from "../lib/helpers";
import { wordToPhonetic } from "../lib/algorithms";
import { KEYS, loadJson, saveJson } from "../lib/persistence";
import type {
  Annotation,
  SavedHypothesis,
  Collection,
  Finding,
  Inscription,
  PhoneticOverrides,
  ResearchNote,
  WordEntry,
} from "../lib/types";
import {
  noteRefs as parseNoteRefs,
  renderNoteHtml,
  type RefKind,
} from "../lib/notes";
import {
  buildCitations,
  CITATION_STYLE_LABEL,
  DEFAULT_CITATION_OPTIONS,
  type CitationStyle,
} from "../lib/citations";
import { sanitizeHtmlFragment } from "../lib/sanitizeHtml";

const CONFIDENCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

type Section =
  | "annotations"
  | "hypotheses"
  | "collections"
  | "findings"
  | "reclassified";

const SECTION_LABEL: Record<Section, string> = {
  annotations: "Annotations",
  hypotheses: "Sound-shift hypotheses",
  collections: "Collections",
  findings: "Findings",
  reclassified: "Reclassified tablets",
};

type ImageShow = "facsimile" | "photo" | "both";

type ReportBlock =
  | {
      kind: "section";
      bid: string;
      section: Section;
      enabled: boolean;
      // Per-item curation: ids (annotation/finding/collection ids,
      // hypothesis names, tablet ids) excluded from this section's render.
      excluded?: string[];
    }
  | { kind: "text"; bid: string; heading: string; body: string }
  | {
      kind: "image";
      bid: string;
      inscriptionId: string;
      caption: string;
      show: ImageShow;
    }
  | { kind: "note"; bid: string; noteId: string }
  | {
      kind: "citation";
      bid: string;
      heading: string;
      style: CitationStyle;
      includeGorila: boolean;
      includeMwenge: boolean;
      includeYounger: boolean;
      includeSigla: boolean;
      includeWorkbench: boolean;
    };

type CollImgMode = "facsimile" | "photo" | "both" | "off";

interface ReportConfig {
  title: string;
  author: string;
  subtitle: string;
  blocks: ReportBlock[];
  // Which plate(s) of each collection inscription to embed. Default facsimile.
  collectionImageMode?: CollImgMode;
}

// Apply a section block's per-item exclusions to the report data. Sections
// read whichever list they render from; everything else passes through.
function curatedData(
  d: ReportData,
  b: Extract<ReportBlock, { kind: "section" }>,
): ReportData {
  if (!b.excluded || b.excluded.length === 0) return d;
  const ex = new Set(b.excluded);
  return {
    ...d,
    annotations: d.annotations.filter((a) => !ex.has(a.id)),
    findings: d.findings.filter((f) => !ex.has(f.id)),
    collections: d.collections.filter((c) => !ex.has(c.id)),
    hypotheses: d.hypotheses.filter((h) => !ex.has(h.name)),
    tabletCategories: Object.fromEntries(
      Object.entries(d.tabletCategories).filter(([id]) => !ex.has(id)),
    ),
  };
}

// The curatable items of a section, with display labels — what the
// per-item checklist renders.
function sectionItems(
  section: Section,
  d: ReportData,
): { id: string; label: string }[] {
  switch (section) {
    case "annotations":
      return d.annotations.map((a) => ({
        id: a.id,
        label: `${a.target.value}${a.proposedMeaning ? ` — ${a.proposedMeaning}` : ""}`,
      }));
    case "hypotheses":
      return d.hypotheses.map((h) => ({ id: h.name, label: h.name }));
    case "collections":
      return d.collections.map((c) => ({
        id: c.id,
        label: `${c.name} (${c.items.length})`,
      }));
    case "findings":
      return d.findings.map((f) => ({ id: f.id, label: f.title }));
    case "reclassified":
      return Object.entries(d.tabletCategories).map(([id, cat]) => ({
        id,
        label: `${id} → ${cat}`,
      }));
  }
}

function defaultBlocks(): ReportBlock[] {
  const order: Section[] = [
    "annotations",
    "hypotheses",
    "collections",
    "findings",
    "reclassified",
  ];
  return order.map((s) => ({
    kind: "section",
    bid: `sec-${s}`,
    section: s,
    enabled: true,
  }));
}

function defaultConfig(): ReportConfig {
  return {
    title: "Linear A — Research Notes",
    author: "",
    subtitle: "",
    blocks: defaultBlocks(),
    collectionImageMode: "facsimile",
  };
}

interface ReportData {
  annotations: Annotation[];
  hypotheses: SavedHypothesis[];
  collections: Collection[];
  tabletCategories: Record<string, string>;
  findings: Finding[];
  notes: ResearchNote[];
  byId: Map<string, Inscription>;
  wordIndex: Map<string, WordEntry>;
  hyp: PhoneticOverrides;
}

// For HTML/Markdown export of note-block references, look up a better label
// than the bare id when one is available (e.g. an annotation id → its target;
// a finding id → its title). Null means the Markdown link label is already
// the right thing to show (ins / word / sign, or a dangling id).
function resolveRefLabel(
  kind: RefKind,
  value: string,
  d: ReportData,
): string | null {
  if (kind === "annotation") {
    const a = d.annotations.find((x) => x.id === value);
    if (a)
      return `${a.target.value}${a.proposedMeaning ? ` — ${a.proposedMeaning}` : ""}`;
  }
  if (kind === "collection") {
    const c = d.collections.find((x) => x.id === value);
    if (c) return c.name;
  }
  if (kind === "finding") {
    const f = d.findings.find((x) => x.id === value);
    if (f) return f.title;
  }
  if (kind === "note") {
    const n = d.notes.find((x) => x.id === value);
    if (n) return n.title || "(untitled note)";
  }
  return null;
}

// Metadata one-liner for an inscription, mirroring the detail modal header.
function insMeta(ins: Inscription): string {
  return [ins.site, ins.context, ins.scribe, ins.support]
    .filter(Boolean)
    .join(" · ");
}
function glossesDiffer(ins: Inscription): boolean {
  return (
    ins.translations.length > 0 &&
    ins.translations.some((t, i) => t && t !== ins.words[i])
  );
}

const rid = () => Math.random().toString(36).slice(2, 9);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Embedded imagery for the HTML export: block id → data-URI thumbnails.
interface ReportImage {
  id: string;
  site: string;
  context: string;
  show: ImageShow;
  caption: string;
  facsimile?: string;
  photo?: string;
}

// ── Markdown ───────────────────────────────────────────────────────────────
function sectionMarkdown(section: Section, d: ReportData): string[] {
  const out: string[] = [];
  if (section === "annotations" && d.annotations.length) {
    out.push("## Proposed readings & annotations", "");
    const byConf = [...d.annotations].sort(
      (a, b) =>
        (CONFIDENCE_ORDER[a.confidence] ?? 9) -
          (CONFIDENCE_ORDER[b.confidence] ?? 9) ||
        a.target.value.localeCompare(b.target.value),
    );
    out.push(
      "| Target | Kind | Proposed meaning | Confidence | Notes |",
      "|---|---|---|---|---|",
    );
    for (const a of byConf) {
      const notes = (a.notes || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const meaning = (a.proposedMeaning || "").replace(/\|/g, "\\|");
      out.push(
        `| \`${a.target.value}\` | ${a.target.kind} | ${meaning} | ${a.confidence} | ${notes} |`,
      );
    }
    out.push("");
  } else if (section === "hypotheses" && d.hypotheses.length) {
    out.push("## Sound-shift hypotheses", "");
    for (const h of d.hypotheses) {
      out.push(`### ${h.name}`, "");
      const overrides = Object.entries(h.overrides);
      if (!overrides.length) out.push("_Baseline — no sign overrides._");
      else {
        out.push("| Sign | Default → Proposed | Reasoning |", "|---|---|---|");
        for (const [sign, value] of overrides) {
          const note = (h.evidence?.[sign]?.note || "")
            .replace(/\|/g, "\\|")
            .replace(/\n/g, " ");
          out.push(`| \`${sign}\` | → \`${value}\` | ${note} |`);
        }
      }
      out.push("");
    }
  } else if (section === "collections" && d.collections.length) {
    out.push("## Collections", "");
    for (const c of d.collections) {
      out.push(`### ${c.name} (${c.items.length})`, "");
      if (!c.items.length) {
        out.push("_empty_", "");
        continue;
      }
      const words = c.items.filter((it) => it.kind === "word");
      const inscrs = c.items.filter((it) => it.kind === "inscription");
      if (words.length) {
        for (const it of words) {
          const e = d.wordIndex.get(it.value);
          out.push(
            `- \`${it.value}\` /${wordToPhonetic(it.value, d.hyp)}/ — ${e?.count ?? 0}× across ${e?.sites.size ?? 0} site${e && e.sites.size === 1 ? "" : "s"}`,
          );
        }
        out.push("");
      }
      for (const it of inscrs) {
        const ins = d.byId.get(it.value);
        if (!ins) {
          out.push(`#### ${it.value}`, "_(not found in corpus)_", "");
          continue;
        }
        out.push(`#### ${ins.id}`);
        out.push(`*${insMeta(ins)} · ${ins.words.length} tokens*`, "");
        if (ins.glyphs) out.push(`**Glyphs:** ${ins.glyphs}`, "");
        out.push(`**Transliteration:** ${ins.words.join(" · ")}`, "");
        if (glossesDiffer(ins))
          out.push(`**Glosses:** ${ins.translations.join(" · ")}`, "");
      }
    }
  } else if (section === "findings" && d.findings.length) {
    out.push("## Findings", "");
    for (const f of d.findings) {
      out.push(
        `### ${f.title}`,
        `*${f.moduleLabel} · ${new Date(f.createdAt).toLocaleString()}*`,
        "",
        f.summary,
      );
      // Captured Markdown rendering of the result, when the module provided one.
      if (f.report?.markdown) out.push("", f.report.markdown);
      if (f.notes) out.push("", `> ${f.notes}`);
      out.push("");
    }
  } else if (section === "reclassified") {
    const rows = Object.entries(d.tabletCategories);
    if (rows.length) {
      out.push("## Reclassified tablets", "");
      out.push("| Tablet | Your category |", "|---|---|");
      for (const [id, cat] of rows) out.push(`| \`${id}\` | ${cat} |`);
      out.push("");
    }
  }
  return out;
}

function buildMarkdown(d: ReportData, cfg: ReportConfig): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# ${cfg.title || "Linear A — Research Notes"}`, "");
  if (cfg.subtitle) lines.push(`*${cfg.subtitle}*`, "");
  if (cfg.author) lines.push(`**Author:** ${cfg.author}  `);
  lines.push(`**Date:** ${date}  `);
  lines.push("**Generated with:** Linear A Research Workbench", "");

  let any = false;
  for (const b of cfg.blocks) {
    if (b.kind === "section" && b.enabled) {
      const s = sectionMarkdown(b.section, curatedData(d, b));
      if (s.length) {
        any = true;
        lines.push(...s);
      }
    } else if (b.kind === "text") {
      any = true;
      if (b.heading) lines.push(`## ${b.heading}`, "");
      if (b.body) lines.push(b.body, "");
    } else if (b.kind === "image") {
      any = true;
      lines.push(
        `**${b.caption || b.inscriptionId}** (\`${b.inscriptionId}\` — ${b.show})`,
        "_[image included in the HTML export]_",
        "",
      );
    } else if (b.kind === "note") {
      const n = d.notes.find((x) => x.id === b.noteId);
      if (n) {
        any = true;
        if (n.title) lines.push(`## ${n.title}`, "");
        if (n.body) lines.push(n.body, "");
      }
    } else if (b.kind === "citation") {
      any = true;
      if (b.heading) lines.push(`## ${b.heading}`, "");
      const cites = buildCitations({
        style: b.style,
        snapshotDate: date,
        includeGorila: b.includeGorila,
        includeMwenge: b.includeMwenge,
        includeYounger: b.includeYounger,
        includeSigla: b.includeSigla,
        includeWorkbench: b.includeWorkbench,
      });
      if (cites) {
        if (b.style === "bibtex") {
          // BibTeX entries belong in a fenced code block so verbatim symbols
          // and braces survive the Markdown round-trip.
          lines.push("```bibtex", cites, "```", "");
        } else {
          lines.push(cites, "");
        }
      }
    }
  }
  if (!any)
    lines.push(
      "_Nothing to include yet. Enable a section or add a block above, or record annotations / findings in the workbench._",
      "",
    );

  lines.push(
    "## Sources",
    "",
    "- **Corpus:** GORILA — Godart, L. & Olivier, J.-P. (1976–1985). *Recueil des inscriptions en linéaire A*. École Française d'Athènes.",
    "- **Digital corpus:** mwenge/lineara.xyz — <https://github.com/mwenge/lineara.xyz>",
    "- **Commentary:** John Younger, *Linear A: introduction, syllabary, transliterated texts, lexicon* (2024) — <https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction>",
    "- **Paleography:** SigLA — The Signs of Linear A — <https://sigla.phis.me/>",
    "",
    "> Analyses produced with the Linear A Research Workbench are exploratory. Linear A remains undeciphered; proposed readings are hypotheses, not established facts.",
    "",
  );
  return lines.join("\n");
}

// ── HTML ─────────────────────────────────────────────────────────────────
function sectionHtml(
  section: Section,
  d: ReportData,
  insImages: Map<string, { facsimile?: string; photo?: string }>,
): string {
  const p: string[] = [];
  if (section === "annotations" && d.annotations.length) {
    const byConf = [...d.annotations].sort(
      (a, b) =>
        (CONFIDENCE_ORDER[a.confidence] ?? 9) -
          (CONFIDENCE_ORDER[b.confidence] ?? 9) ||
        a.target.value.localeCompare(b.target.value),
    );
    p.push("<h2>Proposed readings &amp; annotations</h2>");
    p.push(
      "<table><thead><tr><th>Target</th><th>Kind</th><th>Proposed meaning</th><th>Confidence</th><th>Notes</th></tr></thead><tbody>",
    );
    for (const a of byConf)
      p.push(
        `<tr><td><code>${esc(a.target.value)}</code></td><td>${esc(a.target.kind)}</td><td>${esc(a.proposedMeaning)}</td><td><span class="conf conf-${a.confidence}">${a.confidence}</span></td><td>${esc(a.notes)}</td></tr>`,
      );
    p.push("</tbody></table>");
  } else if (section === "hypotheses" && d.hypotheses.length) {
    p.push("<h2>Sound-shift hypotheses</h2>");
    for (const h of d.hypotheses) {
      p.push(`<h3>${esc(h.name)}</h3>`);
      const overrides = Object.entries(h.overrides);
      if (!overrides.length)
        p.push("<p><em>Baseline — no sign overrides.</em></p>");
      else {
        p.push(
          "<table><thead><tr><th>Sign</th><th>Proposed</th><th>Reasoning</th></tr></thead><tbody>",
        );
        for (const [sign, value] of overrides)
          p.push(
            `<tr><td><code>${esc(sign)}</code></td><td>→ <code>${esc(value)}</code></td><td>${esc(h.evidence?.[sign]?.note ?? "")}</td></tr>`,
          );
        p.push("</tbody></table>");
      }
    }
  } else if (section === "collections" && d.collections.length) {
    p.push("<h2>Collections</h2>");
    for (const c of d.collections) {
      p.push(
        `<h3>${esc(c.name)} <span class="dim">(${c.items.length})</span></h3>`,
      );
      if (!c.items.length) {
        p.push("<p><em>empty</em></p>");
        continue;
      }
      const words = c.items.filter((it) => it.kind === "word");
      const inscrs = c.items.filter((it) => it.kind === "inscription");
      if (words.length)
        p.push(
          `<p>${words
            .map((it) => {
              const e = d.wordIndex.get(it.value);
              return `<code>${esc(it.value)}</code> <span class="dim">/${esc(wordToPhonetic(it.value, d.hyp))}/${e ? ` · ${e.count}×` : ""}</span>`;
            })
            .join(", ")}</p>`,
        );
      for (const it of inscrs) {
        const ins = d.byId.get(it.value);
        if (!ins) {
          p.push(
            `<p><code>${esc(it.value)}</code> <span class="dim">(not in corpus)</span></p>`,
          );
          continue;
        }
        const im = insImages.get(ins.id);
        p.push('<div class="ins-sheet">');
        p.push(
          `<div class="ins-head"><b>${esc(ins.id)}</b> <span class="dim">${esc(insMeta(ins))} · ${ins.words.length} tokens</span></div>`,
        );
        if (im && (im.facsimile || im.photo)) {
          const thumbs: string[] = [];
          if (im.facsimile)
            thumbs.push(
              `<img class="ins-thumb" src="${im.facsimile}" alt="${esc(ins.id)} facsimile" />`,
            );
          if (im.photo)
            thumbs.push(
              `<img class="ins-thumb" src="${im.photo}" alt="${esc(ins.id)} photograph" />`,
            );
          p.push(`<div class="ins-thumbs">${thumbs.join("")}</div>`);
        }
        if (ins.glyphs)
          p.push(`<div class="glyphs">${esc(ins.glyphs)}</div>`);
        p.push(
          `<div class="translit">${ins.words.map((w) => `<span>${esc(w)}</span>`).join(" ")}</div>`,
        );
        if (glossesDiffer(ins))
          p.push(
            `<div class="dim glosses"><b>Glosses:</b> ${esc(ins.translations.join(" · "))}</div>`,
          );
        p.push("</div>");
      }
    }
  } else if (section === "findings" && d.findings.length) {
    p.push("<h2>Findings</h2>");
    for (const f of d.findings) {
      // The interactive report script filters findings by reading `data-search`
      // — keep it cheap to grep over by stuffing the title, module, summary,
      // and notes (lowercased) into the attribute.
      const searchHay = [
        f.title,
        f.moduleLabel,
        f.summary,
        f.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .replace(/"/g, "&quot;");
      p.push(`<div class="finding" data-search="${searchHay}">`);
      p.push(
        `<h3>${esc(f.title)}</h3>`,
        `<p class="dim">${esc(f.moduleLabel)} · ${new Date(f.createdAt).toLocaleString()}</p>`,
        `<p class="pre">${esc(f.summary)}</p>`,
      );
      // Modules can attach a pre-rendered report representation (HTML
      // captured at save time) — when present, splice it in so the report
      // shows the actual table / list / view from the saved result. The
      // field restores verbatim from imported backup files, so it crosses
      // the same trust boundary the in-app Findings panel sanitizes at:
      // never splice it into the export raw.
      if (f.report?.html)
        p.push(
          `<div class="finding-report">${sanitizeHtmlFragment(f.report.html)}</div>`,
        );
      // A few modules attach a `snapshot` data-URL (e.g. the Findspot Map's
      // rendered SVG). Render it inline so the report shows the visual the
      // user saw when they saved the finding.
      const snap = (f.payload as { snapshot?: string } | undefined)?.snapshot;
      if (snap && typeof snap === "string" && snap.startsWith("data:image"))
        p.push(
          `<figure class="finding-snap"><img src="${snap}" alt="${esc(f.title)} snapshot" /></figure>`,
        );
      if (f.notes) p.push(`<blockquote>${esc(f.notes)}</blockquote>`);
      p.push("</div>");
    }
  } else if (section === "reclassified") {
    const rows = Object.entries(d.tabletCategories);
    if (rows.length) {
      p.push("<h2>Reclassified tablets</h2>");
      p.push(
        "<table><thead><tr><th>Tablet</th><th>Your category</th></tr></thead><tbody>",
      );
      for (const [id, cat] of rows)
        p.push(`<tr><td><code>${esc(id)}</code></td><td>${esc(cat)}</td></tr>`);
      p.push("</tbody></table>");
    }
  }
  return p.join("\n");
}

function imageBlockHtml(im: ReportImage): string {
  const imgs: string[] = [];
  if ((im.show === "facsimile" || im.show === "both") && im.facsimile)
    imgs.push(`<img src="${im.facsimile}" alt="${esc(im.id)} facsimile" />`);
  if ((im.show === "photo" || im.show === "both") && im.photo)
    imgs.push(`<img src="${im.photo}" alt="${esc(im.id)} photograph" />`);
  if (!imgs.length) return "";
  return `<figure class="plate"><div class="plate-imgs">${imgs.join("")}</div><figcaption><b>${esc(im.caption || im.id)}</b> <span class="dim">${esc(im.id)}${im.context ? " · " + esc(im.context) : ""}</span></figcaption></figure>`;
}

function buildHtmlReport(
  d: ReportData,
  cfg: ReportConfig,
  images: Map<string, ReportImage>,
  insImages: Map<string, { facsimile?: string; photo?: string }>,
  fontFace: string | null,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const parts: string[] = [];
  parts.push(
    `<header class="cover"><h1>${esc(cfg.title || "Linear A — Research Notes")}</h1>`,
  );
  if (cfg.subtitle) parts.push(`<p class="subtitle">${esc(cfg.subtitle)}</p>`);
  parts.push(
    `<p class="meta">${cfg.author ? `<b>${esc(cfg.author)}</b> · ` : ""}${date} · Generated with the Linear A Research Workbench</p></header>`,
  );

  for (const b of cfg.blocks) {
    if (b.kind === "section" && b.enabled) {
      const s = sectionHtml(b.section, curatedData(d, b), insImages);
      if (s) parts.push(`<section>${s}</section>`);
    } else if (b.kind === "text") {
      const body = b.body
        ? b.body
            .split(/\n\n+/)
            .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
            .join("")
        : "";
      parts.push(
        `<section>${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}${body}</section>`,
      );
    } else if (b.kind === "image") {
      const im = images.get(b.bid);
      if (im) parts.push(`<section>${imageBlockHtml(im)}</section>`);
    } else if (b.kind === "note") {
      const n = d.notes.find((x) => x.id === b.noteId);
      if (n) {
        const body = renderNoteHtml(n.body, {
          refHtml: ({ kind, value, label }) => {
            // `label` arrives HTML-escaped from renderNoteHtml; resolved
            // lookups are raw strings and get escaped here.
            const better = resolveRefLabel(kind, value, d);
            return `<span class="note-ref note-ref-${kind}">${better === null ? label : esc(better)}</span>`;
          },
        });
        parts.push(
          `<section>${n.title ? `<h2>${esc(n.title)}</h2>` : ""}${body}</section>`,
        );
      }
    } else if (b.kind === "citation") {
      const cites = buildCitations({
        style: b.style,
        snapshotDate: date,
        includeGorila: b.includeGorila,
        includeMwenge: b.includeMwenge,
        includeYounger: b.includeYounger,
        includeSigla: b.includeSigla,
        includeWorkbench: b.includeWorkbench,
      });
      if (cites) {
        const heading = b.heading
          ? `<h2>${esc(b.heading)}</h2>`
          : "";
        // BibTeX gets a code block to preserve braces/whitespace verbatim;
        // human-readable styles get one paragraph per entry.
        const body =
          b.style === "bibtex"
            ? `<pre style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:10px 14px;overflow-x:auto;font:12px/1.5 var(--mono);">${esc(cites)}</pre>`
            : cites
                .split("\n\n")
                .map(
                  (entry) =>
                    `<p style="margin:8px 0;padding-left:24px;text-indent:-24px;">${esc(entry)}</p>`,
                )
                .join("");
        parts.push(`<section>${heading}${body}</section>`);
      }
    }
  }

  parts.push(
    '<section><h2>Sources</h2><ul class="sources">' +
      '<li><b>Corpus:</b> GORILA — Godart, L. &amp; Olivier, J.-P. (1976–1985). <i>Recueil des inscriptions en linéaire A</i>. École Française d\'Athènes.</li>' +
      "<li><b>Digital corpus:</b> mwenge/lineara.xyz</li>" +
      "<li><b>Commentary:</b> John Younger, <i>Linear A: introduction, syllabary, transliterated texts, lexicon</i> (2024) — <a href=\"https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction\">academia.edu</a>.</li>" +
      "<li><b>Paleography:</b> SigLA — The Signs of Linear A.</li></ul>" +
      '<blockquote class="caveat">Analyses produced with the Linear A Research Workbench are exploratory. Linear A remains undeciphered; proposed readings are hypotheses, not established facts.</blockquote></section>',
  );

  const css = `
    :root { color-scheme: light dark; --bg: #fff; --text: #1a1d23; --dim: #6b7280; --border: #e2e5ea; --surface: #f7f8fa; --surface-2: #fafbfc; --link: #1d4ed8; --hl: #fde047; --hl-fg: #713f12; }
    body.dark { --bg: #0f1115; --text: #e8eaed; --dim: #9aa0a6; --border: #2a2e36; --surface: #1a1d23; --surface-2: #14171c; --link: #6ea8ff; --hl: #ca8a04; --hl-fg: #fef9c3; color-scheme: dark; }
    html, body { background: var(--bg); color: var(--text); }
    body { font: 15px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 0; }
    .report-toolbar { position: sticky; top: 0; z-index: 10; background: var(--bg); border-bottom: 1px solid var(--border); padding: 10px 16px 0; }
    .report-toolbar-row { display: flex; gap: 10px; align-items: center; max-width: 1100px; margin: 0 auto; flex-wrap: wrap; }
    .report-toolbar-title { font-weight: 600; font-size: 13px; color: var(--dim); white-space: nowrap; }
    .report-toolbar input { flex: 1; min-width: 180px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; font: 13px inherit; background: var(--bg); color: var(--text); }
    .report-toolbar button { padding: 5px 10px; font: 12px inherit; background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 4px; cursor: pointer; }
    .report-toolbar button:hover { background: var(--surface-2); }
    .report-toc { display: flex; flex-wrap: wrap; gap: 4px; max-width: 1100px; margin: 8px auto 0; padding: 6px 0 8px; }
    .toc-link { display: inline-block; padding: 2px 8px; font-size: 11px; color: var(--link); text-decoration: none; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
    .toc-link:hover { background: var(--surface-2); }
    .toc-link.toc-active { background: var(--link); color: #fff; border-color: var(--link); }
    .report-main { max-width: 860px; margin: 0 auto; padding: 24px 20px 80px; }
    .cover { border-bottom: 3px solid var(--text); padding-bottom: 12px; margin-bottom: 8px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .subtitle { font-size: 16px; color: var(--dim); margin: 0 0 6px; font-style: italic; }
    h2 { font-size: 19px; margin: 28px 0 8px; border-bottom: 2px solid var(--border); padding-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    h2.section-toggle { cursor: pointer; user-select: none; }
    h2.section-toggle::before { content: "▾"; color: var(--dim); font-size: 12px; transition: transform .15s; }
    section.collapsed h2.section-toggle::before { transform: rotate(-90deg); }
    section.collapsed > *:not(h2) { display: none; }
    h3 { font-size: 15px; margin: 16px 0 4px; }
    .meta { color: var(--dim); margin: 0; }
    .dim { color: var(--dim); font-weight: 400; }
    code { font-family: ui-monospace, Menlo, monospace; background: var(--surface); padding: 1px 4px; border-radius: 3px; font-size: 0.9em; color: var(--text); }
    code.hl, mark.hl { background: var(--hl); color: var(--hl-fg); outline: 1px solid color-mix(in srgb, var(--hl) 70%, transparent); }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
    th, td { border: 1px solid var(--border); padding: 5px 8px; text-align: left; vertical-align: top; }
    th { background: var(--surface); position: relative; }
    th.sortable { cursor: pointer; user-select: none; }
    th.sortable:hover { background: var(--surface-2); }
    th[data-sort="asc"]::after { content: " ▲"; color: var(--dim); font-size: 10px; }
    th[data-sort="desc"]::after { content: " ▼"; color: var(--dim); font-size: 10px; }
    blockquote { border-left: 3px solid var(--border); margin: 8px 0; padding: 4px 12px; color: var(--dim); }
    blockquote.caveat { font-size: 13px; font-style: italic; }
    .pre { white-space: pre-wrap; }
    .finding { padding: 4px 0; border-bottom: 1px dashed transparent; }
    .finding[hidden] { display: none; }
    .conf { padding: 1px 6px; border-radius: 3px; font-size: 12px; }
    .conf-high { background: #d1fae5; color: #065f46; }
    .conf-medium { background: #fef3c7; color: #92400e; }
    .conf-low { background: #f3f4f6; color: #6b7280; }
    .sources { font-size: 13px; color: var(--dim); }
    .plate { margin: 12px 0; border: 1px solid var(--border); border-radius: 6px; padding: 8px; }
    .plate figcaption { font-size: 12px; margin-top: 6px; }
    .plate-imgs { display: flex; gap: 8px; justify-content: center; }
    .plate-imgs img { max-width: 100%; max-height: 420px; object-fit: contain; background: var(--surface-2); border-radius: 4px; }
    .ins-sheet { border: 1px solid var(--border); border-left: 3px solid var(--border); border-radius: 4px; padding: 8px 10px; margin: 8px 0; }
    .ins-head { font-size: 13px; margin-bottom: 4px; }
    .note-ref { display: inline-block; padding: 0 6px; border-radius: 3px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; border: 1px solid; }
    .note-ref-ins { background: #e0eaff; color: #1d4ed8; border-color: #93c5fd; }
    .note-ref-word { background: #d1fae5; color: #065f46; border-color: #6ee7b7; }
    .note-ref-sign { background: #ede9fe; color: #6d28d9; border-color: #c4b5fd; }
    .note-ref-annotation { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
    .note-ref-collection { background: #cffafe; color: #0e7490; border-color: #67e8f9; }
    .note-ref-finding { background: #fce7f3; color: #be185d; border-color: #f9a8d4; }
    .note-ref-note { background: #f3f4f6; color: #4b5563; border-color: #cbd5e1; }
    .finding-snap { margin: 8px 0; text-align: center; }
    .finding-report { margin: 8px 0; padding: 8px 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; font-size: 13px; }
    .finding-report table { font-size: 12px; }
    .finding-snap img { max-width: 100%; max-height: 480px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px; background: var(--surface-2); }
    .ins-thumbs { float: right; display: flex; gap: 6px; margin: 0 0 6px 10px; }
    .ins-thumb { max-width: 200px; max-height: 180px; object-fit: contain; background: var(--surface-2); border-radius: 4px; }
    .translit { font-family: ui-monospace, Menlo, monospace; font-size: 12px; line-height: 1.8; }
    .translit span { background: var(--surface); padding: 1px 4px; border-radius: 3px; margin-right: 2px; white-space: nowrap; }
    .glyphs { font-family: 'Noto Sans Linear A', 'Segoe UI Historic', serif; font-size: 24px; line-height: 1.5; margin: 4px 0; color: var(--text); }
    .glosses { font-size: 12px; margin-top: 4px; clear: both; }
    .filter-empty { text-align: center; color: var(--dim); padding: 24px; font-style: italic; }
    @media print { .report-toolbar, .report-toc { display: none; } .report-main { max-width: none; padding: 0; } h2 { break-after: avoid; } .plate, tr, section, .ins-sheet, .finding { break-inside: avoid; } section.collapsed > *:not(h2) { display: revert !important; } }
  `;
  // Embed the Linear A font if we fetched it; otherwise fall back to the CDN
  // link so the glyphs still render when the file is opened online.
  const fontHead = fontFace
    ? `<style>${fontFace}</style>`
    : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Linear+A&display=swap">';
  // Interactive layer — works fully offline, no dependencies. Adds: section
  // anchors + sticky TOC, collapsible sections, finding filter input, click-
  // to-sort table headers, click-to-highlight word/sign cross-references,
  // dark-mode toggle. All progressive: turn off JS and the report still reads
  // top-to-bottom as a static document.
  const script = `
    (function(){
      var sections = Array.from(document.querySelectorAll('.report-main > section'));
      var toc = document.getElementById('report-toc');
      var slugCounts = {};
      function slug(s){ var x = String(s||'sec').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'sec'; slugCounts[x]=(slugCounts[x]||0)+1; return slugCounts[x]>1 ? x+'-'+slugCounts[x] : x; }
      // Anchor + collapse each section.
      sections.forEach(function(sec){
        var h = sec.querySelector('h2');
        if (!h) return;
        if (!sec.id) sec.id = 'sec-' + slug(h.textContent);
        h.classList.add('section-toggle');
        h.addEventListener('click', function(){ sec.classList.toggle('collapsed'); });
        var a = document.createElement('a');
        a.href = '#' + sec.id;
        a.textContent = h.textContent.trim();
        a.className = 'toc-link';
        toc.appendChild(a);
      });
      // Spy on scroll to highlight the TOC link nearest the top.
      var tocLinks = Array.from(toc.querySelectorAll('.toc-link'));
      function updateActive(){
        var hit = null;
        for (var i=0;i<sections.length;i++){
          var top = sections[i].getBoundingClientRect().top;
          if (top < 120) hit = i; else break;
        }
        tocLinks.forEach(function(l,i){ l.classList.toggle('toc-active', i===hit); });
      }
      window.addEventListener('scroll', updateActive, { passive: true });
      updateActive();
      // Filter findings (and similarly-tagged items) as you type.
      var filter = document.getElementById('report-filter');
      var emptyMsg = document.getElementById('filter-empty');
      function applyFilter(){
        var q = filter.value.trim().toLowerCase();
        var hidden = 0, total = 0;
        document.querySelectorAll('.finding').forEach(function(el){
          total++;
          var hay = el.getAttribute('data-search') || el.textContent.toLowerCase();
          var show = !q || hay.indexOf(q) !== -1;
          el.hidden = !show;
          if (!show) hidden++;
        });
        // Hide whole sections whose findings are all filtered out (only when
        // there's an active filter — otherwise leave the structure intact).
        sections.forEach(function(sec){
          var fs = sec.querySelectorAll('.finding');
          if (!fs.length) return;
          if (!q) { sec.hidden = false; return; }
          var anyVisible = false;
          fs.forEach(function(f){ if (!f.hidden) anyVisible = true; });
          sec.hidden = !anyVisible;
        });
        emptyMsg.hidden = !(q && total > 0 && hidden === total);
      }
      filter.addEventListener('input', applyFilter);
      // Collapse / expand all.
      var collapseBtn = document.getElementById('report-collapse-all');
      collapseBtn.addEventListener('click', function(){
        var allClosed = sections.every(function(s){ return s.classList.contains('collapsed'); });
        sections.forEach(function(s){ s.classList.toggle('collapsed', !allClosed); });
        collapseBtn.textContent = !allClosed ? 'Expand all' : 'Collapse all';
      });
      // Theme toggle (persists in localStorage so re-opening the file keeps it).
      var theme = document.getElementById('report-theme');
      try { if (localStorage.getItem('linear-a-report-theme') === 'dark') document.body.classList.add('dark'); } catch(e){}
      function refreshThemeBtn(){ theme.textContent = document.body.classList.contains('dark') ? '☀ Light' : '🌙 Dark'; }
      theme.addEventListener('click', function(){
        document.body.classList.toggle('dark');
        try { localStorage.setItem('linear-a-report-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); } catch(e){}
        refreshThemeBtn();
      });
      refreshThemeBtn();
      // Sortable tables — auto-detect numeric vs string columns each click,
      // toggle asc/desc, show ▲/▼ on the active column.
      document.querySelectorAll('.report-main table').forEach(function(table){
        var thead = table.tHead;
        var body = table.tBodies[0];
        if (!thead || !body || !thead.rows[0]) return;
        var ths = Array.from(thead.rows[0].cells);
        ths.forEach(function(th, idx){
          th.classList.add('sortable');
          th.title = (th.title ? th.title + ' · ' : '') + 'Click to sort';
          var asc = true;
          th.addEventListener('click', function(){
            var rows = Array.from(body.rows);
            // Detect: are all values in this column numeric?
            var num = rows.every(function(r){
              var v = (r.cells[idx] && r.cells[idx].textContent || '').trim().replace(/[,%×]/g,'');
              return v === '' || v === '—' || !isNaN(parseFloat(v));
            });
            rows.sort(function(a,b){
              var av = (a.cells[idx] && a.cells[idx].textContent || '').trim();
              var bv = (b.cells[idx] && b.cells[idx].textContent || '').trim();
              var cmp = num ? ((parseFloat(av.replace(/[,%×]/g,'')) || 0) - (parseFloat(bv.replace(/[,%×]/g,'')) || 0)) : av.localeCompare(bv);
              return asc ? cmp : -cmp;
            });
            rows.forEach(function(r){ body.appendChild(r); });
            ths.forEach(function(t){ if (t !== th) t.removeAttribute('data-sort'); });
            th.setAttribute('data-sort', asc ? 'asc' : 'desc');
            asc = !asc;
          });
        });
      });
      // Click any Linear A word/sign chip to highlight every other occurrence
      // of the same token across the entire report. Click again to clear.
      var WORDRE = /^[*0-9A-Z][A-Z0-9*\\-_]*$/;
      document.addEventListener('click', function(e){
        var c = e.target.closest('code');
        if (!c || !c.closest('.report-main')) return;
        var txt = c.textContent.trim();
        if (!txt || !WORDRE.test(txt)) return;
        var all = document.querySelectorAll('.report-main code');
        var wasOn = c.classList.contains('hl');
        all.forEach(function(x){ x.classList.remove('hl'); });
        if (!wasOn) all.forEach(function(x){ if (x.textContent.trim() === txt) x.classList.add('hl'); });
      });
      // Keyboard: '/' focuses the filter input from anywhere; Escape clears.
      document.addEventListener('keydown', function(e){
        if (e.key === '/' && document.activeElement !== filter && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
          e.preventDefault(); filter.focus(); filter.select();
        } else if (e.key === 'Escape' && document.activeElement === filter) {
          filter.value = ''; applyFilter(); filter.blur();
        }
      });
    })();
  `;
  // The sticky toolbar carries the filter, dark-mode toggle, and collapse-all
  // button; the TOC chips are auto-built by the script from the section h2s.
  const toolbar =
    `<header class="report-toolbar">` +
    `<div class="report-toolbar-row">` +
    `<span class="report-toolbar-title">${esc(cfg.title || "Report")}</span>` +
    `<input id="report-filter" type="search" placeholder="Filter findings… (press / to focus)" autocomplete="off">` +
    `<button id="report-collapse-all" type="button" title="Collapse or expand every section">Collapse all</button>` +
    `<button id="report-theme" type="button" title="Toggle light/dark">🌙 Dark</button>` +
    `</div>` +
    `<nav id="report-toc" aria-label="Section navigation"></nav>` +
    `</header>`;
  const main =
    `<main class="report-main">${parts.join("\n")}` +
    `<p id="filter-empty" class="filter-empty" hidden>No findings match the filter.</p>` +
    `</main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(cfg.title || "Linear A — Research Notes")}</title>${fontHead}<style>${css}</style></head><body>${toolbar}${main}<script>${script}</script></body></html>`;
}

// Fetch the Noto Sans Linear A web font and return an @font-face rule with the
// woff2 base64-embedded, so the exported HTML renders the glyphs offline. Null
// if it can't be fetched (offline) — the export then falls back to a CDN link.
async function linearAFontFace(): Promise<string | null> {
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+Linear+A",
    );
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const m = css.match(/src:\s*url\(([^)]+\.woff2)\)/);
    if (!m) return null;
    const fontRes = await fetch(m[1]);
    if (!fontRes.ok) return null;
    const blob = await fontRes.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onloadend = () =>
        resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    return `@font-face { font-family: 'Noto Sans Linear A'; font-style: normal; font-weight: 400; font-display: swap; src: url(${dataUrl}) format('woff2'); }`;
  } catch {
    return null;
  }
}

async function imageToDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(upstreamAsset(path));
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () =>
        resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function ResearchReport() {
  const annotations = useWorkbench((s) => s.annotations);
  const hypotheses = useWorkbench((s) => s.savedHypotheses);
  const collections = useWorkbench((s) => s.collections);
  const tabletCategories = useWorkbench((s) => s.tabletCategories);
  const findings = useWorkbench((s) => s.findings);
  const notes = useWorkbench((s) => s.notes);
  const byId = useWorkbench((s) => s.corpus.byId);
  const wordIndex = useWorkbench((s) => s.corpus.wordIndex);
  const hyp = useWorkbench((s) => s.hypothesis);
  const toast = useWorkbench((s) => s.toast_show);

  const [cfg, setCfg] = useState<ReportConfig>(() => {
    const loaded = loadJson<ReportConfig | null>(KEYS.reportLayout, null);
    if (loaded && Array.isArray(loaded.blocks)) return loaded;
    return defaultConfig();
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    saveJson(KEYS.reportLayout, cfg);
  }, [cfg]);

  const data: ReportData = useMemo(
    () => ({
      annotations,
      hypotheses,
      collections,
      tabletCategories,
      findings,
      notes,
      byId,
      wordIndex,
      hyp,
    }),
    [
      annotations,
      hypotheses,
      collections,
      tabletCategories,
      findings,
      notes,
      byId,
      wordIndex,
      hyp,
    ],
  );

  const counts: Record<Section, number> = {
    annotations: annotations.length,
    hypotheses: hypotheses.length,
    collections: collections.length,
    findings: findings.length,
    reclassified: Object.keys(tabletCategories).length,
  };

  const markdown = useMemo(() => buildMarkdown(data, cfg), [data, cfg]);

  // Which section block's per-item curation checklist is open.
  const [curating, setCurating] = useState<string | null>(null);

  // ── block ops ──────────────────────────────────────────────────────────
  const setBlocks = (fn: (b: ReportBlock[]) => ReportBlock[]) =>
    setCfg((c) => ({ ...c, blocks: fn(c.blocks) }));
  const move = (bid: string, dir: -1 | 1) =>
    setBlocks((blocks) => {
      const i = blocks.findIndex((b) => b.bid === bid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= blocks.length) return blocks;
      const next = [...blocks];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const update = (bid: string, patch: Partial<ReportBlock>) =>
    setBlocks((blocks) =>
      blocks.map((b) => (b.bid === bid ? ({ ...b, ...patch } as ReportBlock) : b)),
    );
  const remove = (bid: string) =>
    setBlocks((blocks) => blocks.filter((b) => b.bid !== bid));
  const addText = () =>
    setBlocks((b) => [
      ...b,
      { kind: "text", bid: rid(), heading: "Note", body: "" },
    ]);
  const addImage = () =>
    setBlocks((b) => [
      ...b,
      { kind: "image", bid: rid(), inscriptionId: "", caption: "", show: "both" },
    ]);
  const addNote = () =>
    setBlocks((b) => [
      ...b,
      { kind: "note", bid: rid(), noteId: notes[0]?.id ?? "" },
    ]);
  const addCitation = () =>
    setBlocks((b) => [
      ...b,
      {
        kind: "citation",
        bid: rid(),
        heading: "References",
        ...DEFAULT_CITATION_OPTIONS,
      },
    ]);

  // Resolve every image referenced by the report (image blocks + collection
  // tablets) using a caller-supplied `ref` function — which turns a corpus
  // image path into either a base64 data URI (single-file HTML) or a relative
  // path inside a zip (and stashes the binary). Returns the two image maps.
  async function gatherImages(ref: (path: string) => Promise<string | null>) {
    const images = new Map<string, ReportImage>();
    const insImages = new Map<string, { facsimile?: string; photo?: string }>();
    const want = (
      show: ImageShow | CollImgMode,
      kind: "facsimile" | "photo",
    ) => show === kind || show === "both";

    for (const b of cfg.blocks) {
      if (b.kind !== "image" || !b.inscriptionId) continue;
      const ins = byId.get(b.inscriptionId);
      if (!ins) continue;
      const facsimile =
        want(b.show, "facsimile") && ins.facsimileImages[0]
          ? ((await ref(ins.facsimileImages[0])) ?? undefined)
          : undefined;
      const photo =
        want(b.show, "photo") && ins.images[0]
          ? ((await ref(ins.images[0])) ?? undefined)
          : undefined;
      if (facsimile || photo)
        images.set(b.bid, {
          id: ins.id,
          site: ins.site,
          context: ins.context,
          show: b.show,
          caption: b.caption,
          facsimile,
          photo,
        });
    }

    const mode: CollImgMode = cfg.collectionImageMode ?? "facsimile";
    if (mode !== "off") {
      const colIns = new Set<string>();
      for (const c of collections)
        for (const it of c.items)
          if (it.kind === "inscription") colIns.add(it.value);
      for (const id of [...colIns].slice(0, 60)) {
        const ins = byId.get(id);
        if (!ins) continue;
        const facsimile =
          want(mode, "facsimile") && ins.facsimileImages[0]
            ? ((await ref(ins.facsimileImages[0])) ?? undefined)
            : undefined;
        const photo =
          want(mode, "photo") && ins.images[0]
            ? ((await ref(ins.images[0])) ?? undefined)
            : undefined;
        if (facsimile || photo) insImages.set(id, { facsimile, photo });
      }
    }
    return { images, insImages };
  }

  function plateCount(
    images: Map<string, ReportImage>,
    insImages: Map<string, { facsimile?: string; photo?: string }>,
  ) {
    let n = 0;
    for (const im of images.values()) n += (im.facsimile ? 1 : 0) + (im.photo ? 1 : 0);
    for (const im of insImages.values())
      n += (im.facsimile ? 1 : 0) + (im.photo ? 1 : 0);
    return n;
  }

  async function exportHtml() {
    setBusy(true);
    try {
      const { images, insImages } = await gatherImages(imageToDataUrl);
      const fontFace = await linearAFontFace();
      const html = buildHtmlReport(data, cfg, images, insImages, fontFace);
      downloadFile("linear_a_research_report.html", html, "text/html");
      const plates = plateCount(images, insImages);
      toast(
        plates
          ? `Report (HTML) downloaded with ${plates} plate${plates === 1 ? "" : "s"}`
          : "Report (HTML) downloaded",
      );
    } finally {
      setBusy(false);
    }
  }

  // Zip export: the same report, but images are stored as separate files (no
  // base64 bloat) and referenced by relative path — much smaller for image-rich
  // reports. Unzip and open report.html.
  async function exportZip() {
    setBusy(true);
    try {
      const files: Record<string, Uint8Array> = {};
      const seen = new Map<string, string>();
      let counter = 0;
      const ref = async (path: string): Promise<string | null> => {
        if (seen.has(path)) return `images/${seen.get(path)}`;
        try {
          const res = await fetch(upstreamAsset(path));
          if (!res.ok) return null;
          const buf = new Uint8Array(await res.arrayBuffer());
          const safe = (path.split("/").pop() || "img").replace(
            /[^\w.\-]/g,
            "_",
          );
          const fn = `${String(++counter).padStart(2, "0")}_${safe}`;
          files[`images/${fn}`] = buf;
          seen.set(path, fn);
          return `images/${fn}`;
        } catch {
          return null;
        }
      };
      const { images, insImages } = await gatherImages(ref);
      const fontFace = await linearAFontFace();
      const html = buildHtmlReport(data, cfg, images, insImages, fontFace);
      files["report.html"] = new TextEncoder().encode(html);
      const { zipSync } = await import("fflate");
      const zipped = zipSync(files, { level: 6 });
      downloadFile(
        "linear_a_research_report.zip",
        new Blob([zipped], { type: "application/zip" }),
        "application/zip",
      );
      const imgN = Object.keys(files).length - 1;
      toast(`Report (ZIP) downloaded — ${imgN} image${imgN === 1 ? "" : "s"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Research Report</h2>
      <div className="callout">
        <h4>Compile &amp; arrange your work into a shareable document</h4>
        <p>
          Auto-compiles from everything you've created — annotations, sound-shift
          hypotheses, collections, findings, and tablet reclassifications — and
          lets you <b>reorder</b> the sections and drop in your own <b>text</b>{" "}
          and <b>image</b> blocks. Export as <b>Markdown</b> or as a styled,
          self-contained <b>HTML</b> document that prints to PDF and embeds the
          tablet plates you add. Your layout is saved between visits.
        </p>
      </div>

      {/* Cover */}
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Report title…"
          value={cfg.title}
          onChange={(e) => setCfg((c) => ({ ...c, title: e.target.value }))}
          style={{ flex: 2, minWidth: 180 }}
        />
        <input
          className="input"
          placeholder="Subtitle (optional)…"
          value={cfg.subtitle}
          onChange={(e) => setCfg((c) => ({ ...c, subtitle: e.target.value }))}
          style={{ flex: 2, minWidth: 160 }}
        />
        <input
          className="input"
          placeholder="Author (optional)…"
          value={cfg.author}
          onChange={(e) => setCfg((c) => ({ ...c, author: e.target.value }))}
          style={{ flex: 1, minWidth: 120 }}
        />
      </div>

      {/* Layout editor */}
      <div
        style={{
          font: "600 10px var(--sans)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          margin: "12px 0 6px",
        }}
      >
        Report layout — reorder, toggle, and add blocks
      </div>
      <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        {cfg.blocks.map((b, i) => (
          <div
            key={b.bid}
            className="card"
            style={{
              margin: 0,
              padding: "8px 10px",
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button
                className="btn btn-outline btn-sm"
                style={{ padding: "0 6px", minWidth: 0 }}
                disabled={i === 0}
                onClick={() => move(b.bid, -1)}
                title="Move up"
              >
                ▲
              </button>
              <button
                className="btn btn-outline btn-sm"
                style={{ padding: "0 6px", minWidth: 0 }}
                disabled={i === cfg.blocks.length - 1}
                onClick={() => move(b.bid, 1)}
                title="Move down"
              >
                ▼
              </button>
            </div>

            {b.kind === "section" && (
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={b.enabled}
                    onChange={(e) =>
                      update(b.bid, { enabled: e.target.checked })
                    }
                  />
                  <span style={{ flex: 1 }}>
                    <b>{SECTION_LABEL[b.section]}</b>{" "}
                    <span className="dim" style={{ fontSize: 11 }}>
                      · auto · {counts[b.section]} item
                      {counts[b.section] === 1 ? "" : "s"}
                      {b.excluded && b.excluded.length > 0
                        ? ` (${b.excluded.length} excluded)`
                        : ""}
                    </span>
                  </span>
                  {counts[b.section] > 0 && (
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: "0 8px", fontSize: 10, minWidth: 0 }}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurating(curating === b.bid ? null : b.bid);
                      }}
                      title="Choose which individual items this section includes"
                    >
                      {curating === b.bid ? "Done" : "Curate…"}
                    </button>
                  )}
                </label>
                {curating === b.bid && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: "6px 8px",
                      background: "var(--surface-0)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      maxHeight: 220,
                      overflowY: "auto",
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    {sectionItems(b.section, data).map((item) => {
                      const excluded = (b.excluded ?? []).includes(item.id);
                      return (
                        <label
                          key={item.id}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 6,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!excluded}
                            onChange={(e) => {
                              const next = new Set(b.excluded ?? []);
                              if (e.target.checked) next.delete(item.id);
                              else next.add(item.id);
                              update(b.bid, { excluded: [...next] });
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              textDecoration: excluded
                                ? "line-through"
                                : undefined,
                              opacity: excluded ? 0.5 : 1,
                            }}
                          >
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {b.kind === "text" && (
              <div style={{ flex: 1, display: "grid", gap: 4 }}>
                <input
                  className="input"
                  placeholder="Heading…"
                  value={b.heading}
                  onChange={(e) => update(b.bid, { heading: e.target.value })}
                  style={{ fontWeight: 600 }}
                />
                <textarea
                  className="input"
                  placeholder="Write a paragraph… (blank line = new paragraph)"
                  value={b.body}
                  onChange={(e) => update(b.bid, { body: e.target.value })}
                  rows={3}
                  style={{ fontFamily: "var(--serif)", resize: "vertical" }}
                />
              </div>
            )}

            {b.kind === "image" && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  className="input"
                  placeholder="Inscription ID (e.g. HT1)"
                  value={b.inscriptionId}
                  onChange={(e) =>
                    update(b.bid, { inscriptionId: e.target.value.trim() })
                  }
                  style={{ width: 140 }}
                />
                <select
                  className="select"
                  value={b.show}
                  onChange={(e) =>
                    update(b.bid, { show: e.target.value as ImageShow })
                  }
                  style={{ fontSize: 11, padding: "3px 6px" }}
                >
                  <option value="both">facsimile + photo</option>
                  <option value="facsimile">facsimile</option>
                  <option value="photo">photo</option>
                </select>
                <input
                  className="input"
                  placeholder="Caption (optional)…"
                  value={b.caption}
                  onChange={(e) => update(b.bid, { caption: e.target.value })}
                  style={{ flex: 1, minWidth: 120 }}
                />
                <span className="dim" style={{ fontSize: 10 }}>
                  {b.inscriptionId
                    ? byId.get(b.inscriptionId)
                      ? byId.get(b.inscriptionId)!.facsimileImages.length ||
                        byId.get(b.inscriptionId)!.images.length
                        ? "✓ imagery found"
                        : "no imagery for this tablet"
                      : "unknown ID"
                    : ""}
                </span>
              </div>
            )}

            {b.kind === "note" && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {notes.length === 0 ? (
                  <span className="dim" style={{ fontSize: 11 }}>
                    No notes yet — write one in <b>My Research › Notes</b>{" "}
                    first, then pick it here.
                  </span>
                ) : (
                  <select
                    className="select"
                    value={b.noteId}
                    onChange={(e) => update(b.bid, { noteId: e.target.value })}
                    style={{ fontSize: 11, padding: "3px 6px", minWidth: 220 }}
                  >
                    <option value="">— pick a note —</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title || "Untitled"}
                      </option>
                    ))}
                  </select>
                )}
                {b.noteId && notes.find((n) => n.id === b.noteId) && (
                  <span className="dim" style={{ fontSize: 10 }}>
                    {(() => {
                      const n = notes.find((x) => x.id === b.noteId)!;
                      const r = parseNoteRefs(n.body).length;
                      return `${n.body.length} chars${r ? ` · ${r} ref${r === 1 ? "" : "s"}` : ""}`;
                    })()}
                  </span>
                )}
              </div>
            )}

            {b.kind === "citation" && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  className="input"
                  placeholder="Section heading"
                  value={b.heading}
                  onChange={(e) => update(b.bid, { heading: e.target.value })}
                  style={{ width: 160, fontSize: 12 }}
                />
                <select
                  className="select"
                  value={b.style}
                  onChange={(e) =>
                    update(b.bid, { style: e.target.value as CitationStyle })
                  }
                  style={{ fontSize: 11, padding: "3px 6px" }}
                  title="Citation style"
                >
                  {(Object.keys(CITATION_STYLE_LABEL) as CitationStyle[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {CITATION_STYLE_LABEL[s]}
                      </option>
                    ),
                  )}
                </select>
                {(
                  [
                    ["includeGorila", "GORILA"],
                    ["includeMwenge", "mwenge"],
                    ["includeYounger", "Younger"],
                    ["includeSigla", "SigLA"],
                    ["includeWorkbench", "workbench"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="dim"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 11,
                    }}
                    title={`Include ${label} in the citation list`}
                  >
                    <input
                      type="checkbox"
                      checked={b[key]}
                      onChange={(e) =>
                        update(b.bid, { [key]: e.target.checked })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}

            {b.kind !== "section" && (
              <button
                className="btn btn-outline btn-sm"
                style={{ color: "var(--rd)" }}
                onClick={() => remove(b.bid)}
                title="Remove block"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <button className="btn btn-outline btn-sm" onClick={addText}>
          + Text block
        </button>
        <button className="btn btn-outline btn-sm" onClick={addImage}>
          + Image block
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={addNote}
          title="Insert one of your Notes as a section in the report"
          disabled={notes.length === 0}
        >
          + Note block
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={addCitation}
          title="Insert a pre-formatted References block (GORILA / mwenge / Younger / SigLA / workbench) in the citation style of your choice"
        >
          + Citation block
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setCfg(defaultConfig())}
          title="Reset the layout to the default auto-sections"
        >
          Reset layout
        </button>
        <label
          className="dim"
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
          title="Which plate(s) of each collected tablet to embed in the export"
        >
          collection tablets
          <select
            className="select"
            value={cfg.collectionImageMode ?? "facsimile"}
            onChange={(e) =>
              setCfg((c) => ({
                ...c,
                collectionImageMode: e.target.value as CollImgMode,
              }))
            }
            style={{ fontSize: 11, padding: "3px 6px" }}
          >
            <option value="facsimile">facsimile</option>
            <option value="photo">photo</option>
            <option value="both">facsimile + photo</option>
            <option value="off">no images</option>
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <button
          className="btn"
          onClick={() =>
            navigator.clipboard?.writeText(markdown).then(
              () => toast("Report copied to clipboard"),
              () => toast("Clipboard not available", "error"),
            )
          }
        >
          Copy
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            downloadFile(
              "linear_a_research_report.md",
              markdown,
              "text/markdown",
            );
            toast("Report downloaded");
          }}
        >
          Download .md
        </button>
        <button
          className="btn btn-secondary"
          onClick={exportHtml}
          disabled={busy}
          title="Download a single self-contained HTML file (images base64-embedded; prints cleanly to PDF)"
        >
          {busy ? "Building…" : "Download .html"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={exportZip}
          disabled={busy}
          title="Download a zip: report.html + an images/ folder — much smaller for image-rich reports"
        >
          {busy ? "Building…" : "Download .zip"}
        </button>
      </div>

      <div
        style={{
          font: "600 10px var(--sans)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          margin: "12px 0 6px",
        }}
      >
        Markdown preview
      </div>
      <textarea
        readOnly
        value={markdown}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: "44vh",
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 12,
          color: "var(--text-dim)",
          font: "12px/1.6 var(--mono)",
          resize: "vertical",
        }}
      />
    </div>
  );
}
