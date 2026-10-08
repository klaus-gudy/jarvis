import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { authorize } from "@/lib/authz";
import { formatCurrencyFull } from "@/lib/format";
import { announceInvoiceSettled, announcePaymentRecorded } from "@/lib/invoices";
import {
  announceClaimRejected,
  confirmPaymentClaim,
  rejectPaymentClaim,
} from "@/lib/payment-claims";

/** A rejection must say why: the tenant reads it in the portal and by email. */
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({
    action: z.literal("reject"),
    reason: z
      .string({ error: "Say why it is being rejected" })
      .trim()
      .min(1, "Say why it is being rejected")
      .max(500, "Keep the reason under 500 characters"),
  }),
]);

/**
 * Confirm or reject a tenant's reported payment. Confirming records a payment,
 * so both need `payment:record` — the same right as the Record payment button.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/invoices/[id]/claims/[claimId]">
) {
  const auth = await authorize("payment:record");
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const reason = parsed.error.issues.find((issue) => issue.path[0] === "reason");
    return Response.json({ error: reason?.message ?? "Invalid action" }, { status: 400 });
  }

  const { id, claimId } = await ctx.params;
  const orgId = auth.context.organizationId;

  if (parsed.data.action === "reject") {
    const result = await rejectPaymentClaim(orgId, id, claimId, parsed.data.reason, auth.context);
    if (result.error) return Response.json({ error: "Claim not found" }, { status: 404 });
    after(() => announceClaimRejected(claimId));
    revalidatePath("/leases");
    revalidatePath("/portal/payments", "layout");
    return Response.json({ ok: true });
  }

  const result = await confirmPaymentClaim(orgId, id, claimId, auth.context);
  if (result.error === "not-found") {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }
  if (result.error === "already-reviewed") {
    return Response.json({ error: "This payment was already reviewed" }, { status: 409 });
  }
  if (result.error === "overpayment") {
    return Response.json(
      {
        error: `That's more than the remaining balance of ${formatCurrencyFull(result.balance)}`,
      },
      { status: 400 }
    );
  }

  if (result.facts) {
    const { facts } = result;
    after(() => announceInvoiceSettled(orgId, facts));
  }
  const { receipt } = result;
  after(() => announcePaymentRecorded(receipt, true));
  revalidatePath("/leases");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return Response.json({ payment: result.payment });
}
