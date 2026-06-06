import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { basePath } from "./url";

// "covers" = a row's cover image (rows.cover_path).
// "fields" = an image/file field's cell value.
export type UploadKind = "covers" | "fields";
const KINDS: UploadKind[] = ["covers", "fields"];

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

function safeExt(filename: string | undefined, mime: string): string {
  const fromMime = ALLOWED_TYPES[mime];
  if (fromMime) return fromMime;
  const m = filename?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/);
  return m ? m[1].replace("jpeg", "jpg") : "bin";
}

/**
 * Save an uploaded image. Returns the relative path (e.g. `covers/abc.png`)
 * on success, or null when there's no real file / it's too big / wrong type —
 * tolerated silently so optional file fields don't blow up a form submit.
 */
export async function saveUpload(
  file: unknown,
  kind: UploadKind,
): Promise<string | null> {
  if (!(file instanceof File)) return null;
  if (file.size === 0) return null;
  if (file.size > MAX_BYTES) return null;
  if (!ALLOWED_TYPES[file.type]) return null;

  const ext = safeExt(file.name, file.type);
  const id = nanoid(24);
  const rel = `${kind}/${id}.${ext}`;
  const abs = join(UPLOAD_DIR, rel);

  await mkdir(join(UPLOAD_DIR, kind), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, bytes);

  return rel;
}

/** Best-effort delete of an uploaded file. Swallows missing-file errors. */
export async function deleteUpload(
  relativePath: string | null | undefined,
): Promise<void> {
  if (!relativePath) return;
  if (!isSafeRelativePath(relativePath)) return;
  try {
    await unlink(join(UPLOAD_DIR, relativePath));
  } catch {
    // ignore — file may already be gone
  }
}

export function uploadAbsolutePath(relativePath: string): string {
  return join(UPLOAD_DIR, relativePath);
}

/** Copy an uploaded file to a fresh path (so duplicated rows don't share a
 *  file that delete-cleanup would later orphan). Returns the new rel path. */
export async function copyUpload(
  rel: string | null | undefined,
): Promise<string | null> {
  if (!rel || !isSafeRelativePath(rel)) return null;
  const [kind, file] = rel.split("/");
  const ext = file.split(".").pop() ?? "bin";
  const newRel = `${kind}/${nanoid(24)}.${ext}`;
  try {
    const data = await readFile(join(UPLOAD_DIR, rel));
    await mkdir(join(UPLOAD_DIR, kind), { recursive: true });
    await writeFile(join(UPLOAD_DIR, newRel), data);
    return newRel;
  } catch {
    return null;
  }
}

/** Public URL for an uploaded file. Respects NEXT_PUBLIC_BASE_PATH. */
export function publicUploadUrl(relativePath: string): string {
  return `${basePath()}/api/uploads/${relativePath}`;
}

/**
 * Validates that a relative path is exactly `<kind>/<file>` with a known kind,
 * no traversal, and a sane image filename. Used by the upload-serving route.
 * NOTE: the kind check here MUST include every UploadKind or those images 404.
 */
export function isSafeRelativePath(rel: string): boolean {
  const parts = rel.split("/");
  if (parts.length !== 2) return false;
  const [kind, file] = parts;
  if (!KINDS.includes(kind as UploadKind)) return false;
  return /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/.test(file);
}

export function mimeFor(file: string): string {
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
