import { useWorkbench } from "../store/workbench";
import { normalizeSignLabel } from "../lib/helpers";

interface Props {
  // Either a GORILA label ("KA", "*301", "RA₂"), or a raw Unicode glyph string.
  sign?: string;
  glyph?: string;
  size?: number;
  title?: string;
}

// Renders Linear A glyphs using Noto Sans Linear A. Falls back to a small
// placeholder if the sign isn't found in the derived sign mapping.
export function Glyph({ sign, glyph, size = 18, title }: Props) {
  const signsByLabel = useWorkbench((s) => s.corpus.signsByLabel);
  let displayGlyph = glyph;
  let phon: string | null = null;
  if (!displayGlyph && sign) {
    const data = signsByLabel.get(normalizeSignLabel(sign));
    displayGlyph = data?.glyph;
    phon = data?.phonetic ?? null;
  }
  const tooltip = title ?? (sign ? `${sign}${phon ? ` /${phon}/` : ""}` : "");
  return (
    <span
      style={{
        fontFamily: "var(--glyph)",
        fontSize: size,
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={tooltip}
    >
      {displayGlyph || (
        <span style={{ color: "var(--text-faint)", fontSize: 10 }}>?</span>
      )}
    </span>
  );
}

// Renders the full glyph string of an inscription (parsedInscription),
// preserving line breaks and separators visually.
export function GlyphRun({ glyphs, size = 22 }: { glyphs: string; size?: number }) {
  if (!glyphs) return null;
  return (
    <div
      style={{
        fontFamily: "var(--glyph)",
        fontSize: size,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        color: "var(--text)",
        letterSpacing: "0.05em",
      }}
    >
      {glyphs}
    </div>
  );
}
