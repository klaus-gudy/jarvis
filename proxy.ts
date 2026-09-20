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

/**
 * Pages served to anyone, session or not.
 *
 * `/payment-complete` is here because the browser reaching it has just been
 * redirected off a payment gateway's domain — a bounce to `/login` at that
 * moment tells somebody who has just paid that we don't know who they are.
 *
 * Note these are **prefix** matches, so an entry must be specific enough not to
 * swallow a route beside it: `/payment-complete` is safe, a shortened
 * `/payment` would not be — it would match `/payments`, the signed-in ledger,
 * and open the whole org's rent roll to the internet.
 */
const PUBLIC_PAGES = ["/invite", "/opengraph-image", "/payment-complete"];

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
