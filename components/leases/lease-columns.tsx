"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ExpiryTag } from "@/components/leases/expiry-tag";
import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTableColumnHeader,
  RowActionButtons,
  type RowAction,
} from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/invoices";
import type { LeaseRow } from "@/lib/leases";

const STATUS_VARIANT: Record<
  LeaseRow["status"],
  "secondary" | "outline" | "destructive"
> = {
  Active: "secondary",
  Upcoming: "outline",
  Ended: "outline",
};

const INVOICE_STATUS_VARIANT: Record<
  InvoiceStatus,
  "secondary" | "outline" | "destructive"
> = {
  Paid: "secondary",
  Partial: "outline",
  Unpaid: "destructive",
};

export function buildLeaseColumns({
  rowActions,
}: {
  rowActions: (lease: LeaseRow) => RowAction[];
}): ColumnDef<LeaseRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked)}
          aria-label={`Select lease for ${row.original.tenantName}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
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
      cell: ({ row }) => row.original.propertyName,
      // Exact match, not TanStack's default substring behaviour — a facet
      // offering "Likely" must not also match "Likely Annex".
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
    },
    {
      accessorKey: "unitLabel",
      header: "Unit",
      cell: ({ row }) => <span className="font-medium">{row.original.unitLabel}</span>,
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Start date"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => formatDate(new Date(row.original.startDate)),
    },
    {
      accessorKey: "endDate",
      header: "End date",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {formatDate(new Date(row.original.endDate))}
          <ExpiryTag expiry={row.original.expiry} />
        </div>
      ),
    },
    {
      accessorKey: "durationMonths",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Duration"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => `${row.original.durationMonths} months`,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={STATUS_VARIANT[row.original.status]}
          className="rounded-full font-normal"
        >
          {row.original.status}
        </Badge>
      ),
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
    },
    {
      id: "invoiceStatus",
      accessorFn: (row) => row.invoice?.status ?? "Unpaid",
      header: "Invoice",
      cell: ({ row }) => {
        const status = row.original.invoice?.status ?? "Unpaid";
        return (
          <Badge
            variant={INVOICE_STATUS_VARIANT[status]}
            className="rounded-full font-normal"
          >
            {status}
          </Badge>
        );
      },
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
    },
    {
      accessorKey: "leaseAmount",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Lease amount"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-mr-2 ml-auto flex"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono tabular-nums">
          {formatCurrencyFull(row.original.leaseAmount)}
        </div>
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
