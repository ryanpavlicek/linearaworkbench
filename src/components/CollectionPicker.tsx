import { useEffect, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";

interface Props {
  kind: "word" | "inscription";
  value: string;
}

export function CollectionPicker({ kind, value }: Props) {
  const collections = useWorkbench((s) => s.collections);
  const create = useWorkbench((s) => s.createCollection);
  const add = useWorkbench((s) => s.addToCollection);
  const remove = useWorkbench((s) => s.removeFromCollection);
  const toast = useWorkbench((s) => s.toast_show);

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const member = (cid: string) =>
    collections
      .find((c) => c.id === cid)
      ?.items.some((i) => i.kind === kind && i.value === value) ?? false;

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        className="btn btn-outline btn-sm"
        onClick={() => setOpen((o) => !o)}
        title="Add to collection"
      >
        ⊞ Collection
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
            padding: 8,
            minWidth: 220,
            zIndex: 30,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {collections.length === 0 ? (
            <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
              No collections yet.
            </div>
          ) : (
            collections.map((c) => {
              const isMember = member(c.id);
              return (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 2px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isMember}
                    onChange={() => {
                      if (isMember) {
                        remove(c.id, { kind, value });
                        toast(`Removed from "${c.name}"`);
                      } else {
                        add(c.id, { kind, value });
                        toast(`Added to "${c.name}"`);
                      }
                    }}
                  />
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span className="dim" style={{ fontSize: 10 }}>
                    {c.items.length}
                  </span>
                </label>
              );
            })
          )}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 6,
              paddingTop: 6,
              borderTop: "1px solid var(--border)",
            }}
          >
            <input
              className="input"
              placeholder="New collection"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ flex: 1, fontSize: 11 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  const id = create(newName.trim());
                  add(id, { kind, value });
                  toast(`Created "${newName.trim()}"`);
                  setNewName("");
                }
              }}
            />
            <button
              className="btn btn-sm"
              disabled={!newName.trim()}
              onClick={() => {
                const id = create(newName.trim());
                add(id, { kind, value });
                toast(`Created "${newName.trim()}"`);
                setNewName("");
              }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
