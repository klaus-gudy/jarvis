import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireActiveOrg } from "@/lib/api-auth";
import { formatCurrencyFull } from "@/lib/format";
import { recordPaymentSchema } from "@/lib/invoices-schemas";
import { announceInvoiceSettled, recordPayment } from "@/lib/invoices";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/invoices/[id]/payments">
) {
  const auth = await requireActiveOrg();
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
  const result = await recordPayment(auth.context.organizationId, id, parsed.data);

  if (result.error === "not-found") {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (result.error === "overpayment") {
    return Response.json(
      {
        error: "Validation failed",
        issues: {
          amount: [
            // Formatted, not raw: this message is shown verbatim under the
            // field, and "200000" beside a form that groups everything else
            // reads as a different kind of number.
            `That's more than the remaining balance of ${formatCurrencyFull(result.balance)}`,
          ],
        },
      },
      { status: 400 }
    );
  }

  // Only on the payment that actually cleared the invoice — `recordPayment`
  // compares against the balance as it stood before this one landed.
  if (result.facts) {
    const { facts } = result;
    after(() => announceInvoiceSettled(auth.context.organizationId, facts));
  }

  revalidatePath("/leases");
  revalidatePath("/payments");
  // "Rent collected" is a sum of payment rows now, so it moves with this.
  revalidatePath("/dashboard");

  return Response.json({ payment: result.payment }, { status: 201 });
}
