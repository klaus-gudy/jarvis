"use client";

import { DataTable } from "@/components/ui/data-table";
import { unitColumns, type UnitRow } from "@/components/properties/unit-columns";

export function UnitsTable({ units }: { units: UnitRow[] }) {
  return (
    <DataTable
      columns={unitColumns}
      data={units}
      searchColumnId="label"
      searchPlaceholder="Filter units…"
      facetFilters={[
        {
          columnId: "status",
          placeholder: "All statuses",
          options: [
            { label: "Occupied", value: "Occupied" },
            { label: "Vacant", value: "Vacant" },
          ],
        },
      ]}
      emptyMessage="No units match your filters."
    />
  );
}
