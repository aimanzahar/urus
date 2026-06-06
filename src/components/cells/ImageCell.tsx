"use client";

import { useRef, useTransition } from "react";
import {
  removeImageCellAction,
  setImageCellAction,
} from "@/lib/actions";
import { uploadUrl } from "@/lib/url";
import type { CellProps } from "./shared";

export default function ImageCell({
  databaseId,
  row,
  field,
  variant,
}: CellProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();
  const value = row.properties[field.id];
  const path = typeof value === "string" && value ? value : null;

  const remove = () => {
    const fd = new FormData();
    fd.set("rowId", row.id);
    fd.set("fieldId", field.id);
    fd.set("databaseId", databaseId);
    start(() => void removeImageCellAction(fd));
  };

  const isImage = field.type === "image";

  return (
    <div className={variant === "cell" ? "px-2 py-1" : ""}>
      <form ref={formRef} action={setImageCellAction} className="hidden">
        <input type="hidden" name="rowId" value={row.id} />
        <input type="hidden" name="fieldId" value={field.id} />
        <input type="hidden" name="databaseId" value={databaseId} />
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept="image/*"
          onChange={() => formRef.current?.requestSubmit()}
        />
      </form>

      {path ? (
        <div className="relative inline-block group">
          {isImage ? (
            <img
              src={uploadUrl(path)}
              alt=""
              className={
                variant === "cell"
                  ? "h-8 w-8 rounded object-cover cursor-pointer"
                  : "max-h-56 rounded-lg object-cover cursor-pointer"
              }
              onClick={() => fileRef.current?.click()}
            />
          ) : (
            <a
              href={uploadUrl(path)}
              target="_blank"
              rel="noreferrer"
              className="chip opt-blue"
            >
              📎 file
            </a>
          )}
          <button
            type="button"
            onClick={remove}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white text-[10px] grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn btn-ghost btn-sm"
        >
          ＋ {isImage ? "Image" : "File"}
        </button>
      )}
    </div>
  );
}
