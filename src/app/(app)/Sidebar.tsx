"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ContextMenu } from "@/components/ContextMenu";
import { MenuItem } from "@/components/Menu";
import {
  createDatabaseAction,
  createPageAction,
  deleteDatabaseAction,
  deletePageAction,
  logoutAction,
  renameDatabaseAction,
  updatePageAction,
} from "@/lib/actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

function PageItemMenu({ page }: { page: SidebarPage }) {
  return (
    <>
      <MenuItem
        onClick={() => {
          const title = window.prompt("Rename page", page.title);
          if (title?.trim())
            void updatePageAction(fd({ pageId: page.id, title: title.trim() }));
        }}
      >
        ✎ Rename page
      </MenuItem>
      <MenuItem onClick={() => void createDatabaseAction(fd({ pageId: page.id }))}>
        ＋ New database
      </MenuItem>
      <MenuItem onClick={() => void createPageAction()}>＋ New page</MenuItem>
      <MenuItem
        danger
        onClick={() => {
          if (confirm(`Delete “${page.title}” and all its databases?`))
            void deletePageAction(fd({ pageId: page.id }));
        }}
      >
        🗑 Delete page
      </MenuItem>
    </>
  );
}

function DbItemMenu({ db }: { db: SidebarDatabase }) {
  return (
    <>
      <MenuItem
        onClick={() => {
          const title = window.prompt("Rename database", db.title);
          if (title?.trim())
            void renameDatabaseAction(
              fd({ databaseId: db.id, title: title.trim() }),
            );
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

export interface SidebarDatabase {
  id: string;
  title: string;
  icon: string | null;
}
export interface SidebarPage {
  id: string;
  title: string;
  icon: string | null;
  databases: SidebarDatabase[];
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  return (
    <button
      className="icon-btn"
      title="Toggle theme"
      aria-label="Toggle theme"
      onClick={() => {
        const root = document.documentElement;
        const next = !root.classList.contains("dark");
        root.classList.toggle("dark", next);
        try {
          localStorage.setItem("urus-theme", next ? "dark" : "light");
        } catch {}
        setDark(next);
      }}
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}

export default function Sidebar({ pages }: { pages: SidebarPage[] }) {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] shrink-0 h-dvh bg-sidebar border-r border-line flex flex-col">
      <div className="flex items-center gap-2 px-3 h-12 shrink-0">
        <div className="w-6 h-6 rounded-md bg-accent text-white grid place-items-center text-xs font-semibold">
          U
        </div>
        <span className="font-semibold text-sm tracking-tight">Urus</span>
        <div className="ml-auto flex items-center gap-0.5">
          <ThemeToggle />
          <form action={logoutAction}>
            <button className="icon-btn" title="Log out" aria-label="Log out">
              ⏻
            </button>
          </form>
        </div>
      </div>

      <ContextMenu
        className="flex-1 overflow-y-auto px-2 py-2"
        menu={<MenuItem onClick={() => void createPageAction()}>＋ New page</MenuItem>}
      >
        <div className="flex items-center justify-between px-1.5 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Workspace
          </span>
          <form action={createPageAction}>
            <button
              className="icon-btn"
              style={{ width: 22, height: 22 }}
              title="New page"
              aria-label="New page"
            >
              +
            </button>
          </form>
        </div>

        {pages.length === 0 ? (
          <p className="text-xs text-ink-faint px-1.5 py-2 leading-relaxed">
            No pages yet. Click + to create your first page.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {pages.map((page) => {
              const pageActive = pathname === `/p/${page.id}`;
              return (
                <li key={page.id}>
                  <ContextMenu menu={<PageItemMenu page={page} />}>
                    <Link
                      href={`/p/${page.id}`}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-sm hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] transition-colors"
                      style={
                        pageActive
                          ? { background: "color-mix(in srgb, var(--ink) 8%, transparent)" }
                          : undefined
                      }
                    >
                      <span className="text-ink-faint text-xs w-4 text-center">
                        {page.icon ?? "▦"}
                      </span>
                      <span className="truncate font-medium">{page.title}</span>
                    </Link>
                  </ContextMenu>

                  <ul className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-line pl-1.5">
                    {page.databases.map((db) => {
                      const active = pathname === `/db/${db.id}`;
                      return (
                        <li key={db.id}>
                          <ContextMenu menu={<DbItemMenu db={db} />}>
                            <Link
                              href={`/db/${db.id}`}
                              className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[13px] text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] hover:text-ink transition-colors"
                              style={
                                active
                                  ? {
                                      background:
                                        "color-mix(in srgb, var(--accent) 14%, transparent)",
                                      color: "var(--accent-2)",
                                    }
                                  : undefined
                              }
                            >
                              <span className="text-xs w-4 text-center">
                                {db.icon ?? "▤"}
                              </span>
                              <span className="truncate">{db.title}</span>
                            </Link>
                          </ContextMenu>
                        </li>
                      );
                    })}
                    <li>
                      <form action={createDatabaseAction}>
                        <input type="hidden" name="pageId" value={page.id} />
                        <button className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[13px] text-ink-faint hover:text-ink hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] w-full transition-colors">
                          <span className="w-4 text-center">+</span>
                          <span>Add database</span>
                        </button>
                      </form>
                    </li>
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </ContextMenu>
    </aside>
  );
}
