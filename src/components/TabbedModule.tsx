import { useEffect, useId, useRef, useState, type ComponentType } from "react";

export interface ModuleTab {
  key: string;
  label: string;
  Component: ComponentType;
}

/**
 * Thin wrapper that presents related modules as accessible, keyboard-navigable
 * tabs under a single sidebar entry. Supports optional URL/store syncing via
 * `onSelect` and automatically follows external changes to `initialKey`.
 */
export function TabbedModule({
  tabs,
  initialKey,
  onSelect,
}: {
  tabs: ModuleTab[];
  initialKey?: string;
  onSelect?: (key: string) => void;
}) {
  const baseId = useId();
  const resolveKey = (k?: string) =>
    tabs.some((t) => t.key === k) ? (k as string) : tabs[0].key;

  const [active, setActive] = useState(() => resolveKey(initialKey));
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (initialKey && tabs.some((t) => t.key === initialKey)) {
      setActive(initialKey);
    }
  }, [initialKey, tabs]);

  const selectTab = (key: string) => {
    setActive(key);
    onSelect?.(key);
  };

  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];
  const Active = activeTab.Component;
  const panelId = `${baseId}-panel-${activeTab.key}`;

  return (
    <>
      <div className="module-tabs" role="tablist">
        {tabs.map((t, idx) => {
          const isSelected = activeTab.key === t.key;
          const tabId = `${baseId}-tab-${t.key}`;
          return (
            <button
              key={t.key}
              ref={(el) => {
                btnRefs.current[idx] = el;
              }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${t.key}`}
              tabIndex={isSelected ? 0 : -1}
              className={`tab-btn${isSelected ? " active" : ""}`}
              onClick={() => selectTab(t.key)}
              onKeyDown={(e) => {
                let nextIdx = -1;
                if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
                else if (e.key === "ArrowLeft")
                  nextIdx = (idx - 1 + tabs.length) % tabs.length;
                else if (e.key === "Home") nextIdx = 0;
                else if (e.key === "End") nextIdx = tabs.length - 1;
                if (nextIdx >= 0) {
                  e.preventDefault();
                  selectTab(tabs[nextIdx].key);
                  btnRefs.current[nextIdx]?.focus();
                }
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeTab.key}`}
      >
        <Active />
      </div>
    </>
  );
}
