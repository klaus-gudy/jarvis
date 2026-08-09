"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import {
  buildUnitColumns,
  type UnitRow,
} from "@/components/properties/unit-columns";
import {
  UnitFormDialog,
  type UnitFormValues,
} from "@/components/properties/unit-form-dialog";
import { UnitViewDialog } from "@/components/properties/unit-view-dialog";
import { ImportDialog } from "@/components/import-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoneyFull } from "@/lib/format";
import { UNIT_TYPE_OPTIONS } from "@/lib/unit-options";
import type { CreateUnitInput } from "@/lib/units-schemas";

const NONE = "__none__";

function toFormValues(unit: UnitRow): UnitFormValues {
  return {
    label: unit.label,
    rentAmount: String(unit.rentAmount),
    minTenureMonths:
      unit.minTenureMonths == null ? "" : String(unit.minTenureMonths),
    autoRenew: unit.autoRenew,
    unitType: unit.unitType ?? NONE,
    floor: unit.floor ?? "",
    block: unit.block ?? "",
    sizeSqm: unit.sizeSqm == null ? "" : String(unit.sizeSqm),
    amenities: unit.amenities,
  };
}

export function UnitsTable({
  propertyId,
  units,
}: {
  propertyId: string;
  units: UnitRow[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<UnitRow | null>(null);
  const [editing, setEditing] = React.useState<UnitRow | null>(null);
  const [deleting, setDeleting] = React.useState<UnitRow | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const columns = React.useMemo(
    () =>
      buildUnitColumns({
        onView: (unit) => setViewing(unit),
        onEdit: (unit) => {
          setEditing(unit);
          setFormOpen(true);
        },
        onDelete: (unit) => {
          setDeleteError(null);
          setDeleting(unit);
        },
      }),
    []
  );

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);

    const response = await fetch(
      `/api/properties/${propertyId}/units/${deleting.id}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      toast.success(`Unit ${deleting.label} deleted`);
      setDeleting(null);
      setDeletePending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not delete this unit";
    setDeleteError(message);
    toast.error(message);
    setDeletePending(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        {/* bg-card, not the variant's bg-background: this button sits directly on
            the page rather than on a card, where `outline`'s fill is the exact
            same colour as the page and only the border shows. */}
        <Button
          variant="outline"
          className="bg-card"
          onClick={() => setImportOpen(true)}
        >
          <UploadIcon />
          Import units
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon />
          Add unit
        </Button>
      </div>

      <DataTable
        columns={columns}
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
          {
            columnId: "unitType",
            placeholder: "All types",
            options: UNIT_TYPE_OPTIONS.map((type) => ({ label: type, value: type })),
          },
        ]}
        emptyMessage="No units yet. Use “Add unit” to create the first one."
      />

      <UnitViewDialog unit={viewing} onOpenChange={(open) => !open && setViewing(null)} />

      {/* Remount on each open so the form re-seeds from initialValues, rather
          than resetting state inside an effect. */}
      <UnitFormDialog
        key={`${editing?.id ?? "new"}:${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        propertyId={propertyId}
        unitId={editing?.id}
        initialValues={editing ? toFormValues(editing) : undefined}
      />

      {/* Remounted per open so a finished import doesn't reopen on its summary. */}
      <ImportDialog<CreateUnitInput>
        key={`import-${importOpen}`}
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import units"
        description="Fill the template with one row per unit, then upload it back here."
        noun="unit"
        templateUrl={`/api/properties/${propertyId}/units/template`}
        parseUrl={`/api/properties/${propertyId}/units/import`}
        createUrl={`/api/properties/${propertyId}/units`}
        templateHint="Download the .xlsx — unit name and monthly rate are required, the rest is optional."
        renderSummary={(unit) => (
          <>
            {formatMoneyFull(unit.rentAmount)}
            {unit.unitType ? ` · ${unit.unitType}` : ""}
          </>
        )}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete unit {deleting?.label}?</DialogTitle>
            <DialogDescription>
              {deleting?.status === "Occupied"
                ? "This unit is currently occupied — deleting it also removes its lease. This cannot be undone."
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Delete unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
