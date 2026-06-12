// Plan an Obsidian vault (or a single research-bundle document) from the
// researcher's workbench data. Pure planning: these functions return
// { path, content } descriptions and never touch the filesystem — the
// Data Export module decides how to write them (File System Access API
// for the vault, a plain download for the bundle).
//
// Vault layout:
//   README.md            what this is, how it was generated
//   Lexicon.md           every annotation as a glossary table
//   Notes/<title>.md     research notes; wb: references become [[wikilinks]]
//   Tablets/<id>.md      a stub per referenced tablet, linking back to the app
//   Words/<word>.md      a stub per referenced word
//   Collections/<name>.md
//   Findings/<title>.md
//
// Every name is deterministic, so re-exporting into the same folder
// overwrites these files and leaves anything else in the vault alone.

import { parseRefUrl } from "./notes";
import type {
  Annotation,
  Collection,
  Finding,
  Inscription,
  ResearchNote,
} from "./types";

export const LIVE_SITE = "https://linearaworkbench.xyz/";

export interface VaultFile {
  path: string; // forward-slash relative path, e.g. "Notes/On KU-RO.md"
  content: string;
}

export interface VaultInput {
  generatedAt: string; // ISO timestamp stamped by the caller
  notes: ResearchNote[];
  annotations: Annotation[];
  collections: Collection[];
  findings: Finding[];
  getInscription: (id: string) => Inscription | undefined;
  getWordStat?: (
    word: string,
  ) => { count: number; sites: string[] } | undefined;
}

// ── names ────────────────────────────────────────────────────────────────

// Obsidian note names can't contain \ / : * ? " < > | # ^ [ ] (the OS and
// wikilink syntax between them). Linear A words use * for unnamed signs
// (DA-SI-*118), so * maps to a lookalike instead of vanishing.
export function fileSafe(name: string): string {
  const cleaned = name
    .replace(/\*/g, "✱")
    .replace(/[\\/:?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
  return cleaned || "untitled";
}

function uniqueNames<T>(
  items: T[],
  rawName: (item: T) => string,
): Map<T, string> {
  const used = new Set<string>();
  const out = new Map<T, string>();
  for (const item of items) {
    const base = fileSafe(rawName(item));
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) {
      name = `${base} ${n}`;
      n++;
    }
    used.add(name.toLowerCase());
    out.set(item, name);
  }
  return out;
}

export function permalink(kind: "ins" | "word", value: string): string {
  return `${LIVE_SITE}#/${kind === "ins" ? "i" : "w"}/${encodeURIComponent(value)}`;
}

function wikilink(target: string, label?: string): string {
  return label && label !== target
    ? `[[${target}|${label}]]`
    : `[[${target}]]`;
}

// ── reference conversion ─────────────────────────────────────────────────

interface NameIndex {
  noteNames: Map<string, string>; // note id → vault name
  collectionNames: Map<string, string>;
  findingNames: Map<string, string>;
}

const WB_LINK_RE = /\[([^\]]+)\]\((wb:[^)]+)\)/g;

// Rewrite a note body for the vault: wb: references become wikilinks (the
// target pages exist in the vault), everything else passes through.
export function bodyToObsidian(body: string, names: NameIndex): string {
  return body.replace(WB_LINK_RE, (whole, label: string, url: string) => {
    const ref = parseRefUrl(url);
    if (!ref) return whole;
    switch (ref.kind) {
      case "ins":
        return wikilink(fileSafe(ref.value), label);
      case "word":
        return wikilink(fileSafe(ref.value), label);
      case "annotation":
        return wikilink("Lexicon", label);
      case "note":
        return wikilink(names.noteNames.get(ref.value) ?? label, label);
      case "collection":
        return wikilink(names.collectionNames.get(ref.value) ?? label, label);
      case "finding":
        return wikilink(names.findingNames.get(ref.value) ?? label, label);
      case "sign":
        return `**${label}**`;
    }
  });
}

// Rewrite a note body for a standalone document: tablet and word references
// become live links into the workbench, everything else collapses to its
// label (there are no pages to point at).
export function bodyToStandalone(body: string): string {
  return body.replace(WB_LINK_RE, (whole, label: string, url: string) => {
    const ref = parseRefUrl(url);
    if (!ref) return whole;
    if (ref.kind === "ins" || ref.kind === "word") {
      return `[${label}](${permalink(ref.kind, ref.value)})`;
    }
    return label;
  });
}

// ── shared pieces ────────────────────────────────────────────────────────

const CONF_LABEL = { high: "high", medium: "medium", low: "low" } as const;

function tableCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function lexiconTable(
  annotations: Annotation[],
  link: (a: Annotation) => string,
): string {
  const rows = [...annotations].sort((a, b) =>
    a.target.value.localeCompare(b.target.value),
  );
  const lines = [
    "| Entry | Kind | Proposed meaning | Confidence | Evidence | Notes |",
    "|---|---|---|---|---|---|",
  ];
  for (const a of rows) {
    lines.push(
      `| ${link(a)} | ${a.target.kind} | ${tableCell(a.proposedMeaning)} | ${CONF_LABEL[a.confidence]} | ${a.evidenceIds.map((id) => wikilink(fileSafe(id))).join(", ")} | ${tableCell(a.notes)} |`,
    );
  }
  return lines.join("\n");
}

// Which tablets and words deserve stub pages: anything the researcher's own
// data points at — annotation targets, evidence, collection members, and
// wb: references inside note bodies.
function referencedTargets(input: VaultInput): {
  tablets: string[];
  words: string[];
} {
  const tablets = new Set<string>();
  const words = new Set<string>();
  for (const a of input.annotations) {
    if (a.target.kind === "inscription") tablets.add(a.target.value);
    if (a.target.kind === "word") words.add(a.target.value);
    for (const id of a.evidenceIds) tablets.add(id);
  }
  for (const c of input.collections) {
    for (const item of c.items) {
      if (item.kind === "inscription") tablets.add(item.value);
      else words.add(item.value);
    }
  }
  for (const n of input.notes) {
    for (const m of n.body.matchAll(WB_LINK_RE)) {
      const ref = parseRefUrl(m[2]);
      if (ref?.kind === "ins") tablets.add(ref.value);
      if (ref?.kind === "word") words.add(ref.value);
    }
  }
  return {
    tablets: [...tablets].sort((a, b) => a.localeCompare(b)),
    words: [...words].sort((a, b) => a.localeCompare(b)),
  };
}

// ── the vault ────────────────────────────────────────────────────────────

export function buildVault(input: VaultInput): VaultFile[] {
  const files: VaultFile[] = [];
  const noteNamesByItem = uniqueNames(input.notes, (n) => n.title || "Untitled note");
  const collectionNamesByItem = uniqueNames(input.collections, (c) => c.name);
  const findingNamesByItem = uniqueNames(input.findings, (f) => f.title);
  const names: NameIndex = {
    noteNames: new Map(
      input.notes.map((n) => [n.id, noteNamesByItem.get(n)!]),
    ),
    collectionNames: new Map(
      input.collections.map((c) => [c.id, collectionNamesByItem.get(c)!]),
    ),
    findingNames: new Map(
      input.findings.map((f) => [f.id, findingNamesByItem.get(f)!]),
    ),
  };

  // README
  files.push({
    path: "README.md",
    content: `# Linear A research vault

Your work from the [Linear A Research Workbench](${LIVE_SITE}), exported
${input.generatedAt.slice(0, 10)} as an Obsidian vault.

- **Lexicon.md** — every proposed meaning you've recorded, as one glossary table.
- **Notes/** — your research notes; workbench cross-references became wikilinks.
- **Tablets/** and **Words/** — a stub page for every tablet and word your
  research touches, each linking back to the live workbench.
- **Collections/** and **Findings/** — your groupings and saved results.

Re-exporting into this folder overwrites these generated files by name and
leaves everything else in the vault alone.
`,
  });

  // Lexicon
  if (input.annotations.length > 0) {
    files.push({
      path: "Lexicon.md",
      content: `# Lexicon

Every annotation, as a working glossary. Confidence and evidence are yours;
attestation lives on the word pages.

${lexiconTable(input.annotations, (a) => wikilink(fileSafe(a.target.value)))}
`,
    });
  }

  // Notes
  for (const n of input.notes) {
    const name = noteNamesByItem.get(n)!;
    files.push({
      path: `Notes/${name}.md`,
      content: `---
created: ${n.createdAt}
updated: ${n.updatedAt}
---

${bodyToObsidian(n.body, names)}
`,
    });
  }

  // Tablet + word stubs
  const { tablets, words } = referencedTargets(input);
  for (const id of tablets) {
    const ins = input.getInscription(id);
    const own = input.annotations.filter(
      (a) => a.target.kind === "inscription" && a.target.value === id,
    );
    const evidenceFor = input.annotations.filter(
      (a) => a.target.kind !== "inscription" && a.evidenceIds.includes(id),
    );
    const fm = ins
      ? `---
site: ${ins.site}
period: ${ins.context}
support: ${ins.support}
---

`
      : "";
    const lines = [`${fm}# ${id}`, ""];
    if (ins && ins.words.length > 0) {
      lines.push(`**Transliteration:** ${ins.words.join(" ")}`, "");
    }
    if (own.length > 0) {
      lines.push(
        "## Your reading",
        ...own.map(
          (a) =>
            `- **${a.proposedMeaning}** (${CONF_LABEL[a.confidence]})${a.notes ? ` — ${a.notes}` : ""}`,
        ),
        "",
      );
    }
    if (evidenceFor.length > 0) {
      lines.push(
        "## Cited as evidence for",
        ...evidenceFor.map(
          (a) =>
            `- ${wikilink(fileSafe(a.target.value))} — ${a.proposedMeaning}`,
        ),
        "",
      );
    }
    lines.push(`[Open in the workbench](${permalink("ins", id)})`, "");
    files.push({ path: `Tablets/${fileSafe(id)}.md`, content: lines.join("\n") });
  }
  for (const w of words) {
    const stat = input.getWordStat?.(w);
    const own = input.annotations.filter(
      (a) => a.target.kind === "word" && a.target.value === w,
    );
    const lines = [`# ${w}`, ""];
    if (stat) {
      lines.push(
        `**Attestation:** ${stat.count} occurrence${stat.count === 1 ? "" : "s"} across ${stat.sites.length} site${stat.sites.length === 1 ? "" : "s"} (${stat.sites.join(", ")})`,
        "",
      );
    }
    for (const a of own) {
      lines.push(
        `**Proposed meaning:** ${a.proposedMeaning} (${CONF_LABEL[a.confidence]})${a.notes ? ` — ${a.notes}` : ""}`,
        "",
      );
      if (a.evidenceIds.length > 0) {
        lines.push(
          `Evidence: ${a.evidenceIds.map((id) => wikilink(fileSafe(id))).join(", ")}`,
          "",
        );
      }
    }
    lines.push(`[Open in the workbench](${permalink("word", w)})`, "");
    files.push({ path: `Words/${fileSafe(w)}.md`, content: lines.join("\n") });
  }

  // Collections
  for (const c of input.collections) {
    const name = collectionNamesByItem.get(c)!;
    const lines = [
      `# ${name}`,
      "",
      ...c.items.map((i) => `- ${wikilink(fileSafe(i.value))}`),
      "",
    ];
    files.push({ path: `Collections/${name}.md`, content: lines.join("\n") });
  }

  // Findings
  for (const f of input.findings) {
    const name = findingNamesByItem.get(f)!;
    const lines = [
      `---
module: ${f.moduleLabel}
created: ${f.createdAt}
---`,
      "",
      `# ${f.title}`,
      "",
      f.summary,
      "",
    ];
    if (f.report?.markdown) lines.push(f.report.markdown, "");
    if (f.notes) lines.push(`> ${f.notes}`, "");
    files.push({ path: `Findings/${name}.md`, content: lines.join("\n") });
  }

  return files;
}

