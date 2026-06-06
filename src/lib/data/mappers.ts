import "server-only";
import type Database from "better-sqlite3";
import { getDb } from "../db";
import type {
  CellValue,
  DatabaseDef,
  Field,
  FieldConfig,
  FieldType,
  Page,
  SelectOption,
  View,
  ViewConfig,
  ViewType,
} from "../types";

export const nowIso = (): string => new Date().toISOString();

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// --- raw row shapes (as stored in sqlite) ---------------------------------

interface PageRow {
  id: string;
  title: string;
  icon: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface DatabaseRow {
  id: string;
  page_id: string | null;
  title: string;
  icon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface FieldRow {
  id: string;
  database_id: string;
  name: string;
  type: string;
  position: number;
  config: string | null;
  created_at: string;
  updated_at: string;
}

interface OptionRow {
  id: string;
  field_id: string;
  label: string;
  color: string;
  position: number;
  created_at: string;
}

interface ViewRow {
  id: string;
  database_id: string;
  name: string;
  type: string;
  position: number;
  config: string | null;
  created_at: string;
  updated_at: string;
}

export interface RowRow {
  id: string;
  database_id: string;
  properties: string;
  cover_path: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export const mapPage = (r: PageRow): Page => ({
  id: r.id,
  title: r.title,
  icon: r.icon,
  notes: r.notes,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapDatabase = (r: DatabaseRow): DatabaseDef => ({
  id: r.id,
  pageId: r.page_id,
  title: r.title,
  icon: r.icon,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapOption = (r: OptionRow): SelectOption => ({
  id: r.id,
  fieldId: r.field_id,
  label: r.label,
  color: r.color,
  position: r.position,
  createdAt: r.created_at,
});

export const mapField = (r: FieldRow, options: SelectOption[]): Field => ({
  id: r.id,
  databaseId: r.database_id,
  name: r.name,
  type: r.type as FieldType,
  position: r.position,
  config: parseJson<FieldConfig>(r.config, {}),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  options,
});

export const mapView = (r: ViewRow): View => ({
  id: r.id,
  databaseId: r.database_id,
  name: r.name,
  type: r.type as ViewType,
  position: r.position,
  config: parseJson<ViewConfig>(r.config, {}),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const parseProperties = (raw: string): Record<string, CellValue> =>
  parseJson<Record<string, CellValue>>(raw, {});

/**
 * Next end-of-list position for a table scoped by one column. Positions are
 * REAL so we can later insert fractional values between neighbors.
 */
export function nextPosition(
  table: string,
  whereCol: string,
  whereVal: string,
): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(position), 0) AS m FROM ${table} WHERE ${whereCol} = ?`,
    )
    .get(whereVal) as { m: number };
  return row.m + 1;
}

/** Next end-of-list position for an unscoped table (e.g. top-level pages). */
export function nextPositionGlobal(table: string): number {
  const db = getDb();
  const row = db
    .prepare(`SELECT COALESCE(MAX(position), 0) AS m FROM ${table}`)
    .get() as { m: number };
  return row.m + 1;
}

export type Db = Database.Database;

/** JSON path for a field's cell. Double-quoted so nanoid `-`/`_` keys are safe. */
export function jsonPath(fieldId: string): string {
  return `$."${fieldId}"`;
}

const EMPTY_CELL = (v: CellValue): boolean =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0);

/**
 * Write a SINGLE field's cell on a row via json_set / json_remove. This is the
 * core concurrency-safety primitive: editing one field never rewrites the rest
 * of the JSON, so two people editing different fields of the same row can't
 * clobber each other. Empty values are removed (absent ⇒ empty when read).
 * Bumps updated_at. Call inside a db.transaction() for multi-row operations.
 */
export function writeCell(
  rowId: string,
  fieldId: string,
  value: CellValue,
): void {
  const db = getDb();
  const path = jsonPath(fieldId);
  if (EMPTY_CELL(value)) {
    db.prepare(
      `UPDATE rows SET properties = json_remove(properties, ?), updated_at = ? WHERE id = ?`,
    ).run(path, nowIso(), rowId);
  } else {
    db.prepare(
      `UPDATE rows SET properties = json_set(properties, ?, json(?)), updated_at = ? WHERE id = ?`,
    ).run(path, JSON.stringify(value), nowIso(), rowId);
  }
}
