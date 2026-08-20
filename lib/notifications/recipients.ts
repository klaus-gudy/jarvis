import { prisma } from "@/lib/prisma";
import { OWNER_ROLE_NAME } from "@/lib/roles";

export type Recipient = { email: string | null; name: string | null };

/**
 * Everyone holding the Owner role in an organization.
 *
 * Plural, unlike `getOrganizationOwnerName` in `lib/organizations.ts`, which
 * picks the oldest to *label* a property. A notice about money or a lease has
 * to reach every owner, not the one who happens to sort first — and the role
 * name is matched loosely because role names are free text and editable, the
 * same way every other Owner lookup here does it.
 */
export async function getOwnerRecipients(
  organizationId: string
): Promise<Recipient[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId,
      role: { name: { equals: OWNER_ROLE_NAME, mode: "insensitive" } },
    },
    select: { user: { select: { email: true, name: true } } },
  });

  // An owner with no address isn't an error, just unreachable by email.
  return memberships
    .map((membership) => membership.user)
    .filter((user) => user.email !== null);
}
