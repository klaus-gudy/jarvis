import { prisma } from "@/lib/prisma";

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
      role: { kind: "OWNER" as const },
    },
    select: { user: { select: { email: true, name: true } } },
  });

  // An owner with no address isn't an error, just unreachable by email.
  return memberships
    .map((membership) => membership.user)
    .filter((user) => user.email !== null);
}

/**
 * The tenant on a membership, when they can be emailed: only a **verified**
 * address. Landlords type tenants' emails in for them, and an unproven address
 * may belong to someone else — so mail waits until the tenant has used it
 * (email verification, an invitation sent to it, or a password reset).
 */
export async function getTenantRecipient(membershipId: string): Promise<Recipient | null> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: {
      role: { select: { kind: true } },
      user: { select: { email: true, name: true, emailVerifiedAt: true } },
    },
  });
  if (!membership || membership.role.kind !== "TENANT") return null;
  const { email, name, emailVerifiedAt } = membership.user;
  return email && emailVerifiedAt ? { email, name } : null;
}
