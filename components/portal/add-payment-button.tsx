"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { RecordPaymentDialog } from "@/components/leases/record-payment-dialog"
import { Button } from "@/components/ui/button"

/**
 * The landlord's Record payment dialog, tenant-side. Same form, but it posts to
 * the portal's claims route: the payment waits for the landlord to confirm it
 * before it counts toward the balance.
 */
export function AddPaymentButton({
  invoice,
}: {
  invoice: { id: string; amount: number; paid: number; balance: number }
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        <PlusIcon />
        Add payment
      </Button>
      {/* Keyed so each opening starts from a clean form, as on the Billing tab. */}
      <RecordPaymentDialog
        key={String(open)}
        open={open}
        onOpenChange={setOpen}
        invoice={invoice}
        endpoint={`/api/portal/invoices/${invoice.id}/claims`}
        receiptEndpoint={(claimId) => `/api/portal/claims/${claimId}/receipt`}
        copy={{
          title: "Add payment",
          description:
            "Tell your landlord about a payment you made. It counts toward your balance once they confirm it.",
          submit: "Send for confirmation",
          success: "Payment sent to your landlord to confirm",
        }}
      />
    </>
  )
}
