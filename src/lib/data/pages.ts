import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";
import type { Page } from "../types";
import { mapPage, nextPositionGlobal, nowIso } from "./mappers";

export function listPages(): Page[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM pages ORDER BY position ASC, created_at ASC`)
    .all();
  return rows.map((r) => mapPage(r as never));
}

export function getPage(id: string): Page | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(id);
  return row ? mapPage(row as never) : null;
}

export function createPage(title = "Untitled"): Page {
  const db = getDb();
  const id = newId("pg");
  const ts = nowIso();
  const position = nextPositionGlobal("pages");
  db.prepare(
    `INSERT INTO pages (id, title, icon, notes, position, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, ?, ?, ?)`,
  ).run(id, title.trim() || "Untitled", position, ts, ts);
  return getPage(id)!;
}

export function updatePage(
  id: string,
  patch: { title?: string; notes?: string | null; icon?: string | null },
): void {
  const db = getDb();
  const existing = getPage(id);
  if (!existing) return;
  const title =
    patch.title !== undefined ? patch.title.trim() || "Untitled" : existing.title;
  const notes = patch.notes !== undefined ? patch.notes : existing.notes;
  const icon = patch.icon !== undefined ? patch.icon : existing.icon;
  db.prepare(
    `UPDATE pages SET title = ?, notes = ?, icon = ?, updated_at = ? WHERE id = ?`,
  ).run(title, notes, icon, nowIso(), id);
}

export function deletePage(id: string): void {
  // CASCADE removes child databases (and their fields/rows/relations).
  getDb().prepare(`DELETE FROM pages WHERE id = ?`).run(id);
}
