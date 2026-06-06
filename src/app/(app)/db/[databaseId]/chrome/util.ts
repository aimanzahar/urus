import { updateViewConfigAction } from "@/lib/actions";
import type { ViewConfig } from "@/lib/types";

/** Merge a partial config patch into a view (server-persisted). */
export function setViewConfig(
  databaseId: string,
  viewId: string,
  patch: ViewConfig,
): Promise<void> {
  const fd = new FormData();
  fd.set("viewId", viewId);
  fd.set("databaseId", databaseId);
  fd.set("config", JSON.stringify(patch));
  return updateViewConfigAction(fd);
}

export const VIEW_ICON: Record<string, string> = {
  table: "▤",
  kanban: "▥",
  calendar: "▦",
  timeline: "▬",
  gallery: "▢",
};

export const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "Text",
  number: "Number",
  single_select: "Select",
  multi_select: "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  image: "Image",
  file: "File",
  relation: "Relation",
};

export const FIELD_TYPE_ICON: Record<string, string> = {
  text: "T",
  number: "#",
  single_select: "◉",
  multi_select: "▤",
  date: "▦",
  checkbox: "☑",
  image: "▢",
  file: "📎",
  relation: "↗",
};
