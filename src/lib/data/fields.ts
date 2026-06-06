import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";
import { deleteUpload } from "../uploads";
import type {
  CellValue,
  Field,
  FieldConfig,
  FieldType,
  SelectOption,
} from "../types";
import {
  mapField,
  mapOption,
  nextPosition,
  nowIso,
  parseProperties,
  writeCell,
  type RowRow,
} from "./mappers";

const isSelect = (t: FieldType): boolean =>
  t === "single_select" || t === "multi_select";

// --- fields ----------------------------------------------------------------

export function listFields(databaseId: string): Field[] {
  const db = getDb();
  const fieldRows = db
    .prepare(
      `SELECT * FROM fields WHERE database_id = ? ORDER BY position ASC, created_at ASC`,
    )
    .all(databaseId);
  const optionRows = db
    .prepare(
      `SELECT so.* FROM select_options so
       JOIN fields f ON f.id = so.field_id
       WHERE f.database_id = ?
       ORDER BY so.position ASC, so.created_at ASC`,
    )
    .all(databaseId) as Array<{ field_id: string }>;

  const byField = new Map<string, SelectOption[]>();
  for (const r of optionRows) {
    const opt = mapOption(r as never);
    const list = byField.get(opt.fieldId) ?? [];
    list.push(opt);
    byField.set(opt.fieldId, list);
  }
  return fieldRows.map((r) =>
    mapField(r as never, byField.get((r as { id: string }).id) ?? []),
  );
}

export function getField(id: string): Field | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM fields WHERE id = ?`).get(id);
  if (!row) return null;
  const options = db
    .prepare(
      `SELECT * FROM select_options WHERE field_id = ? ORDER BY position ASC, created_at ASC`,
    )
    .all(id)
    .map((o) => mapOption(o as never));
  return mapField(row as never, options);
}

export function createField(
  databaseId: string,
  name: string,
  type: FieldType,
  config: FieldConfig = {},
): Field {
  const db = getDb();
  const id = newId("fld");
  const ts = nowIso();
  const position = nextPosition("fields", "database_id", databaseId);
  db.prepare(
    `INSERT INTO fields (id, database_id, name, type, position, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    databaseId,
    name.trim() || "Untitled",
    type,
    position,
    JSON.stringify(config),
    ts,
    ts,
  );
  return getField(id)!;
}

export function updateField(
  id: string,
  patch: { name?: string; config?: FieldConfig },
): void {
  const db = getDb();
  const existing = getField(id);
  if (!existing) return;
  const name =
    patch.name !== undefined ? patch.name.trim() || "Untitled" : existing.name;
  const config = patch.config !== undefined ? patch.config : existing.config;
  db.prepare(
    `UPDATE fields SET name = ?, config = ?, updated_at = ? WHERE id = ?`,
  ).run(name, JSON.stringify(config), nowIso(), id);
}

/**
 * Best-effort value conversion when a field's type changes. Returns the new
 * cell value, or null to drop the cell. Select<->select reshaping and
 * relation transitions are handled by retypeField, not here.
 */
