import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { authorize } from "@/lib/authz";
import { invitationDelivery, resendInvitation } from "@/lib/invitations";

/**
 * A new link for a pending invitation. The token is only ever shown once, so
 * this is how a lost or expired link is recovered: it replaces the token (the
 * old link stops working), resets the expiry and emails it again where the
 * role allows. The response has the same shape as creating one, so the dialog
 * can show the link the same way.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/invitations/[id]/resend">) {
  const auth = await authorize("member:invite");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await resendInvitation(auth.context, id);
  if (result.error === "not-found") {
    return Response.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (result.error === "forbidden") {
    return Response.json({ error: "Only an Owner can invite an Owner" }, { status: 403 });
  }
  if (result.error === "escalation") {
    return Response.json(
      { error: "That role has permissions you don't hold yourself" },
      { status: 403 }
    );
  }

  const delivery = invitationDelivery({
    inviterUserId: auth.context.userId,
    email: result.email,
    name: result.name,
    roleName: result.roleName,
    roleKind: result.roleKind,
    organizationName: result.organizationName,
    token: result.token,
    expiresInDays: result.expiresInDays,
  });
  after(delivery.send);

  revalidatePath("/users");
  return Response.json({
    invitation: result.invitation,
    token: result.token,
    emailed: delivery.emailed,
    emailedTo: delivery.emailed ? result.email : null,
    emailSuppressedForRole: delivery.emailSuppressedForRole,
  });
}
