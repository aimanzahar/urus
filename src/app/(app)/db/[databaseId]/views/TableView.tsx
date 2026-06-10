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
import { useTransition, type CSSProperties } from "react";
import CellEditor from "@/components/cells/CellEditor";
import CellFlash from "@/components/cells/FlashCell";
import { cellSignature } from "@/components/cells/shared";
import { ContextMenu } from "@/components/ContextMenu";
import { MenuItem } from "@/components/Menu";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { EditingBadge } from "@/components/realtime/EditingBadge";
import {
  createFieldAction,
  createRowAction,
  deleteFieldAction,
  moveRowAction,
} from "@/lib/actions";
import type { Field, FieldType, Row, View } from "@/lib/types";
import FieldHeaderMenu from "./FieldHeaderMenu";
import { RowMenuItems } from "./rowMenu";
import AddFieldMenu from "../chrome/AddFieldMenu";
import { setViewConfig } from "../chrome/util";
import type { ViewProps } from "./shared";

// Default column widths by field type — a checkbox doesn't need the same
// room as a title. A leading text field is the primary column: it flexes to
// absorb leftover width so the sheet always reaches toward the far edge.
// The trailing fixed stub hosts the "+ New field" affordance.
const FIELD_WIDTH: Record<FieldType, string> = {
  text: "240px",
  number: "150px",
  date: "165px",
  checkbox: "110px",
  single_select: "190px",
  multi_select: "230px",
  relation: "230px",
  image: "150px",
  file: "150px",
};
const GUTTER = "44px";
const PRIMARY_WIDTH = "minmax(260px, 1fr)";
const STUB_WIDTH = "112px";

function tableCols(fields: Field[]): string {
  const cols = fields.map((f, i) => {
    // ?? guards hand-edited/legacy rows: an unknown type must not produce
    // "undefined" in grid-template-columns (the whole declaration would drop).
    const w = FIELD_WIDTH[f.type] ?? "180px";
    return i === 0 && f.type === "text" ? PRIMARY_WIDTH : w;
  });
  return `${GUTTER} ${cols.join(" ")} ${STUB_WIDTH}`;
}

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

function Cell({
  databaseId,
  field,
  row,
  bordered,
}: {
  databaseId: string;
  field: Field;
  row: Row;
  bordered: boolean;
}) {
  const rt = useRealtime();
  const cellKey = `${row.id}:${field.id}`;
  // Field-level presence: ring the exact cell a remote user is in, in their color.
  const editorColor = rt?.editingByCell[cellKey]?.[0]?.color;
  return (
    <div
      className={`relative ${bordered ? "border-l border-line" : ""} flex items-stretch min-h-[36px] transition-shadow`}
      style={
        editorColor
          ? { boxShadow: `inset 0 0 0 2px ${editorColor}`, zIndex: 1 }
          : undefined
      }
    >
      <CellEditor databaseId={databaseId} row={row} field={field} variant="cell" />
      <CellFlash flashKey={cellKey} signature={cellSignature(row, field)} />
    </div>
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
      {fields.map((f, i) => (
        <Cell
          key={f.id}
          databaseId={databaseId}
          field={f}
          row={row}
          bordered={i > 0}
        />
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
  const rt = useRealtime();
  const editors = rt?.editingByRow[row.id] ?? [];
  const editorColor = editors[0]?.color;

  return (
    <div
      ref={setNodeRef}
      style={{
        gridTemplateColumns: cols,
        transform: CSS.Transform.toString(transform),
        transition,
        ...(editorColor ? { "--editor-color": editorColor } : {}),
      } as CSSProperties}
      className={`tbl-row grid bg-surface border-b border-line hover:bg-surface-2 group relative editing-bar ${
        editors.length ? "editing-active" : ""
      } ${isDragging ? "drag-ghost z-10" : ""}`}
    >
      {editors.length > 0 ? (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10">
          <EditingBadge editors={editors} />
        </div>
      ) : null}
      <div className="flex items-center justify-center gap-px text-ink-faint">
        {draggable ? (
          <button
            className="icon-btn opacity-0 group-hover:opacity-100 cursor-grab"
            style={{ width: 18, height: 24 }}
            aria-label="Drag row"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        ) : null}
        <button
          className="icon-btn opacity-0 group-hover:opacity-100"
          style={{ width: 18, height: 24 }}
          aria-label="Open row"
          onClick={() => onOpenRow(row.id)}
        >
          ⤢
        </button>
      </div>
      <Cells databaseId={databaseId} fields={fields} row={row} />
      <div className="border-l border-line" />
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
  const cols = tableCols(fields);
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
    // Inline min-width: the global `* { min-width: 0 }` reset is unlayered
    // and beats Tailwind's layered min-w-full utility.
    <div className="inline-block align-top text-sm" style={{ minWidth: "100%" }}>
      <div
        className="grid sticky top-0 z-20 bg-surface-2 border-b border-line-strong"
        style={{ gridTemplateColumns: cols }}
      >
        <div />
        {fields.map((f, i) => (
          <ContextMenu
            key={f.id}
            menu={<ColumnMenuItems databaseId={databaseId} view={view} field={f} />}
          >
            <div className={i > 0 ? "border-l border-line" : ""}>
              <FieldHeaderMenu databaseId={databaseId} field={f} />
            </div>
          </ContextMenu>
        ))}
        <div className="border-l border-line flex">
          <AddFieldMenu
            databaseId={databaseId}
            align="left"
            button={
              <button
                className="flex items-center gap-1 h-full px-2.5 text-xs text-ink-faint hover:text-ink-soft hover-wash transition-colors whitespace-nowrap cursor-pointer"
                title="Add field"
              >
                <span className="text-[11px]">＋</span> New field
              </button>
            }
          />
        </div>
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
        className="grid w-full text-left bg-surface hover:bg-surface-2 border-b border-line text-ink-faint hover:text-ink-soft transition-colors"
        style={{ gridTemplateColumns: cols }}
      >
        <span className="flex items-center justify-center text-[11px]">＋</span>
        <span className="px-2 py-2 text-xs">New row</span>
      </button>

      {rows.length === 0 ? (
        <p
          className="text-xs text-ink-faint py-3"
          style={{ paddingLeft: 52 }}
        >
          No rows yet. Click “New row” to add one.
        </p>
      ) : (
        <p
          className="text-xs text-ink-soft select-none pt-2 pb-8"
          style={{ paddingLeft: 52 }}
        >
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </p>
      )}
    </div>
  );
}
