import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/constants";

/**
 * Lightweight auth gate (Next 16 `proxy`, runs on the Node runtime). It only
 * checks for the PRESENCE of the session cookie; the cryptographic
 * verification happens in requireAuth()/getAuth() — a present-but-invalid
 * cookie still gets redirected by the page guard.
 *
 * The /api/uploads route guards itself (and must 404, not redirect, because
 * it's loaded as an <img>), so it's excluded here.
 */
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/uploads")) {
    return NextResponse.next();
  }

  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
