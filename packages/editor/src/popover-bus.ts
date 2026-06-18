// popover-bus — one open menu/popover at a time, across the editor AND the host.
//
// Every dropdown/popover/menu announces itself when it opens; any OTHER open
// popover closes itself. This works across components (and across the app/package
// boundary) because it rides a single window CustomEvent — so opening the File
// menu closes the Properties popover, opening the seal chip closes a ribbon
// dropdown, etc., without the pieces needing to know about each other.

import { useEffect, type RefObject } from "react";

const EVENT = "it-popover-open";

/** Announce that the popover with this id just opened (others will close). */
export function announcePopover(id: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
  }
}

/**
 * Close this popover whenever a DIFFERENT popover announces it opened. Pass the
 * popover's stable id, whether it's currently open, and how to close it.
 */
export function usePopoverExclusive(
  id: string,
  isOpen: boolean,
  close: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return;
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) close();
    };
    window.addEventListener(EVENT, onOther);
    return () => window.removeEventListener(EVENT, onOther);
  }, [id, isOpen, close]);
}

/**
 * Full popover dismissal: closes when ANOTHER popover opens (exclusive), when the
 * user clicks ANYWHERE outside `ref`, or on Escape — so a popover only stays open
 * until you click its own trigger again or interact elsewhere. Pass a ref on the
 * popover's root element (the trigger + menu both inside it, so clicking the
 * trigger toggles rather than dismisses).
 */
export function usePopover(
  id: string,
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  close: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return;
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) close();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener(EVENT, onOther);
    // capture-phase so we see the click even if inner handlers stop propagation
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(EVENT, onOther);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [id, isOpen, close, ref]);
}
