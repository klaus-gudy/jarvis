"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LandmarkIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { PaymentAccountDialog } from "@/components/profile/payment-account-dialog";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAYMENT_ACCOUNT_TYPE_LABEL } from "@/lib/payment-account-options";
import type { PaymentAccountRow } from "@/lib/payment-accounts";
import { cn } from "@/lib/utils";

export function PaymentAccountsCard({
  accounts,
}: {
  accounts: PaymentAccountRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<PaymentAccountRow | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PaymentAccountRow | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const response = await fetch(`/api/payment-accounts/${deleting.id}`, {
      method: "DELETE",
    });
    setPending(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Could not delete the account");
      return;
    }

    setDeleting(null);
    toast.success("Payment account removed");
    router.refresh();
  }

  return (
    <>
      <Card>
        <ProfileCardHeader
          title="Payment accounts"
          icon={LandmarkIcon}
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <PlusIcon />
              Add account
            </Button>
          }
        />

        <CardContent className={accounts.length > 0 ? "px-0" : undefined}>
          {accounts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No payment accounts yet. Add one so tenants know where to send rent.
            </p>
          ) : (
            // No scroll wrapper here: `Table` already renders its own
            // `data-slot="table-container"` with `overflow-x-auto`, and nesting
            // a second one just creates a scroller that never scrolls.
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Account/Lipa number</TableHead>
                    <TableHead>Account name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        {PAYMENT_ACCOUNT_TYPE_LABEL[account.type]}
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {account.provider}
                          {account.isDefault && (
                            <Badge
                              variant="outline"
                              className="border-stat-accent/40 bg-stat-accent/10 text-[10px] text-stat-accent"
                            >
                              Default
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {account.accountNumber}
                      </TableCell>
                      <TableCell
                        className={cn(
                          !account.accountName &&
                            "italic text-muted-foreground/60"
                        )}
                      >
                        {account.accountName || "Not set"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${account.provider} account`}
                            onClick={() => setEditing(account)}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${account.provider} account`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleting(account)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/*
        Keyed remounts rather than an effect that re-seeds state on open —
        `react-hooks/set-state-in-effect` forbids the effect pattern, and the
        key re-reads the account's values every time the dialog opens.
      */}
      {adding && (
        <PaymentAccountDialog
          key="add"
          open
          onOpenChange={setAdding}
          account={null}
          isFirstAccount={accounts.length === 0}
        />
      )}
      {editing && (
        <PaymentAccountDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          account={editing}
          isFirstAccount={accounts.length === 1}
        />
      )}

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove payment account?</DialogTitle>
            <DialogDescription>
              {deleting?.provider} ending {deleting?.accountNumber.slice(-4)} will
              no longer be shown to tenants. Payments already recorded are not
              affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
