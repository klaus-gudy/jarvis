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
    // Two equal halves when the header stacks them under its title (a narrow
    // card), a plain pair beside the title otherwise — `stackAction` on the
    // header decides which, by the same 28rem container query.
    <div className="grid grid-cols-2 gap-2 @md/card-header:flex">
      <ExportButton
        url="/api/organizations/export"
        label="Export data"
        filenameFallback="organization-backup.xlsx"
        size="sm"
        className="w-full @md/card-header:w-auto"
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full @md/card-header:w-auto"
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
