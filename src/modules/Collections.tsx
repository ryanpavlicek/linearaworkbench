import { useState } from "react";
import { useWorkbench } from "../store/workbench";
import { WordToken } from "../components/WordToken";
import { InscriptionLink } from "../components/InscriptionLink";
import { downloadFile } from "../lib/helpers";

type SetOp = "union" | "intersect" | "difference";

export default function Collections() {
  const collections = useWorkbench((s) => s.collections);
  const create = useWorkbench((s) => s.createCollection);
  const createWithItems = useWorkbench((s) => s.createCollectionWithItems);
  const rename = useWorkbench((s) => s.renameCollection);
  const remove = useWorkbench((s) => s.deleteCollection);
  const removeItem = useWorkbench((s) => s.removeFromCollection);
  const toast = useWorkbench((s) => s.toast_show);

  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Set operations
  const [opA, setOpA] = useState("");
  const [opB, setOpB] = useState("");
  const [op, setOp] = useState<SetOp>("union");

  function runSetOp() {
    const a = collections.find((c) => c.id === opA);
    const b = collections.find((c) => c.id === opB);
    if (!a || !b) return;
    const key = (it: { kind: string; value: string }) =>
      `${it.kind}:${it.value}`;
    const bKeys = new Set(b.items.map(key));
    let items: typeof a.items;
    let symbol: string;
    if (op === "union") {
      items = [...a.items, ...b.items];
      symbol = "∪";
    } else if (op === "intersect") {
      items = a.items.filter((it) => bKeys.has(key(it)));
      symbol = "∩";
    } else {
      items = a.items.filter((it) => !bKeys.has(key(it)));
      symbol = "−";
    }
    const count = new Set(items.map(key)).size;
    const resultName = `${a.name} ${symbol} ${b.name}`;
    createWithItems(resultName, items);
    toast(`Created "${resultName}" (${count} item${count === 1 ? "" : "s"})`);
  }

  return (
    <div className="panel">
      <h2>Collections</h2>
      <div className="callout">
        <h4>Group words and inscriptions for later</h4>
        <p>
          Bookmark anything interesting into named collections — candidate
          religious vocabulary, a particular scribe's tablets, words that
          deserve revisiting. Collections persist in localStorage and can
          surface from any detail modal via the <code>⊞ Collection</code>{" "}
          button.
        </p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="New collection name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              create(name.trim());
              toast(`Created "${name.trim()}"`);
              setName("");
            }
          }}
        />
        <button
          className="btn"
          disabled={!name.trim()}
          onClick={() => {
            create(name.trim());
            toast(`Created "${name.trim()}"`);
            setName("");
          }}
        >
          New collection
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            downloadFile(
              "linear_a_collections.json",
              JSON.stringify(collections, null, 2),
              "application/json",
            );
            toast("Exported collections");
          }}
        >
          Export
        </button>
      </div>

      {collections.length >= 2 && (
        <div
          className="toolbar"
          style={{ flexWrap: "wrap", alignItems: "center" }}
        >
          <span
            className="dim"
            style={{
              font: "600 9px var(--sans)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Set operation
          </span>
          <select
            className="select"
            value={opA}
            onChange={(e) => setOpA(e.target.value)}
            style={{ fontSize: 11, padding: "3px 6px", maxWidth: 180 }}
          >
            <option value="">collection A…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.items.length})
              </option>
            ))}
          </select>
          <select
            className="select"
            value={op}
            onChange={(e) => setOp(e.target.value as SetOp)}
            style={{ fontSize: 11, padding: "3px 6px" }}
            title="Union: items in either · Intersect: items in both · Difference: in A but not B"
          >
            <option value="union">∪ union</option>
            <option value="intersect">∩ intersect</option>
            <option value="difference">− difference</option>
          </select>
          <select
            className="select"
            value={opB}
            onChange={(e) => setOpB(e.target.value)}
            style={{ fontSize: 11, padding: "3px 6px", maxWidth: 180 }}
          >
            <option value="">collection B…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.items.length})
              </option>
            ))}
          </select>
          <button
            className="btn btn-sm"
            disabled={!opA || !opB || opA === opB}
            onClick={runSetOp}
            title={
              opA === opB && opA
                ? "Pick two different collections"
                : "Create a new collection from the result"
            }
          >
            Create result
          </button>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="card">
          <div className="dim">
            No collections yet. Click <b>⊞ Collection</b> on any word or
            inscription to start grouping them.
          </div>
        </div>
      ) : (
        collections.map((c) => (
          <div className="card" key={c.id}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              {renamingId === c.id ? (
                <input
                  className="input"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim() && renameValue !== c.name)
                      rename(c.id, renameValue.trim());
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (renameValue.trim()) rename(c.id, renameValue.trim());
                      setRenamingId(null);
                    }
                  }}
                  style={{ flex: 1, font: "500 14px var(--sans)" }}
                />
              ) : (
                <h4
                  style={{ flex: 1, cursor: "text" }}
                  onClick={() => {
                    setRenamingId(c.id);
                    setRenameValue(c.name);
                  }}
                >
                  {c.name}{" "}
                  <span className="dim" style={{ fontWeight: 400 }}>
                    ({c.items.length})
                  </span>
                </h4>
              )}
              <span className="dim" style={{ fontSize: 10 }}>
                updated {new Date(c.updatedAt).toLocaleDateString()}
              </span>
              <button
                className="btn btn-outline btn-sm"
                style={{ color: "var(--rd)" }}
                onClick={() => {
                  if (
                    window.confirm(`Delete collection "${c.name}"?`)
                  )
                    remove(c.id);
                }}
              >
                Delete
              </button>
            </div>
            {c.items.length === 0 ? (
              <div className="dim" style={{ fontSize: 11 }}>
                Empty — add items from any word or inscription detail view.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {c.items.map((it) => (
                  <span
                    key={`${it.kind}:${it.value}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 6px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 3,
                      fontSize: 11,
                    }}
                  >
                    {it.kind === "word" ? (
                      <WordToken word={it.value} />
                    ) : (
                      <InscriptionLink id={it.value} />
                    )}
                    <button
                      className="dim"
                      style={{
                        background: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--rd)",
                        fontSize: 10,
                      }}
                      onClick={() => removeItem(c.id, it)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
