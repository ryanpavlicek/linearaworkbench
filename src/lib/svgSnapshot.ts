// Rasterize an inline <svg> to a PNG data URL by drawing it into a canvas.
// Inlines computed colors for any CSS-var-referencing fills/strokes (so the
// snapshot survives outside the app's stylesheet), then serializes the SVG
// and loads it into an Image. Returns null on failure.
export async function svgToPngDataUrl(
  svg: SVGSVGElement,
  opts: { width?: number; height?: number; background?: string } = {},
): Promise<string | null> {
  try {
    const rect = svg.getBoundingClientRect();
    const w = opts.width ?? Math.max(1, Math.round(rect.width || 900));
    const h = opts.height ?? Math.max(1, Math.round(rect.height || 720));

    // Resolve any var(--…) references on fill / stroke / background so the
    // serialized SVG paints correctly without the page CSS.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const live = svg.querySelectorAll("*");
    const clones = clone.querySelectorAll("*");
    for (let i = 0; i < live.length; i++) {
      const l = live[i] as Element;
      const c = clones[i] as Element;
      const cs = window.getComputedStyle(l);
      const setIfVar = (attr: "fill" | "stroke") => {
        const raw = (c as Element).getAttribute(attr);
        if (raw && raw.startsWith("var(")) {
          const resolved = cs.getPropertyValue(attr);
          if (resolved) c.setAttribute(attr, resolved.trim());
        }
      };
      setIfVar("fill");
      setIfVar("stroke");
    }
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg image load failed"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    // 2× scale for crisp print/HD output without ballooning size too much.
    const scale = 2;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
