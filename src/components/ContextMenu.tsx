"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MenuCloseCtx } from "./Menu";

/**
 * Right-click (context) menu. Wraps a target; on contextmenu it opens a
 * cursor-anchored menu, clamped to stay on-screen. `menu` receives a close()
 * callback; menu items inside can also call useMenuClose(). Closes on outside
 * click, Escape, and scroll.
 */
export function ContextMenu({
  children,
  menu,
  width = 200,
  className = "contents",
}: {
  children: ReactNode;
  menu: ReactNode;
  width?: number;
  className?: string;
}) {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPt(null), []);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPos(null);
    setPt({ x: e.clientX, y: e.clientY });
  };

  useLayoutEffect(() => {
    if (!pt) return;
    const margin = 8;
    const pw = panelRef.current?.offsetWidth ?? width;
    const ph = panelRef.current?.offsetHeight ?? 0;
    let left = Math.min(pt.x, window.innerWidth - pw - margin);
    left = Math.max(margin, left);
    let top = pt.y;
    if (ph && top + ph > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - ph - margin);
    }
    setPos({ left, top });
  }, [pt, width]);

  useEffect(() => {
    if (!pt) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setPt(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPt(null);
    };
    const onScroll = () => setPt(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [pt]);

  return (
    <>
      <div className={className} onContextMenu={onContextMenu}>
        {children}
      </div>
      {pt && typeof document !== "undefined"
        ? createPortal(
            <MenuCloseCtx.Provider value={close}>
              <div
                ref={panelRef}
                className="menu fixed z-[70] animate-pop"
                style={{
                  left: pos?.left ?? -9999,
                  top: pos?.top ?? -9999,
                  width,
                  maxHeight: "min(70vh, 520px)",
                  overflowY: "auto",
                  visibility: pos ? "visible" : "hidden",
                }}
                onClick={() => setPt(null)}
              >
                {menu}
              </div>
            </MenuCloseCtx.Provider>,
            document.body,
          )
        : null}
    </>
  );
}
