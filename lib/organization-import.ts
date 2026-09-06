import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { cellText } from "@/lib/xlsx-import";
import { PropertyStatus, PropertyType } from "@/lib/generated/prisma/enums";

/**
 * The restore half of the organization backup — `lib/organization-export.ts`
 * is the other half. Reads the exact five-sheet workbook that route produces
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
  oldRenewedFromId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ParsedPayment = {
  oldLeaseId: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  notes: string | null;
  createdAt: Date | null;
};

export type ParsedBackup = {
  properties: ParsedProperty[];
  units: ParsedUnit[];
  memberships: ParsedMembership[];
  leases: ParsedLease[];
  payments: ParsedPayment[];
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

      payments.push({
        oldLeaseId,
        amount,
        paidAt,
        method: strAt(row, index, "method"),
        notes: strAt(row, index, "notes"),
        createdAt: dateAt(row, index, "createdAt"),
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, data: { properties, units, memberships, leases, payments } };
}

export type ImportSummary = {
  properties: number;
  units: number;
  memberships: number;
  leases: number;
  payments: number;
};

/**
 * Trusts `data` completely — every reference in it was already confirmed to
 * resolve within the file by `parseOrganizationBackup`. Runs as one
 * transaction: a restore that lands half its leases because a later payment
 * failed would be a worse state than refusing the whole file.
 */
export async function importOrganizationBackup(
  organizationId: string,
  data: ParsedBackup
): Promise<ImportSummary> {
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
          const roleKey = membership.role.toLowerCase();
          let roleId = roleCache.get(roleKey);
          if (!roleId) {
            const role =
              (await tx.role.findFirst({
                where: {
                  organizationId,
                  name: { equals: membership.role, mode: "insensitive" },
                },
                select: { id: true },
              })) ??
              (await tx.role.create({
                data: { organizationId, name: membership.role },
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
            create: { membershipId, ...profileFields },
            update: profileFields,
          });
        }
      }

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
            durationMonths: lease.durationMonths,
            monthlyRent: lease.monthlyRent,
            leaseAmount: lease.leaseAmount,
            ...(lease.createdAt ? { createdAt: lease.createdAt } : {}),
            ...(lease.updatedAt ? { updatedAt: lease.updatedAt } : {}),
          },
          select: { id: true },
        });
        leaseMap.set(lease.oldId, created.id);

        const invoice = await tx.invoice.create({
          data: {
            leaseId: created.id,
            amount: lease.leaseAmount,
            dueDate: lease.startDate,
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
      }

      let paymentsCreated = 0;
      for (const payment of data.payments) {
        const newLeaseId = leaseMap.get(payment.oldLeaseId)!;
        await tx.payment.create({
          data: {
            invoiceId: invoiceMap.get(newLeaseId)!,
            amount: payment.amount,
            paidAt: payment.paidAt,
            method: payment.method,
            notes: payment.notes,
            ...(payment.createdAt ? { createdAt: payment.createdAt } : {}),
          },
        });
        paymentsCreated++;
      }

      return {
        properties: data.properties.length,
        units: data.units.length,
        memberships: data.memberships.length,
        leases: data.leases.length,
        payments: paymentsCreated,
      };
    },
    // Generous on purpose: this is an infrequent, admin-triggered restore
    // that can touch thousands of rows across five tables, each a separate
    // round trip — the 5s interactive-transaction default would abort a
    // large, otherwise-healthy backup partway through.
    { timeout: 60_000 }
  );
}
