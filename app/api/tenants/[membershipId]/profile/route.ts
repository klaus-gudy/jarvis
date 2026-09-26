import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { authorizeMemberTarget } from "@/lib/member-access";
import { updateMemberProfileSchema } from "@/lib/member-profile-schemas";
import { updateMemberProfile } from "@/lib/tenants";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tenants/[membershipId]/profile">
) {
  // Any member's profile (the member page serves staff too), so the
  // permission depends on whose it is — see `canManageMember`.
  const auth = await authorize();
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
  const access = await authorizeMemberTarget(auth.context, membershipId);
  if (!access.ok) return access.response;

  const result = await updateMemberProfile(
    auth.context.organizationId,
    membershipId,
    parsed.data
  );

  if (result.error === "not-found") {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  revalidatePath(`/members/${membershipId}`);
  revalidatePath("/tenants");
  revalidatePath("/users");

  return Response.json({ ok: true });
}
