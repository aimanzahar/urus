"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  checkPassword,
  clearedSessionCookie,
  newSessionCookie,
  requireAuth,
} from "./auth";
import { createPage, deletePage, updatePage } from "./data/pages";
import {
  createDatabase,
  deleteDatabase,
  getDatabase,
  updateDatabase,
} from "./data/databases";
import {
  addOption,
  createField,
  deleteField,
  deleteOption,
  getField,
  retypeField,
  updateField,
  updateOption,
} from "./data/fields";
import {
  createView,
  deleteView,
  getView,
  renameView,
  updateViewConfig,
} from "./data/views";
import {
  createRow,
  deleteRow,
  duplicateRow,
  getRowCell,
  moveCard,
  moveRow,
  setCover,
  setImageCell,
  updateCell,
} from "./data/rows";
import {
  addRelation,
  listRowChoices,
  removeRelation,
} from "./data/relations";
import { saveUpload } from "./uploads";
import type {
  CellValue,
  FieldType,
  RelationLink,
  ViewConfig,
  ViewType,
} from "./types";

// --- helpers ---------------------------------------------------------------

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function revalidateDb(databaseId: string): void {
  revalidatePath(`/db/${databaseId}`);
}

function revalidateAll(): void {
  // Sidebar lives in the (app) layout, so structural changes revalidate it.
  revalidatePath("/", "layout");
}

// --- auth ------------------------------------------------------------------

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = s(formData, "password");
  if (!checkPassword(password)) {
    return { error: "Incorrect password." };
  }
  const c = await newSessionCookie();
  (await cookies()).set(c.name, c.value, c.options);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const c = await clearedSessionCookie();
  (await cookies()).set(c.name, c.value, c.options);
  redirect("/login");
}

// --- pages -----------------------------------------------------------------

export async function createPageAction(): Promise<void> {
  await requireAuth();
  const page = createPage("Untitled");
  revalidateAll();
  redirect(`/p/${page.id}`);
}

export async function updatePageAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = s(formData, "pageId");
  if (!id) return;
  const patch: { title?: string; notes?: string } = {};
  if (formData.has("title")) patch.title = s(formData, "title");
  if (formData.has("notes")) patch.notes = s(formData, "notes");
  updatePage(id, patch);
  revalidateAll();
}

export async function deletePageAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = s(formData, "pageId");
  if (id) deletePage(id);
  revalidateAll();
  redirect("/");
}

// --- databases -------------------------------------------------------------

export async function createDatabaseAction(formData: FormData): Promise<void> {
  await requireAuth();
  const pageId = s(formData, "pageId") || null;
  const db = createDatabase(pageId, "Untitled");
  revalidateAll();
  redirect(`/db/${db.id}`);
}

export async function renameDatabaseAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = s(formData, "databaseId");
  if (!id) return;
  updateDatabase(id, { title: s(formData, "title") });
  revalidateAll();
  revalidateDb(id);
}

export async function deleteDatabaseAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = s(formData, "databaseId");
  const db = id ? getDatabase(id) : null;
  if (!db) return;
  // Remove image files first (delete the rows by hand so files are cleaned),
  // then drop the database (CASCADE handles the rest).
  const { rows } = await import("./query").then((m) => ({
    rows: m.loadDatabaseBundle(id)?.rows ?? [],
  }));
  for (const r of rows) await deleteRow(r.id);
  deleteDatabase(id);
  revalidateAll();
  redirect(db.pageId ? `/p/${db.pageId}` : "/");
}

// --- fields ----------------------------------------------------------------

export async function createFieldAction(formData: FormData): Promise<void> {
  await requireAuth();
  const databaseId = s(formData, "databaseId");
  const name = s(formData, "name");
  const type = s(formData, "type") as FieldType;
  if (!databaseId || !type) return;
  const targetDatabaseId = s(formData, "targetDatabaseId");
  createField(
    databaseId,
    name,
    type,
    type === "relation" && targetDatabaseId ? { targetDatabaseId } : {},
  );
  revalidateDb(databaseId);
  revalidateAll();
}

export async function renameFieldAction(formData: FormData): Promise<void> {
  await requireAuth();
  const fieldId = s(formData, "fieldId");
  const databaseId = s(formData, "databaseId");
  if (!fieldId) return;
  updateField(fieldId, { name: s(formData, "name") });
  if (databaseId) revalidateDb(databaseId);
}

export async function updateFieldConfigAction(
  formData: FormData,
): Promise<void> {
  await requireAuth();
  const fieldId = s(formData, "fieldId");
  const databaseId = s(formData, "databaseId");
  if (!fieldId) return;
  const field = getField(fieldId);
  if (!field) return;
  const targetDatabaseId = s(formData, "targetDatabaseId");
  updateField(fieldId, {
    config: { ...field.config, ...(targetDatabaseId ? { targetDatabaseId } : {}) },
  });
  if (databaseId) revalidateDb(databaseId);
}

