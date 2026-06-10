import { updateCellAction } from "@/lib/actions";
import { markLocalEdit } from "@/components/realtime/changeFlash";
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
  // Suppress flashing our own edit when the change event comes back to us.
  markLocalEdit(`${row.id}:${field.id}`);
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

/** A stable string of a cell's value, used to detect remote changes for the
 *  flash highlight. Includes relation links for relation fields. */
export function cellSignature(row: Row, field: Field): string {
  const v = row.properties[field.id] ?? null;
  if (field.type === "relation") {
    const ids = (row.relations[field.id] ?? []).map((r) => r.rowId);
    return JSON.stringify(ids);
  }
  return JSON.stringify(v);
}

/** A stable string of a whole row, for card views that render many fields at
 *  once (board/gallery) and flash the card when anything on it changes. */
export function rowSignature(row: Row): string {
  const rel: Record<string, string[]> = {};
  for (const [k, links] of Object.entries(row.relations))
    rel[k] = links.map((l) => l.rowId);
  return JSON.stringify({ p: row.properties, r: rel, c: row.coverPath });
}
