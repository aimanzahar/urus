"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export const MenuCloseCtx = createContext<() => void>(() => {});
export const useMenuClose = () => useContext(MenuCloseCtx);

/**
 * Click-to-open dropdown. The panel is rendered with viewport-fixed
 * positioning and clamped/flipped so it NEVER overflows off-screen, no matter
 * where the trigger sits (right edge, bottom edge, inside a scroll area). The
 * panel does NOT auto-close on inner clicks (so it can hold inputs); menu items
 * call useMenuClose() to dismiss. Closes on outside click and Escape.
 */
export function Menu({
  button,
  children,
  align = "left",
  width = 224,
}: {
  button: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const reposition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const margin = 8;
    const pw = panelRef.current?.offsetWidth ?? width;
    const ph = panelRef.current?.offsetHeight ?? 0;

    // Horizontal: prefer requested alignment, then clamp into the viewport.
    let left = align === "right" ? r.right - pw : r.left;
    left = Math.min(left, window.innerWidth - pw - margin);
    left = Math.max(margin, left);

    // Vertical: open downward; flip up if it would overflow the bottom.
    let top = r.bottom + 4;
    if (ph && top + ph > window.innerHeight - margin) {
      const up = r.top - ph - 4;
      top = up >= margin ? up : Math.max(margin, window.innerHeight - ph - margin);
    }
    setPos({ left, top });
  }, [align, width]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Re-clamp when the panel's own content changes size (e.g. async-loaded
    // relation results, adding a filter row) so it never grows off-screen.
    const ro = new ResizeObserver(() => reposition());
    if (panelRef.current) ro.observe(panelRef.current);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      ro.disconnect();
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-block"
        onClick={() => setOpen((o) => !o)}
      >
        {button}
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
            <MenuCloseCtx.Provider value={close}>
              <div
                ref={panelRef}
                className="menu fixed z-[60] animate-pop"
                style={{
                  left: pos?.left ?? -9999,
                  top: pos?.top ?? -9999,
                  width,
                  maxHeight: "min(70vh, 520px)",
                  overflowY: "auto",
                  visibility: pos ? "visible" : "hidden",
                }}
              >
                {children}
              </div>
            </MenuCloseCtx.Provider>,
            document.body,
          )
        : null}
    </>
  );
}

/** A menu row that runs an action then closes the menu. */
export function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const close = useMenuClose();
  return (
    <button
      type="button"
      className={`menu-item ${danger ? "danger" : ""}`}
      onClick={() => {
        onClick?.();
        close();
      }}
    >
      {children}
    </button>
  );
}
