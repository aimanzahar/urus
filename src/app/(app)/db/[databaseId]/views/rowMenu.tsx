"use client";

import type { ReactNode } from "react";
import { MenuItem } from "@/components/Menu";
import { deleteRowAction, duplicateRowAction } from "@/lib/actions";

function rowFd(databaseId: string, rowId: string): FormData {
  const fd = new FormData();
  fd.set("rowId", rowId);
  fd.set("databaseId", databaseId);
  return fd;
}

/** Open / Duplicate / Delete items shared by every view's row context menu. */
export function RowMenuItems({
  databaseId,
  rowId,
  onOpenRow,
  extra,
}: {
  databaseId: string;
  rowId: string;
  onOpenRow: (id: string) => void;
  extra?: ReactNode;
}) {
  return (
    <>
      <MenuItem onClick={() => onOpenRow(rowId)}>⤢ Open</MenuItem>
      <MenuItem onClick={() => void duplicateRowAction(rowFd(databaseId, rowId))}>
        ⧉ Duplicate
      </MenuItem>
      {extra}
      <MenuItem
        danger
        onClick={() => {
          if (confirm("Delete this row?"))
            void deleteRowAction(rowFd(databaseId, rowId));
        }}
      >
        🗑 Delete
      </MenuItem>
    </>
  );
}
