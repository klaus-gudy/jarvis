import { leaseReference } from "@/lib/leases";
import {
  renderLeaseTemplate,
  placeholderValues,
  usedPlaceholders,
  type LeaseContractContext,
  type RenderedTemplate,
} from "@/lib/lease-placeholders";
import type {
  CreateLeaseTemplateInput,
  UpdateLeaseTemplateInput,
} from "@/lib/lease-template-schemas";
import {
  DEFAULT_TEMPLATE_DESCRIPTION,
  DEFAULT_TEMPLATE_NAME,
  starterBody,
} from "@/lib/lease-template-starters";
import {
  getOrganizationOwner,
  getOrganizationOwnerSignatureKey,
} from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { signatureDataUri } from "@/lib/signatures";

export type LeaseTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  language: string;
  isDefault: boolean;
  /** How many distinct known tokens the body uses — a rough completeness read. */
  placeholderCount: number;
  updatedAt: Date;
};

export type LeaseTemplateDetail = LeaseTemplateRow & { body: string };

const ROW_SELECT = {
  id: true,
  name: true,
  description: true,
  language: true,
  isDefault: true,
  updatedAt: true,
  body: true,
} as const;

function toRow(template: {
  id: string;
  name: string;
  description: string | null;
  language: string;
  isDefault: boolean;
  updatedAt: Date;
  body: string;
}): LeaseTemplateRow {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    language: template.language,
    isDefault: template.isDefault,
    placeholderCount: usedPlaceholders(template.body).length,
    updatedAt: template.updatedAt,
  };
}

export async function getLeaseTemplates(
  organizationId: string
): Promise<LeaseTemplateRow[]> {
  const templates = await prisma.leaseTemplate.findMany({
    where: { organizationId },
    // The default first, then alphabetically — the list is short and the one
    // that governs new contracts is the one being looked for.
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: ROW_SELECT,
  });

  return templates.map(toRow);
}

export async function getLeaseTemplate(
  organizationId: string,
  templateId: string
): Promise<LeaseTemplateDetail | null> {
  const template = await prisma.leaseTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: ROW_SELECT,
  });
  if (!template) return null;

  return { ...toRow(template), body: template.body };
}

type WriteResult =
  | { template: LeaseTemplateDetail }
  | { error: "duplicate" | "not-found" };

/**
 * While an organization has any template at all, exactly one of them is the
 * default — it changes by promoting another, never by demoting this one into a
 * vacuum. So a template is the default if it is asked to be, if it is the only
 * one, or (when editing) if it already was.
 *
 * The alternative is an organization with templates and no default, where
 * generating a contract without naming one 404s for a reason nobody can see.
 */
async function resolveDefault(
  organizationId: string,
  requested: boolean | undefined,
  { excludeId, wasDefault = false }: { excludeId?: string; wasDefault?: boolean } = {}
) {
  if (requested || wasDefault) return true;

  const others = await prisma.leaseTemplate.count({
    where: { organizationId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return others === 0;
}

/** How many templates an organization has — the form asks, to know if it is writing the first. */
export function countLeaseTemplates(organizationId: string) {
  return prisma.leaseTemplate.count({ where: { organizationId } });
}

export async function createLeaseTemplate(
  organizationId: string,
  input: CreateLeaseTemplateInput
): Promise<WriteResult> {
  const duplicate = await prisma.leaseTemplate.findFirst({
    where: { organizationId, name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) return { error: "duplicate" };

  const isDefault = await resolveDefault(organizationId, input.isDefault);

  const template = await prisma.$transaction(async (tx) => {
    // Cleared first, inside the same transaction: the partial unique index on
    // (organizationId) WHERE isDefault rejects the insert otherwise.
    if (isDefault) {
      await tx.leaseTemplate.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.leaseTemplate.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        language: input.language,
        body: input.body,
        isDefault,
      },
      select: ROW_SELECT,
    });
  });

  return { template: { ...toRow(template), body: template.body } };
}

export async function updateLeaseTemplate(
  organizationId: string,
  templateId: string,
  input: UpdateLeaseTemplateInput
): Promise<WriteResult> {
  const existing = await prisma.leaseTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true, isDefault: true },
  });
  if (!existing) return { error: "not-found" };

  const duplicate = await prisma.leaseTemplate.findFirst({
    where: {
      organizationId,
      name: { equals: input.name, mode: "insensitive" },
      id: { not: templateId },
    },
    select: { id: true },
  });
  if (duplicate) return { error: "duplicate" };

  const isDefault = await resolveDefault(organizationId, input.isDefault, {
    excludeId: templateId,
    wasDefault: existing.isDefault,
  });

  const template = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.leaseTemplate.updateMany({
        where: { organizationId, isDefault: true, id: { not: templateId } },
        data: { isDefault: false },
      });
    }

    return tx.leaseTemplate.update({
      where: { id: templateId },
      data: {
        name: input.name,
        description: input.description,
        language: input.language,
        body: input.body,
        isDefault,
      },
      select: ROW_SELECT,
    });
  });

  return { template: { ...toRow(template), body: template.body } };
}

