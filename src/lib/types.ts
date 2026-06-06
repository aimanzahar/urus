// Domain model for the planning app. See the plan doc for the storage design:
// one `rows` table with a JSON `properties` column keyed by field id; relations
// in a dedicated join table; select options as first-class rows.

export type FieldType =
  | "text"
  | "number"
  | "single_select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "image"
  | "file"
  | "relation";

export const FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "single_select",
  "multi_select",
  "date",
  "checkbox",
  "image",
  "file",
  "relation",
];

export type ViewType = "table" | "kanban" | "calendar" | "timeline" | "gallery";

export const VIEW_TYPES: ViewType[] = [
  "table",
  "kanban",
  "calendar",
  "timeline",
  "gallery",
];

/** A single cell's value as stored inside `rows.properties[fieldId]`. */
export type CellValue = string | number | boolean | string[] | null;

export interface Page {
  id: string;
  title: string;
  icon: string | null;
  notes: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseDef {
  id: string;
  pageId: string | null;
  title: string;
  icon: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface SelectOption {
  id: string;
  fieldId: string;
  label: string;
  color: string;
  position: number;
  createdAt: string;
}

/** Per-type config blob stored as JSON in `fields.config`. */
export interface FieldConfig {
  /** relation: which database this field links rows to. */
  targetDatabaseId?: string;
  /** number: rendering format. */
  format?: "plain" | "integer";
}

export interface Field {
  id: string;
  databaseId: string;
  name: string;
  type: FieldType;
  position: number;
  config: FieldConfig;
  createdAt: string;
  updatedAt: string;
  /** Hydrated for single_select / multi_select fields. */
  options: SelectOption[];
}

export interface SortRule {
  fieldId: string;
  dir: "asc" | "desc";
}

export type FilterOp =
  | "contains"
  | "not_contains"
  | "is"
  | "is_not"
  | "is_empty"
  | "is_not_empty"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export interface FilterRule {
  fieldId: string;
  op: FilterOp;
  value?: string;
}

/** Per-type config blob stored as JSON in `views.config`. */
export interface ViewConfig {
  // table
  sort?: SortRule[];
  filters?: FilterRule[];
  hiddenFieldIds?: string[];
  // kanban
  groupByFieldId?: string;
  // calendar
  dateFieldId?: string;
  // timeline
  startFieldId?: string;
  endFieldId?: string;
  // gallery: "row_cover" or an image field id
  coverSource?: string;
}

export interface View {
  id: string;
  databaseId: string;
  name: string;
  type: ViewType;
  position: number;
  config: ViewConfig;
  createdAt: string;
  updatedAt: string;
}

/** A resolved relation link, ready for rendering (id + display title). */
export interface RelationLink {
  rowId: string;
  title: string;
}

/** A row with its JSON properties parsed + relations hydrated per field. */
export interface Row {
  id: string;
  databaseId: string;
  properties: Record<string, CellValue>;
  coverPath: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  /** fieldId -> linked rows, for relation fields only. */
  relations: Record<string, RelationLink[]>;
}

/** Everything the database page needs to render any view. */
export interface DatabaseBundle {
  database: DatabaseDef;
  fields: Field[];
  views: View[];
  rows: Row[];
}

/** The named option colors. Keep in sync with the `.opt-*` classes in CSS. */
export const OPTION_COLORS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "pink",
  "teal",
] as const;

export type OptionColor = (typeof OPTION_COLORS)[number];
