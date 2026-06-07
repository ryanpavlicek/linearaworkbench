// Browser APIs jsdom doesn't implement but several modules touch on mount
// (charts, force-graphs, maps, scroll-spy). Stubbed just enough that a module
// can render without throwing; behavior is exercised properly by the E2E layer.
import { vi } from "vitest";

const w = window as unknown as Record<string, unknown>;
const g = globalThis as unknown as Record<string, unknown>;

if (!window.matchMedia) {
  w.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
w.ResizeObserver ??= StubObserver;
w.IntersectionObserver ??= StubObserver;

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// jsdom doesn't implement the CSS object; scroll-spy uses CSS.escape.
g.CSS ??= {};
const css = g.CSS as { escape?: (s: string) => string };
css.escape ??= (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

// SVG geometry used by the force-directed graphs / label layout.
const svgProto = SVGElement.prototype as unknown as Record<string, unknown>;
svgProto.getBBox ??= () => ({ x: 0, y: 0, width: 0, height: 0 });
svgProto.getComputedTextLength ??= () => 0;

// Canvas 2D context (maps, snapshots). Return a no-op proxy so any drawing
// call is a silent no-op rather than a TypeError.
const ctxStub = new Proxy(
  {},
  {
    get: (_t, prop) => {
      if (prop === "canvas") return document.createElement("canvas");
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "getImageData")
        return () => ({ data: new Uint8ClampedArray(4) });
      return () => undefined;
    },
  },
);
const canvasProto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
canvasProto.getContext = vi.fn(() => ctxStub);
canvasProto.toDataURL = vi.fn(() => "data:image/png;base64,");