export async function deleteLeaseTemplate(
  organizationId: string,
  templateId: string
) {
  const existing = await prisma.leaseTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true, isDefault: true },
  });
  if (!existing) return { error: "not-found" as const };

  await prisma.$transaction(async (tx) => {
    await tx.leaseTemplate.delete({ where: { id: templateId } });

    // Deleting the default would otherwise leave an organization whose
    // contracts have no starting point, so the oldest survivor takes over.
    if (existing.isDefault) {
      const successor = await tx.leaseTemplate.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (successor) {
        await tx.leaseTemplate.update({
          where: { id: successor.id },
          data: { isDefault: true },
        });
      }
    }
  });

  return { ok: true as const };
}

/**
 * Everything a contract needs, read from the database in one query per side.
 *
 * Scoped through both the membership and the unit's property, matching
 * `getLease` — a lease is only this organization's if both of its ends are.
 */
export async function buildLeaseContext(
  organizationId: string,
  leaseId: string
): Promise<LeaseContractContext | null> {
  const [lease, owner, organization] = await Promise.all([
    prisma.lease.findFirst({
      where: {
        id: leaseId,
        membership: { organizationId },
        unit: { property: { organizationId } },
      },
      include: {
        unit: { include: { property: true } },
        membership: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
            profile: true,
          },
        },
      },
    }),
    getOrganizationOwner(organizationId),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
  ]);
  if (!lease) return null;

  const { user, profile } = lease.membership;
  const { unit } = lease;

  // Inlined as data URIs: document-worker refuses every remote URL, so an
  // image the PDF can print has to travel inside the HTML. Each is a few KB.
  const [tenantSignature, landlordSignature] = await Promise.all([
    signatureDataUri(organizationId, profile?.signatureKey),
    getOrganizationOwnerSignatureKey(organizationId).then((key) =>
      signatureDataUri(organizationId, key)
    ),
  ]);
  const { property } = unit;

  return {
    agreementDate: new Date(),
    contractNumber: leaseReference(lease.id),
    organizationName: organization?.name ?? null,
    landlord: {
      name: owner?.name ?? null,
      email: owner?.email ?? null,
      phone: owner?.phone ?? null,
      signature: landlordSignature,
    },
    tenant: {
      // Falls back the same way every other surface does, so a tenant with no
      // name on file reads identically on the contract and in the table.
      name: user.name ?? user.email ?? user.phone ?? null,
      nationalId: profile?.nidaNumber ?? null,
      phone: user.phone,
      email: user.email,
      nationality: profile?.nationality ?? null,
      occupation: profile?.occupation ?? null,
      nextOfKin: profile?.emergencyContactName ?? null,
      nextOfKinPhone: profile?.emergencyContactPhone ?? null,
      signature: tenantSignature,
    },
    property: {
      name: property.name,
      location: property.address,
      category: property.category,
    },
    unit: {
      name: unit.label,
      type: unit.unitType,
      floor: unit.floor,
      block: unit.block,
      areaSqm: unit.sizeSqm,
    },
    lease: {
      startDate: lease.startDate,
      endDate: lease.endDate,
      months: lease.durationMonths,
      rentAmount: lease.monthlyRent,
      totalAmount: lease.leaseAmount,
    },
  } satisfies LeaseContractContext;
}

