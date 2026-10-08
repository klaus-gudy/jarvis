import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { authorize } from "@/lib/authz";
import { createInvitation, getInvitations, invitationDelivery } from "@/lib/invitations";
import { tzPhoneSchema } from "@/lib/phone";

// Phone is mandatory for every member — it is the identifier the business
// actually reaches people on, so no member may be recorded without one.
const createInvitationSchema = z.object({
  name: z.string().trim().max(100).optional(),
  phone: tzPhoneSchema,
  email: z
    .literal("")
    .transform(() => undefined)
    .or(z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")))
    .optional(),
  roleId: z.string().min(1, "Pick a role"),
});

export async function GET() {
  const auth = await authorize(["member:read", "member:invite"]);
  if (!auth.ok) return auth.response;

  const invitations = await getInvitations(auth.context.organizationId);
  return Response.json({ invitations });
}

export async function POST(request: Request) {
  const auth = await authorize("member:invite");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await createInvitation(auth.context, parsed.data);
  if (result.error === "role-not-found") {
    return Response.json({ error: "Role not found" }, { status: 404 });
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

  /*
   * Email the link, if there is an address and the role is one this
   * deployment emails. Inside `after()` and never awaited: the invitation is
   * committed, `publishMail` swallows its own failures, and the dialog shows
   * the copyable link either way — so a broker that is down means sharing by
   * hand, not a failed invitation.
   */
  const delivery = invitationDelivery({
    inviterUserId: auth.context.userId,
    email: parsed.data.email ?? null,
    name: parsed.data.name ?? null,
    roleName: result.roleName,
    roleKind: result.roleKind,
    organizationName: result.organizationName,
    token: result.token,
    expiresInDays: result.expiresInDays,
  });
  after(delivery.send);

  revalidatePath("/users");

  // The raw token is returned once so the UI can build a shareable link; it is
  // never stored in plaintext and cannot be retrieved again.
  return Response.json(
    {
      invitation: result.invitation,
      token: result.token,
      // Whether an email is on its way, so the dialog can say so rather than
      // leaving the inviter to guess. `true` means queued, not delivered.
      emailed: delivery.emailed,
      /*
       * Set when an address was given but the role is not one this deployment
       * emails. Distinct from `emailed: false` with no address at all: one is
       * a policy, the other is a missing field, and the dialog says something
       * different for each.
       */
      emailSuppressedForRole: delivery.emailSuppressedForRole,
    },
    { status: 201 }
  );
}
