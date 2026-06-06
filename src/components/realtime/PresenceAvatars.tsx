"use client";

import { useState } from "react";
import { Menu, useMenuClose } from "@/components/Menu";
import { getSessionId, initials } from "./identity";
import { useRealtime, type Viewer } from "./RealtimeProvider";

function Avatar({ viewer, you }: { viewer: Viewer; you: boolean }) {
  return (
    <div
      title={you ? `${viewer.name} (you)` : viewer.name}
      className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-white ring-2 ring-surface select-none"
      style={{ background: viewer.color }}
    >
      {initials(viewer.name)}
    </div>
  );
}

function RenamePanel() {
  const rt = useRealtime();
  const close = useMenuClose();
  const [val, setVal] = useState(rt?.identity.name ?? "");
  if (!rt) return null;
  return (
    <div className="p-1.5">
      <p className="text-[11px] font-medium text-ink-faint mb-1">Your name</p>
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            rt.rename(val);
            close();
          }
        }}
        className="btn-sm mb-1"
      />
      <button
        className="btn btn-primary btn-sm w-full"
        onClick={() => {
          rt.rename(val);
          close();
        }}
      >
        Save
      </button>
    </div>
  );
}

export default function PresenceAvatars() {
  const rt = useRealtime();
  if (!rt) return null;
  const sid = getSessionId();

  // Dedupe by name+color so the same person in two tabs shows once.
  const seen = new Set<string>();
  const unique = rt.viewers.filter((v) => {
    const k = `${v.name}|${v.color}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) return null;

  const shown = unique.slice(0, 5);
  const extra = unique.length - shown.length;

  return (
    <Menu
      align="right"
      width={220}
      button={
        <button
          className="flex items-center gap-1 px-1 rounded-md hover:bg-surface-2"
          title="Who's here"
        >
          <div className="flex -space-x-2">
            {shown.map((v) => (
              <Avatar key={v.sessionId} viewer={v} you={v.sessionId === sid} />
            ))}
            {extra > 0 ? (
              <div className="w-6 h-6 rounded-full bg-surface-2 text-ink-soft grid place-items-center text-[10px] ring-2 ring-surface">
                +{extra}
              </div>
            ) : null}
          </div>
        </button>
      }
    >
      <div className="px-1.5 py-1">
        <p className="text-[11px] font-medium text-ink-faint mb-1">
          Viewing now ({unique.length})
        </p>
        <ul className="flex flex-col gap-1 max-h-52 overflow-y-auto">
          {unique.map((v) => (
            <li key={v.sessionId} className="flex items-center gap-2 text-sm">
              <Avatar viewer={v} you={v.sessionId === sid} />
              <span className="truncate">
                {v.name}
                {v.sessionId === sid ? (
                  <span className="text-ink-faint"> (you)</span>
                ) : null}
              </span>
              {v.editingRowId ? (
                <span className="ml-auto text-[10px] text-ink-faint">editing</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-line">
        <RenamePanel />
      </div>
    </Menu>
  );
}
