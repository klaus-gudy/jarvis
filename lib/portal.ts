import type { AuthContext } from "@/lib/authz";
import { LEASE_CONTRACT_TYPE_ID } from "@/lib/contract-constants";
import { calendarDaysBetween, startOfTodayUtc } from "@/lib/dates";
import { deriveInvoiceStatus, invoiceReference, type InvoiceStatus } from "@/lib/invoice-types";
import { leaseExpiry, leaseReference, type LeaseExpiry, type LeaseStatus } from "@/lib/leases";
import { getOrganizationOwner, getOrganizationOwnerMembershipId } from "@/lib/organizations";
import type { PaymentAccountTypeValue } from "@/lib/payment-account-options";
import { prisma } from "@/lib/prisma";
import { rentCoverage, type RentCoverage } from "@/lib/rent-coverage";

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
  /** The lease this one renewed, and the one that renewed it — by reference. */
  renewedFrom: string | null;
  renewedTo: string | null;
  /** Whether the unit renews this lease on its own, and for how long. */
  autoRenew: boolean;
  renewalMonths: number | null;
  /** The place itself, for the Home page's "Your home" card. */
  home: {
    address: string;
    unitType: string | null;
    floor: string | null;
    block: string | null;
    sizeSqm: number | null;
    /** Unit amenities first, then the property's, without repeats. */
    amenities: string[];
  };
  invoice: {
    id: string;
    reference: string;
    amount: number;
    dueDate: Date;
    paid: number;
    balance: number;
    status: InvoiceStatus;
    payments: PortalPayment[];
    /** Payments this tenant reported that the landlord hasn't confirmed yet. */
    pendingClaims: { id: string; amount: number; paidAt: Date; method: string | null }[];
    coverage: RentCoverage;
  } | null;
  contract: { id: string; fileName: string; fileType: string; sizeBytes: number } | null;
};

export type PortalLandlord = {
  name: string | null;
  phone: string | null;
  email: string | null;
  organizationName: string;
  paymentAccounts: {
    id: string;
    type: PaymentAccountTypeValue;
    provider: string;
    accountNumber: string;
    accountName: string | null;
    isDefault: boolean;
  }[];
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
  fileType: string;
  sizeBytes: number;
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
      renewedFromId: true,
      renewedTo: { select: { id: true } },
      unit: {
        select: {
          label: true,
          unitType: true,
          floor: true,
          block: true,
          sizeSqm: true,
          amenities: true,
          autoRenew: true,
          minTenureMonths: true,
          property: { select: { name: true, address: true, amenities: true } },
        },
      },
      invoice: {
        select: {
          id: true,
          amount: true,
          dueDate: true,
          payments: {
            orderBy: { paidAt: "desc" },
            select: { id: true, amount: true, paidAt: true, method: true },
          },
          paymentClaims: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "asc" },
            select: { id: true, amount: true, paidAt: true, method: true },
          },
        },
      },
      fileAssets: {
        where: { assetTypeId: LEASE_CONTRACT_TYPE_ID },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, fileName: true, fileType: true, sizeBytes: true },
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
      renewedFrom: lease.renewedFromId ? leaseReference(lease.renewedFromId) : null,
      renewedTo: lease.renewedTo ? leaseReference(lease.renewedTo.id) : null,
      autoRenew: lease.unit.autoRenew,
      renewalMonths: lease.unit.minTenureMonths,
      home: {
        address: lease.unit.property.address,
        unitType: lease.unit.unitType,
        floor: lease.unit.floor,
        block: lease.unit.block,
        sizeSqm: lease.unit.sizeSqm,
        amenities: [...new Set([...lease.unit.amenities, ...lease.unit.property.amenities])],
      },
      invoice: lease.invoice
        ? {
            id: lease.invoice.id,
            reference: invoiceReference(lease.invoice.id),
            amount: lease.invoice.amount,
            dueDate: lease.invoice.dueDate,
            paid,
            balance: lease.invoice.amount - paid,
            status: deriveInvoiceStatus(lease.invoice.amount, paid),
            payments: lease.invoice.payments,
            pendingClaims: lease.invoice.paymentClaims,
            coverage: rentCoverage(lease, { amount: lease.invoice.amount, paid }, now),
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

export type PortalLeaseDocuments = {
  id: string;
  reference: string;
  title: string;
  status: LeaseStatus;
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  documents: PortalDocument[];
};

/**
 * Files on the tenant's leases — the contract above all — newest lease first.
 * Leases with nothing filed are left out. The tenant's own membership files
 * are read through `listDocuments`, like the landlord's member page.
 */
export async function getPortalLeaseDocuments(
  ctx: AuthContext
): Promise<PortalLeaseDocuments[]> {
  const leases = await prisma.lease.findMany({
    where: ownLeases(ctx),
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      durationMonths: true,
      unit: { select: { label: true, property: { select: { name: true } } } },
      fileAssets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          sizeBytes: true,
          createdAt: true,
          assetType: { select: { label: true } },
        },
      },
    },
  });

  return leases
    .filter((lease) => lease.fileAssets.length > 0)
    .map((lease) => ({
      id: lease.id,
      reference: leaseReference(lease.id),
      title: `${lease.unit.property.name} · Unit ${lease.unit.label}`,
      status: lease.status,
      startDate: lease.startDate,
      endDate: lease.endDate,
      durationMonths: lease.durationMonths,
      documents: lease.fileAssets.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        sizeBytes: doc.sizeBytes,
        label: doc.assetType.label,
        createdAt: doc.createdAt,
      })),
    }));
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

/**
 * Who the tenant rents from and how to pay them: the organization's Owner
 * (oldest Owner-kind membership, as the contract's `{{landlord_*}}` tokens use)
 * and that membership's payment accounts, preferred one first.
 *
 * Organization-wide rather than tenant-specific, so it is scoped by the org
 * alone — and selects only what a tenant is meant to see.
 */
export async function getPortalLandlord(ctx: AuthContext): Promise<PortalLandlord> {
  const [owner, ownerMembershipId, organization] = await Promise.all([
    getOrganizationOwner(ctx.organizationId),
    getOrganizationOwnerMembershipId(ctx.organizationId),
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { name: true },
    }),
  ]);

  const paymentAccounts = ownerMembershipId
    ? await prisma.paymentAccount.findMany({
        where: { membershipId: ownerMembershipId },
        // Same order as the owner's own list: the default is the one to use.
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          provider: true,
          accountNumber: true,
          accountName: true,
          isDefault: true,
        },
      })
    : [];

  return {
    name: owner?.name ?? null,
    phone: owner?.phone ?? null,
    email: owner?.email ?? null,
    organizationName: organization.name,
    paymentAccounts,
  };
}
