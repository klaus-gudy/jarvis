import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { deletePayment } from "@/lib/invoices";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/invoices/[id]/payments/[paymentId]">
) {
  const auth = await authorize("payment:reverse");
  if (!auth.ok) return auth.response;

  const { id, paymentId } = await ctx.params;
  const result = await deletePayment(auth.context.organizationId, id, paymentId, auth.context);

  if (result.error === "not-found") {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }

  revalidatePath("/leases");
  revalidatePath("/payments");
  revalidatePath("/dashboard");

  return Response.json({ ok: true });
}
