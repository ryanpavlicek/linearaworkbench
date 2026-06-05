// Position a popover anchored under a trigger element, clamped to the viewport.
//
// The popover is rendered with `position: fixed` and these JS-computed coords.
// That matters: the app's `.main` content column sets `overflow-y: auto`, which
// makes the browser compute `overflow-x: auto` too — so a `position: absolute`
// popover that extends past the column edge gets *clipped* and slides under the
// sidebar. A fixed popover is clipped only by the viewport (no transformed
// ancestors create a containing block here), so it escapes that and can sit
// above the sidebar.
export function anchoredPopoverPos(
  trigger: HTMLElement,
  width: number,
  estHeight: number,
  opts: { align?: "left" | "right"; gap?: number } = {},
): { top: number; left: number } {
  const r = trigger.getBoundingClientRect();
  const gap = opts.gap ?? 4;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const align = opts.align ?? "left";
  // "left" aligns the popover's left edge to the trigger; "right" aligns the
  // popover's right edge to the trigger's right edge.
  let left = align === "right" ? r.right - width : r.left;
  left = Math.max(8, Math.min(left, vw - width - 8));
  // Prefer below the trigger; flip above if it would overflow the bottom and
  // there's room above.
  let top = r.bottom + gap;
  if (top + estHeight > vh - 8 && r.top - estHeight - gap > 8) {
    top = r.top - estHeight - gap;
  }
  top = Math.max(8, top);
  return { top, left };
}
