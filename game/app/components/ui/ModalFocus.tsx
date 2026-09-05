import { useLayoutEffect, useRef, type RefObject } from "react";

export function restoreModalFocus(
  restore: (() => void) | undefined,
  invoker: Pick<HTMLElement, "focus" | "isConnected"> | null,
): void {
  if (restore) restore();
  else if (invoker?.isConnected) invoker.focus();
}

interface ModalFocusOptions {
  active?: boolean;
  rootRef: RefObject<HTMLElement | null>;
  initialFocus?: () => HTMLElement | null;
  onEscape?: () => void;
  restoreFocus?: false | (() => void);
}

function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]',
  )].filter(element => element.tabIndex >= 0 && !element.matches(':disabled, [aria-disabled="true"]') &&
    element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
}

/** The shell enables only the top surface. Covered surfaces retain their invokers. */
export function useModalFocus(options: ModalFocusOptions): void {
  const latest = useRef(options);
  latest.current = options;
  const initialized = useRef(false);
  const invoker = useRef<HTMLElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const active = options.active ?? true;

  useLayoutEffect(() => {
    if (!active) return;
    const root = options.rootRef.current;
    if (!root) return;
    const focusInitial = () => {
      const preferred = latest.current.initialFocus?.();
      const target = preferred && !preferred.matches(":disabled") ? preferred : tabbables(root)[0] ?? root;
      target.focus();
    };
    if (!initialized.current) {
      invoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      initialized.current = true;
      focusInitial();
    } else {
      // Let a closing child restore its exact invoker before choosing a fallback.
      queueMicrotask(() => {
        if (!(latest.current.active ?? true) || !root.isConnected || root.contains(document.activeElement)) return;
        if (lastFocused.current?.isConnected && !lastFocused.current.matches(":disabled")) lastFocused.current.focus();
        else focusInitial();
      });
    }
    const keydown = (event: KeyboardEvent) => {
      if (!(latest.current.active ?? true)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        latest.current.onEscape?.();
      } else if (event.key === "Tab") {
        const items = tabbables(root);
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (!items.length || index === -1 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
          event.preventDefault();
          (event.shiftKey ? items[items.length - 1] ?? root : items[0] ?? root).focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (!(latest.current.active ?? true)) return;
      if (event.target instanceof HTMLElement && root.contains(event.target)) lastFocused.current = event.target;
      else focusInitial();
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin, true);
    // Removing the focused control does not emit focusin (for example, Found
    // becomes Descend). Recover after DOM updates without stealing child focus.
    const contentObserver = new MutationObserver(() => {
      if ((latest.current.active ?? true) && root.isConnected && !root.contains(document.activeElement)) focusInitial();
    });
    contentObserver.observe(root, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin, true);
      contentObserver.disconnect();
    };
  }, [active, options.rootRef]);

  useLayoutEffect(() => {
    const root = options.rootRef.current;
    return () => {
      // StrictMode replays effects while keeping the DOM connected.
      queueMicrotask(() => {
        const current = latest.current;
        if (!root || root.isConnected || !(current.active ?? true) || current.restoreFocus === false) return;
        restoreModalFocus(current.restoreFocus, invoker.current);
      });
    };
  }, [options.rootRef]);
}
