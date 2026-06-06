import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { basePath } from "./url";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function appPassword(): string {
  // Default keeps local `pnpm dev` working out of the box; override in prod.
  return process.env.APP_PASSWORD || "changeme";
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

/** Constant-time string compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do a comparison to keep timing roughly constant.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  return safeEqual(input, appPassword());
}

/**
 * The cookie value is a signed token: `<issuedAt>.<hmac>`. Because there are
 * no per-user accounts yet, the payload is just the issue time — enough to
 * sign and expire. Re-deriving the HMAC from the secret verifies authenticity.
 */
export function signSession(issuedAt: number): string {
  const payload = String(issuedAt);
  const mac = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${mac}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");
  if (!safeEqual(mac, expected)) return false;
  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt)) return false;
  return Date.now() - issuedAt < MAX_AGE_SECONDS * 1000;
}

export interface SessionCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
  };
}

/**
 * Whether THIS request is HTTPS. Driven by the actual request protocol so the
 * cookie works over plain HTTP on a LAN IP (Secure cookies are dropped over
 * http on non-localhost hosts) yet still gets `Secure` when fronted by an
 * HTTPS reverse proxy (which sets X-Forwarded-Proto: https).
 */
async function isHttps(): Promise<boolean> {
  const h = await headers();
  return (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
}

/** Builds the cookie to set on successful login. */
export async function newSessionCookie(): Promise<SessionCookie> {
  return {
    name: SESSION_COOKIE,
    value: signSession(Date.now()),
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: await isHttps(),
      // Scope to the basePath so a `/plan`-mounted app doesn't loop.
      path: basePath() || "/",
      maxAge: MAX_AGE_SECONDS,
    },
  };
}

export async function clearedSessionCookie(): Promise<SessionCookie> {
  const base = await newSessionCookie();
  return { ...base, value: "", options: { ...base.options, maxAge: 0 } };
}

/** Boolean check — used where we must NOT redirect (e.g. the image route). */
export async function getAuth(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Redirect-to-login guard — used by pages and server actions. */
export async function requireAuth(): Promise<void> {
  if (!(await getAuth())) redirect("/login");
}
