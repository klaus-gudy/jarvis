import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { updateMemberProfileSchema } from "@/lib/member-profile-schemas";
import { updateMemberProfile } from "@/lib/tenants";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tenants/[membershipId]/profile">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateMemberProfileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { membershipId } = await ctx.params;
  const result = await updateMemberProfile(
    auth.context.organizationId,
    membershipId,
    parsed.data
  );

  if (result.error === "not-found") {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  revalidatePath(`/tenants/${membershipId}`);
  revalidatePath("/tenants");

  return Response.json({ ok: true });
}
