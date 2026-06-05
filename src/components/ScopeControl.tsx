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
import type { CorpusScope } from "../lib/types";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

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
