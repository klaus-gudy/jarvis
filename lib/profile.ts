import { prisma } from "@/lib/prisma";
import { getOrganizationOwnerName } from "@/lib/organizations";
import { getPaymentAccounts, type PaymentAccountRow } from "@/lib/payment-accounts";
import { OWNER_ROLE_NAME } from "@/lib/roles";

export type ProfilePersonal = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type ProfileOrganization = {
  id: string;
  name: string;
  roleName: string;
  ownerName: string;
  joinedAt: Date;
  createdAt: Date;
  memberCount: number;
  propertyCount: number;
};

export type Profile = {
  personal: ProfilePersonal;
  /** Null when the signed-in user belongs to no organization. */
  organization: ProfileOrganization | null;
  /**
   * A member onboarded by staff has no password yet, so there is nothing to
   * change — the account settings group says so instead of offering the form.
   */
  canSignIn: boolean;
  /** Payment accounts are the owner's, so only an Owner manages them. */
  isOwner: boolean;
  membershipId: string | null;
  paymentAccounts: PaymentAccountRow[];
};

const EMPTY: Profile = {
  personal: { name: null, phone: null, email: null },
  organization: null,
  canSignIn: false,
  isOwner: false,
  membershipId: null,
  paymentAccounts: [],
};

/**
 * Everything the /profile page renders. Scoped to the signed-in user and their
 * *active* organization — `getCurrentUser` has already validated that claim
 * against live memberships, so a revoked membership can't surface here.
 *
 * The user and the membership are fetched separately rather than as one nested
 * select: the membership half is conditional on there being an active org, and
 * a conditional `select` collapses Prisma's inferred type back to the bare
 * scalar row.
 */
export async function getProfile(
  userId: string,
  activeOrgId: string | null
): Promise<Profile> {
  const [user, membership, paymentAccounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, email: true, passwordHash: true },
    }),
    activeOrgId
      ? prisma.membership.findFirst({
          where: { userId, organizationId: activeOrgId },
          select: {
            id: true,
            createdAt: true,
            role: { select: { name: true } },
            organization: {
              select: {
                id: true,
                name: true,
                createdAt: true,
                _count: { select: { memberships: true, properties: true } },
              },
            },
          },
        })
      : null,
    activeOrgId
      ? getPaymentAccounts({ userId, organizationId: activeOrgId })
      : [],
  ]);

  if (!user) return EMPTY;

  const personal: ProfilePersonal = {
    name: user.name,
    phone: user.phone,
    email: user.email,
  };
  const canSignIn = user.passwordHash !== null;

  if (!membership) {
    return { ...EMPTY, personal, canSignIn };
  }

  // Role names are free text and editable, so match the way every other guard
  // in the codebase does rather than on an exact string.
  const isOwner =
    membership.role.name.toLowerCase() === OWNER_ROLE_NAME.toLowerCase();

  return {
    personal,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      roleName: membership.role.name,
      ownerName: await getOrganizationOwnerName(membership.organization.id),
      joinedAt: membership.createdAt,
      createdAt: membership.organization.createdAt,
      memberCount: membership.organization._count.memberships,
      propertyCount: membership.organization._count.properties,
    },
    canSignIn,
    isOwner,
    membershipId: membership.id,
    paymentAccounts,
  };
}
