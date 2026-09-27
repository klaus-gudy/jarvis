import { revalidatePath } from "next/cache";

import { authorizeTenant } from "@/lib/authz";
import { updateOwnTenantProfile } from "@/lib/portal";
import { updateOwnProfileSchema } from "@/lib/portal-schemas";

/**
 * A tenant editing their own details. There is no id in the URL: the row is
 * always the caller's own membership, taken from the session context.
 */
export async function PATCH(request: Request) {
  const auth = await authorizeTenant();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateOwnProfileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await updateOwnTenantProfile(auth.context, parsed.data);

  revalidatePath("/portal", "layout");
  revalidatePath(`/members/${auth.context.membershipId}`);

  return Response.json({ ok: true });
}
