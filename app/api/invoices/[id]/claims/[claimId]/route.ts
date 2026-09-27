import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { authorize } from "@/lib/authz";
import { formatCurrencyFull } from "@/lib/format";
import { announceInvoiceSettled } from "@/lib/invoices";
import { confirmPaymentClaim, rejectPaymentClaim } from "@/lib/payment-claims";

const bodySchema = z.object({ action: z.enum(["confirm", "reject"]) });

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
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  const { id, claimId } = await ctx.params;
  const orgId = auth.context.organizationId;

  if (parsed.data.action === "reject") {
    const result = await rejectPaymentClaim(orgId, id, claimId);
    if (result.error) return Response.json({ error: "Claim not found" }, { status: 404 });
    revalidatePath("/leases");
    return Response.json({ ok: true });
  }

  const result = await confirmPaymentClaim(orgId, id, claimId);
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
  revalidatePath("/leases");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return Response.json({ payment: result.payment });
}
