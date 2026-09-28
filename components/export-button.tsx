"use client";

import * as React from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * One button, fed a `url`, that downloads whatever `.xlsx` that endpoint
 * streams. Same fetch-blob-anchor dance `ImportDialog` uses for its template
 * download — export is the same shape of request, just with no dialog around it.
 *
 * With `getIds`, the export follows the table: when it returns ids, they are
 * POSTed and only those rows come back, in that order; `null` means the table
 * isn't narrowed and the plain GET exports everything.
 */
type ExportOptions = {
  url: string;
  filenameFallback?: string;
  getIds?: () => string[] | null;
};

/**
 * The download itself, apart from any button — so the same export can be
 * started from `ExportButton` or from a menu item (`ImportExportActions`).
 */
export function useExportDownload({
  url,
  filenameFallback = "export.xlsx",
  getIds,
}: ExportOptions) {
  const [downloading, setDownloading] = React.useState(false);

  async function run() {
    const ids = getIds?.() ?? null;
    if (ids?.length === 0) {
      toast.error("No rows match the current filters");
      return;
    }

    setDownloading(true);
    try {
      const response = ids
        ? await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          })
        : await fetch(url);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not build the export");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download =
        response.headers
          .get("content-disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? filenameFallback;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      toast.success(
        ids
          ? `Exported ${ids.length} filtered ${ids.length === 1 ? "row" : "rows"}`
          : "Export downloaded"
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not build the export"
      );
    } finally {
      setDownloading(false);
    }
  }

  return { run, downloading };
}

export function ExportButton({
  url,
  label = "Export",
  shortLabel,
  filenameFallback = "export.xlsx",
  size,
  className,
  getIds,
  permission = "export:run",
}: ExportOptions & {
  /** Hidden without it; the endpoint enforces the same one. */
  permission?: Permission;
  label?: string;
  /** Shown instead of `label` below `sm`, where the toolbar is tight. */
  shortLabel?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const allowed = useCan(permission);
  const { run, downloading } = useExportDownload({ url, filenameFallback, getIds });

  if (!allowed) return null;

  return (
    <Button
      variant="outline"
      className={cn("bg-card", className)}
      size={size}
      onClick={run}
      disabled={downloading}
    >
      {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
      {downloading ? (
        "Preparing…"
      ) : shortLabel ? (
        <>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </Button>
  );
}