export type GeneratedContract = RenderedTemplate & {
  template: { id: string; name: string; language: string };
  contractNumber: string;
};

/**
 * A real contract: this organization's template, filled from this lease's row.
 * `templateId` omitted means the organization's default.
 */
/**
 * Guarantees the organization has a default lease template, creating one from
 * the English starter if it has none.
 *
 * The alternative, which is what this replaces, is that the first lease an
 * organization ever signs gets no contract and an empty tab: the worker skips
 * it with "no lease template", correctly refuses to retry, and nothing on
 * screen connects the missing PDF to a settings page nobody has visited. A
 * template someone must edit is a far better starting point than nothing.
 *
 * **The generated document is explicitly provisional.** `starterBody` is the
 * same draft the template editor offers, and its own note applies unchanged:
 * these clauses are the ordinary shape of a Tanzanian residential tenancy, not
 * legal advice, and every organization is expected to rewrite them. The
 * description says so on the template itself, so the person who eventually
 * opens Settings → Lease templates finds out how it got there.
 *
 * Returns whether it wrote one, so the caller can log the difference between
 * "used the template that was there" and "invented one".
 */
export async function ensureDefaultLeaseTemplate(
  organizationId: string
): Promise<{ created: boolean; templateId: string } | null> {
  const existingDefault = await prisma.leaseTemplate.findFirst({
    where: { organizationId, isDefault: true },
    select: { id: true },
  });
  if (existingDefault) {
    return { created: false, templateId: existingDefault.id };
  }

  /*
   * Templates but no default — possible for an organization whose only
   * template was written before `resolveDefault` existed. Promoting the oldest
   * is the smaller, more honest repair: this organization has already written
   * its own wording, and adding a starter beside it would generate contracts
   * from a document nobody here chose.
   */
  const oldest = await prisma.leaseTemplate.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (oldest) {
    await prisma.leaseTemplate.update({
      where: { id: oldest.id },
      data: { isDefault: true },
    });
    return { created: false, templateId: oldest.id };
  }

  const result = await createLeaseTemplate(organizationId, {
    name: DEFAULT_TEMPLATE_NAME,
    description: DEFAULT_TEMPLATE_DESCRIPTION,
    language: "en",
    body: starterBody("en"),
    isDefault: true,
  });

  if ("error" in result) {
    /*
     * `duplicate` means another worker won the race a moment ago — the unique
     * index did its job. Re-read rather than fail: the outcome the caller
     * wanted (a default template exists) is true either way.
     */
    const raced = await prisma.leaseTemplate.findFirst({
      where: { organizationId, isDefault: true },
      select: { id: true },
    });
    return raced ? { created: false, templateId: raced.id } : null;
  }

  return { created: true, templateId: result.template.id };
}

export async function generateLeaseContract(
  organizationId: string,
  leaseId: string,
  templateId?: string
): Promise<
  | { contract: GeneratedContract }
  | { error: "no-lease" | "no-template" }
> {
  const template = templateId
    ? await prisma.leaseTemplate.findFirst({
        where: { id: templateId, organizationId },
        select: { id: true, name: true, language: true, body: true },
      })
    : await prisma.leaseTemplate.findFirst({
        where: { organizationId, isDefault: true },
        select: { id: true, name: true, language: true, body: true },
      });
  if (!template) return { error: "no-template" };

  const context = await buildLeaseContext(organizationId, leaseId);
  if (!context) return { error: "no-lease" };

  const rendered = renderLeaseTemplate(template.body, {
    values: placeholderValues(context),
  });

  return {
    contract: {
      ...rendered,
      template: {
        id: template.id,
        name: template.name,
        language: template.language,
      },
      contractNumber: context.contractNumber,
    },
  };
}

export {
  DEFAULT_TEMPLATE_NAME,
  seedDefaultLeaseTemplate,
} from "@/lib/lease-template-starters";
