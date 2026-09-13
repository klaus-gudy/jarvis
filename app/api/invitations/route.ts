import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { requireActiveOrg } from "@/lib/api-auth";
import { createInvitation, getInvitations } from "@/lib/invitations";
import { mayEmailInvitation } from "@/lib/mail/config";
import { sendInvitationEmail } from "@/lib/mail/invitations";
import { tzPhoneSchema } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

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
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const invitations = await getInvitations(auth.context.organizationId);
  return Response.json({ invitations });
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
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

  const result = await createInvitation(auth.context.organizationId, parsed.data);
  if (result.error === "role-not-found") {
    return Response.json({ error: "Role not found" }, { status: 404 });
  }

  /*
   * Email the link, if there is an address to email it to.
   *
   * Inside `after()` and never awaited: the invitation is already committed,
   * and `publishMail` swallows its own failures, so a broker that is down means
   * the invite has to be shared by hand — not that creating it fails. The
   * dialog still shows the copyable link either way, which is what makes this
   * safe to treat as best-effort rather than as part of the operation.
   */
  /*
   * Two independent reasons not to email: there is no address, or the role is
   * one this deployment never mails — `Tenant` by default. Decided here rather
   * than inside the sender so the response can say which happened, and so the
   * dialog can tell the inviter to share the link themselves instead of
   * leaving them waiting for a message that is never coming.
   */
  const invitedEmail = parsed.data.email ?? null;
  const roleMayBeEmailed = mayEmailInvitation(result.roleName);
  const willEmail = Boolean(invitedEmail) && roleMayBeEmailed;

  after(async () => {
    if (!willEmail) return;

    // The inviter's name, for "X invited you". Read here rather than in the
    // request because nothing in the response depends on it.
    const inviter = await prisma.user.findUnique({
      where: { id: auth.context.userId },
      select: { name: true },
    });

    await sendInvitationEmail({
      to: invitedEmail,
      name: parsed.data.name ?? null,
      organizationName: result.organizationName,
      roleName: result.roleName,
      invitedByName: inviter?.name ?? null,
      token: result.token,
      expiresInDays: result.expiresInDays,
    });
  });

  revalidatePath("/users");

  // The raw token is returned once so the UI can build a shareable link; it is
  // never stored in plaintext and cannot be retrieved again.
  return Response.json(
    {
      invitation: result.invitation,
      token: result.token,
      // Whether an email is on its way, so the dialog can say so rather than
      // leaving the inviter to guess. `true` means queued, not delivered.
      emailed: willEmail,
      /*
       * Set when an address was given but the role is not one this deployment
       * emails. Distinct from `emailed: false` with no address at all: one is
       * a policy, the other is a missing field, and the dialog says something
       * different for each.
       */
      emailSuppressedForRole: Boolean(invitedEmail) && !roleMayBeEmailed
        ? result.roleName
        : null,
    },
    { status: 201 }
  );
}
