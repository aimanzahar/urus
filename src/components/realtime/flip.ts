"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

// FLIP (First-Last-Invert-Play): glide a card to its new column/position when a
// *remote* edit reorders or moves it, instead of teleporting after the refresh.
// Last screen positions are kept at module scope so a card that changes column
// (and thus unmounts in one list + remounts in another) can still animate from
// where it was to where it lands.

const positions = new Map<string, { left: number; top: number }>();

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Returns a callback ref to attach to a movable element (compose it with any
 * other refs, e.g. dnd-kit's `setNodeRef`). On every commit it measures the
 * element and, if it moved since the previous commit, plays a transform-glide
 * from the old position to the new one via the Web Animations API (which runs
 * independently of React's inline `style`, so nothing clobbers it).
 *
 * @param id   stable identity of the element across renders/remounts
 * @param skip pass true while the local user is actively dragging this element
 *             — let the drag library own the motion in that case.
 */
export function useFlip(
  id: string,
  skip: boolean,
): (el: HTMLElement | null) => void {
  const ref = useRef<HTMLElement | null>(null);
  const anim = useRef<Animation | null>(null);
  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el;
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const prev = positions.get(id);
    positions.set(id, { left: r.left, top: r.top });
    if (skip || !prev || reducedMotion()) return;
    const dx = prev.left - r.left;
    const dy = prev.top - r.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    // Supersede any in-flight glide so rapid re-layouts don't stack/wobble.
    anim.current?.cancel();
    anim.current = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0px, 0px)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
  });

  return setRef;
}
