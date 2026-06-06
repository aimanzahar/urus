"use client";

import { useState, useTransition } from "react";
import { Menu, useMenuClose } from "@/components/Menu";
import { addOptionAndAssignAction } from "@/lib/actions";
import type { SelectOption } from "@/lib/types";
import { ALL_OPTION_COLORS, optClass, saveCell, type CellProps } from "./shared";

function Chip({ option }: { option: SelectOption }) {
  return (
    <span className={`chip ${optClass(option.color)}`}>
      <span className={`opt-dot ${optClass(option.color)}`} />
      {option.label}
    </span>
  );
}

function Popover({
  databaseId,
  row,
  field,
  multi,
  selectedIds,
}: CellProps & { multi: boolean; selectedIds: string[] }) {
  const close = useMenuClose();
  const [q, setQ] = useState("");
  const [, start] = useTransition();

  const set = (ids: string[]) =>
    start(() => {
      void saveCell(
        databaseId,
        row,
        field,
        multi ? JSON.stringify(ids) : ids[0] ?? "",
      );
    });

  const toggle = (id: string) => {
    if (multi) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      set(next);
    } else {
      set([id]);
      close();
    }
  };

  const create = () => {
    const label = q.trim();
    if (!label) return;
    const fd = new FormData();
    fd.set("fieldId", field.id);
    fd.set("rowId", row.id);
    fd.set("databaseId", databaseId);
    fd.set("mode", multi ? "multi" : "single");
    fd.set("label", label);
    fd.set(
      "color",
      ALL_OPTION_COLORS[field.options.length % ALL_OPTION_COLORS.length],
    );
    start(() => void addOptionAndAssignAction(fd));
    setQ("");
    if (!multi) close();
  };

  const filtered = field.options.filter((o) =>
    o.label.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const exact = field.options.some(
    (o) => o.label.toLowerCase() === q.trim().toLowerCase(),
  );

  return (
    <div className="p-1">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim() && !exact) {
            e.preventDefault();
            create();
          }
        }}
        placeholder="Search or create…"
        autoFocus
        className="mb-1 btn-sm"
      />
      <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
        {filtered.map((o) => (
          <button
            key={o.id}
            type="button"
            className="menu-item justify-between"
            onClick={() => toggle(o.id)}
          >
            <Chip option={o} />
            {selectedIds.includes(o.id) ? (
              <span className="text-accent">✓</span>
            ) : null}
          </button>
        ))}
        {q.trim() && !exact ? (
          <button type="button" className="menu-item" onClick={create}>
            Create <span className="font-medium">“{q.trim()}”</span>
          </button>
        ) : null}
        {!multi && selectedIds.length > 0 ? (
          <button
            type="button"
            className="menu-item text-ink-faint"
            onClick={() => {
              set([]);
              close();
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function SelectCell({
  databaseId,
  row,
  field,
  variant,
}: CellProps) {
  const multi = field.type === "multi_select";
  const value = row.properties[field.id];
  const selectedIds: string[] = multi
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : typeof value === "string" && value
      ? [value]
      : [];
  const selected = selectedIds
    .map((id) => field.options.find((o) => o.id === id))
    .filter((o): o is SelectOption => Boolean(o));
  // Defense-in-depth: ids with no matching option render faded.
  const orphanCount = selectedIds.length - selected.length;

  const trigger = (
    <div
      className={`flex flex-wrap items-center gap-1 cursor-pointer ${
        variant === "cell" ? "min-h-[28px] px-2 py-1" : "min-h-[34px]"
      }`}
    >
      {selected.map((o) => (
        <Chip key={o.id} option={o} />
      ))}
      {orphanCount > 0 ? (
        <span className="chip opt-gray opacity-50">unknown</span>
      ) : null}
      {selected.length === 0 && orphanCount === 0 ? (
        <span className="text-ink-faint text-sm">
          {variant === "panel" ? "Empty" : ""}
        </span>
      ) : null}
    </div>
  );

  return (
    <Menu button={trigger} width={250}>
      <Popover
        databaseId={databaseId}
        row={row}
        field={field}
        variant={variant}
        multi={multi}
        selectedIds={selectedIds}
      />
    </Menu>
  );
}
