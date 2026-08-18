import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { createPaymentAccount, getPaymentAccounts } from "@/lib/payment-accounts";
import { paymentAccountSchema } from "@/lib/payment-accounts-schemas";

/** Always the signed-in member's own accounts — there is no id to pass. */
export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const accounts = await getPaymentAccounts(auth.context);
  return Response.json({ accounts });
}

export async function POST(request: Request) {
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

  const result = await createPaymentAccount(auth.context, parsed.data);
  if ("error" in result) {
    return Response.json({ error: "No membership found" }, { status: 403 });
  }

  revalidatePath("/profile");
  return Response.json({ ok: true, id: result.account.id }, { status: 201 });
}
