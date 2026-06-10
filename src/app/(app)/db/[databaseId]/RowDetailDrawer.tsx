"use client";

import { useRef, useTransition } from "react";
import { Drawer } from "@/components/Drawer";
import CellEditor from "@/components/cells/CellEditor";
import CellFlash from "@/components/cells/FlashCell";
import { cellSignature } from "@/components/cells/shared";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import {
  deleteRowAction,
  removeCoverAction,
  setCoverAction,
} from "@/lib/actions";
import { uploadUrl } from "@/lib/url";
import type { Field, Row } from "@/lib/types";
import { clientRowTitle } from "./views/shared";
import { FIELD_TYPE_ICON } from "./chrome/util";

function CoverControl({
  databaseId,
  row,
}: {
  databaseId: string;
  row: Row;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();

  const remove = () => {
    const fd = new FormData();
    fd.set("rowId", row.id);
    fd.set("databaseId", databaseId);
    start(() => void removeCoverAction(fd));
  };

  return (
    <div className="mb-4">
      <form ref={formRef} action={setCoverAction} className="hidden">
        <input type="hidden" name="rowId" value={row.id} />
        <input type="hidden" name="databaseId" value={databaseId} />
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept="image/*"
          onChange={() => formRef.current?.requestSubmit()}
        />
      </form>
      {row.coverPath ? (
        <div className="relative group">
          <img
            src={uploadUrl(row.coverPath)}
            alt=""
            className="w-full h-40 object-cover rounded-lg"
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="btn btn-ghost btn-sm !bg-surface"
              onClick={() => fileRef.current?.click()}
            >
              Change
            </button>
            <button className="btn btn-ghost btn-sm !bg-surface" onClick={remove}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-ghost btn-sm w-full"
          onClick={() => fileRef.current?.click()}
        >
          ＋ Add cover image
        </button>
      )}
    </div>
  );
}

function Body({
  databaseId,
  fields,
  row,
  onClose,
}: {
  databaseId: string;
  fields: Field[];
  row: Row;
  onClose: () => void;
}) {
  const rt = useRealtime();
  const onDelete = () => {
    if (!confirm("Delete this row?")) return;
    const fd = new FormData();
    fd.set("rowId", row.id);
    fd.set("databaseId", databaseId);
    void deleteRowAction(fd);
    onClose();
  };

  return (
    <div>
      <CoverControl databaseId={databaseId} row={row} />
      <div className="flex flex-col gap-3">
        {fields.map((f) => {
          const cellKey = `${row.id}:${f.id}`;
          const editorColor = rt?.editingByCell[cellKey]?.[0]?.color;
          return (
            <div key={f.id} className="grid grid-cols-[120px_1fr] gap-2 items-start">
              <span className="text-[13px] text-ink-soft flex items-center gap-1.5 pt-1.5">
                <span className="text-ink-faint w-4 text-center">
                  {FIELD_TYPE_ICON[f.type]}
                </span>
                <span className="truncate">{f.name}</span>
              </span>
              <div
                className="relative min-h-[34px] flex items-center rounded-md transition-shadow"
                style={
                  editorColor
                    ? { boxShadow: `inset 0 0 0 2px ${editorColor}` }
                    : undefined
                }
              >
                <CellEditor
                  databaseId={databaseId}
                  row={row}
                  field={f}
                  variant="panel"
                />
                <CellFlash flashKey={cellKey} signature={cellSignature(row, f)} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="hairline my-4" />
      <button className="btn btn-danger btn-sm" onClick={onDelete}>
        🗑 Delete row
      </button>
    </div>
  );
}

export default function RowDetailDrawer({
  databaseId,
  fields,
  row,
  onClose,
}: {
  databaseId: string;
  fields: Field[];
  row: Row | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      title={row ? clientRowTitle(row, fields) : ""}
    >
      {row ? (
        <Body
          databaseId={databaseId}
          fields={fields}
          row={row}
          onClose={onClose}
        />
      ) : null}
    </Drawer>
  );
}
