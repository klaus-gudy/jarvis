"use client";

import * as React from "react";
import { PencilIcon } from "lucide-react";

import {
  UnitFormDialog,
  unitFormValues,
} from "@/components/properties/unit-form-dialog";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";

/**
 * The unit page's header button — the property page's `PropertyActions`,
 * pointed at one unit. Deactivate and Delete live on the Actions tab.
 */
export function UnitActions({
  propertyId,
  unit,
}: {
  propertyId: string;
  unit: Parameters<typeof unitFormValues>[0] & { id: string };
}) {
  const canWrite = useCan("property:write");
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    // Same stacking as `PropertyActions`: full width on a phone, a row from `sm`.
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        onClick={() => setEditOpen(true)}
        disabled={!canWrite}
        title={canWrite ? undefined : "Your role doesn't allow this"}
      >
        <PencilIcon />
        Edit
      </Button>

      {/* Mounted per open so the form re-seeds from the latest values. */}
      {editOpen && (
        <UnitFormDialog
          key={unit.id}
          open
          onOpenChange={(open) => !open && setEditOpen(false)}
          propertyId={propertyId}
          unitId={unit.id}
          initialValues={unitFormValues(unit)}
        />
      )}
    </div>
  );
}
