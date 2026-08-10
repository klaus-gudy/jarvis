import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { recordPaymentSchema } from "@/lib/invoices-schemas";
import { recordPayment } from "@/lib/invoices";

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
            `That's more than the remaining balance of ${result.balance}`,
          ],
        },
      },
      { status: 400 }
    );
  }

  revalidatePath("/leases");
  revalidatePath("/payments");
  // "Rent collected" is a sum of payment rows now, so it moves with this.
  revalidatePath("/dashboard");

  return Response.json({ payment: result.payment }, { status: 201 });
}
