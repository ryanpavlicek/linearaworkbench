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
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();

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
      <div style={{ padding: "8px 10px 4px" }}>
        <input
          type="search"
          className="input"
          aria-label="Filter modules"
          placeholder="Filter modules…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: "100%", fontSize: 11, padding: "4px 8px" }}
        />
      </div>
      {MODULE_GROUPS.map((g) => {
        const items = needle
          ? g.items.filter(
              (m) =>
                m.name.toLowerCase().includes(needle) ||
                (m.keywords && m.keywords.toLowerCase().includes(needle)),
            )
          : g.items;
        if (items.length === 0) return null;
        const showItems = needle ? true : !collapsed.has(g.group);
        return (
          <div className="sidebar-group" key={g.group}>
            <button
              type="button"
              className="sidebar-label"
              onClick={() => toggleGroup(g.group)}
              aria-expanded={showItems}
              title={showItems ? `Collapse ${g.group}` : `Expand ${g.group}`}
            >
              <span className="sidebar-chevron">{showItems ? "▾" : "▸"}</span>
              {g.group}
            </button>
            {showItems &&
              items.map((m) => {
                const isActive = effectiveActive === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`sidebar-item${isActive ? " active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setActive(m.id)}
                  >
                    {m.name}
                  </button>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}
