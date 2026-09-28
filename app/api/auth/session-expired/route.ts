import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Clears a dead session cookie and lands on `/login`. See
 * `SESSION_EXPIRED_PATH` in `lib/auth/session.ts` for why pages come here
 * rather than redirecting to `/login` themselves. Clearing a cookie grants
 * nothing, so no auth check is needed.
 */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
