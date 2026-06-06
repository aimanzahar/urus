import { getAuth } from "@/lib/auth";
import {
  addViewer,
  removeViewer,
  subscribe,
  touchViewer,
  type RealtimeEvent,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events stream. One connection per client tab. Carries:
//  - `change` events (this database + all workspace-structural changes)
//  - `presence` events (viewer list for this database, incl. who's editing)
// The connection itself registers/unregisters presence (join on open, leave on
// disconnect) and sends a heartbeat so dead connections get cleaned up.
export async function GET(req: Request) {
  // Must NOT redirect (EventSource can't follow to HTML) — 401 instead.
  if (!(await getAuth())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const databaseId = url.searchParams.get("db") || "";
  const sessionId = url.searchParams.get("sid") || "";
  const name = (url.searchParams.get("name") || "Someone").slice(0, 40);
  const color = url.searchParams.get("color") || "#5b5bd6";

  const enc = new TextEncoder();
  let closed = false;
  let unsub: () => void = () => {};
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (ping) clearInterval(ping);
        unsub();
        if (databaseId && sessionId) removeViewer(databaseId, sessionId);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const write = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          close();
        }
      };

      write("retry: 3000\n\n");

      unsub = subscribe((e: RealtimeEvent) => {
        if (e.type === "change") {
          if (e.scope === "workspace" || e.databaseId === databaseId) {
            write(`data: ${JSON.stringify(e)}\n\n`);
          }
        } else if (e.type === "presence" && e.databaseId === databaseId) {
          write(`data: ${JSON.stringify(e)}\n\n`);
        }
      });

      if (databaseId && sessionId) {
        addViewer(databaseId, { sessionId, name, color });
      }

      ping = setInterval(() => {
        // Keep this connected viewer fresh so the stale-sweep doesn't drop
        // someone who's just viewing (not editing).
        if (databaseId && sessionId) touchViewer(databaseId, sessionId);
        write(": ping\n\n");
      }, 25_000);
      ping.unref?.();

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx) so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
