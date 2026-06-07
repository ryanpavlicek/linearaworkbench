// Word-level multiple-sequence alignment (progressive Needleman–Wunsch) and
// the captured HTML/Markdown report builder for the inscription comparator.
// Extracted from CompareInscriptions.tsx so the component stays presentational
// and this pure logic is independently unit-testable.
import type { Inscription } from "./types";

// One aligned position: a word (or null gap) for each inscription column.
export type AlnPos = (string | null)[];

const repWord = (p: AlnPos): string | null => {
  for (const w of p) if (w) return w;
  return null;
};

// Add one sequence to a growing alignment via Needleman–Wunsch at the word
// level (exact-token match rewarded; substitution columns allowed; gaps
// penalized). `priorN` = how many sequences are already in the alignment.
export function addSequence(
  aln: AlnPos[],
  seq: string[],
  priorN: number,
): AlnPos[] {
  const P = aln.length;
  const L = seq.length;
  const GAP = -1;
  const MATCH = 2;
  const MIS = 0;
  const dp: number[][] = Array.from({ length: P + 1 }, () =>
    new Array(L + 1).fill(0),
  );
  // traceback: 0 diag, 1 up (gap in new seq), 2 left (new column)
  const tb: number[][] = Array.from({ length: P + 1 }, () =>
    new Array(L + 1).fill(0),
  );
  for (let i = 1; i <= P; i++) {
    dp[i][0] = dp[i - 1][0] + GAP;
    tb[i][0] = 1;
  }
  for (let j = 1; j <= L; j++) {
    dp[0][j] = dp[0][j - 1] + GAP;
    tb[0][j] = 2;
  }
  for (let i = 1; i <= P; i++) {
    for (let j = 1; j <= L; j++) {
      const r = repWord(aln[i - 1]);
      const s = r !== null && r === seq[j - 1] ? MATCH : MIS;
      const diag = dp[i - 1][j - 1] + s;
      const up = dp[i - 1][j] + GAP;
      const left = dp[i][j - 1] + GAP;
      let best = diag;
      let t = 0;
      if (up > best) {
        best = up;
        t = 1;
      }
      if (left > best) {
        best = left;
        t = 2;
      }
      dp[i][j] = best;
      tb[i][j] = t;
    }
  }
  const out: AlnPos[] = [];
  let i = P;
  let j = L;
  while (i > 0 || j > 0) {
    const t = i > 0 && j > 0 ? tb[i][j] : i > 0 ? 1 : 2;
    if (t === 0) {
      out.push([...aln[i - 1], seq[j - 1]]);
      i--;
      j--;
    } else if (t === 1) {
      out.push([...aln[i - 1], null]);
      i--;
    } else {
      out.push([...new Array(priorN).fill(null), seq[j - 1]]);
      j--;
    }
  }
  out.reverse();
  return out;
}

// Progressive multiple alignment of up to four word sequences.
export function alignSequences(seqs: string[][]): AlnPos[] {
  if (!seqs.length) return [];
  let aln: AlnPos[] = seqs[0].map((w) => [w]);
  for (let k = 1; k < seqs.length; k++) aln = addSequence(aln, seqs[k], k);
  return aln;
}

