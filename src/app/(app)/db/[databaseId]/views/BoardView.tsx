"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useState, useTransition, type CSSProperties } from "react";
import CellFlash from "@/components/cells/FlashCell";
import { optClass, rowSignature } from "@/components/cells/shared";
import { ContextMenu } from "@/components/ContextMenu";
import { MenuItem } from "@/components/Menu";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { markLocalEdit } from "@/components/realtime/changeFlash";
import { useFlip } from "@/components/realtime/flip";
import { EditingBadge } from "@/components/realtime/EditingBadge";
import {
  addOptionAction,
  createRowAction,
  deleteOptionAction,
  moveCardAction,
  updateOptionAction,
} from "@/lib/actions";
import { uploadUrl } from "@/lib/url";
import type { Field, Row, View } from "@/lib/types";
import { FieldBadges } from "./Badges";
import { RowMenuItems } from "./rowMenu";
import { clientRowTitle, type ViewProps } from "./shared";

interface Column {
  key: string; // option id, or "__none__"
  label: string;
  color: string;
  cardIds: string[];
}

function CardBody({
  row,
  fields,
  skip,
}: {
  row: Row;
  fields: Field[];
  skip: string[];
}) {
  return (
    <>
      {row.coverPath ? (
        <img
          src={uploadUrl(row.coverPath)}
          alt=""
          className="w-full h-24 object-cover rounded-md mb-2"
        />
      ) : null}
      <div className="text-[13px] font-medium mb-1 leading-snug">
        {clientRowTitle(row, fields)}
      </div>
      <FieldBadges row={row} fields={fields} skip={skip} />
    </>
  );
}

function Card({
  row,
  fields,
  skip,
  onOpenRow,
}: {
  row: Row;
  fields: Field[];
  skip: string[];
  onOpenRow: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });
  const rt = useRealtime();
  const editors = rt?.editingByRow[row.id] ?? [];
  const editorColor = editors[0]?.color;
  // Glide the card to its new spot when a remote move reorders/relocates it.
  const flipRef = useFlip(row.id, isDragging);
  const setRefs = useCallback(
    (el: HTMLElement | null) => {
      setNodeRef(el);
      flipRef(el);
    },
    [setNodeRef, flipRef],
  );
  return (
    <div
      ref={setRefs}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(editorColor ? { "--editor-color": editorColor } : {}),
      } as CSSProperties}
      className={`card p-2.5 cursor-pointer hover:shadow-md relative editing-bar ${
        editors.length ? "editing-active" : ""
      } ${isDragging ? "opacity-30" : ""}`}
      onClick={() => onOpenRow(row.id)}
      {...attributes}
      {...listeners}
    >
      {editors.length > 0 ? (
        <div className="absolute right-1.5 top-1.5 z-10">
          <EditingBadge editors={editors} />
        </div>
      ) : null}
      <CardBody row={row} fields={fields} skip={skip} />
      <CellFlash flashKey={row.id} signature={rowSignature(row)} />
    </div>
  );
}

function ColumnView({
  column,
  rowsById,
  fields,
  skip,
  databaseId,
  groupFieldId,
  onOpenRow,
}: {
  column: Column;
  rowsById: Map<string, Row>;
  fields: Field[];
  skip: string[];
  databaseId: string;
  groupFieldId: string;
  onOpenRow: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.key}` });
  const [, start] = useTransition();

  const addCard = () => {
    const fd = new FormData();
    fd.set("databaseId", databaseId);
    if (column.key !== "__none__") {
      fd.set("fieldId", groupFieldId);
      fd.set("value", column.key);
    }
    start(() => void createRowAction(fd));
  };

  return (
    <div className="w-[280px] shrink-0 flex flex-col max-h-full">
      <ContextMenu
        menu={
          <ColumnMenuItems
            databaseId={databaseId}
            groupFieldId={groupFieldId}
            column={column}
            onAddCard={addCard}
          />
        }
      >
        <div className="flex items-center gap-1.5 px-1 mb-2 cursor-context-menu">
          <span className={`chip ${optClass(column.color)}`}>
            {column.key !== "__none__" ? (
              <span className={`opt-dot ${optClass(column.color)}`} />
            ) : null}
            {column.label}
          </span>
          <span className="text-xs text-ink-faint">{column.cardIds.length}</span>
        </div>
      </ContextMenu>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto rounded-lg p-1.5 flex flex-col gap-2 transition-colors ${
          isOver ? "drop-active" : "bg-surface-2"
        }`}
        style={{ minHeight: 80 }}
      >
        <SortableContext
          items={column.cardIds}
          strategy={verticalListSortingStrategy}
        >
          {column.cardIds.map((id) => {
            const row = rowsById.get(id);
            return row ? (
              <ContextMenu
                key={id}
                menu={
                  <RowMenuItems
                    databaseId={databaseId}
                    rowId={id}
                    onOpenRow={onOpenRow}
                  />
                }
              >
                <Card row={row} fields={fields} skip={skip} onOpenRow={onOpenRow} />
              </ContextMenu>
            ) : null;
          })}
        </SortableContext>
        <button
          onClick={addCard}
          className="text-[13px] text-ink-faint hover:text-ink text-left px-1.5 py-1 rounded hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
        >
          + Add card
        </button>
      </div>
    </div>
  );
}

