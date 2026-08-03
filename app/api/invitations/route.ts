import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActiveOrg } from "@/lib/api-auth";
import { createInvitation, getInvitations } from "@/lib/invitations";

// Phone is mandatory for every member — it is the identifier the business
// actually reaches people on, so no member may be recorded without one.
const createInvitationSchema = z.object({
  name: z.string().trim().max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number"),
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

  revalidatePath("/users");

  // The raw token is returned once so the UI can build a shareable link; it is
  // never stored in plaintext and cannot be retrieved again.
  return Response.json(
    { invitation: result.invitation, token: result.token },
    { status: 201 }
  );
}
