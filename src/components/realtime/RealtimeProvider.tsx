"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { basePath } from "@/lib/url";
import {
  getIdentity,
  getSessionId,
  setIdentityName,
  type Identity,
} from "./identity";

export interface Viewer {
  sessionId: string;
  name: string;
  color: string;
  editingRowId: string | null;
}

interface RealtimeValue {
  viewers: Viewer[];
  /** rowId -> other viewers currently editing it (excludes self). */
  editingByRow: Record<string, Viewer[]>;
  identity: Identity;
  rename: (name: string) => void;
  reportEditing: (rowId: string | null) => void;
}

const Ctx = createContext<RealtimeValue | null>(null);
export const useRealtime = (): RealtimeValue | null => useContext(Ctx);

function dbIdFromPath(pathname: string): string | null {
  const m = /^\/db\/([^/?]+)/.exec(pathname);
  return m ? m[1] : null;
}

const isEditable = (el: Element | null): boolean =>
  !!el?.closest("input, textarea, select, [contenteditable='true']");

export default function RealtimeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dbId = dbIdFromPath(pathname);
  const sid = getSessionId();

  const [identity, setIdentity] = useState<Identity>(() => getIdentity());
  const [viewers, setViewers] = useState<Viewer[]>([]);

  // --- focus-guarded, debounced refresh ---------------------------------
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRefresh = useCallback(() => {
    pending.current = false;
    router.refresh();
  }, [router]);

  const scheduleRefresh = useCallback(() => {
    // Don't yank a field the local user is typing in — defer until blur/idle.
    if (isEditable(document.activeElement)) {
      pending.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(doRefresh, 250);
  }, [doRefresh]);

  useEffect(() => {
    const onFocusOut = () => {
      if (!pending.current) return;
      setTimeout(() => {
        if (pending.current && !isEditable(document.activeElement)) doRefresh();
      }, 200);
    };
    document.addEventListener("focusout", onFocusOut);
    return () => document.removeEventListener("focusout", onFocusOut);
  }, [doRefresh]);

  // --- SSE connection (re-created when db or identity changes) -----------
  useEffect(() => {
    setViewers([]);
    const params = new URLSearchParams({
      db: dbId ?? "",
      sid,
      name: identity.name,
      color: identity.color,
    });
    const es = new EventSource(`${basePath()}/api/stream?${params.toString()}`);
    let openedOnce = false;

    es.onmessage = (ev) => {
      let data: { type?: string; viewers?: Viewer[] };
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (data.type === "change") scheduleRefresh();
      else if (data.type === "presence") setViewers(data.viewers ?? []);
    };
    es.onopen = () => {
      if (openedOnce) doRefresh(); // reconnected — catch up on missed changes
      openedOnce = true;
    };
    // onerror: EventSource auto-reconnects; nothing to do.

    return () => es.close();
  }, [dbId, sid, identity.name, identity.color, scheduleRefresh, doRefresh]);

  // --- editing reporting (debounced so cell->cell moves don't flicker) ---
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReported = useRef<string | null>(null);
  const reportEditing = useCallback(
    (rowId: string | null) => {
      if (!dbId) return;
      if (editTimer.current) clearTimeout(editTimer.current);
      editTimer.current = setTimeout(() => {
        if (lastReported.current === rowId) return;
        lastReported.current = rowId;
        fetch(`${basePath()}/api/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ databaseId: dbId, sessionId: sid, editingRowId: rowId }),
          keepalive: true,
        }).catch(() => {});
      }, 120);
    },
    [dbId, sid],
  );

  const rename = useCallback(
    (name: string) => setIdentity(setIdentityName(name)),
    [],
  );

  const editingByRow: Record<string, Viewer[]> = {};
  for (const v of viewers) {
    if (v.sessionId === sid || !v.editingRowId) continue;
    (editingByRow[v.editingRowId] ??= []).push(v);
  }

  return (
    <Ctx.Provider
      value={{ viewers, editingByRow, identity, rename, reportEditing }}
    >
      {children}
    </Ctx.Provider>
  );
}
