import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

const AUTH_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
];

const PUBLIC_PAGES = ["/invite", "/opengraph-image"];

const APP_HOME = "/dashboard";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  const isPublicPage = PUBLIC_PAGES.some((page) => pathname.startsWith(page));

  if (isPublicPage) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return session
      ? NextResponse.redirect(new URL(APP_HOME, request.url))
      : NextResponse.next();
  }

  if (session && isAuthPage) {
    return NextResponse.redirect(new URL(APP_HOME, request.url));
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
