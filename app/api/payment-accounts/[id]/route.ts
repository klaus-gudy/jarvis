import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import {
  deletePaymentAccount,
  updatePaymentAccount,
} from "@/lib/payment-accounts";
import { paymentAccountSchema } from "@/lib/payment-accounts-schemas";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/payment-accounts/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = paymentAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const result = await updatePaymentAccount(auth.context, id, parsed.data);

  // 404 whether the account never existed or belongs to someone else, so the
  // response can't be used to probe for other members' account ids.
  if ("error" in result) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  revalidatePath("/profile");
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/payment-accounts/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await deletePaymentAccount(auth.context, id);
  if ("error" in result) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  revalidatePath("/profile");
  return Response.json({ ok: true });
}
