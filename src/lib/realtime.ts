import "server-only";
import { EventEmitter } from "node:events";

// Real-time hub: a single in-process pub/sub + presence registry shared across
// all requests in the one container (mirrors the getDb() singleton pattern).
// Server actions publish change events; the SSE route streams them to clients.

export interface PublicViewer {
  sessionId: string;
  name: string;
  color: string;
  /** rowId the viewer is currently editing, or null. */
  editingRowId: string | null;
  /** fieldId the viewer is currently editing within that row, or null. */
  editingFieldId: string | null;
}

export type RealtimeEvent =
  | { type: "change"; scope: "db" | "workspace"; databaseId: string | null }
  | { type: "presence"; databaseId: string; viewers: PublicViewer[] };

interface ViewerState extends PublicViewer {
  lastSeen: number;
}

interface Hub {
  emitter: EventEmitter;
  /** databaseId -> sessionId -> viewer */
  presence: Map<string, Map<string, ViewerState>>;
}

const STALE_MS = 60_000; // > 2x the 25s SSE heartbeat that touches viewers
const SWEEP_MS = 15_000;

function createHub(): Hub {
  const hub: Hub = { emitter: new EventEmitter(), presence: new Map() };
  hub.emitter.setMaxListeners(0); // unbounded subscribers (one per SSE client)

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [dbId, viewers] of hub.presence) {
      let changed = false;
      for (const [sid, v] of viewers) {
        if (now - v.lastSeen > STALE_MS) {
          viewers.delete(sid);
          changed = true;
        }
      }
      if (viewers.size === 0) hub.presence.delete(dbId);
      if (changed) broadcastPresence(hub, dbId);
    }
  }, SWEEP_MS);
  sweep.unref?.();
  return hub;
}

// Survive dev HMR + ensure a single instance per process.
const g = globalThis as unknown as { __urusHub?: Hub };
const hub: Hub = g.__urusHub ?? (g.__urusHub = createHub());

function viewersOf(databaseId: string): PublicViewer[] {
  const m = hub.presence.get(databaseId);
  if (!m) return [];
  return [...m.values()].map(
    ({ sessionId, name, color, editingRowId, editingFieldId }) => ({
      sessionId,
      name,
      color,
      editingRowId,
      editingFieldId,
    }),
  );
}

function broadcastPresence(h: Hub, databaseId: string): void {
  h.emitter.emit("event", {
    type: "presence",
    databaseId,
    viewers: viewersOf(databaseId),
  } satisfies RealtimeEvent);
}

export function subscribe(listener: (e: RealtimeEvent) => void): () => void {
  hub.emitter.on("event", listener);
  return () => hub.emitter.off("event", listener);
}

/** Emitted by every mutating server action (via revalidateDb / revalidateAll). */
export function publishChange(
  scope: "db" | "workspace",
  databaseId: string | null = null,
): void {
  hub.emitter.emit("event", {
    type: "change",
    scope,
    databaseId,
  } satisfies RealtimeEvent);
}

export function addViewer(
  databaseId: string,
  v: { sessionId: string; name: string; color: string },
): void {
  let m = hub.presence.get(databaseId);
  if (!m) {
    m = new Map();
    hub.presence.set(databaseId, m);
  }
  const prev = m.get(v.sessionId);
  m.set(v.sessionId, {
    ...v,
    editingRowId: prev?.editingRowId ?? null,
    editingFieldId: prev?.editingFieldId ?? null,
    lastSeen: Date.now(),
  });
  broadcastPresence(hub, databaseId);
}

export function removeViewer(databaseId: string, sessionId: string): void {
  const m = hub.presence.get(databaseId);
  if (!m) return;
  if (m.delete(sessionId)) {
    if (m.size === 0) hub.presence.delete(databaseId);
    broadcastPresence(hub, databaseId);
  }
}

export function touchViewer(databaseId: string, sessionId: string): void {
  const v = hub.presence.get(databaseId)?.get(sessionId);
  if (v) v.lastSeen = Date.now();
}

export function setEditing(
  databaseId: string,
  sessionId: string,
  editingRowId: string | null,
  editingFieldId: string | null = null,
): void {
  const v = hub.presence.get(databaseId)?.get(sessionId);
  if (!v) return;
  if (v.editingRowId === editingRowId && v.editingFieldId === editingFieldId) {
    v.lastSeen = Date.now();
    return;
  }
  v.editingRowId = editingRowId;
  v.editingFieldId = editingFieldId;
  v.lastSeen = Date.now();
  broadcastPresence(hub, databaseId);
}
