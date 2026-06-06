"use client";

import { useTransition } from "react";
import { Menu } from "@/components/Menu";
import type { Field, FilterRule, View } from "@/lib/types";
import { setViewConfig } from "./util";

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block px-1.5 py-1">
      <span className="block text-[11px] font-medium text-ink-faint mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function ViewControls({
  databaseId,
  view,
  fields,
}: {
  databaseId: string;
  view: View;
  fields: Field[];
}) {
  const [, start] = useTransition();
  const set = (patch: Parameters<typeof setViewConfig>[2]) =>
    start(() => void setViewConfig(databaseId, view.id, patch));

  const dateFields = fields.filter((f) => f.type === "date");
  const selectFields = fields.filter((f) => f.type === "single_select");
  const imageFields = fields.filter((f) => f.type === "image");
  const cfg = view.config;

  if (view.type === "kanban") {
    return (
      <Menu width={220} button={<button className="btn btn-subtle btn-sm">⚙ Group</button>}>
        <Labeled label="Group by (single-select)">
          <select
            value={cfg.groupByFieldId ?? ""}
            onChange={(e) => set({ groupByFieldId: e.target.value })}
          >
            <option value="">Choose field…</option>
            {selectFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Labeled>
        {selectFields.length === 0 ? (
          <p className="text-xs text-ink-faint px-2 pb-2">
            Add a single-select field to group cards into columns.
          </p>
        ) : null}
      </Menu>
    );
  }

  if (view.type === "calendar") {
    return (
      <Menu width={220} button={<button className="btn btn-subtle btn-sm">⚙ Date</button>}>
        <Labeled label="Date field">
          <select
            value={cfg.dateFieldId ?? ""}
            onChange={(e) => set({ dateFieldId: e.target.value })}
          >
            <option value="">Choose field…</option>
            {dateFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Labeled>
        {dateFields.length === 0 ? (
          <p className="text-xs text-ink-faint px-2 pb-2">Add a date field first.</p>
        ) : null}
      </Menu>
    );
  }

  if (view.type === "timeline") {
    return (
      <Menu width={220} button={<button className="btn btn-subtle btn-sm">⚙ Dates</button>}>
        <Labeled label="Start date">
          <select
            value={cfg.startFieldId ?? ""}
            onChange={(e) => set({ startFieldId: e.target.value })}
          >
            <option value="">Choose field…</option>
            {dateFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="End date">
          <select
            value={cfg.endFieldId ?? ""}
            onChange={(e) => set({ endFieldId: e.target.value })}
          >
            <option value="">Choose field…</option>
            {dateFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Labeled>
        {dateFields.length === 0 ? (
          <p className="text-xs text-ink-faint px-2 pb-2">Add date fields first.</p>
        ) : null}
      </Menu>
    );
  }

  if (view.type === "gallery") {
    return (
      <Menu width={220} button={<button className="btn btn-subtle btn-sm">⚙ Cover</button>}>
        <Labeled label="Cover image">
          <select
            value={cfg.coverSource ?? "row_cover"}
            onChange={(e) => set({ coverSource: e.target.value })}
          >
            <option value="row_cover">Row cover</option>
            {imageFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Labeled>
      </Menu>
    );
  }

  // table: sort + filter
  return <TableControls databaseId={databaseId} view={view} fields={fields} />;
}

function TableControls({
  databaseId,
  view,
  fields,
}: {
  databaseId: string;
  view: View;
  fields: Field[];
}) {
  const [, start] = useTransition();
  const set = (patch: Parameters<typeof setViewConfig>[2]) =>
    start(() => void setViewConfig(databaseId, view.id, patch));

  const sortable = fields.filter((f) => f.type !== "image" && f.type !== "file");
  const sort = view.config.sort?.[0];
  const filters = view.config.filters ?? [];

  const updateFilter = (i: number, patch: Partial<FilterRule>) => {
    const next = filters.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    set({ filters: next });
  };
  const addFilter = () => {
    if (sortable.length === 0) return;
    set({
      filters: [...filters, { fieldId: sortable[0].id, op: "contains", value: "" }],
    });
  };
  const removeFilter = (i: number) =>
    set({ filters: filters.filter((_, idx) => idx !== i) });

  return (
    <div className="flex items-center gap-0.5">
      <Menu width={240} button={<button className="btn btn-subtle btn-sm">⇅ Sort</button>}>
        <div className="p-1.5 flex flex-col gap-1.5">
          <select
            value={sort?.fieldId ?? ""}
            onChange={(e) =>
              set({
                sort: e.target.value
                  ? [{ fieldId: e.target.value, dir: sort?.dir ?? "asc" }]
                  : [],
              })
            }
          >
            <option value="">No sort</option>
            {sortable.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {sort ? (
            <div className="flex gap-1">
              {(["asc", "desc"] as const).map((d) => (
                <button
                  key={d}
                  className="btn btn-ghost btn-sm flex-1"
                  style={
                    sort.dir === d
                      ? { borderColor: "var(--accent)", color: "var(--accent-2)" }
                      : undefined
                  }
                  onClick={() => set({ sort: [{ fieldId: sort.fieldId, dir: d }] })}
                >
                  {d === "asc" ? "Ascending" : "Descending"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Menu>

      <Menu width={300} button={<button className="btn btn-subtle btn-sm">⛃ Filter{filters.length ? ` (${filters.length})` : ""}</button>}>
        <div className="p-1.5 flex flex-col gap-1.5">
          {filters.map((r, i) => (
            <div key={i} className="flex flex-col gap-1 border-b border-line pb-1.5">
              <div className="flex gap-1">
                <select
                  value={r.fieldId}
                  onChange={(e) => updateFilter(i, { fieldId: e.target.value })}
                  className="!text-xs"
                >
                  {sortable.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={r.op}
                  onChange={(e) =>
                    updateFilter(i, { op: e.target.value as FilterRule["op"] })
                  }
                  className="!text-xs"
                >
                  <option value="contains">contains</option>
                  <option value="not_contains">excludes</option>
                  <option value="is">is</option>
                  <option value="is_not">is not</option>
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="is_empty">is empty</option>
                  <option value="is_not_empty">not empty</option>
                </select>
                <button
                  className="icon-btn"
                  style={{ width: 24, height: 24 }}
                  onClick={() => removeFilter(i)}
                  aria-label="Remove filter"
                >
                  ✕
                </button>
              </div>
              {r.op !== "is_empty" && r.op !== "is_not_empty" ? (
                <input
                  defaultValue={r.value ?? ""}
                  placeholder="Value"
                  className="!text-xs"
                  onBlur={(e) => updateFilter(i, { value: e.target.value })}
                />
              ) : null}
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={addFilter}>
            + Add filter
          </button>
        </div>
      </Menu>
    </div>
  );
}
