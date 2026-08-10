import { redirect } from "next/navigation";
import { WalletIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PaymentsTable } from "@/components/payments/payments-table";
import { getCurrentUser } from "@/lib/auth/session";
import { getPayableInvoices, getPayments } from "@/lib/payments";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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

  return <PaymentsTable payments={payments} payableInvoices={payableInvoices} />;
}
