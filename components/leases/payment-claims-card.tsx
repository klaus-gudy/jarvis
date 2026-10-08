"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, PaperclipIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrencyFull, formatDate } from "@/lib/format";

export type BillingClaim = {
  id: string;
  amount: number;
  /** ISO string. */
  paidAt: string;
  method: string | null;
  notes: string | null;
  /** The tenant's receipt, if they attached one. */
  receiptId: string | null;
};

/**
 * Payments the tenant reported from the portal, above the ledger. Confirming
 * records a real payment (it then appears in the table below); rejecting
 * closes the claim with a reason the tenant is shown. Both need
 * `payment:record`, like the Record payment button.
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
  const [rejecting, setRejecting] = React.useState<BillingClaim | null>(null);

  async function review(
    claim: BillingClaim,
    body: { action: "confirm" } | { action: "reject"; reason: string }
  ) {
    setBusy(claim.id);
    const response = await fetch(`/api/invoices/${invoiceId}/claims/${claim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);

    if (response.ok) {
      toast.success(body.action === "confirm" ? "Payment confirmed" : "Payment rejected");
      setRejecting(null);
      router.refresh();
      return true;
    }
    const data = await response.json().catch(() => null);
    toast.error(data?.error ?? "Something went wrong");
    router.refresh();
    return false;
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
                {claim.receiptId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a href={`/api/documents/${claim.receiptId}`} target="_blank" rel="noreferrer" />
                    }
                  >
                    <PaperclipIcon />
                    Receipt
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canRecord || busy !== null}
                  title={canRecord ? undefined : "Your role doesn't allow this"}
                  onClick={() => setRejecting(claim)}
                >
                  <XIcon />
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={!canRecord || busy !== null}
                  title={canRecord ? undefined : "Your role doesn't allow this"}
                  onClick={() => review(claim, { action: "confirm" })}
                >
                  <CheckIcon />
                  {busy === claim.id ? "Saving…" : "Confirm"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      {/* Keyed per claim so the reason starts empty each time. */}
      {rejecting && (
        <RejectDialog
          key={rejecting.id}
          claim={rejecting}
          pending={busy !== null}
          onCancel={() => setRejecting(null)}
          onReject={(reason) => review(rejecting, { action: "reject", reason })}
        />
      )}
    </Card>
  );
}

function RejectDialog({
  claim,
  pending,
  onCancel,
  onReject,
}: {
  claim: BillingClaim;
  pending: boolean;
  onCancel: () => void;
  onReject: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Say why it is being rejected");
      return;
    }
    await onReject(reason.trim());
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reject this payment?</DialogTitle>
            <DialogDescription>
              {formatCurrencyFull(claim.amount)}, paid {formatDate(new Date(claim.paidAt))}. The
              tenant sees your reason in their portal and by email.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reject-reason" required>
              Reason
            </FieldLabel>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError(null);
              }}
              maxLength={500}
              placeholder="No payment with this reference reached our M-Pesa account."
              autoFocus
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Rejecting…" : "Reject payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
