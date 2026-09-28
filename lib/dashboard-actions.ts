import type { AuthContext } from "@/lib/authz";
import { LEASE_CONTRACT_TYPE_ID } from "@/lib/contract-constants";
import { getOrganizationOwnerMembershipId } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";

/**
 * What the landlord dashboard's Quick actions card has to say, worked out for
 * one viewer. Each figure is only fetched when the viewer could act on it —
 * a member without `payment:record` is never told about claims to confirm.
 *
 * Lease ids come back when every item sits on one lease, so the card can link
 * straight to it rather than to a list the landlord has to search.
 */
export type DashboardAttention = {
  /** The viewer's own membership has no drawn signature. */
  signatureMissing: boolean;
  /** The viewer is the Owner whose signature and payment details tenants see. */
  isContractLandlord: boolean;
  /** Only meaningful for the contract landlord: tenants are shown no way to pay. */
  paymentDetailsMissing: boolean;
  pendingClaims: { count: number; leaseId: string | null };
  leasesWithoutContract: { count: number; leaseId: string | null };
};

function singleLease(ids: string[]) {
  const unique = [...new Set(ids)];
  return unique.length === 1 ? unique[0] : null;
}

export async function getDashboardAttention(ctx: AuthContext): Promise<DashboardAttention> {
  const orgLease = {
    membership: { organizationId: ctx.organizationId },
    unit: { property: { organizationId: ctx.organizationId } },
  };

  const [membership, ownerMembershipId, claims, contractless] = await Promise.all([
    prisma.membership.findUnique({
      where: { id: ctx.membershipId },
      select: {
        profile: { select: { signatureKey: true } },
        _count: { select: { paymentAccounts: true } },
      },
    }),
    getOrganizationOwnerMembershipId(ctx.organizationId),
    ctx.permissions.has("payment:record")
      ? prisma.paymentClaim.findMany({
          where: { status: "PENDING", invoice: { lease: orgLease } },
          select: { invoice: { select: { leaseId: true } } },
        })
      : [],
    ctx.permissions.has("contract:generate")
      ? prisma.lease.findMany({
          where: {
            ...orgLease,
            status: { in: ["Active", "Upcoming"] },
            fileAssets: { none: { assetTypeId: LEASE_CONTRACT_TYPE_ID } },
          },
          select: { id: true },
        })
      : [],
  ]);

  const isContractLandlord = ownerMembershipId === ctx.membershipId;

  return {
    signatureMissing: !membership?.profile?.signatureKey,
    isContractLandlord,
    paymentDetailsMissing: isContractLandlord && (membership?._count.paymentAccounts ?? 0) === 0,
    pendingClaims: {
      count: claims.length,
      leaseId: singleLease(claims.map((c) => c.invoice.leaseId)),
    },
    leasesWithoutContract: {
      count: contractless.length,
      leaseId: singleLease(contractless.map((l) => l.id)),
    },
  };
}
