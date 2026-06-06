"use client";

import Link from "next/link";
import { useRef, useTransition } from "react";
import { Menu, MenuItem } from "@/components/Menu";
import {
  createRowAction,
  createViewAction,
  deleteDatabaseAction,
  deleteViewAction,
  renameDatabaseAction,
  renameViewAction,
} from "@/lib/actions";
import type { DatabaseDef, View, ViewType } from "@/lib/types";
import { VIEW_ICON } from "./util";

export function DbTitle({ database }: { database: DatabaseDef }) {
  const [, start] = useTransition();
  return (
    <input
      key={database.updatedAt}
      defaultValue={database.title}
      onBlur={(e) => {
        if (e.currentTarget.value !== database.title) {
          const fd = new FormData();
          fd.set("databaseId", database.id);
          fd.set("title", e.currentTarget.value);
          start(() => void renameDatabaseAction(fd));
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      aria-label="Database title"
      className="!border-0 !bg-transparent !px-0 !shadow-none focus:!shadow-none text-lg font-semibold tracking-tight"
    />
  );
}

export function DbMenu({ database }: { database: DatabaseDef }) {
  const onDelete = () => {
    if (!confirm("Delete this database and all its rows? This cannot be undone."))
      return;
    const fd = new FormData();
    fd.set("databaseId", database.id);
    void deleteDatabaseAction(fd);
  };
  return (
    <Menu
      align="right"
      width={200}
      button={
        <button className="icon-btn" aria-label="Database options">
          ⋯
        </button>
      }
    >
      <MenuItem danger onClick={onDelete}>
        🗑 Delete database
      </MenuItem>
    </Menu>
  );
}

const VIEW_TYPES: { type: ViewType; label: string }[] = [
  { type: "table", label: "Table" },
  { type: "kanban", label: "Board" },
  { type: "calendar", label: "Calendar" },
  { type: "timeline", label: "Timeline" },
  { type: "gallery", label: "Gallery" },
];

export function AddViewMenu({ databaseId }: { databaseId: string }) {
  return (
    <Menu
      width={180}
      button={
        <button className="btn btn-subtle btn-sm" title="Add view">
          + View
        </button>
      }
    >
      {VIEW_TYPES.map((v) => (
        <MenuItem
          key={v.type}
          onClick={() => {
            const fd = new FormData();
            fd.set("databaseId", databaseId);
            fd.set("type", v.type);
            void createViewAction(fd);
          }}
        >
          <span className="w-4 text-center text-ink-faint">
            {VIEW_ICON[v.type]}
          </span>
          {v.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

export function ViewTabs({
  databaseId,
  views,
  activeViewId,
}: {
  databaseId: string;
  views: View[];
  activeViewId: string | null;
}) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto">
      {views.map((v) => {
        const active = v.id === activeViewId;
        return (
          <div key={v.id} className="flex items-center">
            <Link
              href={`/db/${databaseId}?view=${v.id}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] whitespace-nowrap transition-colors"
              style={
                active
                  ? { background: "var(--surface-2)", color: "var(--ink)", fontWeight: 550 }
                  : { color: "var(--ink-soft)" }
              }
            >
              <span className="text-ink-faint">{VIEW_ICON[v.type]}</span>
              {v.name}
            </Link>
            {active ? <ViewTabMenu databaseId={databaseId} view={v} canDelete={views.length > 1} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function ViewTabMenu({
  databaseId,
  view,
  canDelete,
}: {
  databaseId: string;
  view: View;
  canDelete: boolean;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <Menu
      width={200}
      button={
        <button className="icon-btn" style={{ width: 22, height: 22 }} aria-label="View options">
          ▾
        </button>
      }
    >
      <div className="p-1.5">
        <input
          ref={nameRef}
          defaultValue={view.name}
          className="btn-sm mb-1"
          onBlur={(e) => {
            if (e.currentTarget.value !== view.name) {
              const fd = new FormData();
              fd.set("viewId", view.id);
              fd.set("databaseId", databaseId);
              fd.set("name", e.currentTarget.value);
              void renameViewAction(fd);
            }
          }}
        />
        {canDelete ? (
          <MenuItem
            danger
            onClick={() => {
              const fd = new FormData();
              fd.set("viewId", view.id);
              fd.set("databaseId", databaseId);
              void deleteViewAction(fd);
            }}
          >
            🗑 Delete view
          </MenuItem>
        ) : null}
      </div>
    </Menu>
  );
}

export function NewRowButton({ databaseId }: { databaseId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-primary btn-sm"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("databaseId", databaseId);
        start(() => void createRowAction(fd));
      }}
    >
      + New
    </button>
  );
}
