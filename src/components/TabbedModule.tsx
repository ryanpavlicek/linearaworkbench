import { useState, type ComponentType } from "react";

export interface ModuleTab {
  key: string;
  label: string;
  Component: ComponentType;
}

/**
 * Thin wrapper that presents several related modules as tabs under a single
 * sidebar entry. Each tab is an existing module component, rendered unchanged
 * (it keeps its own panel + heading). Used to consolidate view-splits — e.g.
 * the co-occurrence table and its network graph — so related views live
 * together instead of in separate sidebar entries.
 */
export function TabbedModule({
  tabs,
  initialKey,
}: {
  tabs: ModuleTab[];
  initialKey?: string;
}) {
  const [active, setActive] = useState(() =>
    tabs.some((t) => t.key === initialKey) ? (initialKey as string) : tabs[0].key,
  );
  const Active = (tabs.find((t) => t.key === active) ?? tabs[0]).Component;
  return (
    <>
      <div className="module-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            className={`tab-btn${active === t.key ? " active" : ""}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </>
  );
}
