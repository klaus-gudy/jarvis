"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";

import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types";
import type { PaymentRow } from "@/lib/payments";

/**
 * Every cell is a single line — no secondary captions. There is no view button
 * either: double-clicking the row opens its lease, which `getRowHref` on the
 * table provides.
 */
export function buildPaymentColumns({
  onDelete,
}: {
  onDelete: (payment: PaymentRow) => void;
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
      id: "invoiceAmount",
      accessorFn: (row) => row.invoiceAmount,
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Invoiced"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-mr-2 ml-auto flex"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono tabular-nums">
          {formatCurrencyFull(row.original.invoiceAmount)}
        </div>
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
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(row.original)}
            aria-label={`Remove payment of ${row.original.amount}`}
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
