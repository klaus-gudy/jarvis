import { requireActiveOrg } from "@/lib/api-auth";
import { getOrganizationExportData } from "@/lib/organization-export";
import {
  buildMultiSheetWorkbook,
  exportFilename,
  exportSheet,
  xlsxResponse,
  type ExportColumn,
} from "@/lib/xlsx-export";
import type {
  LeaseExportRow,
  MembershipExportRow,
  PaymentExportRow,
  PropertyExportRow,
  UnitExportRow,
} from "@/lib/organization-export";

const DATE_FORMAT = "yyyy-mm-dd";

const PROPERTY_COLUMNS: ExportColumn<PropertyExportRow>[] = [
  { header: "id", width: 26, value: (p) => p.id },
  { header: "name", width: 26, value: (p) => p.name },
  { header: "type", width: 14, value: (p) => p.type },
  { header: "category", width: 16, value: (p) => p.category },
  { header: "address", width: 30, value: (p) => p.address },
  { header: "status", width: 12, value: (p) => p.status },
  { header: "description", width: 30, value: (p) => p.description ?? "" },
  { header: "amenities", width: 30, value: (p) => p.amenities.join(", ") },
  { header: "createdAt", width: 14, format: DATE_FORMAT, value: (p) => p.createdAt },
  { header: "updatedAt", width: 14, format: DATE_FORMAT, value: (p) => p.updatedAt },
];

const UNIT_COLUMNS: ExportColumn<UnitExportRow>[] = [
  { header: "id", width: 26, value: (u) => u.id },
  // References the Properties sheet's `id` column.
  { header: "propertyId", width: 26, value: (u) => u.propertyId },
  { header: "label", width: 14, value: (u) => u.label },
  { header: "rentAmount", width: 14, format: "#,##0", value: (u) => u.rentAmount },
  { header: "minTenureMonths", width: 16, value: (u) => u.minTenureMonths ?? "" },
  { header: "autoRenew", width: 12, value: (u) => (u.autoRenew ? "TRUE" : "FALSE") },
  { header: "unitType", width: 16, value: (u) => u.unitType ?? "" },
  { header: "floor", width: 12, value: (u) => u.floor ?? "" },
  { header: "block", width: 12, value: (u) => u.block ?? "" },
  { header: "sizeSqm", width: 12, value: (u) => u.sizeSqm ?? "" },
  { header: "amenities", width: 30, value: (u) => u.amenities.join(", ") },
  { header: "createdAt", width: 14, format: DATE_FORMAT, value: (u) => u.createdAt },
  { header: "updatedAt", width: 14, format: DATE_FORMAT, value: (u) => u.updatedAt },
];

const MEMBERSHIP_COLUMNS: ExportColumn<MembershipExportRow>[] = [
  { header: "id", width: 26, value: (m) => m.id },
  { header: "userId", width: 26, value: (m) => m.userId },
  { header: "name", width: 24, value: (m) => m.name ?? "" },
  { header: "email", width: 26, value: (m) => m.email ?? "" },
  { header: "phone", width: 18, value: (m) => m.phone ?? "" },
  { header: "role", width: 16, value: (m) => m.role },
  { header: "occupation", width: 20, value: (m) => m.occupation ?? "" },
  { header: "nidaNumber", width: 20, value: (m) => m.nidaNumber ?? "" },
  { header: "nationality", width: 18, value: (m) => m.nationality ?? "" },
  { header: "employer", width: 20, value: (m) => m.employer ?? "" },
  {
    header: "emergencyContactName",
    width: 22,
    value: (m) => m.emergencyContactName ?? "",
  },
  {
    header: "emergencyContactPhone",
    width: 20,
    value: (m) => m.emergencyContactPhone ?? "",
  },
  {
    header: "emergencyContactRelation",
    width: 20,
    value: (m) => m.emergencyContactRelation ?? "",
  },
  { header: "createdAt", width: 14, format: DATE_FORMAT, value: (m) => m.createdAt },
  { header: "updatedAt", width: 14, format: DATE_FORMAT, value: (m) => m.updatedAt },
];

const LEASE_COLUMNS: ExportColumn<LeaseExportRow>[] = [
  { header: "id", width: 26, value: (l) => l.id },
  // References the Units sheet's `id` column.
  { header: "unitId", width: 26, value: (l) => l.unitId },
  // References the Memberships sheet's `id` column.
  { header: "membershipId", width: 26, value: (l) => l.membershipId },
  { header: "startDate", width: 14, format: DATE_FORMAT, value: (l) => l.startDate },
  { header: "endDate", width: 14, format: DATE_FORMAT, value: (l) => l.endDate },
  { header: "durationMonths", width: 16, value: (l) => l.durationMonths },
  { header: "monthlyRent", width: 16, format: "#,##0", value: (l) => l.monthlyRent },
  { header: "leaseAmount", width: 16, format: "#,##0", value: (l) => l.leaseAmount },
  // Self-references another row's `id` on this same sheet, when this lease
  // was created by auto-renewing an earlier one.
  { header: "renewedFromId", width: 26, value: (l) => l.renewedFromId ?? "" },
  { header: "createdAt", width: 14, format: DATE_FORMAT, value: (l) => l.createdAt },
  { header: "updatedAt", width: 14, format: DATE_FORMAT, value: (l) => l.updatedAt },
];

const PAYMENT_COLUMNS: ExportColumn<PaymentExportRow>[] = [
  { header: "id", width: 26, value: (p) => p.id },
  /**
   * Payment's real foreign key is `invoiceId`; there is no Invoice sheet, so
   * this is resolved through the payment's invoice to the lease it belongs
   * to, referencing the Leases sheet's `id` column instead. Lossless: each
   * lease has at most one invoice, so `leaseId` and `invoiceId` name the
   * same row.
   */
  { header: "leaseId", width: 26, value: (p) => p.leaseId },
  {
    header: "invoiceAmount",
    width: 16,
    format: "#,##0",
    value: (p) => p.invoiceAmount,
  },
  {
    header: "invoiceDueDate",
    width: 14,
    format: DATE_FORMAT,
    value: (p) => p.invoiceDueDate,
  },
  { header: "amount", width: 14, format: "#,##0", value: (p) => p.amount },
  { header: "paidAt", width: 14, format: DATE_FORMAT, value: (p) => p.paidAt },
  { header: "method", width: 16, value: (p) => p.method ?? "" },
  { header: "notes", width: 30, value: (p) => p.notes ?? "" },
  { header: "createdAt", width: 14, format: DATE_FORMAT, value: (p) => p.createdAt },
];

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const data = await getOrganizationExportData(auth.context.organizationId);

  const buffer = await buildMultiSheetWorkbook([
    exportSheet("Properties", PROPERTY_COLUMNS, data.properties),
    exportSheet("Units", UNIT_COLUMNS, data.units),
    exportSheet("Memberships", MEMBERSHIP_COLUMNS, data.memberships),
    exportSheet("Leases", LEASE_COLUMNS, data.leases),
    exportSheet("Payments", PAYMENT_COLUMNS, data.payments),
  ]);

  return xlsxResponse(buffer, exportFilename("organization-backup"));
}
