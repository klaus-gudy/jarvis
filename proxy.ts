import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

const AUTH_PAGES = ["/login", "/register"];
/**
 * Reachable signed out: the recipient of an invite has no account yet, and the
 * token in the URL is what authorises them.
 */
const PUBLIC_PAGES = ["/invite"];

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  const isPublicPage = PUBLIC_PAGES.some((page) => pathname.startsWith(page));

  if (isPublicPage) {
    return NextResponse.next();
  }

  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!session && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes (they enforce auth themselves), Next
  // internals, and static files with an extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
