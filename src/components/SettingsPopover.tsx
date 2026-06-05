import { useEffect, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import type { DisplaySettings } from "../lib/types";

interface ToggleDef {
  key: keyof DisplaySettings;
  label: string;
  hint: string;
}

const TOGGLES: ToggleDef[] = [
  {
    key: "showGlyphsInline",
    label: "Glyphs inline",
    hint: "Show Linear A glyphs next to every word transliteration",
  },
  {
    key: "showPhoneticInline",
    label: "Phonetic inline",
    hint: "Show /phon/ reading next to every word",
  },
  {
    key: "showAnnotationChips",
    label: "Annotation chips",
    hint: "Colored dot next to annotated words / inscriptions",
  },
  {
    key: "inlineWordTools",
    label: "Inline word tools ✎",
    hint: "Show the ✎ control on every word — annotate, add to a collection, and pin in place. Supersedes the annotation chip. Turn off for a cleaner read-only view.",
  },
  {
    key: "hoverPreviews",
    label: "Hover previews",
    hint: "Tooltip card on word/inscription hover",
  },
  {
    key: "compactTables",
    label: "Compact tables",
    hint: "Tighter row padding in data tables",
  },
  {
    key: "pinRailVisible",
    label: "Pin rail visible",
    hint: "Show the right-side pin rail (shows a hint when empty)",
  },
];

export function SettingsPopover() {
  const settings = useWorkbench((s) => s.settings);
  const update = useWorkbench((s) => s.updateSettings);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={popRef}>
      <button
        className="btn btn-sm btn-outline"
        onClick={() => setOpen((o) => !o)}
        title="Display settings"
        aria-expanded={open}
      >
        ⚙ Display
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "var(--surface-0)",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            padding: 10,
            minWidth: 280,
            zIndex: 20,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Theme
          </div>
          <div
            role="radiogroup"
            aria-label="Theme"
            style={{ display: "flex", gap: 6, marginBottom: 12 }}
          >
            {(["dark", "light"] as const).map((mode) => {
              const active = (settings.theme ?? "dark") === mode;
              return (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ theme: mode })}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    fontSize: 12,
                    cursor: "pointer",
                    background: active ? "var(--surface-2)" : "var(--surface-0)",
                    color: active ? "var(--ac)" : "var(--text-dim)",
                    border: `1px solid ${active ? "var(--ac)" : "var(--border)"}`,
                    borderRadius: 4,
                  }}
                  title={`Switch to ${mode} theme`}
                >
                  {mode === "dark" ? "🌙 Dark" : "☀ Light"}
                </button>
              );
            })}
          </div>

          <div
            style={{
              font: "600 10px var(--sans)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Display density
          </div>
          {TOGGLES.map((t) => (
            <label
              key={t.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 4px",
                cursor: "pointer",
                borderRadius: 4,
              }}
              title={t.hint}
              onMouseEnter={(e) =>
                ((e.currentTarget.style.background = "var(--surface-1)"))
              }
              onMouseLeave={(e) => ((e.currentTarget.style.background = ""))}
            >
              <input
                type="checkbox"
                checked={Boolean(settings[t.key])}
                onChange={(e) => update({ [t.key]: e.target.checked })}
              />
              <span style={{ flex: 1, fontSize: 12 }}>{t.label}</span>
              <span className="dim" style={{ fontSize: 10 }}>
                {settings[t.key] ? "on" : "off"}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