export async function retypeFieldAction(formData: FormData): Promise<void> {
  await requireAuth();
  const fieldId = s(formData, "fieldId");
  const databaseId = s(formData, "databaseId");
  const type = s(formData, "type") as FieldType;
  if (!fieldId || !type) return;
  await retypeField(fieldId, type);
  if (databaseId) revalidateDb(databaseId);
}

export async function deleteFieldAction(formData: FormData): Promise<void> {
  await requireAuth();
  const fieldId = s(formData, "fieldId");
  const databaseId = s(formData, "databaseId");
  if (!fieldId) return;
  await deleteField(fieldId);
  if (databaseId) revalidateDb(databaseId);
}

export async function addOptionAction(formData: FormData): Promise<void> {
  await requireAuth();
  const fieldId = s(formData, "fieldId");
  const databaseId = s(formData, "databaseId");
  if (!fieldId) return;
  addOption(fieldId, s(formData, "label"), s(formData, "color") || "gray");
  if (databaseId) revalidateDb(databaseId);
}

export async function updateOptionAction(formData: FormData): Promise<void> {
  await requireAuth();
  const optionId = s(formData, "optionId");
  const databaseId = s(formData, "databaseId");
  if (!optionId) return;
  const patch: { label?: string; color?: string } = {};
  if (formData.has("label")) patch.label = s(formData, "label");
  if (formData.has("color")) patch.color = s(formData, "color");
  updateOption(optionId, patch);
  if (databaseId) revalidateDb(databaseId);
}

export async function deleteOptionAction(formData: FormData): Promise<void> {
  await requireAuth();
  const optionId = s(formData, "optionId");
  const databaseId = s(formData, "databaseId");
  if (!optionId) return;
  deleteOption(optionId);
  if (databaseId) revalidateDb(databaseId);
}

/** Create a new option AND assign it to a row's cell, in one round trip. */
export async function addOptionAndAssignAction(
  formData: FormData,
): Promise<void> {
  await requireAuth();
  const fieldId = s(formData, "fieldId");
  const rowId = s(formData, "rowId");
  const databaseId = s(formData, "databaseId");
  const mode = s(formData, "mode"); // "single" | "multi"
  if (!fieldId || !rowId) return;
  const opt = addOption(fieldId, s(formData, "label"), s(formData, "color") || "gray");
  if (mode === "multi") {
    const cur = getRowCell(rowId, fieldId);
    const arr = Array.isArray(cur) ? (cur as string[]) : [];
    updateCell(rowId, fieldId, [...arr, opt.id]);
  } else {
    updateCell(rowId, fieldId, opt.id);
  }
  if (databaseId) revalidateDb(databaseId);
}

// --- views -----------------------------------------------------------------

export async function createViewAction(formData: FormData): Promise<void> {
  await requireAuth();
  const databaseId = s(formData, "databaseId");
  const type = s(formData, "type") as ViewType;
  if (!databaseId || !type) return;
  const view = createView(databaseId, type);
  revalidateDb(databaseId);
  redirect(`/db/${databaseId}?view=${view.id}`);
}

export async function renameViewAction(formData: FormData): Promise<void> {
  await requireAuth();
  const viewId = s(formData, "viewId");
  const databaseId = s(formData, "databaseId");
  if (!viewId) return;
  renameView(viewId, s(formData, "name"));
  if (databaseId) revalidateDb(databaseId);
}

export async function updateViewConfigAction(formData: FormData): Promise<void> {
  await requireAuth();
  const viewId = s(formData, "viewId");
  const databaseId = s(formData, "databaseId");
  if (!viewId) return;
  let patch: ViewConfig = {};
  try {
    patch = JSON.parse(s(formData, "config") || "{}") as ViewConfig;
  } catch {
    patch = {};
  }
  updateViewConfig(viewId, patch);
  if (databaseId) revalidateDb(databaseId);
}

export async function deleteViewAction(formData: FormData): Promise<void> {
  await requireAuth();
  const viewId = s(formData, "viewId");
  const databaseId = s(formData, "databaseId");
  if (!viewId) return;
  deleteView(viewId);
  if (databaseId) revalidateDb(databaseId);
  if (databaseId) redirect(`/db/${databaseId}`);
}

// --- rows & cells ----------------------------------------------------------

export async function createRowAction(formData: FormData): Promise<void> {
  await requireAuth();
  const databaseId = s(formData, "databaseId");
  if (!databaseId) return;
  const initial: Record<string, CellValue> = {};
  // Optional: prefill one cell (e.g. kanban "add card in column", calendar day).
  const fieldId = s(formData, "fieldId");
  const value = s(formData, "value");
  if (fieldId && value) initial[fieldId] = value;
  createRow(databaseId, initial);
  revalidateDb(databaseId);
}

