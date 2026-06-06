"use client";

import { optClass } from "@/components/cells/shared";
import type { Field, Row } from "@/lib/types";
import { isYMD, shortDate } from "./shared";

/** Compact, read-only summary chips for a row's fields (cards & calendar). */
export function FieldBadges({
  row,
  fields,
  skip = [],
}: {
  row: Row;
  fields: Field[];
  skip?: string[];
}) {
  const items: React.ReactNode[] = [];

  for (const f of fields) {
    if (skip.includes(f.id)) continue;
    const v = row.properties[f.id];

    if (f.type === "single_select") {
      const o = f.options.find((opt) => opt.id === v);
      if (o)
        items.push(
          <span key={f.id} className={`chip ${optClass(o.color)}`}>
            <span className={`opt-dot ${optClass(o.color)}`} />
            {o.label}
          </span>,
        );
    } else if (f.type === "multi_select") {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      for (const id of arr) {
        const o = f.options.find((opt) => opt.id === id);
        if (o)
          items.push(
            <span key={`${f.id}:${id}`} className={`chip ${optClass(o.color)}`}>
              {o.label}
            </span>,
          );
      }
    } else if (f.type === "date") {
      if (isYMD(v))
        items.push(
          <span key={f.id} className="chip opt-gray">
            ▦ {shortDate(v)}
          </span>,
        );
    } else if (f.type === "checkbox") {
      if (v === true)
        items.push(
          <span key={f.id} className="chip opt-green">
            ☑ {f.name}
          </span>,
        );
    } else if (f.type === "number") {
      if (typeof v === "number")
        items.push(
          <span key={f.id} className="text-xs text-ink-soft tabular-nums">
            {f.name}: {v}
          </span>,
        );
    } else if (f.type === "relation") {
      const c = row.relations[f.id]?.length ?? 0;
      if (c > 0)
        items.push(
          <span key={f.id} className="chip opt-blue">
            ↗ {c}
          </span>,
        );
    }
  }

  if (items.length === 0) return null;
  return <div className="flex flex-wrap gap-1 items-center">{items}</div>;
}
