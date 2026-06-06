/**
 * The path prefix the app is served under (e.g. `/plan` behind the gateway,
 * or `""` for local dev). `NEXT_PUBLIC_BASE_PATH` is a compile-time value, so
 * this is safe to read on both server and client.
 */
export function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

/** Client-safe URL for an uploaded file (rel = "covers/abc.png"). */
export function uploadUrl(rel: string): string {
  return `${basePath()}/api/uploads/${rel}`;
}
