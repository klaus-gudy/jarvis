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
const PUBLIC_PAGES = ["/invite", "/opengraph-image", "/payment-complete", "/subscribe"];

const APP_HOME = "/dashboard";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery, defence in depth. The session cookie is
 * `SameSite=Lax`, which already keeps it off cross-site POSTs; this refuses any
 * state-changing API call whose `Origin` names another site, so the guarantee
 * doesn't rest on one cookie attribute (or on every browser honouring it).
 * No `Origin` at all is let through: that is a server-to-server caller — the
 * snippe webhook, the cron — which carries no cookie to ride on anyway.
 */
function crossSiteMutation(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return false;
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true; // "null" (a sandboxed frame) or garbage
  }
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")];
  return !hosts.some((host) => host && host.split(",")[0]!.trim() === originHost);
}

export async function proxy(request: NextRequest) {
  // API routes enforce auth themselves; the proxy only screens their origin.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return crossSiteMutation(request)
      ? Response.json({ error: "Cross-site request refused" }, { status: 403 })
      : NextResponse.next();
  }

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
  // Pages: everything except Next internals and static files with an
  // extension. API routes: only for the origin screen above.
  matcher: ["/((?!api|_next|.*\\..*).*)", "/api/:path*"],
};
