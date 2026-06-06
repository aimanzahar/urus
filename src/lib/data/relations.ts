import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";
import type { RelationLink } from "../types";
import { nowIso, parseProperties } from "./mappers";

const placeholders = (n: number): string => Array(n).fill("?").join(",");

export function addRelation(
  fieldId: string,
  fromRowId: string,
  toRowId: string,
): void {
  if (fromRowId === toRowId) return; // no self-link via the same row
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO row_relations (id, field_id, from_row_id, to_row_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(newId("rel"), fieldId, fromRowId, toRowId, nowIso());
}

export function removeRelation(
  fieldId: string,
  fromRowId: string,
  toRowId: string,
): void {
  getDb()
    .prepare(
      `DELETE FROM row_relations WHERE field_id = ? AND from_row_id = ? AND to_row_id = ?`,
    )
    .run(fieldId, fromRowId, toRowId);
}

/** The first text field of a database, used as a row's display title. */
function firstTextFieldByDatabase(
  databaseIds: string[],
): Map<string, string> {
  const out = new Map<string, string>();
  if (databaseIds.length === 0) return out;
  const rows = getDb()
    .prepare(
      `SELECT database_id, id FROM fields
       WHERE database_id IN (${placeholders(databaseIds.length)}) AND type = 'text'
       ORDER BY position ASC, created_at ASC`,
    )
    .all(...databaseIds) as { database_id: string; id: string }[];
  for (const r of rows) {
    if (!out.has(r.database_id)) out.set(r.database_id, r.id);
  }
  return out;
}

interface TitleRow {
  id: string;
  database_id: string;
  properties: string;
}

function titlesFor(rowIds: string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (rowIds.length === 0) return out;
  const rows = getDb()
    .prepare(
      `SELECT id, database_id, properties FROM rows
       WHERE id IN (${placeholders(rowIds.length)})`,
    )
    .all(...rowIds) as TitleRow[];
  const firstText = firstTextFieldByDatabase([
    ...new Set(rows.map((r) => r.database_id)),
  ]);
  for (const r of rows) {
    const fid = firstText.get(r.database_id);
    const v = fid ? parseProperties(r.properties)[fid] : null;
    out.set(r.id, typeof v === "string" && v.trim() ? v : "Untitled");
  }
  return out;
}

/**
 * Batch-load all relation links for a set of rows. Returns a nested map:
 * fieldId -> fromRowId -> RelationLink[]. One query for links + one for titles,
 * regardless of how many rows/fields — no N+1.
 */
export function loadRelations(
  relationFieldIds: string[],
  fromRowIds: string[],
): Record<string, Record<string, RelationLink[]>> {
  const result: Record<string, Record<string, RelationLink[]>> = {};
  if (relationFieldIds.length === 0 || fromRowIds.length === 0) return result;

  const links = getDb()
    .prepare(
      `SELECT field_id, from_row_id, to_row_id FROM row_relations
       WHERE field_id IN (${placeholders(relationFieldIds.length)})
         AND from_row_id IN (${placeholders(fromRowIds.length)})
       ORDER BY created_at ASC`,
    )
    .all(...relationFieldIds, ...fromRowIds) as {
    field_id: string;
    from_row_id: string;
    to_row_id: string;
  }[];

  const titles = titlesFor([...new Set(links.map((l) => l.to_row_id))]);

  for (const l of links) {
    (result[l.field_id] ??= {});
    (result[l.field_id][l.from_row_id] ??= []).push({
      rowId: l.to_row_id,
      title: titles.get(l.to_row_id) ?? "Untitled",
    });
  }
  return result;
}

/** Candidate rows to link to, for the relation picker. Title-searchable. */
export function listRowChoices(
  targetDatabaseId: string,
  query = "",
  limit = 50,
): RelationLink[] {
  const rows = getDb()
    .prepare(
      `SELECT id, database_id, properties FROM rows
       WHERE database_id = ? ORDER BY position ASC, created_at ASC`,
    )
    .all(targetDatabaseId) as TitleRow[];
  const firstText = firstTextFieldByDatabase([targetDatabaseId]);
  const fid = firstText.get(targetDatabaseId);
  const q = query.trim().toLowerCase();
  const out: RelationLink[] = [];
  for (const r of rows) {
    const v = fid ? parseProperties(r.properties)[fid] : null;
    const title = typeof v === "string" && v.trim() ? v : "Untitled";
    if (q && !title.toLowerCase().includes(q)) continue;
    out.push({ rowId: r.id, title });
    if (out.length >= limit) break;
  }
  return out;
}
