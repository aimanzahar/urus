import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";
import type { View, ViewConfig, ViewType } from "../types";
import { mapView, nextPosition, nowIso } from "./mappers";

const DEFAULT_NAME: Record<ViewType, string> = {
  table: "Table",
  kanban: "Board",
  calendar: "Calendar",
  timeline: "Timeline",
  gallery: "Gallery",
};

export function listViews(databaseId: string): View[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM views WHERE database_id = ? ORDER BY position ASC, created_at ASC`,
    )
    .all(databaseId);
  return rows.map((r) => mapView(r as never));
}

export function getView(id: string): View | null {
  const row = getDb().prepare(`SELECT * FROM views WHERE id = ?`).get(id);
  return row ? mapView(row as never) : null;
}

export function createView(
  databaseId: string,
  type: ViewType,
  name?: string,
  config: ViewConfig = {},
): View {
  const db = getDb();
  const id = newId("vw");
  const ts = nowIso();
  const position = nextPosition("views", "database_id", databaseId);
  db.prepare(
    `INSERT INTO views (id, database_id, name, type, position, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    databaseId,
    (name?.trim() || DEFAULT_NAME[type]),
    type,
    position,
    JSON.stringify(config),
    ts,
    ts,
  );
  return getView(id)!;
}

export function renameView(id: string, name: string): void {
  const existing = getView(id);
  if (!existing) return;
  getDb()
    .prepare(`UPDATE views SET name = ?, updated_at = ? WHERE id = ?`)
    .run(name.trim() || DEFAULT_NAME[existing.type], nowIso(), id);
}

/** Shallow-merge a partial config patch into the stored view config. */
export function updateViewConfig(id: string, patch: ViewConfig): void {
  const existing = getView(id);
  if (!existing) return;
  const merged = { ...existing.config, ...patch };
  getDb()
    .prepare(`UPDATE views SET config = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(merged), nowIso(), id);
}

export function deleteView(id: string): void {
  getDb().prepare(`DELETE FROM views WHERE id = ?`).run(id);
}
