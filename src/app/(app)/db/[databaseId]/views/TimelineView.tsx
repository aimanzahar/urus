"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { useTransition } from "react";
import { ContextMenu } from "@/components/ContextMenu";
import { updateCellAction } from "@/lib/actions";
import type { Field, Row, View } from "@/lib/types";
import { RowMenuItems } from "./rowMenu";
import {
  clientRowTitle,
  isYMD,
  ordinalToYMD,
  shortDate,
  ymdToOrdinal,
  type ViewProps,
} from "./shared";

const PX_PER_DAY = 30;
const LANE_H = 38;

interface Span {
  row: Row;
  startO: number;
  endO: number;
}

function Bar({
  span,
  minO,
  fields,
  databaseId,
  onOpenRow,
}: {
  span: Span;
  minO: number;
  fields: Field[];
  databaseId: string;
  onOpenRow: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: span.row.id });
  const left = (span.startO - minO) * PX_PER_DAY;
  const width = Math.max(1, span.endO - span.startO + 1) * PX_PER_DAY;
  return (
    <ContextMenu
      menu={
        <RowMenuItems
          databaseId={databaseId}
          rowId={span.row.id}
          onOpenRow={onOpenRow}
        />
      }
    >
      <div
        ref={setNodeRef}
        className={`absolute top-1.5 h-[26px] rounded-md bg-accent text-white text-[12px] px-2 flex items-center cursor-grab overflow-hidden ${
          isDragging ? "opacity-80 shadow-md z-20" : ""
        }`}
        style={{
          left,
          width,
          transform: transform ? `translateX(${transform.x}px)` : undefined,
        }}
        onClick={() => onOpenRow(span.row.id)}
        {...listeners}
        {...attributes}
      >
        <span className="truncate">{clientRowTitle(span.row, fields)}</span>
      </div>
    </ContextMenu>
  );
}

export default function TimelineView({
  databaseId,
  fields,
  rows,
  onOpenRow,
  view,
}: ViewProps & { view: View }) {
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const startField = fields.find(
    (f) => f.id === view.config.startFieldId && f.type === "date",
  );
  const endField = fields.find(
    (f) => f.id === view.config.endFieldId && f.type === "date",
  );

  if (!startField && !endField) {
    return (
      <div className="p-8 text-center text-sm text-ink-soft">
        Choose a start and/or end date field (the ⚙ Dates button above).
      </div>
    );
  }

  const spans: Span[] = [];
  const backlog: Row[] = [];
  for (const row of rows) {
    const sv = startField ? row.properties[startField.id] : null;
    const ev = endField ? row.properties[endField.id] : null;
    const so = isYMD(sv) ? ymdToOrdinal(sv) : null;
    const eo = isYMD(ev) ? ymdToOrdinal(ev) : null;
    if (so === null && eo === null) {
      backlog.push(row);
      continue;
    }
    let a = so ?? eo!;
    let b = eo ?? so!;
    if (b < a) [a, b] = [b, a]; // end before start → render swapped
    spans.push({ row, startO: a, endO: b });
  }

  const shift = (rowId: string, deltaDays: number) => {
    if (deltaDays === 0) return;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    for (const f of [startField, endField]) {
      if (!f) continue;
      const v = row.properties[f.id];
      if (!isYMD(v)) continue;
      const ord = ymdToOrdinal(v);
      if (ord === null) continue;
      const fd = new FormData();
      fd.set("rowId", rowId);
      fd.set("fieldId", f.id);
      fd.set("databaseId", databaseId);
      fd.set("type", "date");
      fd.set("value", ordinalToYMD(ord + deltaDays));
      start(() => void updateCellAction(fd));
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const delta = Math.round(e.delta.x / PX_PER_DAY);
    shift(String(e.active.id), delta);
  };

  if (spans.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-ink-faint mb-3">
          No rows have dates yet. Set a start or end date to see bars.
        </p>
        <BacklogRail rows={backlog} fields={fields} onOpenRow={onOpenRow} />
      </div>
    );
  }

  const minO = Math.min(...spans.map((s) => s.startO)) - 2;
  const maxO = Math.max(...spans.map((s) => s.endO)) + 2;
  const totalDays = maxO - minO + 1;
  const width = totalDays * PX_PER_DAY;

  const ticks: { o: number; label: string }[] = [];
  for (let o = minO; o <= maxO; o++) {
    // Weekly ticks (Mondays): ordinal where (o + 4) % 7 === 0 ~ Monday.
    if ((o % 7 + 7) % 7 === 0) ticks.push({ o, label: shortDate(ordinalToYMD(o)) });
  }

  return (
    <div className="flex h-full">
      <div className="w-44 shrink-0 border-r border-line overflow-y-auto">
        <div className="h-8 border-b border-line" />
        {spans.map((s) => (
          <button
            key={s.row.id}
            onClick={() => onOpenRow(s.row.id)}
            className="block w-full text-left px-3 text-[13px] truncate border-b border-line hover:bg-surface-2"
            style={{ height: LANE_H, lineHeight: `${LANE_H}px` }}
          >
            {clientRowTitle(s.row, fields)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <DndContext
          id="timeline-dnd"
          sensors={sensors}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={onDragEnd}
        >
          <div style={{ width }}>
            <div className="h-8 border-b border-line relative">
              {ticks.map((t) => (
                <div
                  key={t.o}
                  className="absolute top-0 h-full border-l border-line text-[10px] text-ink-faint pl-1"
                  style={{ left: (t.o - minO) * PX_PER_DAY }}
                >
                  {t.label}
                </div>
              ))}
            </div>
            <div className="relative">
              {ticks.map((t) => (
                <div
                  key={t.o}
                  className="absolute top-0 bottom-0 border-l border-line"
                  style={{ left: (t.o - minO) * PX_PER_DAY }}
                />
              ))}
              {spans.map((s) => (
                <div
                  key={s.row.id}
                  className="relative border-b border-line"
                  style={{ height: LANE_H }}
                >
                  <Bar
                    span={s}
                    minO={minO}
                    fields={fields}
                    databaseId={databaseId}
                    onOpenRow={onOpenRow}
                  />
                </div>
              ))}
            </div>
          </div>
        </DndContext>
        {backlog.length > 0 ? (
          <div className="p-3 border-t border-line">
            <BacklogRail rows={backlog} fields={fields} onOpenRow={onOpenRow} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BacklogRail({
  rows,
  fields,
  onOpenRow,
}: {
  rows: Row[];
  fields: Field[];
  onOpenRow: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-ink-faint mb-1.5">
        No dates ({rows.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((row) => (
          <button
            key={row.id}
            onClick={() => onOpenRow(row.id)}
            className="chip opt-gray cursor-pointer"
          >
            {clientRowTitle(row, fields)}
          </button>
        ))}
      </div>
    </div>
  );
}
