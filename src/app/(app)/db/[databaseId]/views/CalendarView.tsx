"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useState, useTransition } from "react";
import { ContextMenu } from "@/components/ContextMenu";
import { MenuItem } from "@/components/Menu";
import { createRowAction, updateCellAction } from "@/lib/actions";
import type { Field, Row, View } from "@/lib/types";
import { RowMenuItems } from "./rowMenu";
import {
  clientRowTitle,
  isYMD,
  monthGrid,
  monthLabel,
  parseYMD,
  todayYMD,
  type ViewProps,
} from "./shared";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function EventChip({
  row,
  fields,
  databaseId,
  onOpenRow,
  onUnschedule,
}: {
  row: Row;
  fields: Field[];
  databaseId: string;
  onOpenRow: (id: string) => void;
  onUnschedule?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: row.id });
  return (
    <ContextMenu
      menu={
        <RowMenuItems
          databaseId={databaseId}
          rowId={row.id}
          onOpenRow={onOpenRow}
          extra={
            onUnschedule ? (
              <MenuItem onClick={() => onUnschedule(row.id)}>
                ⊘ Unschedule
              </MenuItem>
            ) : null
          }
        />
      }
    >
      <div
        ref={setNodeRef}
        style={
          transform
            ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
            : undefined
        }
        className={`text-[12px] px-1.5 py-0.5 rounded bg-accent-soft text-accent-2 truncate cursor-pointer ${
          isDragging ? "opacity-70 shadow-md" : ""
        }`}
        onClick={() => onOpenRow(row.id)}
        {...listeners}
        {...attributes}
      >
        {clientRowTitle(row, fields)}
      </div>
    </ContextMenu>
  );
}

function DayCell({
  ymd,
  inMonth,
  events,
  fields,
  databaseId,
  onOpenRow,
  onUnschedule,
  onAdd,
}: {
  ymd: string;
  inMonth: boolean;
  events: Row[];
  fields: Field[];
  databaseId: string;
  onOpenRow: (id: string) => void;
  onUnschedule: (id: string) => void;
  onAdd: (ymd: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${ymd}` });
  const day = parseYMD(ymd)?.d ?? "";
  const isToday = ymd === todayYMD();
  return (
    <ContextMenu
      menu={<MenuItem onClick={() => onAdd(ymd)}>＋ Add row here</MenuItem>}
    >
      <div
        ref={setNodeRef}
        className={`border-b border-r border-line p-1 min-h-[100px] flex flex-col gap-1 group ${
          inMonth ? "" : "bg-surface-2"
        } ${isOver ? "drop-active" : ""}`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] grid place-items-center w-5 h-5 rounded-full ${
              isToday
                ? "bg-accent text-white"
                : inMonth
                  ? "text-ink-soft"
                  : "text-ink-faint"
            }`}
          >
            {day}
          </span>
          <button
            className="icon-btn opacity-0 group-hover:opacity-100"
            style={{ width: 18, height: 18 }}
            aria-label="Add row on this day"
            onClick={() => onAdd(ymd)}
          >
            +
          </button>
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {events.map((row) => (
            <EventChip
              key={row.id}
              row={row}
              fields={fields}
              databaseId={databaseId}
              onOpenRow={onOpenRow}
              onUnschedule={onUnschedule}
            />
          ))}
        </div>
      </div>
    </ContextMenu>
  );
}

function UnscheduledTray({
  rows,
  fields,
  databaseId,
  onOpenRow,
}: {
  rows: Row[];
  fields: Field[];
  databaseId: string;
  onOpenRow: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  return (
    <div
      ref={setNodeRef}
      className={`border-t border-line p-2 ${isOver ? "drop-active" : ""}`}
    >
      <p className="text-[11px] font-medium text-ink-faint mb-1.5">
        Unscheduled ({rows.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {rows.length === 0 ? (
          <span className="text-xs text-ink-faint">
            Drag events here to unschedule them.
          </span>
        ) : (
          rows.map((row) => (
            <EventChip
              key={row.id}
              row={row}
              fields={fields}
              databaseId={databaseId}
              onOpenRow={onOpenRow}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function CalendarView({
  databaseId,
  fields,
  rows,
  onOpenRow,
  view,
}: ViewProps & { view: View }) {
  const dateField = fields.find(
    (f) => f.id === view.config.dateFieldId && f.type === "date",
  );
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const [{ y, m }, setYM] = useState(() => {
    if (!dateField) {
      const t = parseYMD(todayYMD())!;
      return { y: t.y, m: t.m };
    }
    const dated = rows
      .map((r) => r.properties[dateField.id])
      .filter(isYMD)
      .sort();
    const base = dated.length ? parseYMD(dated[0])! : parseYMD(todayYMD())!;
    return { y: base.y, m: base.m };
  });

  if (!dateField) {
    return (
      <div className="p-8 text-center text-sm text-ink-soft">
        Choose a date field to place rows on the calendar (the ⚙ Date button
        above).
      </div>
    );
  }

  const byDay = new Map<string, Row[]>();
  const unscheduled: Row[] = [];
  for (const row of rows) {
    const v = row.properties[dateField.id];
    if (isYMD(v)) {
      const list = byDay.get(v) ?? [];
      list.push(row);
      byDay.set(v, list);
    } else {
      unscheduled.push(row);
    }
  }

  const cells = monthGrid(y, m);

  const prev = () => setYM(m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 });
  const next = () => setYM(m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 });

  const setDate = (rowId: string, ymd: string) => {
    const fd = new FormData();
    fd.set("rowId", rowId);
    fd.set("fieldId", dateField.id);
    fd.set("databaseId", databaseId);
    fd.set("type", "date");
    fd.set("value", ymd);
    start(() => void updateCellAction(fd));
  };

  const addOnDay = (ymd: string) => {
    const fd = new FormData();
    fd.set("databaseId", databaseId);
    fd.set("fieldId", dateField.id);
    fd.set("value", ymd);
    start(() => void createRowAction(fd));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const rowId = String(active.id);
    const overId = String(over.id);
    if (overId === "unscheduled") setDate(rowId, "");
    else if (overId.startsWith("day:")) setDate(rowId, overId.slice(4));
  };

  return (
    <DndContext id="calendar-dnd" sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-2 shrink-0">
          <button className="icon-btn" onClick={prev} aria-label="Previous month">
            ‹
          </button>
          <span className="text-sm font-medium w-36 text-center">
            {monthLabel(y, m)}
          </span>
          <button className="icon-btn" onClick={next} aria-label="Next month">
            ›
          </button>
          <button
            className="btn btn-ghost btn-sm ml-2"
            onClick={() => {
              const t = parseYMD(todayYMD())!;
              setYM({ y: t.y, m: t.m });
            }}
          >
            Today
          </button>
        </div>

        <div className="grid grid-cols-7 border-t border-l border-line shrink-0">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-[11px] font-medium text-ink-faint px-2 py-1 border-r border-b border-line"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l border-line flex-1 overflow-y-auto">
          {cells.map((c) => (
            <DayCell
              key={c.ymd}
              ymd={c.ymd}
              inMonth={c.inMonth}
              events={byDay.get(c.ymd) ?? []}
              fields={fields}
              databaseId={databaseId}
              onOpenRow={onOpenRow}
              onUnschedule={(id) => setDate(id, "")}
              onAdd={addOnDay}
            />
          ))}
        </div>
        <UnscheduledTray
          rows={unscheduled}
          fields={fields}
          databaseId={databaseId}
          onOpenRow={onOpenRow}
        />
      </div>
    </DndContext>
  );
}
