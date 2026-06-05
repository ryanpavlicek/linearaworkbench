import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// Trap keyboard focus within `containerRef` while `active` is true.
//
//   - On activation: moves focus to the first focusable element inside the
//     container (or the container itself as a fallback).
//   - While active: Tab / Shift+Tab cycle within the container; focus can't
//     escape to the page behind a modal.
//   - On teardown: restores focus to whatever was focused before activation
//     (typically the button that opened the modal).
//
// The keydown listener is attached at the document level in capture phase so
// it intercepts Tab regardless of where focus currently sits.
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.getClientRects().length > 0);

    // Move focus into the trap on open.
    const initial = getFocusable()[0];
    if (initial) {
      initial.focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    // Arrow (not a hoisted `function`) so TS keeps the non-null narrowing
    // of `container` inside the closure.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = getFocusable();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !container.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Restore focus to the trigger element on close.
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef]);
}
