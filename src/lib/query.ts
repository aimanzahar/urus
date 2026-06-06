import "server-only";
import { getDb } from "./db";
import { getDatabase } from "./data/databases";
import { listFields } from "./data/fields";
import { listViews } from "./data/views";
import { loadRelations } from "./data/relations";
import { parseProperties, type RowRow } from "./data/mappers";
import type {
  CellValue,
  DatabaseBundle,
  Field,
  FilterRule,
  Row,
  SortRule,
  ViewConfig,
} from "./types";

/** Load everything needed to render any view of a database (relations batched). */
export function loadDatabaseBundle(databaseId: string): DatabaseBundle | null {
  const database = getDatabase(databaseId);
  if (!database) return null;

  const fields = listFields(databaseId);
  const views = listViews(databaseId);

  const rawRows = getDb()
    .prepare(
      `SELECT * FROM rows WHERE database_id = ? ORDER BY position ASC, created_at ASC`,
    )
    .all(databaseId) as RowRow[];

  const relationFieldIds = fields
    .filter((f) => f.type === "relation")
    .map((f) => f.id);
  const rowIds = rawRows.map((r) => r.id);
  const relations = loadRelations(relationFieldIds, rowIds);

  const rows: Row[] = rawRows.map((r) => {
    const rowRelations: Record<string, (typeof relations)[string][string]> = {};
    for (const fid of relationFieldIds) {
      rowRelations[fid] = relations[fid]?.[r.id] ?? [];
    }
    return {
      id: r.id,
      databaseId: r.database_id,
      properties: parseProperties(r.properties),
      coverPath: r.cover_path,
      position: r.position,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      relations: rowRelations,
    };
  });

  return { database, fields, views, rows };
}

// --- filtering & sorting ---------------------------------------------------

const fieldById = (fields: Field[]) =>
  new Map(fields.map((f) => [f.id, f]));

/** Is this row's cell for the given field "empty"? */
function isEmpty(row: Row, field: Field): boolean {
  if (field.type === "relation") return (row.relations[field.id]?.length ?? 0) === 0;
  const v = row.properties[field.id];
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (field.type === "checkbox") return v === false;
  return false;
}

/** A lowercase searchable string for text-style matching. */
function searchText(row: Row, field: Field): string {
  if (field.type === "relation")
    return (row.relations[field.id] ?? []).map((l) => l.title).join(" ").toLowerCase();
  const v = row.properties[field.id];
  if (v === null || v === undefined) return "";
  if (field.type === "single_select" && typeof v === "string")
    return (field.options.find((o) => o.id === v)?.label ?? "").toLowerCase();
  if (field.type === "multi_select" && Array.isArray(v))
    return v
      .map((id) => field.options.find((o) => o.id === id)?.label ?? "")
      .join(" ")
      .toLowerCase();
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).toLowerCase();
}

function matchesFilter(row: Row, field: Field, rule: FilterRule): boolean {
  const empty = isEmpty(row, field);
  const needle = (rule.value ?? "").trim().toLowerCase();
  switch (rule.op) {
    case "is_empty":
      return empty;
    case "is_not_empty":
      return !empty;
    case "contains":
      return searchText(row, field).includes(needle);
    case "not_contains":
      return !searchText(row, field).includes(needle);
    case "is":
      if (field.type === "single_select")
        return row.properties[field.id] === rule.value;
      if (field.type === "checkbox")
        return Boolean(row.properties[field.id]) === (rule.value === "true");
      return searchText(row, field) === needle;
    case "is_not":
      if (field.type === "single_select")
        return row.properties[field.id] !== rule.value;
      if (field.type === "checkbox")
        return Boolean(row.properties[field.id]) !== (rule.value === "true");
      return searchText(row, field) !== needle;
    case "gt":
    case "lt":
    case "gte":
    case "lte": {
      const a = row.properties[field.id];
      if (field.type === "number") {
        const x = typeof a === "number" ? a : Number.NaN;
        const y = Number.parseFloat(rule.value ?? "");
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        return compareOp(rule.op, x, y);
      }
      // date (lexicographic YYYY-MM-DD works) and text fallback
      const x = typeof a === "string" ? a : "";
      const y = rule.value ?? "";
      if (!x || !y) return false;
      return compareOp(rule.op, x, y);
    }
    default:
      return true;
  }
}

function compareOp<T>(op: string, x: T, y: T): boolean {
  if (op === "gt") return x > y;
  if (op === "lt") return x < y;
  if (op === "gte") return x >= y;
  if (op === "lte") return x <= y;
  return false;
}

/** Sort key for a field; empties handled separately so they sort to the end. */
function sortKey(row: Row, field: Field): number | string {
  if (field.type === "number") {
    const v = row.properties[field.id];
    return typeof v === "number" ? v : Number.NEGATIVE_INFINITY;
  }
  if (field.type === "checkbox") return row.properties[field.id] ? 1 : 0;
  if (field.type === "single_select") {
    const v = row.properties[field.id];
    const opt = field.options.find((o) => o.id === v);
    return opt ? opt.position : Number.POSITIVE_INFINITY;
  }
  return searchText(row, field);
}

function applyFilters(rows: Row[], fields: Field[], filters: FilterRule[]): Row[] {
  if (!filters || filters.length === 0) return rows;
  const map = fieldById(fields);
  return rows.filter((row) =>
    filters.every((rule) => {
      const field = map.get(rule.fieldId);
      return field ? matchesFilter(row, field, rule) : true;
    }),
  );
}

function applySort(rows: Row[], fields: Field[], sort: SortRule[]): Row[] {
  if (!sort || sort.length === 0) return rows;
  const map = fieldById(fields);
  const copy = [...rows];
  copy.sort((ra, rb) => {
    for (const rule of sort) {
      const field = map.get(rule.fieldId);
      if (!field) continue;
      const ea = isEmpty(ra, field);
      const eb = isEmpty(rb, field);
      if (ea && eb) continue;
      if (ea) return 1; // empties always last, regardless of direction
      if (eb) return -1;
      const ka = sortKey(ra, field);
      const kb = sortKey(rb, field);
      let cmp = 0;
      if (typeof ka === "number" && typeof kb === "number") cmp = ka - kb;
      else cmp = String(ka).localeCompare(String(kb));
      if (cmp !== 0) return rule.dir === "desc" ? -cmp : cmp;
    }
    return ra.position - rb.position;
  });
  return copy;
}

/** Apply a view's filters + sort to a row set. */
export function applyView(
  rows: Row[],
  fields: Field[],
  config: ViewConfig,
): Row[] {
  return applySort(applyFilters(rows, fields, config.filters ?? []), fields, config.sort ?? []);
}

/** Best-effort display title for a row (its first text field). */
export function rowTitle(row: Row, fields: Field[]): string {
  const textField = fields.find((f) => f.type === "text");
  const v = textField ? row.properties[textField.id] : null;
  return typeof v === "string" && v.trim() ? v : "Untitled";
}

export type { CellValue };
