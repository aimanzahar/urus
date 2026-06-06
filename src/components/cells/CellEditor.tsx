"use client";

import { useTransition } from "react";
import SelectCell from "./SelectCell";
import RelationCell from "./RelationCell";
import ImageCell from "./ImageCell";
import { cellString, saveCell, type CellProps } from "./shared";

const cellInputClass =
  "!border-0 !bg-transparent !rounded-none !shadow-none focus:!shadow-none px-2 py-1 text-sm w-full";

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
  const persisted = cellString(row, field);
  return (
    <input
      type="date"
      defaultValue={persisted}
      onChange={(e) =>
        start(() => void saveCell(databaseId, row, field, e.target.value))
      }
      className={variant === "cell" ? cellInputClass : ""}
    />
  );
}

function CheckboxCell({ databaseId, row, field, variant }: CellProps) {
  const [, start] = useTransition();
  const checked = row.properties[field.id] === true;
  return (
    <div
      className={
        variant === "cell" ? "flex items-center justify-center h-full py-1" : ""
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

export default function CellEditor(props: CellProps) {
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
