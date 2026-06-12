// Node 22.4+ defines experimental `localStorage`/`sessionStorage` getters on
// globalThis that evaluate to undefined unless --localstorage-file is set.
// In the vitest jsdom environment `window` IS `globalThis`, so the dud getter
// also shadows jsdom's storage and every storage-backed test breaks on a
// new-enough Node. There is no real Storage left to borrow, so install a
// spec-shaped in-memory one. Node-environment test files (no `window`) are
// untouched; the lib code's try/catch storage guards keep covering them.

class MemoryStorage {
  #map = new Map<string, string>();
  get length(): number {
    return this.#map.size;
  }
  clear(): void {
    this.#map.clear();
  }
  getItem(key: string): string | null {
    return this.#map.has(key) ? this.#map.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.#map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.#map.set(String(key), String(value));
  }
}

if (typeof window !== "undefined") {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    if ((globalThis as unknown as Record<string, unknown>)[key] === undefined) {
      Object.defineProperty(globalThis, key, {
        value: new MemoryStorage(),
        configurable: true,
        writable: true,
      });
    }
  }
}
