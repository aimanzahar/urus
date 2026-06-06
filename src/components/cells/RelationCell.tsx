"use client";

import { useEffect, useState, useTransition } from "react";
import { Menu } from "@/components/Menu";
import {
  addRelationAction,
  removeRelationAction,
  searchRelationChoicesAction,
} from "@/lib/actions";
import type { RelationLink } from "@/lib/types";
import type { CellProps } from "./shared";

function Picker({ databaseId, row, field }: CellProps) {
  const [q, setQ] = useState("");
  const [choices, setChoices] = useState<RelationLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [, start] = useTransition();

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchRelationChoicesAction(field.id, q).then((r) => {
        if (active) {
          setChoices(r);
          setLoading(false);
        }
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, field.id]);

  const linkedIds = new Set(
    (row.relations[field.id] ?? []).map((l) => l.rowId),
  );

  const mutate = (toRowId: string, link: boolean) => {
    const fd = new FormData();
    fd.set("fieldId", field.id);
    fd.set("fromRowId", row.id);
    fd.set("toRowId", toRowId);
    fd.set("databaseId", databaseId);
    start(() =>
      link ? void addRelationAction(fd) : void removeRelationAction(fd),
    );
  };

  const visible = choices.filter((c) => c.rowId !== row.id);

  return (
    <div className="p-1">
      {!field.config.targetDatabaseId ? (
        <p className="text-xs text-ink-faint p-2">
          Set a target database for this relation field first (field menu →
          Edit relation).
        </p>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rows to link…"
            autoFocus
            className="mb-1 btn-sm"
          />
          <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-ink-faint p-2">Searching…</p>
            ) : visible.length === 0 ? (
              <p className="text-xs text-ink-faint p-2">No rows found.</p>
            ) : (
              visible.map((c) => {
                const linked = linkedIds.has(c.rowId);
                return (
                  <button
                    key={c.rowId}
                    type="button"
                    className="menu-item justify-between"
                    onClick={() => mutate(c.rowId, !linked)}
                  >
                    <span className="truncate">{c.title}</span>
                    {linked ? <span className="text-accent">✓</span> : null}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function RelationCell({
  databaseId,
  row,
  field,
  variant,
}: CellProps) {
  const links = row.relations[field.id] ?? [];
  const [, start] = useTransition();

  const remove = (toRowId: string) => {
    const fd = new FormData();
    fd.set("fieldId", field.id);
    fd.set("fromRowId", row.id);
    fd.set("toRowId", toRowId);
    fd.set("databaseId", databaseId);
    start(() => void removeRelationAction(fd));
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${
        variant === "cell" ? "min-h-[28px] px-2 py-1" : "min-h-[34px]"
      }`}
    >
      {links.map((l) => (
        <span key={l.rowId} className="chip opt-blue">
          <span className="opacity-60">↗</span>
          <span className="truncate max-w-[140px]">{l.title}</span>
          <span className="chip-x" onClick={() => remove(l.rowId)}>
            ✕
          </span>
        </span>
      ))}
      <Menu
        button={
          <button type="button" className="chip opt-gray cursor-pointer">
            + Link
          </button>
        }
        width={260}
      >
        <Picker
          databaseId={databaseId}
          row={row}
          field={field}
          variant={variant}
        />
      </Menu>
    </div>
  );
}
