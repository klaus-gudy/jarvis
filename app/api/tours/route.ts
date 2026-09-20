import { getCurrentUser } from "@/lib/auth/session";
import { markTourSeen, resetToursSeen } from "@/lib/tour-progress";

/**
 * A person's own tour progress.
 *
 * Authenticated with `getCurrentUser` rather than `requireActiveOrg`: which
 * tours somebody has watched is theirs, not their organization's, and a user
 * who has not joined one yet still moves around an app that offers tours.
 *
 * There is no GET — the app layout reads the list server-side and hands it to
 * `TourProvider` as a prop, so a fetch here would only re-answer a question the
 * page already arrived knowing.
 */

async function requireUser() {
  const user = await getCurrentUser();
  if (user) return { ok: true as const, userId: user.id };
  return {
    ok: false as const,
    response: Response.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

/** Marks one tour seen, however it ended — finished or dismissed. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tourId =
    typeof body === "object" && body !== null && "tourId" in body
      ? (body as { tourId: unknown }).tourId
      : null;

  if (typeof tourId !== "string") {
    return Response.json({ error: "tourId is required" }, { status: 400 });
  }

  const seen = await markTourSeen(auth.userId, tourId);
  return Response.json({ seen });
}

/** Forgets every tour for this user. */
export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  await resetToursSeen(auth.userId);
  return Response.json({ seen: [] });
}
