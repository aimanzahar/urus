"use client";

import { useEffect, type ReactNode } from "react";

/** A right-side slide-over panel. Closes on Escape and backdrop click. */
export function Drawer({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md h-full bg-surface border-l border-line shadow-lg flex flex-col animate-pop">
        <div className="flex items-center justify-between px-4 h-12 border-b border-line shrink-0">
          <div className="font-medium text-sm truncate">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
