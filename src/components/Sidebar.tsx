import { useState } from "react";
import { MODULE_ALIASES, MODULE_GROUPS } from "../modules/registry";
import { useWorkbench } from "../store/workbench";
import { KEYS, loadJson, saveJson } from "../lib/persistence";

export function Sidebar() {
  const active = useWorkbench((s) => s.activeModule);
  const setActive = useWorkbench((s) => s.setActiveModule);
  // A consolidated module is reachable by several ids; highlight its primary
  // sidebar entry regardless of which sub-view id is active.
  const effectiveActive = MODULE_ALIASES[active] ?? active;

  // Collapsed group names persist across sessions.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(loadJson<string[]>(KEYS.sidebarCollapsed, [])),
  );
  function toggleGroup(group: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      saveJson(KEYS.sidebarCollapsed, [...next]);
      return next;
    });
  }

  return (
    <nav className="sidebar" aria-label="Modules">
      {MODULE_GROUPS.map((g) => {
        const showItems = !collapsed.has(g.group);
        return (
          <div className="sidebar-group" key={g.group}>
            <button
              className="sidebar-label"
              onClick={() => toggleGroup(g.group)}
              aria-expanded={showItems}
              title={showItems ? `Collapse ${g.group}` : `Expand ${g.group}`}
            >
              <span className="sidebar-chevron">{showItems ? "▾" : "▸"}</span>
              {g.group}
            </button>
            {showItems &&
              g.items.map((m) => (
                <button
                  key={m.id}
                  className={`sidebar-item${effectiveActive === m.id ? " active" : ""}`}
                  onClick={() => setActive(m.id)}
                >
                  {m.name}
                </button>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
