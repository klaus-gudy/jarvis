import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** The role name created for the registrant in app/api/auth/register/route.ts. */
const OWNER_ROLE_NAME = "Owner";

/**
 * Properties don't store an owner — it is whoever holds the Owner role in the
 * organization. Cached so one lookup serves a whole render rather than firing
 * once per property card.
 */
export const getOrganizationOwnerName = cache(async (organizationId: string) => {
  const ownerMembership = await prisma.membership.findFirst({
    where: {
      organizationId,
      // Role names are free text and editable, so match loosely.
      role: { name: { equals: OWNER_ROLE_NAME, mode: "insensitive" } },
    },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });

  // email is optional now, so an owner could have neither name nor email.
  const ownerLabel =
    ownerMembership?.user.name ??
    ownerMembership?.user.email ??
    ownerMembership?.user.phone;
  if (ownerLabel) return ownerLabel;

  // No Owner-role member (renamed or removed) — the organization itself is the
  // best remaining answer, and beats rendering a blank owner line.
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  return organization?.name ?? "—";
});
