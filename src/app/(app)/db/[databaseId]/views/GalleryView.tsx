"use client";

import CellFlash from "@/components/cells/FlashCell";
import { rowSignature } from "@/components/cells/shared";
import { ContextMenu } from "@/components/ContextMenu";
import { uploadUrl } from "@/lib/url";
import type { Row, View } from "@/lib/types";
import { FieldBadges } from "./Badges";
import { RowMenuItems } from "./rowMenu";
import { clientRowTitle, type ViewProps } from "./shared";

export default function GalleryView({
  databaseId,
  fields,
  rows,
  onOpenRow,
  view,
}: ViewProps & { view: View }) {
  const coverSource = view.config.coverSource ?? "row_cover";
  const titleFieldId = fields.find((f) => f.type === "text")?.id;
  const skip = titleFieldId ? [titleFieldId] : [];

  const coverPathFor = (row: Row): string | null => {
    if (coverSource === "row_cover") return row.coverPath;
    const v = row.properties[coverSource];
    return typeof v === "string" && v ? v : null;
  };

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-faint p-6">
        No rows yet. Add rows to see them as gallery cards.
      </p>
    );
  }

  return (
    <div
      className="p-4 grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
    >
      {rows.map((row) => {
        const cover = coverPathFor(row);
        return (
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
          <button
            onClick={() => onOpenRow(row.id)}
            className="card relative overflow-hidden text-left hover:shadow-md transition-shadow flex flex-col w-full"
          >
            <CellFlash flashKey={row.id} signature={rowSignature(row)} />
            <div className="h-36 bg-surface-2 flex items-center justify-center overflow-hidden">
              {cover ? (
                <img
                  src={uploadUrl(cover)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-ink-faint text-2xl">▢</span>
              )}
            </div>
            <div className="p-3 flex flex-col gap-1.5">
              <div className="text-[13px] font-medium leading-snug">
                {clientRowTitle(row, fields)}
              </div>
              <FieldBadges row={row} fields={fields} skip={skip} />
            </div>
          </button>
          </ContextMenu>
        );
      })}
    </div>
  );
}
