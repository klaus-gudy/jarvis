import { audit, createdBy, type Actor } from "@/lib/audit";
import { leaseStatus } from "@/lib/leases";
import ExcelJS from "exceljs";

import { parsePermissions, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { OWNER_ROLE_NAME, TENANT_ROLE_NAME } from "@/lib/role-constants";
import { cellText, inflatesSafely } from "@/lib/xlsx-import";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  PaymentAccountType,
  PaymentClaimStatus,
  PropertyStatus,
  PropertyType,
} from "@/lib/generated/prisma/enums";

/**
 * The restore half of the organization backup — `lib/organization-export.ts`
 * is the other half. Reads the workbook that route produces (five sheets, plus
 * PaymentAccounts and PaymentClaims in backups from 2026-10-08 on — older
 * files without them still restore)
 * and rebuilds it under a *different* organization, remapping every foreign
 * key from the old id it was exported with to the id its new row gets here.
 *
 * Two phases, deliberately kept apart: `parseOrganizationBackup` reads and
 * validates every sheet — including that every cross-sheet reference points
 * at a row that actually exists in the file — before anything is written.
 * `importOrganizationBackup` then trusts that validation completely and just
 * builds id maps while it inserts. A restore that partially lands (some
 * leases created, the payments that reference them rejected) would be worse
 * than the gap it started from, so the whole thing runs in one transaction:
 * every row commits, or none do.
 */

const MAX_ROWS_PER_SHEET = 5000;