// ── Captured report representation ────────────────────────────────────────
// Build a self-contained HTML + Markdown rendering of the current comparison
// so the saved finding shows the full result in the research report — not
// just the bare summary line.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCompareReport(
  selected: Inscription[],
  alignment: AlnPos[],
  sharedColor: Map<string, string>,
): { html: string; markdown: string } {
  // ── Header: per-column metadata ───────────────────────────────────────
  const headerCells = selected
    .map(
      (ins) =>
        `<th style="text-align:left;vertical-align:top;padding:4px 8px;border-bottom:2px solid #cbd2db;"><b>${esc(ins.id)}</b><div style="color:#6b7280;font-size:11px;">${esc([ins.site, ins.context].filter(Boolean).join(" · "))}</div>${ins.scribe ? `<div style="color:#6b7280;font-size:11px;">${esc(ins.scribe)}</div>` : ""}</th>`,
    )
    .join("");

  // ── Shared-words legend ───────────────────────────────────────────────
  const sharedEntries = [...sharedColor.entries()];
  const legend = sharedEntries.length
    ? `<div style="font-size:11px;margin:6px 0;"><b>Shared words (${sharedEntries.length}):</b> ${sharedEntries
        .map(
          ([w, c]) =>
            `<span style="display:inline-block;background:${c}22;border:1px solid ${c}66;color:${c};padding:1px 5px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;margin:1px 2px;">${esc(w)}</span>`,
        )
        .join("")}</div>`
    : '<div style="font-size:11px;color:#6b7280;margin:6px 0;">No shared multi-sign words across the comparison.</div>';

  // ── Interlinear alignment table ───────────────────────────────────────
  const rows = alignment
    .map((pos, ri) => {
      const present = pos.filter((w): w is string => Boolean(w));
      const isMatch = present.length >= 2 && new Set(present).size === 1;
      const cells = pos
        .map((w) => {
          if (w === null)
            return `<td style="padding:2px 8px;vertical-align:top;border-left:1px solid #e2e5ea;color:#cbd2db;">·</td>`;
          const color = sharedColor.get(w);
          const inner = color
            ? `<span style="background:${color}22;border:1px solid ${color}66;color:${color};padding:1px 5px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:12px;">${esc(w)}</span>`
            : `<span style="font-family:ui-monospace,Menlo,monospace;font-size:12px;">${esc(w)}</span>`;
          return `<td style="padding:2px 8px;vertical-align:top;border-left:1px solid #e2e5ea;">${inner}</td>`;
        })
        .join("");
      return `<tr${isMatch ? ' style="background:#f3f4f6;"' : ""}><td style="font-size:9px;text-align:right;padding:2px 4px;color:#9ca3af;">${ri + 1}</td>${cells}</tr>`;
    })
    .join("");

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;">` +
    `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${selected.length} inscription${selected.length === 1 ? "" : "s"} compared · ${alignment.length} aligned positions</div>` +
    legend +
    `<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:12px;width:100%;"><thead><tr><th style="width:28px;"></th>${headerCells}</tr></thead><tbody>${rows}</tbody></table></div>` +
    `<div style="font-size:10px;color:#6b7280;margin-top:6px;">Rows are aligned positions; a shaded row is where the same word aligns across columns. <b>·</b> marks a gap (no word in that column at that position).</div>` +
    `</div>`;

  // ── Markdown equivalent (compact: per-tablet metadata + a textual
  // alignment listing — Markdown tables are too narrow for 4 columns of
  // monospace transliteration).
  const mdLines: string[] = [];
  mdLines.push(
    `*${selected.length} inscriptions compared · ${alignment.length} aligned positions*`,
    "",
  );
  for (const ins of selected) {
    mdLines.push(
      `- **${ins.id}** — ${[ins.site, ins.context, ins.scribe].filter(Boolean).join(" · ")}`,
    );
  }
  if (sharedEntries.length) {
    mdLines.push(
      "",
      `**Shared words (${sharedEntries.length}):** ${sharedEntries.map(([w]) => `\`${w}\``).join(", ")}`,
      "",
    );
  } else {
    mdLines.push("", "_No shared multi-sign words across the comparison._", "");
  }
  if (alignment.length) {
    mdLines.push("**Interlinear alignment**", "");
    // Pipe-table with one column per tablet
    const head =
      "| # | " + selected.map((ins) => esc(ins.id)).join(" | ") + " |";
    const sep =
      "|---|" + selected.map(() => "---").join("|") + "|";
    mdLines.push(head, sep);
    const display = alignment.slice(0, 50);
    for (let ri = 0; ri < display.length; ri++) {
      const pos = display[ri];
      mdLines.push(
        `| ${ri + 1} | ` +
          pos
            .map((w) => (w === null ? "·" : `\`${w.replace(/\|/g, "\\|")}\``))
            .join(" | ") +
          " |",
      );
    }
    if (alignment.length > display.length)
      mdLines.push(
        "",
        `_…and ${alignment.length - display.length} more aligned positions._`,
      );
  }
  return { html, markdown: mdLines.join("\n") };
}
