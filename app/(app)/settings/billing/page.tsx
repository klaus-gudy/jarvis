import { CreditCardIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can, requireStaffPage } from "@/lib/authz";
import { getSubscriptionOverview } from "@/lib/billing/subscriptions";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { monthlyPrice, PRICING_PLANS, subscribePath } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata = { title: "Billing" };

/**
 * The organization's own plan with us: what is paid, until when, and the way
 * to pay. Open to any staff member — someone sent here by `/subscribe` without
 * `org:manage` should learn who can pay, not be bounced elsewhere — but only
 * `org:manage` gets working Pay buttons. Paying goes through `/subscribe`,
 * which attaches this organization to the checkout link.
 */
export default async function BillingSettingsPage() {
  const access = await requireStaffPage();
  if (!access) {
    return (
      <EmptyState
        icon={CreditCardIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const canPay = can(access, "org:manage");
  const { current, paidUntil, history } = await getSubscriptionOverview(access.organizationId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card>
        <ProfileCardHeader title="Current plan" />
        <CardContent>
          {current ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="text-2xl font-semibold tracking-tight">{current.planName}</p>
              <Badge variant="secondary" className="rounded-full capitalize">
                {current.billing}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Paid until{" "}
                <span className="font-medium text-foreground">
                  {formatDate(paidUntil ?? current.paidUntil)}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No plan is paid for yet. Choose one below — paying early never loses days, a
              new period starts where the current one ends.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <Card key={plan.slug} className={cn(current?.plan === plan.slug && "ring-2 ring-primary")}>
            <CardContent className="flex h-full flex-col gap-3">
              <div>
                <p className="text-lg font-semibold">{plan.name}</p>
                <p className="text-sm text-muted-foreground">{plan.audience}</p>
              </div>
              <p className="text-sm">
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrencyFull(monthlyPrice(plan))}
                </span>{" "}
                a month, or{" "}
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrencyFull(plan.yearlyPrice)}
                </span>{" "}
                a year
              </p>
              <div className="mt-auto flex gap-2">
                {(["monthly", "yearly"] as const).map((billing) =>
                  canPay ? (
                    // A plain <a>: `/subscribe` redirects to snippe's checkout.
                    <Button
                      key={billing}
                      size="sm"
                      variant={billing === "yearly" ? "default" : "outline"}
                      className="flex-1"
                      nativeButton={false}
                      render={<a href={subscribePath(plan.slug, billing)} />}
                    >
                      Pay {billing}
                    </Button>
                  ) : (
                    <Button
                      key={billing}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled
                      title="Only someone who can manage the organization can pay"
                    >
                      Pay {billing}
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {!canPay && (
        <p className="text-sm text-muted-foreground">
          Paying for a plan needs the “Organization settings” permission — ask an Owner.
        </p>
      )}

      <Card>
        <ProfileCardHeader title="Payments" />
        <CardContent className="px-0">
          {history.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">Nothing paid yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Plan</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Covers</TableHead>
                  <TableHead className="pr-6 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6 font-medium">{row.planName}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{row.billing}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(row.startsAt)} – {formatDate(row.paidUntil)}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-mono tabular-nums">
                      {formatCurrencyFull(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
