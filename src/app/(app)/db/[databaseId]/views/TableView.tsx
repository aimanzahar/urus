"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTransition } from "react";
import CellEditor from "@/components/cells/CellEditor";
import { ContextMenu } from "@/components/ContextMenu";
import { MenuItem } from "@/components/Menu";
import {
  createFieldAction,
  createRowAction,
  deleteFieldAction,
  moveRowAction,
} from "@/lib/actions";
import type { Field, Row, View } from "@/lib/types";
import FieldHeaderMenu from "./FieldHeaderMenu";
import { RowMenuItems } from "./rowMenu";
import { setViewConfig } from "../chrome/util";
import type { ViewProps } from "./shared";

function ColumnMenuItems({
  databaseId,
  view,
  field,
}: {
  databaseId: string;
  view: View;
  field: Field;
}) {
  const set = (patch: Parameters<typeof setViewConfig>[2]) =>
    void setViewConfig(databaseId, view.id, patch);
  const insertField = () => {
    const fd = new FormData();
    fd.set("databaseId", databaseId);
    fd.set("name", "Field");
    fd.set("type", "text");
    void createFieldAction(fd);
  };
  const deleteField = () => {
    if (!confirm(`Delete field “${field.name}”?`)) return;
    const fd = new FormData();
    fd.set("fieldId", field.id);
    fd.set("databaseId", databaseId);
    void deleteFieldAction(fd);
  };
  return (
    <>
      <MenuItem onClick={() => set({ sort: [{ fieldId: field.id, dir: "asc" }] })}>
        ↑ Sort ascending
      </MenuItem>
      <MenuItem onClick={() => set({ sort: [{ fieldId: field.id, dir: "desc" }] })}>
        ↓ Sort descending
      </MenuItem>
      {view.config.sort?.length ? (
        <MenuItem onClick={() => set({ sort: [] })}>Clear sort</MenuItem>
      ) : null}
      <div className="hairline my-1" />
      <MenuItem onClick={insertField}>＋ Insert field</MenuItem>
      <MenuItem danger onClick={deleteField}>
        🗑 Delete field
      </MenuItem>
    </>
  );
}

function Cells({
  databaseId,
  fields,
  row,
}: {
  databaseId: string;
  fields: Field[];
  row: Row;
}) {
  return (
    <>
      {fields.map((f) => (
        <div
          key={f.id}
          className="border-l border-line first:border-l-0 flex items-stretch min-h-[34px]"
        >
          <CellEditor databaseId={databaseId} row={row} field={f} variant="cell" />
        </div>
      ))}
    </>
  );
}

function SortableRow({
  databaseId,
  fields,
  row,
  cols,
  onOpenRow,
  draggable,
}: {
  databaseId: string;
  fields: Field[];
  row: Row;
  cols: string;
  onOpenRow: (id: string) => void;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id, disabled: !draggable });

  return (
    <div
      ref={setNodeRef}
      style={{
        gridTemplateColumns: cols,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`grid border-b border-line hover:bg-surface-2 group ${
        isDragging ? "drag-ghost relative z-10 bg-surface" : ""
      }`}
    >
      <div className="flex items-center justify-center gap-0.5 text-ink-faint">
        {draggable ? (
          <button
            className="icon-btn opacity-0 group-hover:opacity-100 cursor-grab"
            style={{ width: 18, height: 22 }}
            aria-label="Drag row"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        ) : null}
        <button
          className="icon-btn opacity-0 group-hover:opacity-100"
          style={{ width: 18, height: 22 }}
          aria-label="Open row"
          onClick={() => onOpenRow(row.id)}
        >
          ⤢
        </button>
      </div>
      <Cells databaseId={databaseId} fields={fields} row={row} />
    </div>
  );
}

export default function TableView({
  databaseId,
  fields,
  rows,
  onOpenRow,
  view,
}: ViewProps & { view: View }) {
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const cols = `36px ${fields.map(() => "minmax(180px,1fr)").join(" ")}`;
  const sortActive = (view.config.sort?.length ?? 0) > 0;
  const draggable = !sortActive;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = rows.map((r) => r.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const order = arrayMove(ids, from, to);
    const idx = order.indexOf(String(active.id));
    const fd = new FormData();
    fd.set("rowId", String(active.id));
    fd.set("databaseId", databaseId);
    fd.set("prevId", order[idx - 1] ?? "");
    fd.set("nextId", order[idx + 1] ?? "");
    start(() => void moveRowAction(fd));
  };

  const addRow = () => {
    const fd = new FormData();
    fd.set("databaseId", databaseId);
    start(() => void createRowAction(fd));
  };

  const body = (
    <>
      {rows.map((row) => (
        <ContextMenu
          key={row.id}
          menu={
            <RowMenuItems
              databaseId={databaseId}
              rowId={row.id}
              onOpenRow={onOpenRow}
            />
          }
        >
          <SortableRow
            databaseId={databaseId}
            fields={fields}
            row={row}
            cols={cols}
            onOpenRow={onOpenRow}
            draggable={draggable}
          />
        </ContextMenu>
      ))}
    </>
  );

  return (
    <div className="min-w-full inline-block align-top text-sm">
      <div
        className="grid sticky top-0 z-20 bg-surface border-b border-line-strong"
        style={{ gridTemplateColumns: cols }}
      >
        <div />
        {fields.map((f) => (
          <ContextMenu
            key={f.id}
            menu={<ColumnMenuItems databaseId={databaseId} view={view} field={f} />}
          >
            <div className="border-l border-line first:border-l-0">
              <FieldHeaderMenu databaseId={databaseId} field={f} />
            </div>
          </ContextMenu>
        ))}
      </div>

      {sortActive ? (
        body
      ) : (
        <DndContext
          id="table-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={rows.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            {body}
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={addRow}
        className="grid w-full text-left hover:bg-surface-2 text-ink-faint"
        style={{ gridTemplateColumns: cols }}
      >
        <span className="flex items-center justify-center">+</span>
        <span className="px-2 py-2 text-[13px]">New row</span>
      </button>

      {rows.length === 0 ? (
        <p className="text-xs text-ink-faint px-3 py-3">
          No rows yet. Click “New row” to add one.
        </p>
      ) : null}
    </div>
  );
}
