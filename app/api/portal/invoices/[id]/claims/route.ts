import { revalidatePath } from "next/cache";

import { authorizeTenant } from "@/lib/authz";
import { formatCurrencyFull } from "@/lib/format";
import { recordPaymentSchema } from "@/lib/invoices-schemas";
import { createPaymentClaim } from "@/lib/payment-claims";

/**
 * A tenant reports a payment on their own invoice. Same body and validation as
 * the landlord's `POST /api/invoices/[id]/payments`, but it files a claim for
 * the landlord to confirm — nothing here touches a balance.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/portal/invoices/[id]/claims">) {
  const auth = await authorizeTenant();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const result = await createPaymentClaim(auth.context, id, parsed.data);

  if (result.error === "not-found") {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (result.error === "overpayment") {
    return Response.json(
      {
        error: "Validation failed",
        issues: {
          amount: [`That's more than the remaining balance of ${formatCurrencyFull(result.balance)}`],
        },
      },
      { status: 400 }
    );
  }

  revalidatePath("/portal/payments");
  revalidatePath("/leases");
  return Response.json({ claim: result.claim }, { status: 201 });
}
