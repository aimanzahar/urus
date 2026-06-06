import { updateCellAction } from "@/lib/actions";
import { OPTION_COLORS, type Field, type OptionColor, type Row } from "@/lib/types";

export interface CellProps {
  databaseId: string;
  row: Row;
  field: Field;
  /** "cell" = compact (table grid), "panel" = full-width (row drawer). */
  variant: "cell" | "panel";
}

/** Tailwind/CSS class for an option color chip; falls back to gray. */
export function optClass(color: string): string {
  return `opt-${(OPTION_COLORS as readonly string[]).includes(color) ? color : "gray"}`;
}

export const ALL_OPTION_COLORS: readonly OptionColor[] = OPTION_COLORS;

/** Persist a single cell value (string form; multi_select expects JSON). */
export function saveCell(
  databaseId: string,
  row: Row,
  field: Field,
  value: string,
): Promise<void> {
  const fd = new FormData();
  fd.set("rowId", row.id);
  fd.set("fieldId", field.id);
  fd.set("databaseId", databaseId);
  fd.set("type", field.type);
  fd.set("value", value);
  return updateCellAction(fd);
}

export function cellString(row: Row, field: Field): string {
  const v = row.properties[field.id];
  if (v === null || v === undefined) return "";
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}
