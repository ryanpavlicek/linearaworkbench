// Pre-formatted citation strings for the canonical Linear A corpus sources
// and this workbench, across four common style families. Used by the
// Research Report's "Citation block" so a researcher can drop a properly-
// formatted references page into their report without having to look up
// or hand-format the entries.
//
// The workbench itself includes the export date so a citation pins the
// snapshot the analyses were run against — important for reproducibility
// since the workbench is updated frequently.

export type CitationStyle = "bibtex" | "apa" | "chicago" | "mla";

export const CITATION_STYLE_LABEL: Record<CitationStyle, string> = {
  bibtex: "BibTeX",
  apa: "APA (7th ed.)",
  chicago: "Chicago (author-date)",
  mla: "MLA (9th ed.)",
};

// Workbench version — kept here as a single source of truth alongside
// package.json so the self-citation pins a reproducible release. Bump
// version + year + date together on a release. Mirrored in CITATION.cff
// at the repo root (cff `version` + `date-released`) and in package.json.
export const WORKBENCH_VERSION = "1.3.0";
const WORKBENCH_RELEASE_YEAR = "2026";
const WORKBENCH_URL = "https://github.com/ryanpavlicek/linearaworkbench";

// Workbench self-citation — the date arg is the snapshot date the
// researcher pulls data against, formatted YYYY-MM-DD. Author + version
// are mandatory in all four styles; pinning the version is the whole
// point of citing software for reproducibility.
function workbenchCitation(style: CitationStyle, date: string): string {
  const v = WORKBENCH_VERSION;
  const y = WORKBENCH_RELEASE_YEAR;
  switch (style) {
    case "bibtex":
      return [
        "@software{linear_a_research_workbench,",
        "  author  = {Pavlicek, Ryan},",
        "  title   = {Linear A Research Workbench},",
        `  year    = {${y}},`,
        `  version = {${v}},`,
        `  url     = {${WORKBENCH_URL}},`,
        `  note    = {Accessed: ${date}}`,
        "}",
      ].join("\n");
    case "apa":
      return `Pavlicek, R. (${y}). *Linear A Research Workbench* (Version ${v}) [Computer software]. ${WORKBENCH_URL}`;
    case "chicago":
      return `Pavlicek, Ryan. ${y}. *Linear A Research Workbench*. Version ${v}. ${WORKBENCH_URL}. Accessed ${date}.`;
    case "mla":
      return `Pavlicek, Ryan. *Linear A Research Workbench*. Version ${v}, ${y}, ${WORKBENCH_URL}. Accessed ${date}.`;
  }
}

// GORILA — the printed edition every digital Linear A project derives from.
function gorilaCitation(style: CitationStyle): string {
  switch (style) {
    case "bibtex":
      return [
        "@book{gorila,",
        "  author    = {Godart, Louis and Olivier, Jean-Pierre},",
        "  title     = {Recueil des inscriptions en lin{\\'e}aire A},",
        "  publisher = {{\\'E}cole Fran{\\c{c}}aise d'Ath{\\`e}nes},",
        "  year      = {1976--1985},",
        "  series    = {{\\'E}tudes Cr{\\'e}toises 21},",
        "  volumes   = {5},",
        "  address   = {Paris},",
        "}",
      ].join("\n");
    case "apa":
      return "Godart, L., & Olivier, J.-P. (1976–1985). *Recueil des inscriptions en linéaire A* (Études Crétoises 21, 5 vols.). École Française d'Athènes.";
    case "chicago":
      return "Godart, Louis, and Jean-Pierre Olivier. 1976–1985. *Recueil des inscriptions en linéaire A*. Études Crétoises 21. 5 vols. Paris: École Française d'Athènes.";
    case "mla":
      return "Godart, Louis, and Jean-Pierre Olivier. *Recueil des inscriptions en linéaire A*. Études Crétoises 21, 5 vols., École Française d'Athènes, 1976–1985.";
  }
}

// mwenge/lineara.xyz — the digital transcription the workbench bundles.
function mwengeCitation(style: CitationStyle): string {
  switch (style) {
    case "bibtex":
      return [
        "@misc{mwenge_lineara,",
        "  title  = {lineara.xyz: a visual catalog of Linear A inscriptions},",
        "  author = {{mwenge contributors}},",
        "  url    = {https://github.com/mwenge/lineara.xyz},",
        "}",
      ].join("\n");
    case "apa":
      return "mwenge contributors. *lineara.xyz: a visual catalog of Linear A inscriptions*. https://github.com/mwenge/lineara.xyz";
    case "chicago":
      return "mwenge contributors. *lineara.xyz: a visual catalog of Linear A inscriptions*. https://github.com/mwenge/lineara.xyz.";
    case "mla":
      return "mwenge contributors. *lineara.xyz: a visual catalog of Linear A inscriptions*. https://github.com/mwenge/lineara.xyz.";
  }
}

