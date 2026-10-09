"use client";

import * as React from "react";
import { EyeIcon, FileTextIcon, PencilIcon } from "lucide-react";

import { gateActions, useCan } from "@/components/permissions-provider";
import {
  UnitFormDialog,
  unitFormValues,
} from "@/components/properties/unit-form-dialog";
import { AllUnitCard } from "@/components/units/all-unit-card";
import { buildAllUnitColumns } from "@/components/units/all-unit-columns";
import { DataTable, type RowAction } from "@/components/ui/data-table";
import { UNIT_TYPE_OPTIONS } from "@/lib/unit-options";
import type { UnitListRow } from "@/lib/units";

/**
 * Every unit in the organization, one row each — the leases page lists every
 * term, so a unit let three times appears three times there; here it appears
 * once, with who is in it now or was last.
 *
 * Adding a unit stays on its property's page, where the property is already
 * chosen.
 */
export function AllUnitsTable({ units }: { units: UnitListRow[] }) {
  const [editing, setEditing] = React.useState<UnitListRow | null>(null);

  const canWrite = useCan("property:write");
  const canReadTenants = useCan("tenant:read");
  const canReadLeases = useCan("lease:read");
  const baseRowActions = React.useCallback(
    (unit: UnitListRow): RowAction[] => [
      {
        label: `View unit ${unit.label}`,
        icon: EyeIcon,
        href: `/properties/${unit.propertyId}/units/${unit.id}`,
      },
      {
        // Kept in place when there is nothing to open, so the actions stay in
        // one order on every row.
        label: `View lease for unit ${unit.label}`,
        icon: FileTextIcon,
        href: unit.occupant ? `/leases/${unit.occupant.leaseId}` : undefined,
        disabled: !unit.occupant,
        disabledReason: "Never let",
      },
      {
        label: `Edit unit ${unit.label}`,
        icon: PencilIcon,
        onSelect: () => setEditing(unit),
      },
    ],
    []
  );
  // Greyed out, not hidden, when the role can't use them; the API enforces it.
  const rowActions = React.useCallback(
    (row: UnitListRow) =>
      gateActions(baseRowActions(row), [["View lease", canReadLeases], ["Edit", canWrite]]),
    [baseRowActions, canReadLeases, canWrite]
  );

  const columns = React.useMemo(
    () => buildAllUnitColumns({ rowActions, canReadTenants, canReadLeases }),
    [rowActions, canReadTenants, canReadLeases]
  );

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        data={units}
        stateKey="units"
        searchPlaceholder="Search units or tenants…"
        facetFilters={[
          {
            columnId: "propertyName",
            placeholder: "All properties",
            label: "Property",
            multiple: true,
            options: [...new Set(units.map((unit) => unit.propertyName))]
              .sort()
              .map((name) => ({ label: name, value: name })),
          },
          {
            columnId: "status",
            placeholder: "All statuses",
            label: "Status",
            options: [
              { label: "Occupied", value: "Occupied" },
              { label: "Vacant", value: "Vacant" },
            ],
          },
          {
            columnId: "unitType",
            placeholder: "All types",
            label: "Unit type",
            multiple: true,
            options: UNIT_TYPE_OPTIONS.map((type) => ({ label: type, value: type })),
          },
        ]}
        emptyMessage="No units yet. Add units from a property's page."
        getRowHref={(unit) => `/properties/${unit.propertyId}/units/${unit.id}`}
        renderCard={(unit) => <AllUnitCard unit={unit} />}
        rowActions={rowActions}
      />

      {/* Remounted per unit so the form re-seeds rather than syncing in an effect. */}
      {editing && (
        <UnitFormDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          propertyId={editing.propertyId}
          unitId={editing.id}
          initialValues={unitFormValues(editing)}
        />
      )}
    </div>
  );
}
