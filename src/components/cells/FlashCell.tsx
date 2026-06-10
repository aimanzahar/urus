"use client";

import type { CSSProperties } from "react";
import { useCellFlash } from "@/components/realtime/changeFlash";

/**
 * A translucent wash that briefly highlights a cell/card when its value changes
 * from a remote edit, tinted with the editor's user color. Drop it inside any
 * `position: relative` container (table cell, drawer field, board/gallery card);
 * it paints over the content via `inset: 0` and removes itself when the
 * animation ends.
 *
 * Must stay mounted across re-renders (don't give it a changing React key), so
 * the underlying value-change detector keeps its history.
 */
export default function CellFlash({
  flashKey,
  signature,
  colorKey,
}: {
  flashKey: string;
  signature: string;
  colorKey?: string;
}) {
  const flash = useCellFlash(flashKey, signature, colorKey);
  if (!flash.flashing) return null;
  return (
    <span
      key={flash.nonce}
      aria-hidden
      className="cell-flash"
      style={{ "--flash-color": flash.color } as CSSProperties}
      onAnimationEnd={flash.onAnimationEnd}
    />
  );
}