// John Younger's Linear A material — the standard online scholarly reference.
// In 2024 Younger migrated off the KU secondary server (his prior host) and
// reorganized everything as PDFs on academia.edu. The academia URL is the
// current canonical location; the workbench bundles a mirror of the pre-2024
// KU-era HTML (via lineara.xyz) for inline commentary, but cite the academia
// folder for the live current material.
function youngerCitation(style: CitationStyle): string {
  switch (style) {
    case "bibtex":
      return [
        "@misc{younger_linear_a,",
        "  author = {Younger, John G.},",
        "  title  = {Linear A: introduction, syllabary, transliterated texts, lexicon},",
        "  year   = {2024},",
        "  url    = {https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction},",
        "  note   = {Folder of PDFs on academia.edu; previously hosted at people.ku.edu/~jyounger/LinearA/ (server retired 2024)}",
        "}",
      ].join("\n");
    case "apa":
      return "Younger, J. G. (2024). *Linear A: introduction, syllabary, transliterated texts, lexicon* [Folder of PDFs]. academia.edu. https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction";
    case "chicago":
      return "Younger, John G. 2024. *Linear A: introduction, syllabary, transliterated texts, lexicon*. Folder of PDFs. academia.edu. https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction.";
    case "mla":
      return "Younger, John G. *Linear A: introduction, syllabary, transliterated texts, lexicon*. 2024, https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction.";
  }
}

// SigLA — the paleographic database the workbench links out to per sign and
// per inscription. Cite when paleographic claims rest on per-scribe variants.
function siglaCitation(style: CitationStyle): string {
  switch (style) {
    case "bibtex":
      return [
        "@misc{sigla,",
        "  title  = {SigLA: The Signs of Linear A},",
        "  url    = {https://sigla.phis.me/},",
        "}",
      ].join("\n");
    case "apa":
      return "*SigLA: The Signs of Linear A*. https://sigla.phis.me/";
    case "chicago":
      return "*SigLA: The Signs of Linear A*. https://sigla.phis.me/.";
    case "mla":
      return "*SigLA: The Signs of Linear A*. https://sigla.phis.me/.";
  }
}

/**
 * Per-inscription citation — the unit a paper actually cites. GORILA is the
 * printed edition of record; the workbench permalink is the digital point of
 * access, pinned to version + access date. No volume/page numbers: GORILA's
 * volume split is the researcher's to confirm against the physical edition,
 * and the inscription id is the stable scholarly handle either way.
 */
export function buildInscriptionCitation(
  ins: { id: string; site?: string },
  style: CitationStyle,
  snapshotDate?: string,
): string {
  const date = snapshotDate || new Date().toISOString().slice(0, 10);
  const v = WORKBENCH_VERSION;
  const link = `https://ryanpavlicek.github.io/linearaworkbench/#/i/${encodeURIComponent(ins.id)}`;
  const site = ins.site ? `, ${ins.site}` : "";
  switch (style) {
    case "bibtex": {
      const key = ins.id.replace(/[^A-Za-z0-9]+/g, "");
      return [
        `@misc{lineara_${key},`,
        "  author       = {Godart, Louis and Olivier, Jean-Pierre},",
        `  title        = {Linear A inscription ${ins.id}${site}},`,
        "  howpublished = {Recueil des inscriptions en lin{\\'e}aire A",
        "                  ({\\'E}tudes Cr{\\'e}toises 21). Paris: {\\'E}cole",
        "                  Fran{\\c{c}}aise d'Ath{\\`e}nes, 1976--1985},",
        `  note         = {Viewed in the Linear A Research Workbench v${v},`,
        `                  ${link}, accessed ${date}}`,
        "}",
      ].join("\n");
    }
    case "apa":
      return `Godart, L., & Olivier, J.-P. (1976–1985). Linear A inscription ${ins.id}${site}. In *Recueil des inscriptions en linéaire A* (Études Crétoises 21). École Française d'Athènes. Viewed in the Linear A Research Workbench (v${v}), ${link} (accessed ${date}).`;
    case "chicago":
      return `Godart, Louis, and Jean-Pierre Olivier. 1976–1985. Linear A inscription ${ins.id}${site}. In *Recueil des inscriptions en linéaire A*, Études Crétoises 21. Paris: École Française d'Athènes. Viewed in the Linear A Research Workbench, version ${v}, ${link}, accessed ${date}.`;
    case "mla":
      return `Godart, Louis, and Jean-Pierre Olivier. "Linear A inscription ${ins.id}${site}." *Recueil des inscriptions en linéaire A*, École Française d'Athènes, 1976–1985. *Linear A Research Workbench*, version ${v}, ${link}. Accessed ${date}.`;
  }
}

export interface CitationOptions {
  style: CitationStyle;
  /** Snapshot date the researcher is citing — YYYY-MM-DD. Defaults to today. */
  snapshotDate?: string;
  includeGorila: boolean;
  includeMwenge: boolean;
  includeYounger: boolean;
  includeSigla: boolean;
  includeWorkbench: boolean;
}

/** Build the formatted citation list as a single string. Each entry is on its
 *  own paragraph, separated by a blank line — paste-ready for the target
 *  style's typical document format. */
export function buildCitations(opts: CitationOptions): string {
  const date = opts.snapshotDate || new Date().toISOString().slice(0, 10);
  const parts: string[] = [];
  if (opts.includeGorila) parts.push(gorilaCitation(opts.style));
  if (opts.includeMwenge) parts.push(mwengeCitation(opts.style));
  if (opts.includeYounger) parts.push(youngerCitation(opts.style));
  if (opts.includeSigla) parts.push(siglaCitation(opts.style));
  if (opts.includeWorkbench) parts.push(workbenchCitation(opts.style, date));
  return parts.join("\n\n");
}

export const DEFAULT_CITATION_OPTIONS: Omit<CitationOptions, "snapshotDate"> = {
  style: "apa",
  includeGorila: true,
  includeMwenge: true,
  includeYounger: true,
  includeSigla: true,
  includeWorkbench: true,
};