function parseCellValue(type: FieldType, raw: string): CellValue {
  switch (type) {
    case "number": {
      const n = Number.parseFloat(raw.replace(/[, ]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    case "checkbox":
      return raw === "true";
    case "multi_select":
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? (arr as string[]) : null;
      } catch {
        return null;
      }
    case "text":
    case "date":
    case "single_select":
      return raw === "" ? null : raw;
    default:
      return null;
  }
}

export async function updateCellAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const fieldId = s(formData, "fieldId");
  const databaseId = s(formData, "databaseId");
  const type = s(formData, "type") as FieldType;
  if (!rowId || !fieldId || !type) return;
  updateCell(rowId, fieldId, parseCellValue(type, s(formData, "value")));
  if (databaseId) revalidateDb(databaseId);
}

export async function moveRowAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const databaseId = s(formData, "databaseId");
  if (!rowId) return;
  moveRow(rowId, s(formData, "prevId") || null, s(formData, "nextId") || null);
  if (databaseId) revalidateDb(databaseId);
}

export async function moveCardAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const databaseId = s(formData, "databaseId");
  const groupFieldId = s(formData, "groupFieldId");
  if (!rowId || !groupFieldId) return;
  const targetRaw = s(formData, "targetValue");
  const targetValue = targetRaw === "__none__" || targetRaw === "" ? null : targetRaw;
  moveCard(
    rowId,
    groupFieldId,
    targetValue,
    s(formData, "prevId") || null,
    s(formData, "nextId") || null,
  );
  if (databaseId) revalidateDb(databaseId);
}

export async function deleteRowAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const databaseId = s(formData, "databaseId");
  if (!rowId) return;
  await deleteRow(rowId);
  if (databaseId) revalidateDb(databaseId);
}

export async function duplicateRowAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const databaseId = s(formData, "databaseId");
  if (!rowId) return;
  await duplicateRow(rowId);
  if (databaseId) revalidateDb(databaseId);
}

// --- images ----------------------------------------------------------------

export async function setCoverAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const databaseId = s(formData, "databaseId");
  if (!rowId) return;
  const path = await saveUpload(formData.get("file"), "covers");
  if (path) await setCover(rowId, path);
  if (databaseId) revalidateDb(databaseId);
}

export async function removeCoverAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const databaseId = s(formData, "databaseId");
  if (!rowId) return;
  await setCover(rowId, null);
  if (databaseId) revalidateDb(databaseId);
}

export async function setImageCellAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const fieldId = s(formData, "fieldId");
  const databaseId = s(formData, "databaseId");
  if (!rowId || !fieldId) return;
  const path = await saveUpload(formData.get("file"), "fields");
  if (path) await setImageCell(rowId, fieldId, path);
  if (databaseId) revalidateDb(databaseId);
}

export async function removeImageCellAction(formData: FormData): Promise<void> {
  await requireAuth();
  const rowId = s(formData, "rowId");
  const fieldId = s(formData, "fieldId");
  const databaseId = s(formData, "databaseId");
  if (!rowId || !fieldId) return;
  await setImageCell(rowId, fieldId, null);
  if (databaseId) revalidateDb(databaseId);
}

// --- relations -------------------------------------------------------------

export async function addRelationAction(formData: FormData): Promise<void> {
  await requireAuth();
  const fieldId = s(formData, "fieldId");
  const fromRowId = s(formData, "fromRowId");
  const toRowId = s(formData, "toRowId");
  const databaseId = s(formData, "databaseId");
  if (!fieldId || !fromRowId || !toRowId) return;
  addRelation(fieldId, fromRowId, toRowId);
  if (databaseId) revalidateDb(databaseId);
}

export async function removeRelationAction(formData: FormData): Promise<void> {
  await requireAuth();
  const fieldId = s(formData, "fieldId");
  const fromRowId = s(formData, "fromRowId");
  const toRowId = s(formData, "toRowId");
  const databaseId = s(formData, "databaseId");
  if (!fieldId || !fromRowId || !toRowId) return;
  removeRelation(fieldId, fromRowId, toRowId);
  if (databaseId) revalidateDb(databaseId);
}

/** Returns candidate rows to link, for the relation picker (called from client). */
export async function searchRelationChoicesAction(
  fieldId: string,
  query: string,
): Promise<RelationLink[]> {
  await requireAuth();
  const field = getField(fieldId);
  const target = field?.config.targetDatabaseId;
  if (!target) return [];
  return listRowChoices(target, query);
}

/** Databases available as relation targets (for the field editor). */
export async function listDatabaseChoicesAction(): Promise<
  { id: string; title: string }[]
> {
  await requireAuth();
  const { listDatabases } = await import("./data/databases");
  return listDatabases().map((d) => ({ id: d.id, title: d.title }));
}
