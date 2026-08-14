"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import {
  DataTableColumnHeader,
  RowActionButtons,
  type RowAction,
} from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types";
import type { PaymentRow } from "@/lib/payments";

/**
 * Every cell is a single line — no secondary captions. There is no view button
 * either: double-clicking the row opens its lease, which `getRowHref` on the
 * table provides.
 */
export function buildPaymentColumns({
  rowActions,
}: {
  rowActions: (payment: PaymentRow) => RowAction[];
}): ColumnDef<PaymentRow>[] {
  return [
    {
      accessorKey: "tenantName",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Tenant"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => <PersonCell name={row.original.tenantName} />,
    },
    {
      accessorKey: "propertyName",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Property"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.propertyName}
          <span className="text-muted-foreground"> / {row.original.unitLabel}</span>
        </span>
      ),
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
    },
    {
      id: "invoiceAmount",
      accessorFn: (row) => row.invoiceAmount,
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Invoiced"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      // Reference and amount on one line, not stacked: they name the same
      // thing, and a two-line cell made every row twice as tall for it.
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          <span className="font-mono text-xs">
            {row.original.invoiceReference}
          </span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-mono tabular-nums">
            {formatCurrencyFull(row.original.invoiceAmount)}
          </span>
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
      id: "invoiceStatus",
      accessorFn: (row) => row.invoiceStatus,
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={INVOICE_STATUS_VARIANT[row.original.invoiceStatus]}
          className="rounded-full font-normal"
        >
          {row.original.invoiceStatus}
        </Badge>
      ),
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Paid"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-mr-2 ml-auto flex"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono tabular-nums">
          {formatCurrencyFull(row.original.amount)}
        </div>
      ),
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
      id: "actions",
      header: "",
      cell: ({ row }) => <RowActionButtons actions={rowActions(row.original)} />,
      enableSorting: false,
    },
  ];
}
