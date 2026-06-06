"use client";

import type { Viewer } from "./RealtimeProvider";

/** A small "✎ Name" pill shown on a row/card someone else is editing. */
export function EditingBadge({
  editors,
  className,
}: {
  editors: Viewer[];
  className?: string;
}) {
  if (editors.length === 0) return null;
  const first = editors[0];
  const more = editors.length - 1;
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium whitespace-nowrap shadow-sm pointer-events-none ${
        className ?? ""
      }`}
      style={{ background: first.color }}
    >
      ✎ {first.name}
      {more > 0 ? ` +${more}` : ""}
    </span>
  );
}

/** Inset left-border highlight in the first editor's color. */
export function editingShadow(editors: Viewer[]): string | undefined {
  return editors.length ? `inset 3px 0 0 0 ${editors[0].color}` : undefined;
}
