import { needsEmailVerification } from "@/lib/auth/email-verification";
import { getCurrentUser } from "@/lib/auth/session";

type ActiveOrg = { userId: string; organizationId: string };

/**
 * Every property route needs the same three checks, and each failure is a
 * response rather than data — so return one or the other.
 *
 * The verification check lives here rather than only in the app layout because
 * a layout redirect is a UI courtesy, not a boundary: the API is reachable
 * directly, and a gate that only covers the pages is theatre.
 */
export async function requireActiveOrg(): Promise<
  { ok: true; context: ActiveOrg } | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (needsEmailVerification(user)) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Verify your email address to continue",
          reason: "email-unverified",
        },
        { status: 403 }
      ),
    };
  }
  if (!user.activeOrgId) {
    return {
      ok: false,
      response: Response.json(
        { error: "No active organization" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, context: { userId: user.id, organizationId: user.activeOrgId } };
}
