import { getCurrentUser } from "@/lib/auth/session";

type ActiveOrg = { userId: string; organizationId: string };

/**
 * Every property route needs the same two checks, and both failures are
 * responses rather than data — so return one or the other.
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
