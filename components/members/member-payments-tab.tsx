"use client";

import * as React from "react";
import { EyeIcon } from "lucide-react";

import { PaymentCard } from "@/components/payments/payment-card";
import { buildPaymentColumns } from "@/components/payments/payment-columns";
import { DataTable, type RowAction } from "@/components/ui/data-table";
import { INVOICE_STATUSES } from "@/lib/invoice-types";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";
import type { PaymentRow } from "@/lib/payments";

/**
 * Every payment this member has made, across all of their leases, in the same
 * `DataTable` the org-wide payments page uses.
 *
 * Read-only, deliberately. Recording and removing payments already has a home
 * on the Payments page and on the lease itself, and both of those start from an
 * *invoice* — which is the thing a payment is actually made against. A second
 * set of entry points here would mean a second set of dialogs to keep in step
 * for no new capability. This tab answers "what has this tenant paid?", which
 * nowhere else does.
 *
 * The tenant column is dropped: it would repeat the name at the top of the page
 * on every row. The property facet stays, because one tenant can hold leases in
 * several buildings.
 */
export function MemberPaymentsTab({
  payments,
  isTenant,
  roleName,
}: {
  payments: PaymentRow[];
  isTenant: boolean;
  roleName: string;
}) {
  const rowActions = React.useCallback(
    (payment: PaymentRow): RowAction[] => [
      {
        label: "View lease",
        icon: EyeIcon,
        href: `/leases/${payment.leaseId}`,
      },
    ],
    []
  );

  const columns = React.useMemo(
    () => buildPaymentColumns({ rowActions, showTenant: false }),
    [rowActions]
  );

  return (
    <DataTable
      columns={columns}
      data={payments}
      searchPlaceholder="Search payments…"
      facetFilters={[
        {
          columnId: "propertyName",
          placeholder: "All properties",
          label: "Property",
          multiple: true,
          // Derived from the rows on screen, so the filter can never offer a
          // property this member has never paid against.
          options: [...new Set(payments.map((payment) => payment.propertyName))]
            .sort()
            .map((name) => ({ label: name, value: name })),
        },
        {
          columnId: "invoiceStatus",
          placeholder: "All invoice statuses",
          label: "Invoice status",
          multiple: true,
          options: INVOICE_STATUSES.map((status) => ({
            label: status,
            value: status,
          })),
        },
        {
          columnId: "method",
          placeholder: "All methods",
          label: "Method",
          multiple: true,
          options: PAYMENT_METHOD_OPTIONS.map((option) => ({
            label: option,
            value: option,
          })),
        },
      ]}
      emptyMessage={
        isTenant
          ? "No payments recorded for this tenant yet. Payments are recorded against a lease's invoice."
          : `${roleName} members do not normally hold leases, so there is nothing to pay.`
      }
      getRowHref={(payment) => `/leases/${payment.leaseId}`}
      renderCard={(payment) => <PaymentCard payment={payment} />}
      rowActions={rowActions}
    />
  );
}
