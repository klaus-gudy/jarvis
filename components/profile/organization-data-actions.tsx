"use client";

import * as React from "react";
import { UploadIcon } from "lucide-react";

import { ExportButton } from "@/components/export-button";
import { OrganizationImportDialog } from "@/components/organization-import-dialog";
import { Button } from "@/components/ui/button";

/**
 * Export and restore live beside each other on the Organization information
 * card — the two halves of one round trip. Import is greyed out rather than
 * hidden once the organization has data: an owner should see the affordance
 * exists and understand why it's unavailable here, the same reasoning
 * `RowAction.disabled` uses everywhere else in this app.
 */
export function OrganizationDataActions({ canImport }: { canImport: boolean }) {
  const [importOpen, setImportOpen] = React.useState(false);

  return (
    <div className="flex gap-2">
      <ExportButton
        url="/api/organizations/export"
        label="Export data"
        filenameFallback="organization-backup.xlsx"
        size="sm"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setImportOpen(true)}
        disabled={!canImport}
        title={
          canImport
            ? undefined
            : "Only a freshly created, empty organization can restore a backup"
        }
      >
        <UploadIcon />
        Restore backup
      </Button>

      <OrganizationImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
