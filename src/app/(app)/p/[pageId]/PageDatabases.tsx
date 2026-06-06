"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContextMenu } from "@/components/ContextMenu";
import { MenuItem } from "@/components/Menu";
import {
  createDatabaseAction,
  deleteDatabaseAction,
  renameDatabaseAction,
} from "@/lib/actions";

export interface PageDb {
  id: string;
  title: string;
  icon: string | null;
  stats: { rows: number; fields: number };
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

function CardMenu({ db }: { db: PageDb }) {
  const router = useRouter();
  return (
    <>
      <MenuItem onClick={() => router.push(`/db/${db.id}`)}>⤢ Open</MenuItem>
      <MenuItem
        onClick={() => {
          const t = window.prompt("Rename database", db.title);
          if (t?.trim())
            void renameDatabaseAction(fd({ databaseId: db.id, title: t.trim() }));
        }}
      >
        ✎ Rename
      </MenuItem>
      <MenuItem
        danger
        onClick={() => {
          if (confirm(`Delete database “${db.title}”?`))
            void deleteDatabaseAction(fd({ databaseId: db.id }));
        }}
      >
        🗑 Delete
      </MenuItem>
    </>
  );
}

export default function PageDatabases({
  pageId,
  databases,
}: {
  pageId: string;
  databases: PageDb[];
}) {
  const newDb = () => void createDatabaseAction(fd({ pageId }));

  return (
    <ContextMenu
      className="block"
      menu={<MenuItem onClick={newDb}>＋ New database</MenuItem>}
    >
      {databases.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-soft">
          No databases yet. Create one to start planning — you’ll get a Table
          view by default and can add Board, Calendar, Timeline and Gallery
          views.
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {databases.map((db) => (
            <li key={db.id}>
              <ContextMenu menu={<CardMenu db={db} />}>
                <Link
                  href={`/db/${db.id}`}
                  className="card p-4 block hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{db.icon ?? "▤"}</span>
                    <span className="font-medium truncate">{db.title}</span>
                  </div>
                  <p className="text-xs text-ink-faint">
                    {db.stats.rows} {db.stats.rows === 1 ? "row" : "rows"} ·{" "}
                    {db.stats.fields}{" "}
                    {db.stats.fields === 1 ? "field" : "fields"}
                  </p>
                </Link>
              </ContextMenu>
            </li>
          ))}
        </ul>
      )}
    </ContextMenu>
  );
}
