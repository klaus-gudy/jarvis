"use client";

import * as React from "react";
import {
  ArrowDownUpIcon,
  DownloadIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";

import { ExportButton, useExportDownload } from "@/components/export-button";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Export and Import for a table toolbar. From `sm` up they are two buttons, as
 * before; on a phone they fold into one "Import / Export" menu, so the
 * toolbar is two controls (this and the page's Add button) and nothing
 * overlaps at 375px.
 *
 * The switch is CSS, not `useIsMobile`, so the server and the first client
 * render agree and nothing flashes on hydration.
 */
export function ImportExportActions({
  exportUrl,
  exportLabel,
  filenameFallback,
  getIds,
  importLabel,
  onImport,
  canImport,
}: {
  exportUrl: string;
  exportLabel: string;
  filenameFallback: string;
  getIds?: () => string[] | null;
  importLabel: string;
  onImport: () => void;
  /** The caller's write permission; without it Import greys out. */
  canImport: boolean;
}) {
  const canExport = useCan("export:run");
  const { run, downloading } = useExportDownload({
    url: exportUrl,
    filenameFallback,
    getIds,
  });
  const noAccess = "Your role doesn't allow this";

  return (
    <>
      <div className="hidden gap-2 sm:flex">
        <ExportButton
          url={exportUrl}
          label={exportLabel}
          filenameFallback={filenameFallback}
          getIds={getIds}
        />
        {/* bg-card, not the variant's bg-background, which is the page colour. */}
        <Button
          disabled={!canImport}
          title={canImport ? undefined : noAccess}
          variant="outline"
          className="bg-card"
          onClick={onImport}
        >
          <UploadIcon />
          {importLabel}
        </Button>
      </div>

      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="bg-card" disabled={downloading}>
                {downloading ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <ArrowDownUpIcon />
                )}
                {downloading ? "Preparing…" : "Import / Export"}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-48">
            {/* Hidden rather than greyed without the permission, like the
                standalone Export button. */}
            {canExport && (
              <DropdownMenuItem onClick={run} disabled={downloading}>
                <DownloadIcon />
                {exportLabel}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={onImport}
              disabled={!canImport}
              title={canImport ? undefined : noAccess}
            >
              <UploadIcon />
              {importLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
