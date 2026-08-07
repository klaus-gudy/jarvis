import { z } from "zod";

import { organizationNameExists } from "@/lib/organizations";

const querySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

/**
 * Public, like `POST /api/organizations`'s reasoning for skipping
 * `requireActiveOrg`: this runs from the registration form, before an account
 * exists to authenticate. It only answers yes/no on a name — nothing about an
 * organization's membership or data is exposed.
 */
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const parsed = querySchema.safeParse({ name });
  if (!parsed.success) {
    return Response.json({ error: "Invalid organization name" }, { status: 400 });
  }

  const exists = await organizationNameExists(parsed.data.name);
  return Response.json({ available: !exists });
}
