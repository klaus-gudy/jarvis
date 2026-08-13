"use client";

import type { ColumnDef } from "@tanstack/react-table";

import {
  DataTableColumnHeader,
  RowActionButtons,
  type RowAction,
} from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";

export type BillingPaymentRow = {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  notes: string | null;
  /** Every row on this table shares one invoice, but the column keeps the
   * shape consistent with the org-wide payments table. */
  invoiceReference: string;
};

export function buildBillingPaymentColumns({
  rowActions,
}: {
  rowActions: (payment: BillingPaymentRow) => RowAction[];
}): ColumnDef<BillingPaymentRow>[] {
  return [
    {
      accessorKey: "invoiceReference",
      header: "Invoice",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">
          {row.original.invoiceReference}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Amount"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {formatCurrencyFull(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: "method",
      header: "Method",
      cell: ({ row }) => row.original.method ?? "—",
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
    },
    {
      accessorKey: "paidAt",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Date"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => formatDate(new Date(row.original.paidAt)),
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.notes ?? "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <RowActionButtons actions={rowActions(row.original)} />,
      enableSorting: false,
    },
  ];
}
