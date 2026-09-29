"use client";

import * as React from "react";
import { EyeIcon } from "lucide-react";

import { UnitLeaseCard } from "@/components/properties/unit-lease-card";
import {
  buildUnitLeaseColumns,
  type UnitLeaseRow,
} from "@/components/properties/unit-lease-columns";
import { DataTable, type RowAction } from "@/components/ui/data-table";

/**
 * Every lease this unit has held, newest first — the member page's Leases tab
 * seen from the unit's side. Rows open the lease; there is no create button
 * because the lease form picks from free units and has no way to lock one.
 */
export function UnitLeasesTab({ leases }: { leases: UnitLeaseRow[] }) {
  const columns = React.useMemo(() => buildUnitLeaseColumns(), []);

  return (
    <DataTable
      columns={columns}
      data={leases}
      searchPlaceholder="Search leases…"
      facetFilters={[
        {
          columnId: "status",
          placeholder: "All statuses",
          label: "Status",
          multiple: true,
          options: [
            { label: "Active", value: "Active" },
            { label: "Upcoming", value: "Upcoming" },
            { label: "Ended", value: "Ended" },
            { label: "Renewed", value: "Renewed" },
          ],
        },
      ]}
      emptyMessage="This unit has never been leased. Create a lease from the Leases page to let it."
      getRowHref={(lease) => `/leases/${lease.id}`}
      renderCard={(lease) => <UnitLeaseCard lease={lease} />}
      rowActions={(lease): RowAction[] => [
        {
          label: "View lease",
          icon: EyeIcon,
          href: `/leases/${lease.id}`,
        },
      ]}
    />
  );
}
