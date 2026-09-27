import type { PermissionRequirement } from "@/lib/authz";

/**
 * Which permission reading or writing a document needs depends on what it is
 * filed under: a property photo is part of the property, a contract part of
 * the lease. `document:read` / `document:write` cover everything; the subject's
 * own permission covers that subject's files.
 *
 * A member's own files (their profile photo) need nothing beyond membership,
 * and every member's profile photo is readable by any staff member — avatars
 * are drawn across the whole app. Tenants follow the same permissions as
 * everyone else; only the profile-photo courtesy is withheld from them.
 */
export type DocumentSubject = {
  subjectType: string;
  subjectId: string | null;
  isProfilePhoto?: boolean;
};

export function documentRequirement(
  subject: DocumentSubject,
  mode: "read" | "write",
  viewer: { membershipId: string; kind: string }
): PermissionRequirement | null {
  if (subject.subjectType === "MEMBERSHIP" && subject.subjectId === viewer.membershipId) {
    return null;
  }
  // Avatars are drawn across the staff app; a tenant isn't browsing other
  // people's photos, so for them it falls through to the normal rule.
  if (mode === "read" && subject.isProfilePhoto && viewer.kind !== "TENANT") return null;

  const general = mode === "read" ? "document:read" : "document:write";
  switch (subject.subjectType) {
    case "PROPERTY":
    case "UNIT":
      return [general, mode === "read" ? "property:read" : "property:write"];
    case "LEASE":
    case "INVOICE":
    case "PAYMENT":
      return [general, mode === "read" ? "lease:read" : "lease:write"];
    case "MEMBERSHIP":
      return mode === "read"
        ? [general, "tenant:read", "member:read"]
        : [general, "tenant:write", "member:write"];
    default:
      return general;
  }
}

/** The subject of a stored row, from its six nullable subject columns. */
export function subjectOfRow(row: {
  propertyId: string | null;
  unitId: string | null;
  membershipId: string | null;
  leaseId: string | null;
  invoiceId: string | null;
  paymentId: string | null;
  assetType: { key: string };
}): DocumentSubject {
  const pairs: [string, string | null][] = [
    ["PROPERTY", row.propertyId],
    ["UNIT", row.unitId],
    ["MEMBERSHIP", row.membershipId],
    ["LEASE", row.leaseId],
    ["INVOICE", row.invoiceId],
    ["PAYMENT", row.paymentId],
  ];
  const [subjectType, subjectId] = pairs.find(([, id]) => id) ?? ["ORGANIZATION", null];
  return { subjectType, subjectId, isProfilePhoto: row.assetType.key === "PROFILE_PHOTO" };
}