// ── the single-document research bundle ──────────────────────────────────

// One self-contained Markdown document — drop it into NotebookLM (or any
// tool that takes a text source) and every reference resolves to a live
// workbench URL instead of a wikilink.
export function buildResearchBundle(input: VaultInput): string {
  const parts: string[] = [
    `# Linear A research notes`,
    "",
    `Exported ${input.generatedAt.slice(0, 10)} from the [Linear A Research Workbench](${LIVE_SITE}) — ${input.annotations.length} annotation${input.annotations.length === 1 ? "" : "s"}, ${input.notes.length} note${input.notes.length === 1 ? "" : "s"}, ${input.collections.length} collection${input.collections.length === 1 ? "" : "s"}, ${input.findings.length} finding${input.findings.length === 1 ? "" : "s"}.`,
    "",
  ];

  if (input.annotations.length > 0) {
    parts.push(
      "## Lexicon — proposed meanings",
      "",
      lexiconTable(input.annotations, (a) =>
        a.target.kind === "sign"
          ? a.target.value
          : `[${a.target.value}](${permalink(a.target.kind === "inscription" ? "ins" : "word", a.target.value)})`,
      ).replace(/\[\[([^\]|]+)\]\]/g, "$1"),
      "",
    );
  }

  for (const n of input.notes) {
    parts.push(`## Note: ${n.title || "Untitled"}`, "", bodyToStandalone(n.body), "");
  }

  for (const f of input.findings) {
    parts.push(
      `## Finding: ${f.title}`,
      "",
      `*From the ${f.moduleLabel} module, ${f.createdAt.slice(0, 10)}.*`,
      "",
      f.summary,
      "",
    );
    if (f.report?.markdown) parts.push(f.report.markdown, "");
    if (f.notes) parts.push(`> ${f.notes}`, "");
  }

  for (const c of input.collections) {
    parts.push(
      `## Collection: ${c.name}`,
      "",
      ...c.items.map(
        (i) =>
          `- [${i.value}](${permalink(i.kind === "inscription" ? "ins" : "word", i.value)})`,
      ),
      "",
    );
  }

  return parts.join("\n");
}
