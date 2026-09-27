"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyFull, formatDate } from "@/lib/format";

export type BillingClaim = {
  id: string;
  amount: number;
  /** ISO string. */
  paidAt: string;
  method: string | null;
  notes: string | null;
};

/**
 * Payments the tenant reported from the portal, above the ledger. Confirming
 * records a real payment (it then appears in the table below); rejecting just
 * closes the claim. Both need `payment:record`, like the Record payment button.
 */
export function PaymentClaimsCard({
  invoiceId,
  claims,
  canRecord,
}: {
  invoiceId: string;
  claims: BillingClaim[];
  canRecord: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function review(claim: BillingClaim, action: "confirm" | "reject") {
    setBusy(claim.id);
    const response = await fetch(`/api/invoices/${invoiceId}/claims/${claim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);

    if (response.ok) {
      toast.success(action === "confirm" ? "Payment confirmed" : "Payment rejected");
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => null);
    toast.error(data?.error ?? "Something went wrong");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          Reported by the tenant
          <Badge variant="secondary" className="rounded-full">
            {claims.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-mono font-medium tabular-nums">
                  {formatCurrencyFull(claim.amount)}
                </p>
                <p className="truncate text-muted-foreground">
                  Paid {formatDate(new Date(claim.paidAt))}
                  {claim.method ? ` · ${claim.method}` : ""}
                  {claim.notes ? ` · ${claim.notes}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canRecord || busy !== null}
                  title={canRecord ? undefined : "Your role doesn't allow this"}
                  onClick={() => review(claim, "reject")}
                >
                  <XIcon />
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={!canRecord || busy !== null}
                  title={canRecord ? undefined : "Your role doesn't allow this"}
                  onClick={() => review(claim, "confirm")}
                >
                  <CheckIcon />
                  {busy === claim.id ? "Saving…" : "Confirm"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
