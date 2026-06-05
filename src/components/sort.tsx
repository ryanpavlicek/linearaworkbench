import { useState, type CSSProperties } from "react";

// Tiny reusable sort state + clickable table header, shared across the analysis
// modules so every table sorts consistently (click a header to sort; click
// again to flip direction).
export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

export function useSort(initialKey: string, initialDir: SortDir = "desc") {
  const [sort, setSort] = useState<SortState>({
    key: initialKey,
    dir: initialDir,
  });
  function toggle(key: string) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }
  // Returns a sorted copy. `accessors` maps a sort key → a value getter.
  function sortRows<T>(
    rows: T[],
    accessors: Record<string, (r: T) => number | string>,
  ): T[] {
    const acc = accessors[sort.key];
    if (!acc) return rows;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (typeof va === "number" && typeof vb === "number")
        return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }
  return { sort, toggle, sortRows };
}

export function SortHeader({
  label,
  sortKey,
  sort,
  onToggle,
  title,
  style,
}: {
  label: string;
  sortKey: string;
  sort: SortState;
  onToggle: (key: string) => void;
  title?: string;
  style?: CSSProperties;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      onClick={() => onToggle(sortKey)}
      title={title ?? `Sort by ${label}`}
      style={{
        cursor: "pointer",
        color: active ? "var(--ac)" : undefined,
        userSelect: "none",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
      {active ? (sort.dir === "asc" ? " ▴" : " ▾") : ""}
    </th>
  );
}
