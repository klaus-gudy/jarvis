import { prisma } from "@/lib/prisma";

/**
 * The raw-data half of export: one row per database row, real foreign keys
 * intact, meant to be complete enough that a future importer could rebuild
 * the organization from it. This is deliberately not the read-friendly
 * per-page export in `app/api/tenants/export` and its siblings — those
 * flatten and format for a person to read; this preserves the schema so a
 * machine could rebuild it.
 *
 * Payment's real foreign key is `invoiceId`, not `leaseId` — there is no
 * Invoice sheet, so `leaseId` here is resolved through the payment's invoice
 * and substituted in its place. That substitution loses nothing: `Invoice`
 * is `@unique` on `leaseId`, so the two ids identify exactly the same row.
 */

export type PropertyExportRow = {
  id: string;
  name: string;
  type: string;
  category: string;
  address: string;
  status: string;
  description: string | null;
  amenities: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type UnitExportRow = {
  id: string;
  propertyId: string;
  label: string;
  rentAmount: number;
  minTenureMonths: number | null;
  autoRenew: boolean;
  unitType: string | null;
  floor: string | null;
  block: string | null;
  sizeSqm: number | null;
  amenities: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipExportRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  occupation: string | null;
  nidaNumber: string | null;
  nationality: string | null;
  employer: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LeaseExportRow = {
  id: string;
  unitId: string;
  membershipId: string;
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  monthlyRent: number;
  leaseAmount: number;
  renewedFromId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentExportRow = {
  id: string;
  leaseId: string;
  invoiceAmount: number;
  invoiceDueDate: Date;
  amount: number;
  paidAt: Date;
  method: string | null;
  notes: string | null;
  createdAt: Date;
};

export type OrganizationExportData = {
  properties: PropertyExportRow[];
  units: UnitExportRow[];
  memberships: MembershipExportRow[];
  leases: LeaseExportRow[];
  payments: PaymentExportRow[];
};

export async function getOrganizationExportData(
  organizationId: string
): Promise<OrganizationExportData> {
  const [properties, units, memberships, leases, payments] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.unit.findMany({
      where: { property: { organizationId } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.membership.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: { user: true, role: true, profile: true },
    }),
    prisma.lease.findMany({
      where: {
        membership: { organizationId },
        unit: { property: { organizationId } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        invoice: {
          lease: {
            membership: { organizationId },
            unit: { property: { organizationId } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      include: { invoice: { select: { leaseId: true, amount: true, dueDate: true } } },
    }),
  ]);

  return {
    properties,
    units,
    memberships: memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      phone: membership.user.phone,
      role: membership.role.name,
      occupation: membership.profile?.occupation ?? null,
      nidaNumber: membership.profile?.nidaNumber ?? null,
      nationality: membership.profile?.nationality ?? null,
      employer: membership.profile?.employer ?? null,
      emergencyContactName: membership.profile?.emergencyContactName ?? null,
      emergencyContactPhone: membership.profile?.emergencyContactPhone ?? null,
      emergencyContactRelation: membership.profile?.emergencyContactRelation ?? null,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    })),
    leases,
    payments: payments.map((payment) => ({
      id: payment.id,
      leaseId: payment.invoice.leaseId,
      invoiceAmount: payment.invoice.amount,
      invoiceDueDate: payment.invoice.dueDate,
      amount: payment.amount,
      paidAt: payment.paidAt,
      method: payment.method,
      notes: payment.notes,
      createdAt: payment.createdAt,
    })),
  };
}
