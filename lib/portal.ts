import type { AuthContext } from "@/lib/authz";
import { LEASE_CONTRACT_TYPE_ID } from "@/lib/contract-constants";
import { calendarDaysBetween, startOfTodayUtc } from "@/lib/dates";
import { deriveInvoiceStatus, type InvoiceStatus } from "@/lib/invoice-types";
import { leaseExpiry, leaseReference, type LeaseExpiry, type LeaseStatus } from "@/lib/leases";
import { prisma } from "@/lib/prisma";

/**
 * Everything the tenant portal reads. Every query is pinned to the caller's
 * **own membership** (`ctx.membershipId`) as well as the organization — an id
 * from the URL is never enough on its own. That is the whole security model of
 * the portal: a tenant can reach their own leases, invoices, payments and
 * files, and nothing else exists as far as these functions are concerned.
 */

export type PortalPayment = {
  id: string;
  amount: number;
  paidAt: Date;
  method: string | null;
};

export type PortalLease = {
  id: string;
  reference: string;
  propertyName: string;
  unitLabel: string;
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  monthlyRent: number;
  leaseAmount: number;
  status: LeaseStatus;
  /** Days until the end date while the lease is running, else null. */
  daysLeft: number | null;
  /** Set inside 60 days of the end — the same tiers the staff tables use. */
  expiry: LeaseExpiry | null;
  invoice: {
    amount: number;
    dueDate: Date;
    paid: number;
    balance: number;
    status: InvoiceStatus;
    payments: PortalPayment[];
  } | null;
  contract: { id: string; fileName: string } | null;
};

export type PortalMember = {
  name: string | null;
  phone: string | null;
  email: string | null;
  organizationName: string;
  signatureKey: string | null;
  canSignIn: boolean;
  profile: {
    occupation: string | null;
    employer: string | null;
    nationality: string | null;
    nidaNumber: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
  };
};

export type PortalDocument = {
  id: string;
  fileName: string;
  label: string;
  createdAt: Date;
};

/** Leases are this tenant's *and* on a unit in this organization. */
function ownLeases(ctx: AuthContext) {
  return {
    membershipId: ctx.membershipId,
    membership: { organizationId: ctx.organizationId },
    unit: { property: { organizationId: ctx.organizationId } },
  };
}

/** The tenant themself: contact details, profile fields and signature. */
export async function getPortalMember(ctx: AuthContext): Promise<PortalMember | null> {
  const membership = await prisma.membership.findFirst({
    where: { id: ctx.membershipId, organizationId: ctx.organizationId },
    select: {
      user: { select: { name: true, phone: true, email: true, passwordHash: true } },
      organization: { select: { name: true } },
      profile: {
        select: {
          signatureKey: true,
          occupation: true,
          employer: true,
          nationality: true,
          nidaNumber: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          emergencyContactRelation: true,
        },
      },
    },
  });
  if (!membership) return null;

  const profile = membership.profile;
  return {
    name: membership.user.name,
    phone: membership.user.phone,
    email: membership.user.email,
    organizationName: membership.organization.name,
    signatureKey: profile?.signatureKey ?? null,
    canSignIn: membership.user.passwordHash !== null,
    profile: {
      occupation: profile?.occupation ?? null,
      employer: profile?.employer ?? null,
      nationality: profile?.nationality ?? null,
      nidaNumber: profile?.nidaNumber ?? null,
      emergencyContactName: profile?.emergencyContactName ?? null,
      emergencyContactPhone: profile?.emergencyContactPhone ?? null,
      emergencyContactRelation: profile?.emergencyContactRelation ?? null,
    },
  };
}

