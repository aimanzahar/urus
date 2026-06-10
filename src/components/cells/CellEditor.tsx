"use client";

import { useState, useTransition } from "react";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import SelectCell from "./SelectCell";
import RelationCell from "./RelationCell";
import ImageCell from "./ImageCell";
import { cellString, saveCell, type CellProps } from "./shared";

// !px-2: the unlayered base input rule (padding 0.5rem 0.65rem) beats layered
// utilities, and cell text must sit on the table's 52px left rule.
const cellInputClass =
  "!border-0 !bg-transparent !rounded-none !shadow-none focus:!shadow-none !px-2 py-1 text-sm w-full";

function TextCell({ databaseId, row, field, variant }: CellProps) {
  const [, start] = useTransition();
  const persisted = cellString(row, field);
  const save = (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (el.value !== persisted)
      start(() => void saveCell(databaseId, row, field, el.value));
  };
  return (
    <input
      key={`${row.updatedAt}:${field.id}`}
      type="text"
      defaultValue={persisted}
      placeholder={variant === "panel" ? "Empty" : ""}
      onBlur={(e) => save(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={variant === "cell" ? cellInputClass : ""}
    />
  );
}

function NumberCell({ databaseId, row, field, variant }: CellProps) {
  const [, start] = useTransition();
  const persisted = cellString(row, field);
  return (
    <input
      key={`${row.updatedAt}:${field.id}`}
      type="text"
      inputMode="decimal"
      defaultValue={persisted}
      placeholder={variant === "panel" ? "Empty" : ""}
      onBlur={(e) => {
        if (e.currentTarget.value !== persisted)
          start(() => void saveCell(databaseId, row, field, e.currentTarget.value));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`${variant === "cell" ? cellInputClass : ""} tabular-nums`}
    />
  );
}

function DateCell({ databaseId, row, field, variant }: CellProps) {
  const [, start] = useTransition();
  // Bumped to remount after an abandoned partial entry (value stays "" but
  // Chrome keeps ghost segment text in the control).
  const [resetKey, setResetKey] = useState(0);
  const persisted = cellString(row, field);
  return (
    <input
      key={`${row.updatedAt}:${field.id}:${resetKey}`}
      type="date"
      defaultValue={persisted}
      // .cell-date + [data-empty] keep empty cells visually quiet: the
      // dd/mm/yyyy hint and picker icon only appear on row hover or focus.
      data-empty={persisted ? undefined : ""}
      onChange={(e) => {
        // Track emptiness only — saving here would remount the input via the
        // updatedAt key mid-edit, eating keystrokes and persisting partial
        // dates. The save happens on blur, like the text/number cells.
        const el = e.currentTarget;
        if (el.value) el.removeAttribute("data-empty");
        else el.setAttribute("data-empty", "");
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        if (el.value !== persisted)
          start(() => void saveCell(databaseId, row, field, el.value));
        else if (!el.value) setResetKey((k) => k + 1);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={variant === "cell" ? `${cellInputClass} cell-date` : ""}
    />
  );
}

function CheckboxCell({ databaseId, row, field, variant }: CellProps) {
  const [, start] = useTransition();
  const checked = row.properties[field.id] === true;
  return (
    <div
      className={
        variant === "cell" ? "flex items-center h-full px-2.5 py-1" : ""
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) =>
          start(() =>
            void saveCell(
              databaseId,
              row,
              field,
              e.target.checked ? "true" : "false",
            ),
          )
        }
        className="!w-4 !h-4 !p-0 accent-[var(--accent)] cursor-pointer"
        style={{ width: 16, height: 16 }}
      />
    </div>
  );
}

function renderCell(props: CellProps) {
  switch (props.field.type) {
    case "number":
      return <NumberCell {...props} />;
    case "date":
      return <DateCell {...props} />;
    case "checkbox":
      return <CheckboxCell {...props} />;
    case "single_select":
    case "multi_select":
      return <SelectCell {...props} />;
    case "relation":
      return <RelationCell {...props} />;
    case "image":
    case "file":
      return <ImageCell {...props} />;
    case "text":
    default:
      return <TextCell {...props} />;
  }
}

export default function CellEditor(props: CellProps) {
  const rt = useRealtime();
  // Report which row this user is editing (focus bubbles through display:contents).
  return (
    <div
      style={{ display: "contents" }}
      onFocus={() => rt?.reportEditing(props.row.id, props.field.id)}
      onBlur={() => rt?.reportEditing(null, null)}
    >
      {renderCell(props)}
    </div>
  );
}
