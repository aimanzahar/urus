"use client";

import { useState } from "react";

// --- Change-flash registry --------------------------------------------------
//
// Remote edits arrive as a coarse "something changed" refresh, so a changed
// cell would otherwise *snap* to its new value. `useCellFlash` detects when a
// cell's value actually changed (vs. an unrelated refresh) and triggers a brief
// highlight, tinted with the editor's user color.
//
// Two things must live at module scope because they're written from *outside*
// the cell component: which edits the local user made (so we don't flash our
// own changes) and which user last edited each cell (so a change event that
// lands after the editor blurred can still flash in their color).

// How long after a local edit we suppress that cell's flash. Covers the
// round-trip (save -> broadcast -> our own refresh lands), which is debounced
// on both ends, so keep a comfortable margin.
const LOCAL_EDIT_TTL = 2500;
const EDITOR_COLOR_TTL = 6000;

const localEdits = new Map<string, number>();
const recentEditorColor = new Map<string, { color: string; at: number }>();

/** Record that the local user just edited this cell, so their own change (which
 *  comes back as a refresh shortly after) doesn't flash on their own screen. */
export function markLocalEdit(key: string): void {
  localEdits.set(key, Date.now());
}

/** Remember who is/was editing a cell, so a later change flashes in their color. */
export function noteEditorColor(key: string, color: string): void {
  recentEditorColor.set(key, { color, at: Date.now() });
}

function isLocalEdit(key: string): boolean {
  const at = localEdits.get(key);
  return at !== undefined && Date.now() - at <= LOCAL_EDIT_TTL;
}

function editorColorFor(key: string): string | null {
  const e = recentEditorColor.get(key);
  return e && Date.now() - e.at <= EDITOR_COLOR_TTL ? e.color : null;
}

export interface FlashState {
  flashing: boolean;
  color: string;
  /** Changes on every trigger so the overlay element (and its animation) restarts. */
  nonce: number;
  onAnimationEnd: () => void;
}

/**
 * Flash trigger for a single cell/card.
 *
 * @param key        unique per rendered cell, e.g. `${rowId}:${fieldId}` (table)
 *                   or `${rowId}` (card). Used to suppress the local user's own
 *                   edits.
 * @param signature  a stable string of the current value; a flash fires when it
 *                   changes between renders. The first value seen seeds without
 *                   flashing, so nothing flashes on initial load.
 * @param colorKey   key to look up the editor's color (defaults to `key`).
 */
export function useCellFlash(
  key: string,
  signature: string,
  colorKey: string = key,
): FlashState {
  // Derive a flash from a *change* in `signature` between renders. Setting
  // state during render (the "previous value" pattern) is React's endorsed way
  // to respond to prop changes without an effect. The first render seeds
  // `prevSig`, so nothing flashes on initial load.
  const [prevSig, setPrevSig] = useState(signature);
  const [state, setState] = useState<{ on: boolean; color: string; nonce: number }>(
    { on: false, color: "var(--accent)", nonce: 0 },
  );

  if (signature !== prevSig) {
    setPrevSig(signature);
    if (!isLocalEdit(key)) {
      const color = editorColorFor(colorKey) ?? "var(--accent)";
      setState((s) => ({ on: true, color, nonce: s.nonce + 1 }));
    }
  }

  return {
    flashing: state.on,
    color: state.color,
    nonce: state.nonce,
    onAnimationEnd: () => setState((s) => (s.on ? { ...s, on: false } : s)),
  };
}
