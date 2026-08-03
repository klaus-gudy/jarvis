import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, createSession } from "@/lib/auth/session";
import { createOrganizationForUser } from "@/lib/organizations";

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(100),
});

/**
 * Deliberately does NOT use requireActiveOrg: the whole point is that the
 * caller has no organization yet. It only requires a signed-in user.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const organization = await createOrganizationForUser(user.id, parsed.data.name);

  // The session carries the active org, so re-issue it or the user would land
  // back in the "no organization" state they just resolved.
  await createSession(user.id, organization.id);

  revalidatePath("/", "layout");

  return Response.json(
    { organization: { id: organization.id, name: organization.name } },
    { status: 201 }
  );
}
