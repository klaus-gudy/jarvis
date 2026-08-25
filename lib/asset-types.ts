import { prisma } from "@/lib/prisma";
import type { FileAssetSubject } from "@/lib/generated/prisma/enums";

/**
 * Document types, which used to be a Prisma enum and are now rows.
 *
 * Two kinds live in one table. **System types** are the seventeen the enum
 * held, seeded by the 2026-08-25 migration with a null `organizationId`; they
 * are shared by every organization and cannot be renamed or deleted. **Custom
 * types** belong to exactly one organization and never appear in another's
 * dropdown — the same tenancy boundary `lib/documents.ts` enforces for files.
 */

/** One type as the client sees it. */
export type AssetTypeView = {
  id: string;
  key: string;
  label: string;
  subject: FileAssetSubject;
  allowsMultiple: boolean;
  isPhoto: boolean;
  isSystem: boolean;
};

const TYPE_SELECT = {
  id: true,
  key: true,
  label: true,
  subject: true,
  allowsMultiple: true,
  isPhoto: true,
  isSystem: true,
} as const;

/**
 * Every type this organization may file something under, for one subject.
 *
 * System rows first, then the organization's own alphabetically: the seeded
 * list is the one people already know, and a type someone added last week
 * appearing above "Title deed" would move the target every time.
 */
export async function listAssetTypes(
  organizationId: string,
  subject: FileAssetSubject
): Promise<AssetTypeView[]> {
  return prisma.fileAssetType.findMany({
    where: {
      subject,
      OR: [{ organizationId: null }, { organizationId }],
    },
    orderBy: [{ isSystem: "desc" }, { label: "asc" }],
    select: TYPE_SELECT,
  });
}

/**
 * `TITLE_DEED` shape, from whatever the person typed. Two labels that differ
 * only in punctuation or case collapse to the same key on purpose — "Site
 * plan" and "site-plan" are the same document type, and letting both exist
 * would split one dropdown entry into two.
 */
export function toAssetTypeKey(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * Adds a type to one organization, from the surface the person was standing
 * on. **`subject` and `isPhoto` are arguments, not questions** — the Images tab
 * on a property knows both, and asking someone to classify their own document
 * type into a taxonomy is exactly the friction this replaced.
 *
 * `allowsMultiple` **is** asked, via a checkbox next to the name, and defaults
 * to `false` — most invented types name one specific document ("Fire safety
 * certificate"), and a surprise 409 on the second upload is a smaller cost
 * than an unbounded pile nobody meant to allow.
 *
 * `isPhoto` does **not** decide `allowsMultiple`. An earlier version forced
 * every photo type to allow multiple, on the theory that a photo type is
 * always a gallery — wrong the moment a *singular* photo type existed, which
 * `PROFILE_PHOTO` now is (seeded directly, not through this function, but the
 * same column). The two flags describe different things: whether a type takes
 * images, and whether a subject may hold more than one.
 */
export async function createAssetType(
  organizationId: string,
  input: {
    label: string;
    subject: FileAssetSubject;
    isPhoto: boolean;
    allowsMultiple?: boolean;
  }
) {
  const label = input.label.trim();
  const key = toAssetTypeKey(label);

  // A label of only punctuation reduces to nothing, which would otherwise be
  // stored as an empty key and match everything.
  if (key.length === 0) return { error: "invalid-label" as const };

  // Checked against system rows *and* this organization's, because either
  // collision produces two entries reading the same in one dropdown. The
  // unique indexes are what actually guarantee it; this is what turns a
  // constraint violation into a sentence.
  const existing = await prisma.fileAssetType.findFirst({
    where: {
      key,
      OR: [{ organizationId: null }, { organizationId }],
    },
    select: { ...TYPE_SELECT, subject: true },
  });

  if (existing) {
    return { error: "duplicate" as const, existing };
  }

  const created = await prisma.fileAssetType.create({
    data: {
      key,
      label,
      subject: input.subject,
      isPhoto: input.isPhoto,
      allowsMultiple: input.allowsMultiple ?? false,
      organizationId,
      isSystem: false,
    },
    select: TYPE_SELECT,
  });

  return { assetType: created };
}

/**
 * The type a file is being filed under, if this organization is allowed to use
 * it. Resolved in one query rather than fetched and checked afterwards — the
 * same reason `getDocument` filters on `organizationId` inside its `where`.
 */
export async function resolveAssetType(
  organizationId: string,
  assetTypeId: string
) {
  return prisma.fileAssetType.findFirst({
    where: {
      id: assetTypeId,
      OR: [{ organizationId: null }, { organizationId }],
    },
    select: TYPE_SELECT,
  });
}
