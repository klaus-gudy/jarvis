import { z } from "zod";

import { requireActiveOrg } from "@/lib/api-auth";
import { toInternationalTzPhone, tzPhoneSchema } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { searchSmsAlerts, sendSms } from "@/lib/sms/notifier";
import {
  SMS_DEFAULT_PAGE_SIZE,
  SMS_MAX_LENGTH,
  SMS_PAGE_SIZES,
  SMS_STATUSES,
} from "@/lib/sms/sms-types";

/** `APP_TIME_ZONE` (Africa/Dar_es_Salaam) is UTC+3 all year. */
const DAR_OFFSET = "+03:00";

const querySchema = z.object({
  status: z.enum(SMS_STATUSES).optional(),
  // `YYYY-MM-DD` from a date input; widened to whole days below.
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce
    .number()
    .refine((value) => (SMS_PAGE_SIZES as readonly number[]).includes(value))
    .default(SMS_DEFAULT_PAGE_SIZE),
});

const sendSchema = z.object({
  phone: tzPhoneSchema,
  message: z
    .string()
    .trim()
    .min(1, "Write a message")
    .max(SMS_MAX_LENGTH, `Keep it under ${SMS_MAX_LENGTH} characters`),
});

/**
 * Every text costs money and the app has no permission model yet, so sending
 * is capped per user and per organization. In-memory, per process — see
 * `lib/rate-limit.ts` for what that does and doesn't buy.
 */
const PER_USER = { limit: 20, windowMs: 60 * 60 * 1000 };
const PER_ORG = { limit: 100, windowMs: 60 * 60 * 1000 };

/** The member, only if they belong to the caller's organization. */
function findMember(organizationId: string, membershipId: string) {
  return prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { user: { select: { phone: true } } },
  });
}

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
  const membership = await findMember(auth.context.organizationId, membershipId);
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

  const { status, from, to, page, limit } = parsed.data;
  const result = await searchSmsAlerts({
    recipient,
    status,
    // Date inputs mean whole days on the landlord's clock (`APP_TIME_ZONE`,
    // which has no DST), so the upper bound is that day's last instant.
    from: from ? `${from}T00:00:00.000${DAR_OFFSET}` : undefined,
    to: to ? `${to}T23:59:59.999${DAR_OFFSET}` : undefined,
    page,
    limit,
  });

  if (!result.ok) {
    return Response.json(
      { reason: result.reason },
      { status: result.reason === "not-configured" ? 503 : 502 }
    );
  }

  return Response.json({ ...result.data, recipient });
}

/**
 * Sends one SMS from the member page. The number is whatever was typed —
 * usually the member's own, prefilled — but a text only shows in a member's
 * SMS alerts tab when it went to that member's number, because notifier
 * records a phone, not a member.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/members/[membershipId]/sms">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { membershipId } = await ctx.params;
  const membership = await findMember(auth.context.organizationId, membershipId);
  if (!membership) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Checked after validation so a typo doesn't spend the budget.
  for (const [key, window] of [
    [`sms:user:${auth.context.userId}`, PER_USER],
    [`sms:org:${auth.context.organizationId}`, PER_ORG],
  ] as const) {
    const limited = rateLimit(key, window);
    if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  }

  // `tzPhoneSchema` already produced the local form, so this can't be null.
  const recipient = toInternationalTzPhone(parsed.data.phone)!;
  const result = await sendSms({ recipient, message: parsed.data.message });

  if (result.ok) {
    return Response.json({ ok: true, status: result.status, recipient }, { status: 201 });
  }
  if (result.reason === "rejected") {
    return Response.json(
      {
        error: "The SMS provider refused the message",
        detail: result.error,
        reason: "rejected",
      },
      { status: 502 }
    );
  }
  return Response.json(
    {
      error:
        result.reason === "not-configured"
          ? "SMS isn't set up on this server"
          : "The SMS service couldn't be reached",
      reason: result.reason,
    },
    { status: result.reason === "not-configured" ? 503 : 502 }
  );
}
