"use client";

import { useEffect } from "react";

/**
 * Makes the whole app feel like a native app: the browser's default context
 * menu never appears. Elements with their own <ContextMenu> handle + stop the
 * event before it reaches here; anything else gets the native menu suppressed.
 *
 * Exception: real free-text writing surfaces (<textarea>, e.g. page notes)
 * keep the native Cut/Copy/Paste menu, which is itself the native-app behavior
 * for text editing.
 */
export default function SuppressNativeContextMenu() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("textarea")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);
  return null;
}