/** Every lease this tenant holds here, newest first, with invoice and contract. */
export async function getPortalLeases(ctx: AuthContext): Promise<PortalLease[]> {
  const now = new Date();
  const today = startOfTodayUtc(now);

  const leases = await prisma.lease.findMany({
    where: ownLeases(ctx),
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      durationMonths: true,
      monthlyRent: true,
      leaseAmount: true,
      status: true,
      unit: { select: { label: true, property: { select: { name: true } } } },
      invoice: {
        select: {
          amount: true,
          dueDate: true,
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
  });

  return leases.map((lease) => {
    const paid = lease.invoice?.payments.reduce((sum, p) => sum + p.amount, 0) ?? 0;
    return {
      id: lease.id,
      reference: leaseReference(lease.id),
      propertyName: lease.unit.property.name,
      unitLabel: lease.unit.label,
      startDate: lease.startDate,
      endDate: lease.endDate,
      durationMonths: lease.durationMonths,
      monthlyRent: lease.monthlyRent,
      leaseAmount: lease.leaseAmount,
      // The stored column — it alone knows about Renewed.
      status: lease.status,
      daysLeft:
        lease.status === "Active" ? Math.max(0, calendarDaysBetween(today, lease.endDate)) : null,
      expiry: lease.status === "Active" ? leaseExpiry(now, lease.startDate, lease.endDate) : null,
      invoice: lease.invoice
        ? {
            amount: lease.invoice.amount,
            dueDate: lease.invoice.dueDate,
            paid,
            balance: lease.invoice.amount - paid,
            status: deriveInvoiceStatus(lease.invoice.amount, paid),
            payments: lease.invoice.payments,
          }
        : null,
      contract: lease.fileAssets[0] ?? null,
    };
  });
}

/**
 * Leases still in play — running or yet to start. A tenant can rent more than
 * one unit at once, so this can be several; when there are none, the most
 * recent lease stands in so the page still has something to lead with.
 */
export function liveLeases(leases: PortalLease[]): PortalLease[] {
  const live = leases.filter((lease) => lease.status === "Active" || lease.status === "Upcoming");
  return live.length > 0 ? live : leases.slice(0, 1);
}

/**
 * Files the tenant may open: everything filed under one of their leases
 * (contracts first among them) and everything filed under themself.
 */
export async function getPortalDocuments(ctx: AuthContext): Promise<{
  leases: { id: string; reference: string; title: string; documents: PortalDocument[] }[];
  own: PortalDocument[];
}> {
  const select = {
    id: true,
    fileName: true,
    createdAt: true,
    assetType: { select: { label: true } },
  } as const;

  const [leases, own] = await Promise.all([
    prisma.lease.findMany({
      where: ownLeases(ctx),
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        unit: { select: { label: true, property: { select: { name: true } } } },
        fileAssets: { orderBy: { createdAt: "desc" }, select },
      },
    }),
    prisma.fileAsset.findMany({
      where: { organizationId: ctx.organizationId, membershipId: ctx.membershipId },
      orderBy: { createdAt: "desc" },
      select,
    }),
  ]);

  const toDocument = (doc: (typeof own)[number]): PortalDocument => ({
    id: doc.id,
    fileName: doc.fileName,
    label: doc.assetType.label,
    createdAt: doc.createdAt,
  });

  return {
    leases: leases
      .filter((lease) => lease.fileAssets.length > 0)
      .map((lease) => ({
        id: lease.id,
        reference: leaseReference(lease.id),
        title: `${lease.unit.property.name} · ${lease.unit.label}`,
        documents: lease.fileAssets.map(toDocument),
      })),
    own: own.map(toDocument),
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

/** The tenant's own editable details: name plus the non-identity profile fields. */
export async function updateOwnTenantProfile(
  ctx: AuthContext,
  input: {
    name: string;
    occupation: string | null;
    employer: string | null;
    nationality: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
  }
) {
  const { name, ...profile } = input;
  await prisma.$transaction([
    prisma.user.update({ where: { id: ctx.userId }, data: { name } }),
    prisma.memberProfile.upsert({
      where: { membershipId: ctx.membershipId },
      create: { membershipId: ctx.membershipId, ...profile },
      update: profile,
    }),
  ]);
}