function ColumnMenuItems({
  databaseId,
  groupFieldId,
  column,
  onAddCard,
}: {
  databaseId: string;
  groupFieldId: string;
  column: Column;
  onAddCard: () => void;
}) {
  const isNone = column.key === "__none__";
  const addColumn = () => {
    const label = window.prompt("New column name");
    if (!label?.trim()) return;
    const fd = new FormData();
    fd.set("fieldId", groupFieldId);
    fd.set("databaseId", databaseId);
    fd.set("label", label.trim());
    void addOptionAction(fd);
  };
  const renameColumn = () => {
    const label = window.prompt("Rename column", column.label);
    if (!label?.trim()) return;
    const fd = new FormData();
    fd.set("optionId", column.key);
    fd.set("databaseId", databaseId);
    fd.set("label", label.trim());
    void updateOptionAction(fd);
  };
  const deleteColumn = () => {
    if (!confirm(`Delete column “${column.label}”? Cards lose this status.`))
      return;
    const fd = new FormData();
    fd.set("optionId", column.key);
    fd.set("databaseId", databaseId);
    void deleteOptionAction(fd);
  };
  return (
    <>
      <MenuItem onClick={onAddCard}>＋ Add card</MenuItem>
      <MenuItem onClick={addColumn}>＋ Add column</MenuItem>
      {!isNone ? (
        <>
          <MenuItem onClick={renameColumn}>✎ Rename column</MenuItem>
          <MenuItem danger onClick={deleteColumn}>
            🗑 Delete column
          </MenuItem>
        </>
      ) : null}
    </>
  );
}

export default function BoardView({
  databaseId,
  fields,
  rows,
  onOpenRow,
  view,
}: ViewProps & { view: View }) {
  const [, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const groupField = fields.find(
    (f) => f.id === view.config.groupByFieldId && f.type === "single_select",
  );

  if (!groupField) {
    return (
      <div className="p-8 text-center text-sm text-ink-soft">
        Choose a single-select field to group by (the ⚙ Group button above).
      </div>
    );
  }

  const titleFieldId = fields.find((f) => f.type === "text")?.id;
  const skip = [groupField.id, ...(titleFieldId ? [titleFieldId] : [])];

  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const columns: Column[] = groupField.options.map((o) => ({
    key: o.id,
    label: o.label,
    color: o.color,
    cardIds: [],
  }));
  const noneColumn: Column = {
    key: "__none__",
    label: `No ${groupField.name}`,
    color: "gray",
    cardIds: [],
  };
  const byKey = new Map(columns.map((c) => [c.key, c]));

  for (const row of rows) {
    const v = row.properties[groupField.id];
    const col = typeof v === "string" && byKey.has(v) ? byKey.get(v)! : noneColumn;
    col.cardIds.push(row.id);
  }
  const allColumns = [...columns, noneColumn];

  const columnKeyOfCard = (cardId: string): string | null => {
    for (const c of allColumns) if (c.cardIds.includes(cardId)) return c.key;
    return null;
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const movedId = String(active.id);
    const overId = String(over.id);
    markLocalEdit(movedId); // don't flash our own card after we drop it

    const targetKey = overId.startsWith("col:")
      ? overId.slice(4)
      : columnKeyOfCard(overId);
    if (!targetKey) return;

    const targetCol = allColumns.find((c) => c.key === targetKey);
    if (!targetCol) return;

    const remaining = targetCol.cardIds.filter((id) => id !== movedId);
    let insertAt = remaining.length;
    if (!overId.startsWith("col:")) {
      const overIdx = remaining.indexOf(overId);
      if (overIdx >= 0) insertAt = overIdx;
    }
    remaining.splice(insertAt, 0, movedId);
    const idx = remaining.indexOf(movedId);

    const fd = new FormData();
    fd.set("rowId", movedId);
    fd.set("databaseId", databaseId);
    fd.set("groupFieldId", groupField.id);
    fd.set("targetValue", targetKey);
    fd.set("prevId", remaining[idx - 1] ?? "");
    fd.set("nextId", remaining[idx + 1] ?? "");
    start(() => void moveCardAction(fd));
  };

  const activeRow = activeId ? rowsById.get(activeId) : null;

  return (
    <DndContext
      id="board-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 p-4 h-full items-start overflow-x-auto">
        {allColumns.map((c) => (
          <ColumnView
            key={c.key}
            column={c}
            rowsById={rowsById}
            fields={fields}
            skip={skip}
            databaseId={databaseId}
            groupFieldId={groupField.id}
            onOpenRow={onOpenRow}
          />
        ))}
      </div>
      <DragOverlay>
        {activeRow ? (
          <div className="card p-2.5 shadow-lg cursor-grabbing">
            <CardBody row={activeRow} fields={fields} skip={skip} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
