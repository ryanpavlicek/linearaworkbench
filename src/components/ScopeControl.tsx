import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkbench } from "../store/workbench";
import {
  isScopeActive,
  scopeSummary,
  useScopeOptions,
  useScopedCorpus,
} from "../store/scope";
import { anchoredPopoverPos } from "../lib/popover";
import { KEYS, loadJson, saveJson } from "../lib/persistence";
import type { CorpusScope } from "../lib/types";

// A named, reusable scope ("HT LM IB", "roundels only") — apply in one click
// instead of re-picking the dropdowns every session.
interface ScopePreset {
  id: string;
  name: string;
  scope: CorpusScope;
}

const DIMENSIONS: {
  key: keyof Omit<CorpusScope, "collectionId">;
  label: string;
  optionsKey: "sites" | "periods" | "scribes" | "supports";
}[] = [
  { key: "site", label: "Site", optionsKey: "sites" },
  { key: "period", label: "Period", optionsKey: "periods" },
  { key: "scribe", label: "Scribe", optionsKey: "scribes" },
  { key: "support", label: "Support", optionsKey: "supports" },
];

export function ScopeControl() {
  const scope = useWorkbench((s) => s.scope);
  const setScope = useWorkbench((s) => s.setScope);
  const clearScope = useWorkbench((s) => s.clearScope);
  const collections = useWorkbench((s) => s.collections);
  const totalInscriptions = useWorkbench((s) => s.corpus.inscriptions.length);
  const options = useScopeOptions();
  const scoped = useScopedCorpus();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [presets, setPresets] = useState<ScopePreset[]>(() =>
    loadJson<ScopePreset[]>(KEYS.scopePresets, []),
  );
  const [presetName, setPresetName] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const next = [
      ...presets,
      {
        id: Math.random().toString(36).slice(2),
        name,
        scope: { ...scope },
      },
    ];
    setPresets(next);
    saveJson(KEYS.scopePresets, next);
    setPresetName("");
  }

  function deletePreset(id: string) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    saveJson(KEYS.scopePresets, next);
  }

  const active = isScopeActive(scope);
  const scopedCount = scoped.inscriptions.length;

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current)
      setPos(anchoredPopoverPos(triggerRef.current, 300, 360, { align: "right" }));
    function onDown(e: MouseEvent) {
      if (
        popRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectStyle = {
    fontSize: 11,
    padding: "4px 6px",
    width: "100%",
  } as const;

  return (
    <>
      <button
        ref={triggerRef}
        className="btn btn-sm btn-outline"
        onClick={() => setOpen((o) => !o)}
        title="Restrict every analysis module to a slice of the corpus"
        style={active ? { color: "var(--ac)", borderColor: "var(--ac)" } : undefined}
      >
        {active ? "◆" : "◇"} Scope
        {active && (
          <span style={{ marginLeft: 6, opacity: 0.85 }}>
            {scopeSummary(scope)} · {scopedCount}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="inline-annot-pop"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              right: "auto",
              width: 300,
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <b style={{ fontSize: 13 }}>Corpus scope</b>
              <span className="dim" style={{ fontSize: 11 }}>
                {active ? `${scopedCount} of ${totalInscriptions}` : "whole corpus"}
              </span>
            </div>
            <p className="dim" style={{ fontSize: 11, margin: 0 }}>
              Restricts every analysis module to inscriptions matching all the
              selected filters.
            </p>

            {DIMENSIONS.map(({ key, label, optionsKey }) => (
              <label key={key} style={{ fontSize: 11 }}>
                <span className="dim">{label}</span>
                <select
                  className="select"
                  value={scope[key] ?? ""}
                  onChange={(e) =>
                    setScope({ [key]: e.target.value || null })
                  }
                  style={selectStyle}
                >
                  <option value="">any</option>
                  {options[optionsKey].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            <label style={{ fontSize: 11 }}>
              <span className="dim">Collection</span>
              <select
                className="select"
                value={scope.collectionId ?? ""}
                onChange={(e) =>
                  setScope({ collectionId: e.target.value || null })
                }
                style={selectStyle}
              >
                <option value="">any</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.items.filter((i) => i.kind === "inscription").length})
                  </option>
                ))}
              </select>
            </label>

            {(presets.length > 0 || active) && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span className="dim" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Presets
                </span>
                {presets.map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ flex: 1, textAlign: "left" }}
                      title={scopeSummary(p.scope)}
                      onClick={() => setScope({ ...p.scope })}
                    >
                      {p.name}
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      aria-label={`Delete preset ${p.name}`}
                      title="Delete preset"
                      onClick={() => deletePreset(p.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {active && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      className="input"
                      placeholder="Save current scope as…"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") savePreset();
                      }}
                      style={{ flex: 1, fontSize: 11, padding: "4px 6px" }}
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      disabled={!presetName.trim()}
                      onClick={savePreset}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button
                className="btn btn-sm btn-outline"
                disabled={!active}
                onClick={clearScope}
                style={{ flex: 1 }}
              >
                Clear scope
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setOpen(false)}
                style={{ flex: 1 }}
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
