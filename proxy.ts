import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

/** Signed-out only — a signed-in visitor is bounced back into the app. */
const AUTH_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
];
/**
 * Reachable signed out: the recipient of an invite has no account yet, and the
 * token in the URL is what authorises them.
 *
 * `/opengraph-image` is the landing page's generated share card. `robots.txt`
 * and `sitemap.xml` fall outside the matcher below on their extensions, but the
 * image route is served without one — so without this entry a crawler fetching
 * the card would be handed a redirect to `/login` and every shared link would
 * unfurl blank.
 */
const PUBLIC_PAGES = ["/invite", "/opengraph-image"];

/** Where a signed-in visitor belongs — the app, never the marketing page. */
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

  /*
   * `/` is the public landing page, so it is the one route reachable in both
   * states — and the only one whose destination depends on the session rather
   * than merely being allowed or denied. A signed-in visitor never sees it:
   * they are already a customer, and the page exists to convince someone who
   * isn't. Handled before the auth-page branch because `/` is neither an auth
   * page nor, for a signed-out visitor, a protected one.
   */
  if (pathname === "/") {
    return session
      ? NextResponse.redirect(new URL(APP_HOME, request.url))
      : NextResponse.next();
  }

  /*
   * `APP_HOME`, not `/`: login and register both `router.push("/")`, and now
   * that `/` is marketing, bouncing through it would land a freshly signed-in
   * user on the sales page and rely on a second redirect to rescue them.
   */
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