export function coerceCellOnTypeChange(
  oldType: FieldType,
  newType: FieldType,
  value: CellValue,
  labelOf: (optionId: string) => string,
): CellValue {
  if (value === null || value === undefined) return null;

  if (newType === "text") {
    if (oldType === "single_select" && typeof value === "string")
      return labelOf(value) || null;
    if (oldType === "multi_select" && Array.isArray(value))
      return value.map(labelOf).filter(Boolean).join(", ") || null;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    return null;
  }
  if (newType === "number") {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const n = Number.parseFloat(value.replace(/[, ]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    if (typeof value === "boolean") return value ? 1 : 0;
    return null;
  }
  if (newType === "checkbox") {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string")
      return ["true", "yes", "1", "done", "x", "checked"].includes(
        value.trim().toLowerCase(),
      );
    return null;
  }
  if (newType === "date") {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
      return value;
    return null;
  }
  // select / image / file / relation targets: nothing safe to map → drop.
  return null;
}

/**
 * Change a field's type, migrating every cell. Handles: leaving image/file
 * (delete orphaned files), relation transitions (clear join rows / JSON),
 * select<->select reshaping, and dropping options when leaving select types.
 */
export async function retypeField(
  fieldId: string,
  newType: FieldType,
): Promise<void> {
  const db = getDb();
  const field = getField(fieldId);
  if (!field || field.type === newType) return;
  const oldType = field.type;
  const labelOf = (optId: string) =>
    field.options.find((o) => o.id === optId)?.label ?? "";

  const rows = db
    .prepare(`SELECT id, properties FROM rows WHERE database_id = ?`)
    .all(field.databaseId) as Pick<RowRow, "id" | "properties">[];

  const filesToDelete: string[] = [];
  const leavingSelect = isSelect(oldType) && !isSelect(newType);
  const selectToSelect = isSelect(oldType) && isSelect(newType);

  const run = db.transaction(() => {
    db.prepare(
      `UPDATE fields SET type = ?, config = NULL, updated_at = ? WHERE id = ?`,
    ).run(newType, nowIso(), fieldId);

    if (oldType === "relation") {
      db.prepare(`DELETE FROM row_relations WHERE field_id = ?`).run(fieldId);
    }

    if (newType === "relation") {
      // Relations live in the join table; ensure no stale JSON cell remains.
      for (const r of rows) writeCell(r.id, fieldId, null);
    } else if (selectToSelect) {
      for (const r of rows) {
        const v = parseProperties(r.properties)[fieldId];
        let nv: CellValue = null;
        if (newType === "multi_select") {
          nv = v == null ? null : Array.isArray(v) ? v : [String(v)];
        } else {
          nv = Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
        }
        writeCell(r.id, fieldId, nv);
      }
    } else if (oldType !== "relation") {
      for (const r of rows) {
        const v = parseProperties(r.properties)[fieldId] ?? null;
        if ((oldType === "image" || oldType === "file") && typeof v === "string" && v)
          filesToDelete.push(v);
        writeCell(r.id, fieldId, coerceCellOnTypeChange(oldType, newType, v, labelOf));
      }
    }

    if (leavingSelect) {
      db.prepare(`DELETE FROM select_options WHERE field_id = ?`).run(fieldId);
    }
  });
  run();

  for (const p of filesToDelete) await deleteUpload(p);
}

/**
 * Delete a field. CASCADE removes its options and relation links. For
 * image/file fields we must also remove the orphaned files on disk — FK
 * CASCADE never touches the filesystem (explicit carve-out from the
 * "field delete is metadata-only" rule).
 */
export async function deleteField(fieldId: string): Promise<void> {
  const db = getDb();
  const field = getField(fieldId);
  if (!field) return;

  if (field.type === "image" || field.type === "file") {
    const rows = db
      .prepare(`SELECT properties FROM rows WHERE database_id = ?`)
      .all(field.databaseId) as Pick<RowRow, "properties">[];
    for (const r of rows) {
      const v = parseProperties(r.properties)[fieldId];
      if (typeof v === "string" && v) await deleteUpload(v);
    }
  }

  db.prepare(`DELETE FROM fields WHERE id = ?`).run(fieldId);
}

// --- select options --------------------------------------------------------

export function getOption(id: string): SelectOption | null {
  const row = getDb()
    .prepare(`SELECT * FROM select_options WHERE id = ?`)
    .get(id);
  return row ? mapOption(row as never) : null;
}

export function addOption(
  fieldId: string,
  label: string,
  color = "gray",
): SelectOption {
  const db = getDb();
  const id = newId("opt");
  const position = nextPosition("select_options", "field_id", fieldId);
  db.prepare(
    `INSERT INTO select_options (id, field_id, label, color, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, fieldId, label.trim() || "Option", color, position, nowIso());
  return getOption(id)!;
}

export function updateOption(
  id: string,
  patch: { label?: string; color?: string },
): void {
  const db = getDb();
  const existing = getOption(id);
  if (!existing) return;
  const label =
    patch.label !== undefined ? patch.label.trim() || "Option" : existing.label;
  const color = patch.color !== undefined ? patch.color : existing.color;
  db.prepare(`UPDATE select_options SET label = ?, color = ? WHERE id = ?`).run(
    label,
    color,
    id,
  );
}

/**
 * Delete a select option AND strip its id from every cell that references it,
 * in one transaction — so no cell is ever left pointing at a missing option.
 */
export function deleteOption(optionId: string): void {
  const db = getDb();
  const opt = getOption(optionId);
  if (!opt) return;
  const field = getField(opt.fieldId);
  if (!field) return;

  const rows = db
    .prepare(`SELECT id, properties FROM rows WHERE database_id = ?`)
    .all(field.databaseId) as Pick<RowRow, "id" | "properties">[];

  const run = db.transaction(() => {
    for (const r of rows) {
      const v = parseProperties(r.properties)[opt.fieldId];
      if (field.type === "single_select" && v === optionId) {
        writeCell(r.id, opt.fieldId, null);
      } else if (
        field.type === "multi_select" &&
        Array.isArray(v) &&
        v.includes(optionId)
      ) {
        writeCell(
          r.id,
          opt.fieldId,
          v.filter((x) => x !== optionId),
        );
      }
    }
    db.prepare(`DELETE FROM select_options WHERE id = ?`).run(optionId);
  });
  run();
}
