"use client";

import { useEffect, useState, useTransition } from "react";
import { Menu, useMenuClose } from "@/components/Menu";
import {
  addOptionAction,
  deleteFieldAction,
  deleteOptionAction,
  listDatabaseChoicesAction,
  renameFieldAction,
  retypeFieldAction,
  updateFieldConfigAction,
  updateOptionAction,
} from "@/lib/actions";
import {
  ALL_OPTION_COLORS,
  optClass,
} from "@/components/cells/shared";
import { FIELD_TYPES, type Field, type FieldType } from "@/lib/types";
import { FIELD_TYPE_ICON, FIELD_TYPE_LABEL } from "../chrome/util";

function ColorDots({
  databaseId,
  optionId,
  current,
}: {
  databaseId: string;
  optionId: string;
  current: string;
}) {
  const [, start] = useTransition();
  return (
    <div className="flex gap-1 flex-wrap">
      {ALL_OPTION_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`opt-dot ${optClass(c)}`}
          style={{
            width: 16,
            height: 16,
            outline: current === c ? "2px solid var(--accent)" : "none",
            outlineOffset: 1,
          }}
          aria-label={c}
          onClick={() => {
            const fd = new FormData();
            fd.set("optionId", optionId);
            fd.set("databaseId", databaseId);
            fd.set("color", c);
            start(() => void updateOptionAction(fd));
          }}
        />
      ))}
    </div>
  );
}

function OptionsManager({
  databaseId,
  field,
}: {
  databaseId: string;
  field: Field;
}) {
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();

  const add = () => {
    if (!label.trim()) return;
    const fd = new FormData();
    fd.set("fieldId", field.id);
    fd.set("databaseId", databaseId);
    fd.set("label", label.trim());
    fd.set(
      "color",
      ALL_OPTION_COLORS[field.options.length % ALL_OPTION_COLORS.length],
    );
    start(() => void addOptionAction(fd));
    setLabel("");
  };

  return (
    <div className="px-1.5 py-1 border-t border-line mt-1">
      <p className="text-[11px] font-medium text-ink-faint mb-1">Options</p>
      <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
        {field.options.map((o) => (
          <div key={o.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className={`opt-dot ${optClass(o.color)}`} />
              <input
                defaultValue={o.label}
                className="!text-xs flex-1"
                onFocus={() => setEditing(o.id)}
                onBlur={(e) => {
                  setEditing(null);
                  if (e.target.value !== o.label) {
                    const fd = new FormData();
                    fd.set("optionId", o.id);
                    fd.set("databaseId", databaseId);
                    fd.set("label", e.target.value);
                    start(() => void updateOptionAction(fd));
                  }
                }}
              />
              <button
                className="icon-btn"
                style={{ width: 22, height: 22 }}
                aria-label="Delete option"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("optionId", o.id);
                  fd.set("databaseId", databaseId);
                  start(() => void deleteOptionAction(fd));
                }}
              >
                ✕
              </button>
            </div>
            {editing === o.id ? (
              <ColorDots databaseId={databaseId} optionId={o.id} current={o.color} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="New option"
          className="!text-xs"
        />
        <button className="btn btn-ghost btn-sm" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}

function RelationTarget({
  databaseId,
  field,
}: {
  databaseId: string;
  field: Field;
}) {
  const [dbs, setDbs] = useState<{ id: string; title: string }[]>([]);
  const [, start] = useTransition();
  useEffect(() => {
    listDatabaseChoicesAction().then(setDbs);
  }, []);
  return (
    <div className="px-1.5 py-1 border-t border-line mt-1">
      <p className="text-[11px] font-medium text-ink-faint mb-1">
        Linked database
      </p>
      <select
        value={field.config.targetDatabaseId ?? ""}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("fieldId", field.id);
          fd.set("databaseId", databaseId);
          fd.set("targetDatabaseId", e.target.value);
          start(() => void updateFieldConfigAction(fd));
        }}
        className="!text-xs"
      >
        <option value="">Choose…</option>
        {dbs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title}
          </option>
        ))}
      </select>
    </div>
  );
}

function TypeGrid({ databaseId, field }: { databaseId: string; field: Field }) {
  const [, start] = useTransition();
  const close = useMenuClose();
  const retype = (t: FieldType) => {
    if (t === field.type) return;
    if (
      !confirm(
        `Change “${field.name}” from ${FIELD_TYPE_LABEL[field.type]} to ${FIELD_TYPE_LABEL[t]}? Some values may be converted or cleared.`,
      )
    )
      return;
    const fd = new FormData();
    fd.set("fieldId", field.id);
    fd.set("databaseId", databaseId);
    fd.set("type", t);
    start(() => void retypeFieldAction(fd));
    close();
  };
  return (
    <div className="grid grid-cols-3 gap-1 px-1.5 py-1">
      {FIELD_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => retype(t)}
          className="text-[11px] px-1 py-1.5 rounded-md border flex flex-col items-center gap-0.5"
          style={
            field.type === t
              ? {
                  borderColor: "var(--accent)",
                  color: "var(--accent-2)",
                  background: "var(--accent-soft)",
                }
              : { borderColor: "var(--line)", color: "var(--ink-soft)" }
          }
        >
          <span>{FIELD_TYPE_ICON[t]}</span>
          <span>{FIELD_TYPE_LABEL[t]}</span>
        </button>
      ))}
    </div>
  );
}

export default function FieldHeaderMenu({
  databaseId,
  field,
}: {
  databaseId: string;
  field: Field;
}) {
  const [, start] = useTransition();
  const isSelect =
    field.type === "single_select" || field.type === "multi_select";

  return (
    <Menu
      width={264}
      triggerClassName="block"
      button={
        <button className="flex items-center gap-1.5 px-2.5 py-2 w-full text-left hover-wash transition-colors group">
          <span className="text-ink-faint text-[11px]">
            {FIELD_TYPE_ICON[field.type]}
          </span>
          <span className="text-xs font-medium text-ink-soft group-hover:text-ink truncate transition-colors">
            {field.name}
          </span>
          <span className="ml-auto text-ink-faint opacity-0 group-hover:opacity-100 text-[10px]">
            ▾
          </span>
        </button>
      }
    >
      <div className="p-1.5">
        <input
          defaultValue={field.name}
          className="btn-sm mb-1.5"
          aria-label="Field name"
          onBlur={(e) => {
            if (e.target.value !== field.name) {
              const fd = new FormData();
              fd.set("fieldId", field.id);
              fd.set("databaseId", databaseId);
              fd.set("name", e.target.value);
              start(() => void renameFieldAction(fd));
            }
          }}
        />
        <p className="text-[11px] font-medium text-ink-faint mb-1 px-0.5">Type</p>
      </div>
      <TypeGrid databaseId={databaseId} field={field} />
      {isSelect ? (
        <OptionsManager databaseId={databaseId} field={field} />
      ) : null}
      {field.type === "relation" ? (
        <RelationTarget databaseId={databaseId} field={field} />
      ) : null}
      <div className="px-1 pt-1 border-t border-line mt-1">
        <button
          type="button"
          className="menu-item danger"
          onClick={() => {
            if (!confirm(`Delete field “${field.name}”?`)) return;
            const fd = new FormData();
            fd.set("fieldId", field.id);
            fd.set("databaseId", databaseId);
            start(() => void deleteFieldAction(fd));
          }}
        >
          🗑 Delete field
        </button>
      </div>
    </Menu>
  );
}
