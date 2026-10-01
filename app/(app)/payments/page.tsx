import { redirect } from "next/navigation";
import { WalletIcon } from "lucide-react";

import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { EmptyState } from "@/components/empty-state";
import { PaymentsTable } from "@/components/payments/payments-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser, SESSION_EXPIRED_PATH } from "@/lib/auth/session";
import { requireStaffPage } from "@/lib/authz";
import { getPayableInvoices, getPayments } from "@/lib/payments";

export default async function PaymentsPage() {
  await requireStaffPage("payment:read");
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_EXPIRED_PATH);

  if (!user.activeOrgId) {
    return (
      <EmptyState
        icon={WalletIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const [payments, payableInvoices] = await Promise.all([
    getPayments(user.activeOrgId),
    getPayableInvoices(user.activeOrgId),
  ]);

  return (
    <Tabs defaultValue="ledger">
      <TabsList variant="line" className="w-full justify-start border-b">
        <TabsTrigger value="ledger" className="flex-none px-3">
          Ledger
        </TabsTrigger>
        {/* Includes what the ledger can't: reversed payments and the claims
            tenants reported. */}
        <TabsTrigger value="activity" className="flex-none px-3">
          Activity
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ledger" className="pt-5">
        <PaymentsTable payments={payments} payableInvoices={payableInvoices} />
      </TabsContent>
      <TabsContent value="activity" className="pt-5">
        <ActivityTimeline feed="payments" emptyMessage="No payment activity yet." />
      </TabsContent>
    </Tabs>
  );
}
