// Curated catalog of Linear A commodity logograms (ideograms), following the
// GORILA / Younger conventions. Keyed by the logogram "head" — the part
// before any ligature "+". Ligature modifiers (OLE+U, OLE+KI, …) and sex
// markers (OVISm/OVISf) are treated as variants of the head commodity.
//
// These glosses are the standard scholarly readings of the commodity signs;
// the syllabic values of the underlying signs are a separate question. The
// "*NNN" numbered logograms (e.g. *301) are genuinely undeciphered as to
// referent and are handled separately in the module.

export type CommodityCategory =
  | "agricultural"
  | "livestock"
  | "people"
  | "material"
  | "vessel";

export interface CommodityDef {
  gloss: string;
  category: CommodityCategory;
}

export const COMMODITIES: Record<string, CommodityDef> = {
  GRA: { gloss: "grain / wheat", category: "agricultural" },
  HORD: { gloss: "barley", category: "agricultural" },
  OLE: { gloss: "olive oil", category: "agricultural" },
  OLIV: { gloss: "olives", category: "agricultural" },
  VIN: { gloss: "wine", category: "agricultural" },
  FIC: { gloss: "figs", category: "agricultural" },
  NI: { gloss: "figs (logogram)", category: "agricultural" },
  CYP: { gloss: "cyperus (sedge / spice)", category: "agricultural" },
  AROM: { gloss: "aromatic", category: "agricultural" },
  GRA_PA: { gloss: "grain (qualified)", category: "agricultural" },
  OVIS: { gloss: "sheep", category: "livestock" },
  CAP: { gloss: "goat", category: "livestock" },
  SUS: { gloss: "pig", category: "livestock" },
  BOS: { gloss: "ox / cattle", category: "livestock" },
  VIR: { gloss: "man / person", category: "people" },
  MUL: { gloss: "woman", category: "people" },
  TELA: { gloss: "cloth", category: "material" },
  LANA: { gloss: "wool", category: "material" },
  AES: { gloss: "bronze", category: "material" },
  AUR: { gloss: "gold", category: "material" },
  ARG: { gloss: "silver", category: "material" },
};

// Extract the commodity head from a token, or null if it isn't a known
// commodity logogram. Handles ligatures (OLE+U → OLE), bracketed
// uncertainty (VIR+[?] → VIR), and sex markers (OVISm → OVIS).
export function commodityHead(token: string): string | null {
  if (token.includes("-")) return null; // syllabic word, not a logogram
  let head = token.split("+")[0];
  head = head.replace(/[[\]?'"]/g, "");
  if (COMMODITIES[head]) return head;
  const desexed = head.replace(/[mf]$/, "");
  if (COMMODITIES[desexed]) return desexed;
  return null;
}

export const isUndecipheredLogogram = (token: string): boolean =>
  /^\*\d/.test(token);

// Is a hyphenated token a candidate LEXICAL word (a syllabic sign
// sequence), as opposed to a chain of logograms that merely tokenized
// with hyphens? Word-level analyses (graphotactic surprisal, anomaly
// lists) want real words: ligatures (+), bracketed damage, commodity
// heads, and the GORILA *400+ series (vessels, fractions, compound
// logograms — never word-internal syllabograms; the undeciphered
// syllabary candidates like *301/*306 sit below 400) all disqualify.
// A token whose every part is a *NNN logogram is a logogram chain too.
export function isLexicalWord(word: string): boolean {
  if (!word.includes("-")) return false;
  if (/[+[\]?]/.test(word)) return false;
  const parts = word.split("-");
  let starred = 0;
  for (const p of parts) {
    if (commodityHead(p)) return false;
    const m = /^\*(\d+)/.exec(p);
    if (m) {
      if (+m[1] >= 400) return false;
      starred++;
    }
  }
  return starred < parts.length;
}
