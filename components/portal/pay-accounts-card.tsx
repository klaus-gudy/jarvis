"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, LandmarkIcon } from "lucide-react"

import { CopyButton } from "@/components/portal/copy-button"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  PAYMENT_ACCOUNT_NUMBER_LABEL,
  PAYMENT_ACCOUNT_TYPE_LABEL,
  type PaymentAccountTypeValue,
} from "@/lib/payment-account-options"

type Account = {
  id: string
  type: PaymentAccountTypeValue
  provider: string
  accountNumber: string
  accountName: string | null
  isDefault: boolean
}

/**
 * Fourth card of the tenant Home's top row: where to send rent. Shaped like
 * `MetricCard` (same padding, icon tile, rule and caption sizes) but not built
 * from it — that card is one big link, and a copy button can't sit inside a
 * link. Shows one account at a time, preferred first, with arrows through the
 * rest.
 */
export function PayAccountsCard({
  accounts,
  reference,
}: {
  accounts: Account[]
  /** The lease reference to quote with the payment, if there is a lease. */
  reference: string | null
}) {
  const [index, setIndex] = React.useState(0)
  const account = accounts[index] ?? null

  return (
    <Card className="gap-0 p-0 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LandmarkIcon className="size-5" aria-hidden />
          </span>
          {accounts.length > 1 ? (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Previous account"
                onClick={() => setIndex((i) => (i - 1 + accounts.length) % accounts.length)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}/{accounts.length}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Next account"
                onClick={() => setIndex((i) => (i + 1) % accounts.length)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : account?.isDefault ? (
            <Preferred />
          ) : null}
        </div>

        {account ? (
          <div className="mt-auto pt-6">
            <div className="flex items-center gap-1">
              <p className="min-w-0 truncate text-xl font-bold tracking-tight tabular-nums">
                {account.accountNumber}
              </p>
              <CopyButton
                value={account.accountNumber}
                label={PAYMENT_ACCOUNT_NUMBER_LABEL[account.type]}
              />
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {account.provider} · {PAYMENT_ACCOUNT_TYPE_LABEL[account.type]}
              {accounts.length > 1 && account.isDefault && <Preferred />}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{account.accountName ?? "—"}</p>
                <p className="text-[11px] leading-tight text-muted-foreground">Account name</p>
              </div>
              <div className="min-w-0">
                {reference ? (
                  <div className="flex items-center gap-0.5">
                    <p className="truncate text-sm font-semibold tabular-nums">{reference}</p>
                    <CopyButton value={reference} label="Reference" />
                  </div>
                ) : (
                  <p className="text-sm font-semibold">—</p>
                )}
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Quote as reference
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-6">
            <p className="text-xl font-bold tracking-tight">No details yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your landlord hasn&apos;t added payment details. Ask them how to pay.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

function Preferred() {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      Preferred
    </span>
  )
}
