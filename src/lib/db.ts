import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "app.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Shared team workspace: several people may write at once. WAL allows one
  // writer + many readers; busy_timeout makes a brief concurrent write wait
  // for the lock instead of throwing SQLITE_BUSY. We run a single container.
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

function migrate(d: Database.Database) {
  d.exec(`
    -- Sidebar pages: group databases + hold a plain-text note (not blocks).
    CREATE TABLE IF NOT EXISTS pages (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT 'Untitled',
      icon        TEXT,
      notes       TEXT,
      position    REAL NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS databases (
      id          TEXT PRIMARY KEY,
      page_id     TEXT REFERENCES pages(id) ON DELETE CASCADE,
      title       TEXT NOT NULL DEFAULT 'Untitled',
      icon        TEXT,
      position    REAL NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_databases_page ON databases(page_id);

    CREATE TABLE IF NOT EXISTS fields (
      id            TEXT PRIMARY KEY,
      database_id   TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL,
      position      REAL NOT NULL DEFAULT 0,
      config        TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fields_database ON fields(database_id);

    -- First-class select options. Kanban columns ARE these rows; cells store
    -- option ids, so rename/recolor/reorder never rewrites a single card.
    CREATE TABLE IF NOT EXISTS select_options (
      id          TEXT PRIMARY KEY,
      field_id    TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      label       TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT 'gray',
      position    REAL NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_select_options_field ON select_options(field_id);

    CREATE TABLE IF NOT EXISTS views (
      id            TEXT PRIMARY KEY,
      database_id   TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
      name          TEXT NOT NULL DEFAULT 'View',
      type          TEXT NOT NULL,
      position      REAL NOT NULL DEFAULT 0,
      config        TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_views_database ON views(database_id);

    -- The single rows table. properties = JSON keyed by field.id.
    CREATE TABLE IF NOT EXISTS rows (
      id           TEXT PRIMARY KEY,
      database_id  TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
      properties   TEXT NOT NULL DEFAULT '{}',
      cover_path   TEXT,
      position     REAL NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rows_database ON rows(database_id);

    -- One-directional relation links between rows (DB rows only).
    CREATE TABLE IF NOT EXISTS row_relations (
      id           TEXT PRIMARY KEY,
      field_id     TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      from_row_id  TEXT NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
      to_row_id    TEXT NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
      created_at   TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_row_relations_uniq
      ON row_relations(field_id, from_row_id, to_row_id);
    CREATE INDEX IF NOT EXISTS idx_row_relations_from
      ON row_relations(field_id, from_row_id);
    CREATE INDEX IF NOT EXISTS idx_row_relations_to
      ON row_relations(field_id, to_row_id);
  `);

  // v2+ additive migrations go here, e.g.:
  //   ensureColumn(d, "rows", "archived", "INTEGER NOT NULL DEFAULT 0");
}

interface PragmaColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

/**
 * Adds a column only if it's missing, so re-running migrate() on an already
 * upgraded database is a no-op. Mirrors the bill app's pattern.
 */
export function ensureColumn(
  d: Database.Database,
  table: string,
  column: string,
  decl: string,
) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as PragmaColumn[];
  if (cols.some((c) => c.name === column)) return;
  d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl};`);
}