type ParsedProperty = {
  oldId: string;
  name: string;
  type: PropertyType;
  category: string;
  address: string;
  status: PropertyStatus;
  description: string | null;
  amenities: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ParsedUnit = {
  oldId: string;
  oldPropertyId: string;
  label: string;
  rentAmount: number;
  minTenureMonths: number | null;
  autoRenew: boolean;
  unitType: string | null;
  floor: string | null;
  block: string | null;
  sizeSqm: number | null;
  amenities: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ParsedMembership = {
  oldId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  /** Absent in backups made before roles had kinds — derived from the name then. */
  roleKind: "OWNER" | "STAFF" | "TENANT";
  rolePermissions: string[];
  occupation: string | null;
  nidaNumber: string | null;
  nationality: string | null;
  employer: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ParsedLease = {
  oldId: string;
  oldUnitId: string;
  oldMembershipId: string;
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  monthlyRent: number;
  leaseAmount: number;
  /** Null in backups from before leases carried the flag — the unit's applies. */
  autoRenew: boolean | null;
  oldRenewedFromId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ParsedPayment = {
  /** Null only when the cell is blank; claims reference payments by it. */
  oldId: string | null;
  oldLeaseId: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  notes: string | null;
  createdAt: Date | null;
};

type ParsedPaymentAccount = {
  oldMembershipId: string;
  type: PaymentAccountType;
  provider: string;
  accountNumber: string;
  accountName: string | null;
  isDefault: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ParsedPaymentClaim = {
  oldLeaseId: string;
  oldMembershipId: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  notes: string | null;
  status: PaymentClaimStatus;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  oldPaymentId: string | null;
  createdAt: Date | null;
};

export type ParsedBackup = {
  properties: ParsedProperty[];
  units: ParsedUnit[];
  memberships: ParsedMembership[];
  leases: ParsedLease[];
  payments: ParsedPayment[];
  paymentAccounts: ParsedPaymentAccount[];
  paymentClaims: ParsedPaymentClaim[];
};

export type ParseBackupResult =
  | { ok: true; data: ParsedBackup }
  | { ok: false; errors: string[] };

/** Maps a sheet's header row to column indexes, matched by exact text. */
function headerIndex(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, index) => {
    const text = cellText(cell.value).trim();
    if (text) map.set(text, index);
  });
  return map;
}

function cellAt(
  row: ExcelJS.Row,
  index: Map<string, number>,
  header: string
): ExcelJS.CellValue {
  const i = index.get(header);
  return i ? row.getCell(i).value : null;
}

function parseRoleKind(
  value: string | null,
  roleName: string
): "OWNER" | "STAFF" | "TENANT" {
  if (value === "OWNER" || value === "STAFF" || value === "TENANT") return value;
  const name = roleName.trim().toLowerCase();
  if (name === OWNER_ROLE_NAME.toLowerCase()) return "OWNER";
  if (name === TENANT_ROLE_NAME.toLowerCase()) return "TENANT";
  return "STAFF";
}

function strAt(row: ExcelJS.Row, index: Map<string, number>, header: string): string | null {
  const text = cellText(cellAt(row, index, header));
  return text === "" ? null : text;
}

function numAt(row: ExcelJS.Row, index: Map<string, number>, header: string): number | null {
  const value = cellAt(row, index, header);
  if (typeof value === "number") return value;
  if (value == null) return null;
  const parsed = Number(cellText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateAt(row: ExcelJS.Row, index: Map<string, number>, header: string): Date | null {
  const value = cellAt(row, index, header);
  return value instanceof Date ? value : null;
}

function boolAt(row: ExcelJS.Row, index: Map<string, number>, header: string): boolean {
  return strAt(row, index, header)?.toUpperCase() === "TRUE";
}

function listAt(row: ExcelJS.Row, index: Map<string, number>, header: string): string[] {
  const text = strAt(row, index, header);
  if (!text) return [];
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Every non-header, non-blank row in a sheet, 1-based row number attached. */
function dataRows(sheet: ExcelJS.Worksheet): { row: ExcelJS.Row; rowNumber: number }[] {
  const rows: { row: ExcelJS.Row; rowNumber: number }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const isBlank = row.values == null || (row.values as unknown[]).every((v) => v == null || v === "");
    if (!isBlank) rows.push({ row, rowNumber });
  });
  return rows;
}

export async function parseOrganizationBackup(
  buffer: ArrayBuffer
): Promise<ParseBackupResult> {
  if (!inflatesSafely(buffer)) {
    return { ok: false, errors: ["That file isn't a readable .xlsx workbook, or it is far too large."] };
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return { ok: false, errors: ["That file isn't a readable .xlsx workbook."] };
  }

  const errors: string[] = [];

  const propertiesSheet = workbook.getWorksheet("Properties");
  const unitsSheet = workbook.getWorksheet("Units");
  const membershipsSheet = workbook.getWorksheet("Memberships");
  const leasesSheet = workbook.getWorksheet("Leases");
  const paymentsSheet = workbook.getWorksheet("Payments");
  // Optional: backups made before 2026-10-08 don't have them.
  const paymentAccountsSheet = workbook.getWorksheet("PaymentAccounts");
  const paymentClaimsSheet = workbook.getWorksheet("PaymentClaims");

  if (!propertiesSheet || !unitsSheet || !membershipsSheet || !leasesSheet || !paymentsSheet) {
    return {
      ok: false,
      errors: [
        "This doesn't look like an organization backup — it must have Properties, Units, Memberships, Leases and Payments sheets.",
      ],
    };
  }

  const propertyIds = new Set<string>();
  const properties: ParsedProperty[] = [];
  {
    const index = headerIndex(propertiesSheet);
    const rows = dataRows(propertiesSheet);
    if (rows.length > MAX_ROWS_PER_SHEET) {
      errors.push(`Properties: more than ${MAX_ROWS_PER_SHEET} rows.`);
    }
    for (const { row, rowNumber } of rows) {
      const label = `Properties row ${rowNumber}`;
      const oldId = strAt(row, index, "id");
      const name = strAt(row, index, "name");
      const type = strAt(row, index, "type");
      const category = strAt(row, index, "category");
      const address = strAt(row, index, "address");
      const status = strAt(row, index, "status");

      if (!oldId) errors.push(`${label}: missing id`);
      else if (propertyIds.has(oldId)) errors.push(`${label}: duplicate id`);
      if (!name) errors.push(`${label}: missing name`);
      if (!category) errors.push(`${label}: missing category`);
      if (!address) errors.push(`${label}: missing address`);
      if (!type || !Object.values(PropertyType).includes(type as PropertyType)) {
        errors.push(`${label}: type must be one of ${Object.values(PropertyType).join(", ")}`);
      }
      if (!status || !Object.values(PropertyStatus).includes(status as PropertyStatus)) {
        errors.push(`${label}: status must be one of ${Object.values(PropertyStatus).join(", ")}`);
      }
      if (!oldId || !name || !category || !address) continue;

      propertyIds.add(oldId);
      properties.push({
        oldId,
        name,
        type: type as PropertyType,
        category,
        address,
        status: status as PropertyStatus,
        description: strAt(row, index, "description"),
        amenities: listAt(row, index, "amenities"),
        createdAt: dateAt(row, index, "createdAt"),
        updatedAt: dateAt(row, index, "updatedAt"),
      });
    }
  }

  const unitIds = new Set<string>();
  const units: ParsedUnit[] = [];
  {
    const index = headerIndex(unitsSheet);
    const rows = dataRows(unitsSheet);
    if (rows.length > MAX_ROWS_PER_SHEET) {
      errors.push(`Units: more than ${MAX_ROWS_PER_SHEET} rows.`);
    }
    for (const { row, rowNumber } of rows) {
      const label = `Units row ${rowNumber}`;
      const oldId = strAt(row, index, "id");
      const oldPropertyId = strAt(row, index, "propertyId");
      const unitLabel = strAt(row, index, "label");
      const rentAmount = numAt(row, index, "rentAmount");

      if (!oldId) errors.push(`${label}: missing id`);
      else if (unitIds.has(oldId)) errors.push(`${label}: duplicate id`);
      if (!oldPropertyId) errors.push(`${label}: missing propertyId`);
      else if (!propertyIds.has(oldPropertyId)) {
        errors.push(`${label}: propertyId does not match any row in the Properties sheet`);
      }
      if (!unitLabel) errors.push(`${label}: missing label`);
      if (rentAmount == null) errors.push(`${label}: rentAmount must be a number`);
      if (!oldId || !oldPropertyId || !unitLabel || rentAmount == null) continue;

      unitIds.add(oldId);
      units.push({
        oldId,
        oldPropertyId,
        label: unitLabel,
        rentAmount,
        minTenureMonths: numAt(row, index, "minTenureMonths"),
        autoRenew: boolAt(row, index, "autoRenew"),
        unitType: strAt(row, index, "unitType"),
        floor: strAt(row, index, "floor"),
        block: strAt(row, index, "block"),
        sizeSqm: numAt(row, index, "sizeSqm"),
        amenities: listAt(row, index, "amenities"),
        createdAt: dateAt(row, index, "createdAt"),
        updatedAt: dateAt(row, index, "updatedAt"),
      });
    }
  }

  const membershipIds = new Set<string>();
  const memberships: ParsedMembership[] = [];
  {
    const index = headerIndex(membershipsSheet);
    const rows = dataRows(membershipsSheet);
    if (rows.length > MAX_ROWS_PER_SHEET) {
      errors.push(`Memberships: more than ${MAX_ROWS_PER_SHEET} rows.`);
    }
    for (const { row, rowNumber } of rows) {
      const label = `Memberships row ${rowNumber}`;
      const oldId = strAt(row, index, "id");
      const role = strAt(row, index, "role");
      const email = strAt(row, index, "email");
      const phone = strAt(row, index, "phone");

      if (!oldId) errors.push(`${label}: missing id`);
      else if (membershipIds.has(oldId)) errors.push(`${label}: duplicate id`);
      if (!role) errors.push(`${label}: missing role`);
      if (!email && !phone) errors.push(`${label}: needs an email or a phone to identify the member`);
      if (!oldId || !role || (!email && !phone)) continue;

      membershipIds.add(oldId);
      memberships.push({
        oldId,
        name: strAt(row, index, "name"),
        email,
        phone,
        role,
        roleKind: parseRoleKind(strAt(row, index, "roleKind"), role),
        rolePermissions: (strAt(row, index, "rolePermissions") ?? "")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        occupation: strAt(row, index, "occupation"),
        nidaNumber: strAt(row, index, "nidaNumber"),
        nationality: strAt(row, index, "nationality"),
        employer: strAt(row, index, "employer"),
        emergencyContactName: strAt(row, index, "emergencyContactName"),
        emergencyContactPhone: strAt(row, index, "emergencyContactPhone"),
        emergencyContactRelation: strAt(row, index, "emergencyContactRelation"),
        createdAt: dateAt(row, index, "createdAt"),
        updatedAt: dateAt(row, index, "updatedAt"),
      });
    }
  }

  const leaseIds = new Set<string>();
  const leases: ParsedLease[] = [];
  {
    const index = headerIndex(leasesSheet);
    const rows = dataRows(leasesSheet);
    if (rows.length > MAX_ROWS_PER_SHEET) {
      errors.push(`Leases: more than ${MAX_ROWS_PER_SHEET} rows.`);
    }
    for (const { row, rowNumber } of rows) {
      const label = `Leases row ${rowNumber}`;
      const oldId = strAt(row, index, "id");
      const oldUnitId = strAt(row, index, "unitId");
      const oldMembershipId = strAt(row, index, "membershipId");
      const startDate = dateAt(row, index, "startDate");
      const endDate = dateAt(row, index, "endDate");
      const durationMonths = numAt(row, index, "durationMonths");
      const monthlyRent = numAt(row, index, "monthlyRent");
      const leaseAmount = numAt(row, index, "leaseAmount");
      const oldRenewedFromId = strAt(row, index, "renewedFromId");

      if (!oldId) errors.push(`${label}: missing id`);
      else if (leaseIds.has(oldId)) errors.push(`${label}: duplicate id`);
      if (!oldUnitId) errors.push(`${label}: missing unitId`);
      else if (!unitIds.has(oldUnitId)) {
        errors.push(`${label}: unitId does not match any row in the Units sheet`);
      }
      if (!oldMembershipId) errors.push(`${label}: missing membershipId`);
      else if (!membershipIds.has(oldMembershipId)) {
        errors.push(`${label}: membershipId does not match any row in the Memberships sheet`);
      }
      if (!startDate) errors.push(`${label}: startDate must be a date`);
      if (!endDate) errors.push(`${label}: endDate must be a date`);
      if (durationMonths == null) errors.push(`${label}: durationMonths must be a number`);
      if (monthlyRent == null) errors.push(`${label}: monthlyRent must be a number`);
      if (leaseAmount == null) errors.push(`${label}: leaseAmount must be a number`);
      if (
        !oldId ||
        !oldUnitId ||
        !unitIds.has(oldUnitId) ||
        !oldMembershipId ||
        !membershipIds.has(oldMembershipId) ||
        !startDate ||
        !endDate ||
        durationMonths == null ||
        monthlyRent == null ||
        leaseAmount == null
      ) {
        continue;
      }

      leaseIds.add(oldId);
      leases.push({
        oldId,
        oldUnitId,
        oldMembershipId,
        startDate,
        endDate,
        durationMonths,
        monthlyRent,
        leaseAmount,
        autoRenew: strAt(row, index, "autoRenew") === null ? null : boolAt(row, index, "autoRenew"),
        oldRenewedFromId,
        createdAt: dateAt(row, index, "createdAt"),
        updatedAt: dateAt(row, index, "updatedAt"),
      });
    }
  }

  // A second pass, once every lease's own id has been collected: the row a
  // renewal points at might be later in the sheet than where this loop is.
  for (const lease of leases) {
    if (lease.oldRenewedFromId && !leaseIds.has(lease.oldRenewedFromId)) {
      errors.push(
        `Leases: a lease renewed from ${lease.oldRenewedFromId} but no row in this sheet has that id`
      );
    }
  }

  /** Payment id → its lease, so a claim can't point at another lease's payment. */
  const paymentLeases = new Map<string, string>();
  const payments: ParsedPayment[] = [];
  {
    const index = headerIndex(paymentsSheet);
    const rows = dataRows(paymentsSheet);
    if (rows.length > MAX_ROWS_PER_SHEET) {
      errors.push(`Payments: more than ${MAX_ROWS_PER_SHEET} rows.`);
    }
    for (const { row, rowNumber } of rows) {
      const label = `Payments row ${rowNumber}`;
      const oldLeaseId = strAt(row, index, "leaseId");
      const amount = numAt(row, index, "amount");
      const paidAt = dateAt(row, index, "paidAt");

      if (!oldLeaseId) errors.push(`${label}: missing leaseId`);
      else if (!leaseIds.has(oldLeaseId)) {
        errors.push(`${label}: leaseId does not match any row in the Leases sheet`);
      }
      if (amount == null) errors.push(`${label}: amount must be a number`);
      if (!paidAt) errors.push(`${label}: paidAt must be a date`);
      if (!oldLeaseId || !leaseIds.has(oldLeaseId) || amount == null || !paidAt) continue;

      const oldId = strAt(row, index, "id");
      if (oldId) paymentLeases.set(oldId, oldLeaseId);
      payments.push({
        oldId,
        oldLeaseId,
        amount,
        paidAt,
        method: strAt(row, index, "method"),
        notes: strAt(row, index, "notes"),
        createdAt: dateAt(row, index, "createdAt"),
      });
    }
  }

  const paymentAccounts: ParsedPaymentAccount[] = [];
  if (paymentAccountsSheet) {
    const index = headerIndex(paymentAccountsSheet);
    const rows = dataRows(paymentAccountsSheet);
    if (rows.length > MAX_ROWS_PER_SHEET) {
      errors.push(`PaymentAccounts: more than ${MAX_ROWS_PER_SHEET} rows.`);
    }
    for (const { row, rowNumber } of rows) {
      const label = `PaymentAccounts row ${rowNumber}`;
      const oldMembershipId = strAt(row, index, "membershipId");
      const type = strAt(row, index, "type");
      const provider = strAt(row, index, "provider");
      const accountNumber = strAt(row, index, "accountNumber");

      if (!oldMembershipId) errors.push(`${label}: missing membershipId`);
      else if (!membershipIds.has(oldMembershipId)) {
        errors.push(`${label}: membershipId does not match any row in the Memberships sheet`);
      }
      if (!type || !Object.values(PaymentAccountType).includes(type as PaymentAccountType)) {
        errors.push(`${label}: type must be one of ${Object.values(PaymentAccountType).join(", ")}`);
      }
      if (!provider) errors.push(`${label}: missing provider`);
      if (!accountNumber) errors.push(`${label}: missing accountNumber`);
      if (!oldMembershipId || !membershipIds.has(oldMembershipId) || !provider || !accountNumber) {
        continue;
      }

      paymentAccounts.push({
        oldMembershipId,
        type: type as PaymentAccountType,
        provider,
        accountNumber,
        accountName: strAt(row, index, "accountName"),
        isDefault: boolAt(row, index, "isDefault"),
        createdAt: dateAt(row, index, "createdAt"),
        updatedAt: dateAt(row, index, "updatedAt"),
      });
    }
  }

  const paymentClaims: ParsedPaymentClaim[] = [];
  if (paymentClaimsSheet) {
    const index = headerIndex(paymentClaimsSheet);
    const rows = dataRows(paymentClaimsSheet);
    if (rows.length > MAX_ROWS_PER_SHEET) {
      errors.push(`PaymentClaims: more than ${MAX_ROWS_PER_SHEET} rows.`);
    }
    const claimedPayments = new Set<string>();
    for (const { row, rowNumber } of rows) {
      const label = `PaymentClaims row ${rowNumber}`;
      const oldLeaseId = strAt(row, index, "leaseId");
      const oldMembershipId = strAt(row, index, "membershipId");
      const amount = numAt(row, index, "amount");
      const paidAt = dateAt(row, index, "paidAt");
      const status = strAt(row, index, "status");
      const oldPaymentId = strAt(row, index, "paymentId");

      if (!oldLeaseId) errors.push(`${label}: missing leaseId`);
      else if (!leaseIds.has(oldLeaseId)) {
        errors.push(`${label}: leaseId does not match any row in the Leases sheet`);
      }
      if (!oldMembershipId) errors.push(`${label}: missing membershipId`);
      else if (!membershipIds.has(oldMembershipId)) {
        errors.push(`${label}: membershipId does not match any row in the Memberships sheet`);
      }
      if (amount == null) errors.push(`${label}: amount must be a number`);
      if (!paidAt) errors.push(`${label}: paidAt must be a date`);
      if (!status || !Object.values(PaymentClaimStatus).includes(status as PaymentClaimStatus)) {
        errors.push(`${label}: status must be one of ${Object.values(PaymentClaimStatus).join(", ")}`);
      }
      // `paymentId` is unique on the table: two claims can't become one payment.
      if (oldPaymentId && !paymentLeases.has(oldPaymentId)) {
        errors.push(`${label}: paymentId does not match any row in the Payments sheet`);
      } else if (oldPaymentId && paymentLeases.get(oldPaymentId) !== oldLeaseId) {
        errors.push(`${label}: payment ${oldPaymentId} belongs to a different lease`);
      } else if (oldPaymentId && claimedPayments.has(oldPaymentId)) {
        errors.push(`${label}: another claim already points at payment ${oldPaymentId}`);
      }
      if (
        !oldLeaseId ||
        !leaseIds.has(oldLeaseId) ||
        !oldMembershipId ||
        !membershipIds.has(oldMembershipId) ||
        amount == null ||
        !paidAt
      ) {
        continue;
      }
      if (oldPaymentId) claimedPayments.add(oldPaymentId);

      paymentClaims.push({
        oldLeaseId,
        oldMembershipId,
        amount,
        paidAt,
        method: strAt(row, index, "method"),
        notes: strAt(row, index, "notes"),
        status: status as PaymentClaimStatus,
        reviewedAt: dateAt(row, index, "reviewedAt"),
        rejectionReason: strAt(row, index, "rejectionReason"),
        oldPaymentId,
        createdAt: dateAt(row, index, "createdAt"),
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: { properties, units, memberships, leases, payments, paymentAccounts, paymentClaims },
  };
}

export type ImportSummary = {
  properties: number;
  units: number;
  memberships: number;
  leases: number;
  payments: number;
  paymentAccounts: number;
  paymentClaims: number;
};

/**
 * Trusts `data` completely — every reference in it was already confirmed to
 * resolve within the file by `parseOrganizationBackup`. Runs as one
 * transaction: a restore that lands half its leases because a later payment
 * failed would be a worse state than refusing the whole file.
 */
/**
 * A backup row matched an account the restoring user has no authority over.
 * Thrown inside the transaction so nothing from the restore is kept.
 */
export class ForeignAccountError extends Error {
  constructor(readonly contact: string) {
    super(`${contact} already has their own account`);
  }
}

/**
 * Whether a backup row may be attached to an existing User.
 *
 * A backup is a spreadsheet anyone holding `org:restore` can write, so an
 * email or phone in it proves nothing. Reusing whatever account matched would
 * let a crafted file pull a stranger into this organization — and hand their
 * name and contact details to it. Only two accounts are fair game: the
 * restoring user's own, and passwordless records (assisted onboarding) that
 * live solely in organizations the restoring user owns — their own tenants,
 * restored alongside them.
 */
async function mayReuseUser(
  tx: Prisma.TransactionClient,
  userId: string,
  actorUserId: string
) {
  if (userId === actorUserId) return true;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      memberships: { select: { organizationId: true } },
    },
  });
  if (!user || user.passwordHash) return false;
  const orgIds = [...new Set(user.memberships.map((m) => m.organizationId))];
  const owned = await tx.membership.count({
    where: {
      userId: actorUserId,
      organizationId: { in: orgIds },
      role: { kind: "OWNER" },
    },
  });
  return owned === orgIds.length;
}

export async function importOrganizationBackup(
  organizationId: string,
  data: ParsedBackup,
  { actor }: { actor: Actor & { userId: string } }
): Promise<ImportSummary> {
  const actorUserId = actor.userId;
  // Every restored row is stamped with whoever ran the restore: the backup
  // doesn't say who made the originals, and the restore is the act on record.
  const stamp = createdBy(actor);
  return prisma.$transaction(
    async (tx) => {
      const propertyMap = new Map<string, string>();
      for (const property of data.properties) {
        const created = await tx.property.create({
          data: {
            organizationId,
            name: property.name,
            type: property.type,
            category: property.category,
            address: property.address,
            status: property.status,
            description: property.description,
            amenities: property.amenities,
            ...(property.createdAt ? { createdAt: property.createdAt } : {}),
            ...(property.updatedAt ? { updatedAt: property.updatedAt } : {}),
            ...stamp,
          },
          select: { id: true },
        });
        propertyMap.set(property.oldId, created.id);
      }

      const unitMap = new Map<string, string>();
      for (const unit of data.units) {
        const created = await tx.unit.create({
          data: {
            // Validated during parsing: every unit's propertyId is in propertyMap.
            propertyId: propertyMap.get(unit.oldPropertyId)!,
            label: unit.label,
            rentAmount: unit.rentAmount,
            minTenureMonths: unit.minTenureMonths,
            autoRenew: unit.autoRenew,
            unitType: unit.unitType,
            floor: unit.floor,
            block: unit.block,
            sizeSqm: unit.sizeSqm,
            amenities: unit.amenities,
            ...(unit.createdAt ? { createdAt: unit.createdAt } : {}),
            ...(unit.updatedAt ? { updatedAt: unit.updatedAt } : {}),
            ...stamp,
          },
          select: { id: true },
        });
        unitMap.set(unit.oldId, created.id);
      }

      // Cached per import run, not looked up twice for two rows sharing a role.
      const roleCache = new Map<string, string>();
      const membershipMap = new Map<string, string>();
      for (const membership of data.memberships) {
        // A person may already exist as a User — most importantly, the very
        // account restoring this backup, whose Owner membership in the new
        // (freshly created) organization already exists and must be reused
        // rather than duplicated. Matches `createTenant`'s reasoning exactly.
        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              ...(membership.email ? [{ email: membership.email }] : []),
              ...(membership.phone ? [{ phone: membership.phone }] : []),
            ],
          },
          select: { id: true },
        });
        if (existingUser && !(await mayReuseUser(tx, existingUser.id, actorUserId))) {
          throw new ForeignAccountError(
            membership.email ?? membership.phone ?? membership.name ?? "A member"
          );
        }
        const user =
          existingUser ??
          (await tx.user.create({
            data: {
              name: membership.name,
              email: membership.email,
              phone: membership.phone,
              // Restored accounts can't sign in until invited, same as
              // assisted tenant onboarding — this is record-keeping, not an
              // invitation.
              passwordHash: null,
            },
            select: { id: true },
          }));

        const existingMembership = await tx.membership.findUnique({
          where: { userId_organizationId: { userId: user.id, organizationId } },
          select: { id: true },
        });

        let membershipId: string;
        if (existingMembership) {
          membershipId = existingMembership.id;
        } else {
          // Built-ins are matched by kind (the restoring org already has an
          // Owner role, possibly renamed); custom roles by name.
          const roleKey =
            membership.roleKind === "STAFF"
              ? `staff:${membership.role.toLowerCase()}`
              : membership.roleKind;
          let roleId = roleCache.get(roleKey);
          if (!roleId) {
            const role =
              (await tx.role.findFirst({
                where:
                  membership.roleKind === "STAFF"
                    ? {
                        organizationId,
                        kind: "STAFF",
                        name: { equals: membership.role, mode: "insensitive" },
                      }
                    : { organizationId, kind: membership.roleKind },
                select: { id: true },
              })) ??
              (await tx.role.create({
                data: {
                  organizationId,
                  name: membership.role,
                  kind: membership.roleKind,
                  // Backups made while Owner permissions were implicit carry an
                  // empty list for Owner; that meant "everything".
                  permissions:
                    membership.roleKind === "OWNER" && membership.rolePermissions.length === 0
                      ? [...PERMISSIONS]
                      : parsePermissions(membership.rolePermissions),
                  ...stamp,
                },
                select: { id: true },
              }));
            roleId = role.id;
            roleCache.set(roleKey, roleId);
          }

          const created = await tx.membership.create({
            data: {
              userId: user.id,
              organizationId,
              roleId,
              ...(membership.createdAt ? { createdAt: membership.createdAt } : {}),
              ...(membership.updatedAt ? { updatedAt: membership.updatedAt } : {}),
              ...stamp,
            },
            select: { id: true },
          });
          membershipId = created.id;
        }
        membershipMap.set(membership.oldId, membershipId);

        const profileFields = {
          occupation: membership.occupation,
          nidaNumber: membership.nidaNumber,
          nationality: membership.nationality,
          employer: membership.employer,
          emergencyContactName: membership.emergencyContactName,
          emergencyContactPhone: membership.emergencyContactPhone,
          emergencyContactRelation: membership.emergencyContactRelation,
        };
        if (Object.values(profileFields).some((value) => value)) {
          await tx.memberProfile.upsert({
            where: { membershipId },
            create: { membershipId, ...profileFields, ...stamp },
            update: { ...profileFields, updatedById: stamp.updatedById },
          });
        }
      }

      // Older backups have no per-lease flag; their leases take the unit's.
      const unitAutoRenew = new Map(data.units.map((unit) => [unit.oldId, unit.autoRenew]));
      const leaseMap = new Map<string, string>();
      // A lease's invoice always exists and is deterministic — `insertLease`
      // and `updateLease` both set `amount: leaseAmount, dueDate: startDate` —
      // so it is rebuilt from the lease row itself rather than needing an
      // Invoice sheet, and every lease gets one whether or not it has payments.
      const invoiceMap = new Map<string, string>();
      const pendingRenewals: { newLeaseId: string; oldRenewedFromId: string }[] = [];
      for (const lease of data.leases) {
        const created = await tx.lease.create({
          data: {
            unitId: unitMap.get(lease.oldUnitId)!,
            membershipId: membershipMap.get(lease.oldMembershipId)!,
            startDate: lease.startDate,
            endDate: lease.endDate,
            status: leaseStatus(new Date(), lease.startDate, lease.endDate),
            durationMonths: lease.durationMonths,
            monthlyRent: lease.monthlyRent,
            leaseAmount: lease.leaseAmount,
            autoRenew: lease.autoRenew ?? unitAutoRenew.get(lease.oldUnitId) ?? true,
            ...(lease.createdAt ? { createdAt: lease.createdAt } : {}),
            ...(lease.updatedAt ? { updatedAt: lease.updatedAt } : {}),
            ...stamp,
          },
          select: { id: true },
        });
        leaseMap.set(lease.oldId, created.id);

        const invoice = await tx.invoice.create({
          data: {
            leaseId: created.id,
            amount: lease.leaseAmount,
            dueDate: lease.startDate,
            ...stamp,
          },
          select: { id: true },
        });
        invoiceMap.set(created.id, invoice.id);

        if (lease.oldRenewedFromId) {
          pendingRenewals.push({ newLeaseId: created.id, oldRenewedFromId: lease.oldRenewedFromId });
        }
      }
      // Second pass for renewal links, once every lease in the file has been
      // created — the lease a renewal points at can appear later in the sheet.
      for (const renewal of pendingRenewals) {
        await tx.lease.update({
          where: { id: renewal.newLeaseId },
          data: { renewedFromId: leaseMap.get(renewal.oldRenewedFromId)! },
        });
        await tx.lease.update({
          where: { id: leaseMap.get(renewal.oldRenewedFromId)! },
          data: { status: "Renewed" },
        });
      }

      let paymentsCreated = 0;
      const paymentMap = new Map<string, string>();
      for (const payment of data.payments) {
        const newLeaseId = leaseMap.get(payment.oldLeaseId)!;
        const created = await tx.payment.create({
          data: {
            invoiceId: invoiceMap.get(newLeaseId)!,
            amount: payment.amount,
            paidAt: payment.paidAt,
            method: payment.method,
            notes: payment.notes,
            ...(payment.createdAt ? { createdAt: payment.createdAt } : {}),
            createdById: stamp.createdById,
          },
          select: { id: true },
        });
        if (payment.oldId) paymentMap.set(payment.oldId, created.id);
        paymentsCreated++;
      }

      // The restoring owner's membership is reused, and they may have added
      // accounts to the fresh organization before restoring: an identical
      // account is skipped rather than doubled, and theirs stays the default.
      let paymentAccountsCreated = 0;
      const hasDefault = new Set<string>();
      for (const account of data.paymentAccounts) {
        const membershipId = membershipMap.get(account.oldMembershipId)!;
        const existing = await tx.paymentAccount.findMany({
          where: { membershipId },
          select: { type: true, provider: true, accountNumber: true, isDefault: true },
        });
        if (existing.some((row) => row.isDefault)) hasDefault.add(membershipId);
        const duplicate = existing.some(
          (row) =>
            row.type === account.type &&
            row.provider === account.provider &&
            row.accountNumber === account.accountNumber
        );
        if (duplicate) continue;

        const isDefault = account.isDefault && !hasDefault.has(membershipId);
        if (isDefault) hasDefault.add(membershipId);
        await tx.paymentAccount.create({
          data: {
            membershipId,
            type: account.type,
            provider: account.provider,
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            isDefault,
            ...(account.createdAt ? { createdAt: account.createdAt } : {}),
            ...(account.updatedAt ? { updatedAt: account.updatedAt } : {}),
            ...stamp,
          },
        });
        paymentAccountsCreated++;
      }

      // A claim keeps its outcome but not its reviewer: the backup doesn't say
      // who reviewed it, and the restore didn't.
      for (const claim of data.paymentClaims) {
        const newLeaseId = leaseMap.get(claim.oldLeaseId)!;
        await tx.paymentClaim.create({
          data: {
            invoiceId: invoiceMap.get(newLeaseId)!,
            membershipId: membershipMap.get(claim.oldMembershipId)!,
            amount: claim.amount,
            paidAt: claim.paidAt,
            method: claim.method,
            notes: claim.notes,
            status: claim.status,
            reviewedAt: claim.reviewedAt,
            rejectionReason: claim.rejectionReason,
            paymentId: claim.oldPaymentId ? paymentMap.get(claim.oldPaymentId) : null,
            ...(claim.createdAt ? { createdAt: claim.createdAt } : {}),
          },
        });
      }

      const summary = {
        properties: data.properties.length,
        units: data.units.length,
        memberships: data.memberships.length,
        leases: data.leases.length,
        payments: paymentsCreated,
        paymentAccounts: paymentAccountsCreated,
        paymentClaims: data.paymentClaims.length,
      };
      // One entry for the restore rather than one per row: thousands of
      // "created" lines would bury everything else, and every row it wrote
      // carries the stamp anyway.
      await audit(tx, {
        organizationId,
        actor,
        action: "organization.imported",
        entityType: "Organization",
        entityId: organizationId,
        changes: summary,
      });
      return summary;
    },
    // Generous on purpose: this is an infrequent, admin-triggered restore
    // that can touch thousands of rows across seven tables, each a separate
    // round trip — the 5s interactive-transaction default would abort a
    // large, otherwise-healthy backup partway through.
    { timeout: 60_000 }
  );
}
