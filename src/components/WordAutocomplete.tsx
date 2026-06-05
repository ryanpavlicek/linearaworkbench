import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useMultiWords } from "../lib/helpers";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: string) => void; // fired on pick or Enter
  placeholder?: string;
  style?: CSSProperties; // applied to the wrapper (e.g. flex sizing)
  autoFocus?: boolean;
}

// A typeahead for Linear A corpus words. Removes the friction of having to
// type an exact transliteration (with ₂/₃ subscripts, *, hyphens) — type a
// fragment, see matching corpus words ranked by frequency, pick one.
// Controlled via value/onChange so it drops into existing state.
export function WordAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  style,
  autoFocus,
}: Props) {
  const words = useMultiWords();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => {
    const q = value.toUpperCase().trim();
    if (!q) return [];
    const out: { word: string; count: number }[] = [];
    // Prefix matches first, then substring matches — both frequency-ranked
    // (useMultiWords is already sorted by count desc).
    const prefix: typeof out = [];
    const substr: typeof out = [];
    for (const { word, entry } of words) {
      const up = word.toUpperCase();
      if (up === q) continue; // exact already typed
      if (up.startsWith(q)) prefix.push({ word, count: entry.count });
      else if (up.includes(q)) substr.push({ word, count: entry.count });
      if (prefix.length >= 10) break;
    }
    out.push(...prefix, ...substr);
    return out.slice(0, 10);
  }, [value, words]);

  function choose(word: string) {
    onChange(word);
    onSelect?.(word);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") onSelect?.(value);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(suggestions[highlight]?.word ?? value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div style={{ position: "relative", minWidth: 0, ...style }}>
      <input
        className="input"
        style={{ width: "100%" }}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => value && setOpen(true)}
        onBlur={() => {
          // Delay so a click on a suggestion registers before close.
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
      />
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "var(--surface-0)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-sm)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            maxHeight: 280,
            overflowY: "auto",
          }}
          onMouseDown={() => {
            // Prevent the input blur from firing before the click.
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.word}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(s.word)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: "5px 10px",
                cursor: "pointer",
                background:
                  i === highlight ? "var(--ac-soft)" : "transparent",
                fontFamily: "var(--mono)",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--text)" }}>{s.word}</span>
              <span className="dim" style={{ fontSize: 10 }}>
                ×{s.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
