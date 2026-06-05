import { memo } from "react";
import { useWorkbench } from "../store/workbench";
import { classifyToken, normalizeSignLabel } from "../lib/helpers";
import { wordToPhonetic } from "../lib/algorithms";
import { AnnotationChip } from "./AnnotationEditor";
import { WordTools } from "./WordTools";
import { HoverPreview } from "./HoverPreview";

interface Props {
  word: string;
  highlight?: string;
  freqClass?: string;
}

export const WordToken = memo(function WordToken({
  word,
  highlight,
  freqClass,
}: Props) {
  const showWord = useWorkbench((s) => s.showWord);
  const settings = useWorkbench((s) => s.settings);
  const signsByLabel = useWorkbench((s) => s.corpus.signsByLabel);
  const hypothesis = useWorkbench((s) => s.hypothesis);
  const kind = classifyToken(word);

  if (kind === "numeral") return <span className="numeral">{word} </span>;
  if (kind === "separator") return <span className="dim">{word} </span>;
  if (kind === "ideogram")
    return <span className="tag tag-warn">{word}</span>;
  if (kind === "text") return <span className="dim">{word} </span>;

  const matches =
    highlight && word.toUpperCase().includes(highlight.toUpperCase());

  const glyphs = settings.showGlyphsInline
    ? word
        .split("-")
        .map(
          (p) => signsByLabel.get(normalizeSignLabel(p))?.glyph ?? "",
        )
        .join("")
    : "";

  const link = (
    <span
      className={`word-link ${freqClass ?? ""} ${matches ? "hl" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        showWord(word);
      }}
    >
      {settings.showGlyphsInline && glyphs && (
        <span
          style={{
            fontFamily: "var(--glyph)",
            fontSize: "1.1em",
            marginRight: 4,
            verticalAlign: "middle",
          }}
        >
          {glyphs}
        </span>
      )}
      {word}
      {settings.showPhoneticInline && (
        <span
          className="dim"
          style={{ marginLeft: 4, fontSize: "0.85em" }}
        >
          /{wordToPhonetic(word, hypothesis)}/
        </span>
      )}
    </span>
  );

  return (
    <>
      {settings.hoverPreviews ? (
        <HoverPreview kind="word" value={word}>
          {link}
        </HoverPreview>
      ) : (
        link
      )}
      {settings.inlineWordTools ? (
        // The inline control shows annotation state itself, so it supersedes
        // the static chip dot when enabled.
        <WordTools target={{ kind: "word", value: word }} />
      ) : (
        settings.showAnnotationChips && (
          <AnnotationChip target={{ kind: "word", value: word }} />
        )
      )}{" "}
    </>
  );
});
