import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";
import type { DatabaseDef } from "../types";
import { mapDatabase, nextPosition, nowIso } from "./mappers";

export function listDatabases(): DatabaseDef[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM databases ORDER BY position ASC, created_at ASC`)
    .all();
  return rows.map((r) => mapDatabase(r as never));
}

export function listDatabasesForPage(pageId: string): DatabaseDef[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM databases WHERE page_id = ? ORDER BY position ASC, created_at ASC`,
    )
    .all(pageId);
  return rows.map((r) => mapDatabase(r as never));
}

export function getDatabase(id: string): DatabaseDef | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM databases WHERE id = ?`).get(id);
  return row ? mapDatabase(row as never) : null;
}

/**
 * Creates a database pre-seeded with a "Name" text field and a default Table
 * view, so a freshly created database is immediately usable.
 */
export function createDatabase(
  pageId: string | null,
  title = "Untitled",
): DatabaseDef {
  const db = getDb();
  const id = newId("db");
  const ts = nowIso();
  const position = pageId
    ? nextPosition("databases", "page_id", pageId)
    : 1;

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO databases (id, page_id, title, icon, position, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    ).run(id, pageId, title.trim() || "Untitled", position, ts, ts);

    db.prepare(
      `INSERT INTO fields (id, database_id, name, type, position, config, created_at, updated_at)
       VALUES (?, ?, 'Name', 'text', 0, NULL, ?, ?)`,
    ).run(newId("fld"), id, ts, ts);

    db.prepare(
      `INSERT INTO views (id, database_id, name, type, position, config, created_at, updated_at)
       VALUES (?, ?, 'Table', 'table', 0, '{}', ?, ?)`,
    ).run(newId("vw"), id, ts, ts);
  });
  run();

  return getDatabase(id)!;
}

export function updateDatabase(
  id: string,
  patch: { title?: string; icon?: string | null },
): void {
  const db = getDb();
  const existing = getDatabase(id);
  if (!existing) return;
  const title =
    patch.title !== undefined
      ? patch.title.trim() || "Untitled"
      : existing.title;
  const icon = patch.icon !== undefined ? patch.icon : existing.icon;
  db.prepare(
    `UPDATE databases SET title = ?, icon = ?, updated_at = ? WHERE id = ?`,
  ).run(title, icon, nowIso(), id);
}

export function deleteDatabase(id: string): void {
  // CASCADE removes fields, options, views, rows and relations. Image files
  // are cleaned up by callers (deleteDatabaseAction) before deletion.
  getDb().prepare(`DELETE FROM databases WHERE id = ?`).run(id);
}

export interface DatabaseStats {
  rows: number;
  fields: number;
}

export function databaseStats(id: string): DatabaseStats {
  const db = getDb();
  const rows = (
    db.prepare(`SELECT COUNT(*) AS n FROM rows WHERE database_id = ?`).get(id) as {
      n: number;
    }
  ).n;
  const fields = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM fields WHERE database_id = ?`)
      .get(id) as { n: number }
  ).n;
  return { rows, fields };
}
