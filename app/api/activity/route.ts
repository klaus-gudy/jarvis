import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ACTIVITY_SUBJECT_TYPES,
  PAYMENT_ACTIVITY_TYPES,
  getActivity,
  type ActivitySubjectType,
} from "@/lib/activity";
import { authorize, can, type PermissionRequirement } from "@/lib/authz";
import type { Prisma } from "@/lib/generated/prisma/client";

/** A timeline needs the permission of the page it sits on. */
const SUBJECT_PERMISSION: Record<ActivitySubjectType, PermissionRequirement> = {
  Property: "property:read",
  Unit: "property:read",
  Lease: "lease:read",
  Membership: ["tenant:read", "member:read"],
};

const querySchema = z.object({
  // `Unit:<id>`; absent for an org-wide feed.
  subject: z
    .string()
    .regex(new RegExp(`^(${ACTIVITY_SUBJECT_TYPES.join("|")}):[a-z0-9-]{1,40}$`))
    .optional(),
  feed: z.enum(["all", "payments"]).default("all"),
  cursor: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * One page of a timeline, newest first. Always scoped to the caller's
 * organization, so a subject id from elsewhere just returns nothing.
 */
export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { subject, feed, cursor, limit } = parsed.data;

  const requirement: PermissionRequirement = subject
    ? SUBJECT_PERMISSION[subject.split(":")[0] as ActivitySubjectType]
    : feed === "payments"
      ? "payment:read"
      : "dashboard:read";
  const auth = await authorize(requirement);
  if (!auth.ok) return auth.response;

  // A unit's page needs only `property:read`, but its history includes the
  // leases and money on it — hidden unless the caller could read those anyway.
  const exclude: Prisma.ModelName[] = [];
  if (!can(auth.context, "lease:read")) exclude.push("Lease", "Invoice");
  if (!can(auth.context, "payment:read")) exclude.push("Payment", "PaymentClaim");

  const page = await getActivity(
    auth.context.organizationId,
    {
      subject,
      types: !subject && feed === "payments" ? PAYMENT_ACTIVITY_TYPES : undefined,
      exclude,
    },
    { cursor, limit }
  );
  return NextResponse.json(page);
}
