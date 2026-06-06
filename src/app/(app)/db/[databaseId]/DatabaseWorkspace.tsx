"use client";

import { useState } from "react";
import { ContextMenu } from "@/components/ContextMenu";
import { MenuItem } from "@/components/Menu";
import { createFieldAction, createRowAction } from "@/lib/actions";
import type { DatabaseDef, Field, Row, View } from "@/lib/types";
import {
  AddViewMenu,
  DbMenu,
  DbTitle,
  NewRowButton,
  ViewTabs,
} from "./chrome/SimpleChrome";
import AddFieldMenu from "./chrome/AddFieldMenu";
import ViewControls from "./chrome/ViewControls";
import RowDetailDrawer from "./RowDetailDrawer";
import PresenceAvatars from "@/components/realtime/PresenceAvatars";

function BackgroundMenuItems({ databaseId }: { databaseId: string }) {
  const newRow = () => {
    const fd = new FormData();
    fd.set("databaseId", databaseId);
    void createRowAction(fd);
  };
  const newField = () => {
    const fd = new FormData();
    fd.set("databaseId", databaseId);
    fd.set("name", "Field");
    fd.set("type", "text");
    void createFieldAction(fd);
  };
  return (
    <>
      <MenuItem onClick={newRow}>＋ New row</MenuItem>
      <MenuItem onClick={newField}>＋ New field</MenuItem>
    </>
  );
}
import TableView from "./views/TableView";
import BoardView from "./views/BoardView";
import CalendarView from "./views/CalendarView";
import TimelineView from "./views/TimelineView";
import GalleryView from "./views/GalleryView";

export default function DatabaseWorkspace({
  database,
  fields,
  views,
  rows,
  activeView,
}: {
  database: DatabaseDef;
  fields: Field[];
  views: View[];
  rows: Row[];
  activeView: View | null;
}) {
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const openRow = rows.find((r) => r.id === openRowId) ?? null;
  const onOpenRow = (id: string) => setOpenRowId(id);
  const viewProps = { databaseId: database.id, fields, rows, onOpenRow };

  const renderView = () => {
    if (!activeView)
      return (
        <div className="p-8 text-sm text-ink-soft">
          This database has no views. Add one with “+ View”.
        </div>
      );
    switch (activeView.type) {
      case "kanban":
        return <BoardView {...viewProps} view={activeView} />;
      case "calendar":
        return <CalendarView {...viewProps} view={activeView} />;
      case "timeline":
        return <TimelineView {...viewProps} view={activeView} />;
      case "gallery":
        return <GalleryView {...viewProps} view={activeView} />;
      case "table":
      default:
        return <TableView {...viewProps} view={activeView} />;
    }
  };

  const scrolls = activeView?.type === "table" || activeView?.type === "gallery";

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 bg-surface border-b border-line">
        <div className="flex items-center gap-2 px-4 pt-3">
          <span className="text-lg">{database.icon ?? "▤"}</span>
          <DbTitle database={database} />
          <div className="ml-auto flex items-center gap-2">
            <PresenceAvatars />
            <AddFieldMenu databaseId={database.id} />
            <DbMenu database={database} />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <ViewTabs
            databaseId={database.id}
            views={views}
            activeViewId={activeView?.id ?? null}
          />
          <AddViewMenu databaseId={database.id} />
          <div className="ml-auto flex items-center gap-1">
            {activeView ? (
              <ViewControls
                databaseId={database.id}
                view={activeView}
                fields={fields}
              />
            ) : null}
            <NewRowButton databaseId={database.id} />
          </div>
        </div>
      </header>

      <div className={`flex-1 min-h-0 ${scrolls ? "overflow-auto" : "overflow-hidden"}`}>
        <ContextMenu
          className={scrolls ? "block min-h-full" : "block h-full"}
          menu={<BackgroundMenuItems databaseId={database.id} />}
        >
          {renderView()}
        </ContextMenu>
      </div>

      <RowDetailDrawer
        databaseId={database.id}
        fields={fields}
        row={openRow}
        onClose={() => setOpenRowId(null)}
      />
    </div>
  );
}
