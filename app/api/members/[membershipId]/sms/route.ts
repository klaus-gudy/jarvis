import { z } from "zod";

import { requireActiveOrg } from "@/lib/api-auth";
import { toInternationalTzPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { searchSmsAlerts } from "@/lib/sms/notifier";
import { SMS_STATUSES } from "@/lib/sms/sms-types";

/** `APP_TIME_ZONE` (Africa/Dar_es_Salaam) is UTC+3 all year. */
const DAR_OFFSET = "+03:00";

const querySchema = z.object({
  status: z.enum(SMS_STATUSES).optional(),
  // `YYYY-MM-DD` from a date input; widened to whole days below.
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

/**
 * The SMS alerts sent to one member's phone, read from notifier.
 *
 * The membership is looked up inside the caller's org first, so a membership
 * id from another organization answers 404 rather than that person's texts.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/members/[membershipId]/sms">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { membershipId } = await ctx.params;
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: auth.context.organizationId },
    select: { user: { select: { phone: true } } },
  });
  if (!membership) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  // Empty inputs arrive as "" — treat them as absent.
  for (const key of Object.keys(searchParams)) {
    if (searchParams[key] === "") delete searchParams[key];
  }
  const parsed = querySchema.safeParse(searchParams);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const phone = membership.user.phone;
  const recipient = phone ? toInternationalTzPhone(phone) : null;
  if (!recipient) {
    return Response.json({ reason: "no-phone" }, { status: 200 });
  }

  const { status, from, to, page } = parsed.data;
  const result = await searchSmsAlerts({
    recipient,
    status,
    // Date inputs mean whole days on the landlord's clock (`APP_TIME_ZONE`,
    // which has no DST), so the upper bound is that day's last instant.
    from: from ? `${from}T00:00:00.000${DAR_OFFSET}` : undefined,
    to: to ? `${to}T23:59:59.999${DAR_OFFSET}` : undefined,
    page,
  });

  if (!result.ok) {
    return Response.json(
      { reason: result.reason },
      { status: result.reason === "not-configured" ? 503 : 502 }
    );
  }

  return Response.json({ ...result.data, recipient });
}
