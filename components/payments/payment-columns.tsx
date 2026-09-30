"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { PropertyHoverCard } from "@/components/hover-cards/property-hover-card";
import { TenantHoverCard } from "@/components/hover-cards/tenant-hover-card";
import { UnitHoverCard } from "@/components/hover-cards/unit-hover-card";
import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import {
  DataTableColumnHeader,
  facetFilterFn,
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
 *
 * `showTenant` is off for the Payments tab on a member's own page, where the
 * column would repeat the name at the top of the page down every row.
 */
export function buildPaymentColumns({
  rowActions,
  showTenant = true,
  canReadTenants,
  canReadProperties,
}: {
  rowActions: (payment: PaymentRow) => RowAction[];
  showTenant?: boolean;
  /** Each name previews and links only when its page would open. */
  canReadTenants: boolean;
  canReadProperties: boolean;
}): ColumnDef<PaymentRow>[] {
  return [
    ...(showTenant
      ? [
          {
            accessorKey: "tenantName",
            header: ({ column }) => (
              <DataTableColumnHeader
                title="Tenant"
                sorted={column.getIsSorted()}
                onToggle={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="-ml-2"
              />
            ),
            cell: ({ row }) => (
              <PersonCell
                name={row.original.tenantName}
                photoId={row.original.photoId}
              >
                <TenantHoverCard
                  tenant={{
                    name: row.original.tenantName,
                    phone: row.original.tenantPhone,
                    email: row.original.tenantEmail,
                    photoId: row.original.photoId,
                    context: `Unit ${row.original.unitLabel} · ${row.original.propertyName}`,
                  }}
                  href={
                    canReadTenants ? `/members/${row.original.membershipId}` : null
                  }
                  className="hover:underline"
                  align="start"
                />
              </PersonCell>
            ),
          } satisfies ColumnDef<PaymentRow>,
        ]
      : []),
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
          <PropertyHoverCard
            property={row.original.property}
            href={canReadProperties ? `/properties/${row.original.propertyId}` : null}
            className="hover:underline"
          />
          <span className="text-muted-foreground">
            {" / "}
            <UnitHoverCard
              unit={row.original.unit}
              href={
                canReadProperties
                  ? `/properties/${row.original.propertyId}/units/${row.original.unitId}`
                  : null
              }
              className="hover:text-foreground hover:underline"
            />
          </span>
        </span>
      ),
      filterFn: facetFilterFn,
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
      filterFn: facetFilterFn,
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
      filterFn: facetFilterFn,
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
