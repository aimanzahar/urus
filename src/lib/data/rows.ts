import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";
import { copyUpload, deleteUpload } from "../uploads";
import type { CellValue } from "../types";
import {
  nextPosition,
  nowIso,
  parseProperties,
  writeCell,
  type RowRow,
} from "./mappers";

export function createRow(
  databaseId: string,
  properties: Record<string, CellValue> = {},
): string {
  const db = getDb();
  const id = newId("row");
  const ts = nowIso();
  const position = nextPosition("rows", "database_id", databaseId);
  db.prepare(
    `INSERT INTO rows (id, database_id, properties, cover_path, position, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?)`,
  ).run(id, databaseId, JSON.stringify(properties), position, ts, ts);
  return id;
}

function getRowRaw(id: string): RowRow | null {
  const row = getDb().prepare(`SELECT * FROM rows WHERE id = ?`).get(id);
  return (row as RowRow) ?? null;
}

/** Read a single cell's current value (used by combined server actions). */
export function getRowCell(rowId: string, fieldId: string): CellValue {
  const raw = getRowRaw(rowId);
  if (!raw) return null;
  return parseProperties(raw.properties)[fieldId] ?? null;
}

/** Update a single cell (concurrency-safe single-field json_set/remove). */
export function updateCell(
  rowId: string,
  fieldId: string,
  value: CellValue,
): void {
  writeCell(rowId, fieldId, value);
}

/** Image field ids for a database — used to know which cells hold file paths. */
function imageFieldIds(databaseId: string): Set<string> {
  const rows = getDb()
    .prepare(
      `SELECT id FROM fields WHERE database_id = ? AND type IN ('image','file')`,
    )
    .all(databaseId) as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

/** Replace (or clear) a row's cover image, deleting the previous file. */
export async function setCover(
  rowId: string,
  newPath: string | null,
): Promise<void> {
  const db = getDb();
  const existing = getRowRaw(rowId);
  if (!existing) return;
  if (existing.cover_path && existing.cover_path !== newPath) {
    await deleteUpload(existing.cover_path);
  }
  db.prepare(
    `UPDATE rows SET cover_path = ?, updated_at = ? WHERE id = ?`,
  ).run(newPath, nowIso(), rowId);
}

/** Set an image/file cell, deleting the previously stored file if replaced. */
export async function setImageCell(
  rowId: string,
  fieldId: string,
  newPath: string | null,
): Promise<void> {
  const existing = getRowRaw(rowId);
  if (!existing) return;
  const prev = parseProperties(existing.properties)[fieldId];
  if (typeof prev === "string" && prev && prev !== newPath) {
    await deleteUpload(prev);
  }
  writeCell(rowId, fieldId, newPath);
}

function positionBetween(
  prevId: string | null,
  nextId: string | null,
): number {
  const db = getDb();
  const posOf = (id: string | null): number | null => {
    if (!id) return null;
    const r = db.prepare(`SELECT position FROM rows WHERE id = ?`).get(id) as
      | { position: number }
      | undefined;
    return r ? r.position : null;
  };
  const prev = posOf(prevId);
  const next = posOf(nextId);
  if (prev !== null && next !== null) return (prev + next) / 2;
  if (prev !== null) return prev + 1;
  if (next !== null) return next - 1;
  return 1;
}

/**
 * Reorder a row within a list. `prevId`/`nextId` are the ids of the rows that
 * should sit immediately before/after the moved row in the new order (either
 * may be null at a list edge). Positions are read fresh here.
 */
export function moveRow(
  rowId: string,
  prevId: string | null,
  nextId: string | null,
): void {
  const db = getDb();
  const run = db.transaction(() => {
    const pos = positionBetween(prevId, nextId);
    db.prepare(`UPDATE rows SET position = ?, updated_at = ? WHERE id = ?`).run(
      pos,
      nowIso(),
      rowId,
    );
  });
  run();
}

/**
 * Kanban move: set the grouping select cell to the target column AND reorder
 * within that column, in ONE transaction. The select cell is the sole source
 * of column membership, so this can't desync. `targetValue` is the option id,
 * or null for the "__none__" column.
 */
export function moveCard(
  rowId: string,
  groupFieldId: string,
  targetValue: string | null,
  prevId: string | null,
  nextId: string | null,
): void {
  const db = getDb();
  const run = db.transaction(() => {
    writeCell(rowId, groupFieldId, targetValue);
    const pos = positionBetween(prevId, nextId);
    db.prepare(`UPDATE rows SET position = ?, updated_at = ? WHERE id = ?`).run(
      pos,
      nowIso(),
      rowId,
    );
  });
  run();
}

/** Duplicate a row (properties, relations, and cloned image files), placing
 *  the copy immediately after the original. */
export async function duplicateRow(rowId: string): Promise<string | null> {
  const db = getDb();
  const orig = getRowRaw(rowId);
  if (!orig) return null;

  // Clone any image/file cells + cover so the copy owns its own files.
  const imgFields = imageFieldIds(orig.database_id);
  const props = parseProperties(orig.properties);
  for (const fid of imgFields) {
    const v = props[fid];
    if (typeof v === "string" && v) props[fid] = (await copyUpload(v)) ?? null;
  }
  const newCover = orig.cover_path ? await copyUpload(orig.cover_path) : null;

  const next = db
    .prepare(
      `SELECT MIN(position) AS p FROM rows WHERE database_id = ? AND position > ?`,
    )
    .get(orig.database_id, orig.position) as { p: number | null };
  const newPos = next.p != null ? (orig.position + next.p) / 2 : orig.position + 1;

  const id = newId("row");
  const ts = nowIso();
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO rows (id, database_id, properties, cover_path, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, orig.database_id, JSON.stringify(props), newCover, newPos, ts, ts);
    const links = db
      .prepare(`SELECT field_id, to_row_id FROM row_relations WHERE from_row_id = ?`)
      .all(rowId) as { field_id: string; to_row_id: string }[];
    for (const l of links) {
      db.prepare(
        `INSERT OR IGNORE INTO row_relations (id, field_id, from_row_id, to_row_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(newId("rel"), l.field_id, id, l.to_row_id, ts);
    }
  });
  run();
  return id;
}

/** Delete a row, removing its cover + any image/file cell files from disk. */
export async function deleteRow(rowId: string): Promise<void> {
  const db = getDb();
  const row = getRowRaw(rowId);
  if (!row) return;

  const filePaths: string[] = [];
  if (row.cover_path) filePaths.push(row.cover_path);
  const imgFields = imageFieldIds(row.database_id);
  if (imgFields.size > 0) {
    const props = parseProperties(row.properties);
    for (const fid of imgFields) {
      const v = props[fid];
      if (typeof v === "string" && v) filePaths.push(v);
    }
  }

  db.prepare(`DELETE FROM rows WHERE id = ?`).run(rowId); // CASCADE relations
  for (const p of filePaths) await deleteUpload(p);
}
