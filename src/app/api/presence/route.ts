import { getAuth } from "@/lib/auth";
import { setEditing, touchViewer } from "@/lib/realtime";

export const runtime = "nodejs";

// Client -> server presence signal: report which row the user is editing (or
// null on blur). Also doubles as a heartbeat touch. Broadcasting back to other
// clients happens inside setEditing().
export async function POST(req: Request) {
  if (!(await getAuth())) {
    return new Response("Unauthorized", { status: 401 });
  }
  let body: {
    databaseId?: string;
    sessionId?: string;
    editingRowId?: string | null;
    editingFieldId?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore malformed */
  }
  const databaseId = String(body.databaseId ?? "");
  const sessionId = String(body.sessionId ?? "");
  if (databaseId && sessionId) {
    const editingRowId = body.editingRowId ? String(body.editingRowId) : null;
    const editingFieldId =
      editingRowId && body.editingFieldId ? String(body.editingFieldId) : null;
    setEditing(databaseId, sessionId, editingRowId, editingFieldId);
    touchViewer(databaseId, sessionId);
  }
  return new Response("ok");
}
