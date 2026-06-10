"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Menu, useMenuClose } from "@/components/Menu";
import {
  createFieldAction,
  listDatabaseChoicesAction,
} from "@/lib/actions";
import { FIELD_TYPES, type FieldType } from "@/lib/types";
import { FIELD_TYPE_ICON, FIELD_TYPE_LABEL } from "./util";

function Form({ databaseId }: { databaseId: string }) {
  const close = useMenuClose();
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [target, setTarget] = useState("");
  const [dbs, setDbs] = useState<{ id: string; title: string }[]>([]);
  const [, start] = useTransition();

  useEffect(() => {
    if (type === "relation") listDatabaseChoicesAction().then(setDbs);
  }, [type]);

  const submit = () => {
    const fd = new FormData();
    fd.set("databaseId", databaseId);
    fd.set("name", name.trim() || FIELD_TYPE_LABEL[type]);
    fd.set("type", type);
    if (type === "relation" && target) fd.set("targetDatabaseId", target);
    start(() => void createFieldAction(fd));
    close();
  };

  return (
    <div className="p-1.5 flex flex-col gap-2">
      <input
        autoFocus
        placeholder="Field name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(type === "relation" && !target)) submit();
        }}
        className="btn-sm"
      />
      <div className="grid grid-cols-3 gap-1">
        {FIELD_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className="text-[11px] px-1 py-1.5 rounded-md border flex flex-col items-center gap-0.5 transition-colors"
            style={
              type === t
                ? { borderColor: "var(--accent)", color: "var(--accent-2)", background: "var(--accent-soft)" }
                : { borderColor: "var(--line)", color: "var(--ink-soft)" }
            }
          >
            <span>{FIELD_TYPE_ICON[t]}</span>
            <span>{FIELD_TYPE_LABEL[t]}</span>
          </button>
        ))}
      </div>
      {type === "relation" ? (
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Link to database…</option>
          {dbs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={submit}
        disabled={type === "relation" && !target}
      >
        Add field
      </button>
    </div>
  );
}

export default function AddFieldMenu({
  databaseId,
  align = "right",
  button,
}: {
  databaseId: string;
  align?: "left" | "right";
  button?: ReactNode;
}) {
  return (
    <Menu
      align={align}
      width={272}
      button={
        button ?? (
          <button className="btn btn-ghost btn-sm" title="Add field">
            + Field
          </button>
        )
      }
    >
      <Form databaseId={databaseId} />
    </Menu>
  );
}
