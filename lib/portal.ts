import type { AuthContext } from "@/lib/authz";
import { LEASE_CONTRACT_TYPE_ID } from "@/lib/contract-constants";
import { deriveInvoiceStatus, type InvoiceStatus } from "@/lib/invoice-types";
import { leaseReference, type LeaseStatus } from "@/lib/leases";
import { prisma } from "@/lib/prisma";

/**
 * Everything the tenant portal reads. Every query is pinned to the caller's
 * **own membership** (`ctx.membershipId`) as well as the organization — an id
 * from the URL is never enough on its own. That is the whole security model of
 * the portal: a tenant can reach their own leases, invoices, payments and
 * files, and nothing else exists as far as these functions are concerned.
 */

export type PortalLease = {
  id: string;
  reference: string;
  propertyName: string;
  unitLabel: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  status: LeaseStatus;
  invoice: {
    amount: number;
    paid: number;
    balance: number;
    status: InvoiceStatus;
    payments: { id: string; amount: number; paidAt: Date; method: string | null }[];
  } | null;
  contract: { id: string; fileName: string } | null;
};

export type PortalOverview = {
  name: string | null;
  organizationName: string;
  signatureKey: string | null;
  leases: PortalLease[];
  documents: { id: string; fileName: string; label: string; createdAt: Date }[];
};

/** Leases are this tenant's *and* on a unit in this organization. */
function ownLeases(ctx: AuthContext) {
  return {
    membershipId: ctx.membershipId,
    membership: { organizationId: ctx.organizationId },
    unit: { property: { organizationId: ctx.organizationId } },
  };
}

export async function getPortalOverview(ctx: AuthContext): Promise<PortalOverview | null> {
  const membership = await prisma.membership.findFirst({
    where: { id: ctx.membershipId, organizationId: ctx.organizationId },
    select: {
      user: { select: { name: true } },
      organization: { select: { name: true } },
      profile: { select: { signatureKey: true } },
    },
  });
  if (!membership) return null;

  const [leases, documents] = await Promise.all([
    prisma.lease.findMany({
      where: ownLeases(ctx),
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        status: true,
        unit: { select: { label: true, property: { select: { name: true } } } },
        invoice: {
          select: {
            amount: true,
            payments: {
              orderBy: { paidAt: "desc" },
              select: { id: true, amount: true, paidAt: true, method: true },
            },
          },
        },
        fileAssets: {
          where: { assetTypeId: LEASE_CONTRACT_TYPE_ID },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, fileName: true },
        },
      },
    }),
    // Files filed under the tenant themself (ID copy, profile photo…).
    prisma.fileAsset.findMany({
      where: { organizationId: ctx.organizationId, membershipId: ctx.membershipId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        createdAt: true,
        assetType: { select: { label: true } },
      },
    }),
  ]);

  return {
    name: membership.user.name,
    organizationName: membership.organization.name,
    signatureKey: membership.profile?.signatureKey ?? null,
    leases: leases.map((lease) => {
      const paid = lease.invoice?.payments.reduce((sum, p) => sum + p.amount, 0) ?? 0;
      return {
        id: lease.id,
        reference: leaseReference(lease.id),
        propertyName: lease.unit.property.name,
        unitLabel: lease.unit.label,
        startDate: lease.startDate,
        endDate: lease.endDate,
        monthlyRent: lease.monthlyRent,
        // The stored column — it alone knows about Renewed.
        status: lease.status,
        invoice: lease.invoice
          ? {
              amount: lease.invoice.amount,
              paid,
              balance: lease.invoice.amount - paid,
              status: deriveInvoiceStatus(lease.invoice.amount, paid),
              payments: lease.invoice.payments,
            }
          : null,
        contract: lease.fileAssets[0] ?? null,
      };
    }),
    documents: documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      label: doc.assetType.label,
      createdAt: doc.createdAt,
    })),
  };
}

/**
 * One file the tenant may download: filed under one of *their* leases or
 * under their own membership. Anything else reads as not found.
 */
export async function getPortalDocument(ctx: AuthContext, id: string) {
  return prisma.fileAsset.findFirst({
    where: {
      id,
      organizationId: ctx.organizationId,
      OR: [{ membershipId: ctx.membershipId }, { lease: ownLeases(ctx) }],
    },
    select: { id: true, objectKey: true, fileName: true, fileType: true },
  });
}
