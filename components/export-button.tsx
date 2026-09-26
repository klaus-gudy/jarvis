"use client";

import * as React from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
export function ExportButton({
  url,
  label = "Export",
  filenameFallback = "export.xlsx",
  size,
  className,
  getIds,
}: {
  url: string;
  label?: string;
  filenameFallback?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  getIds?: () => string[] | null;
}) {
  const [downloading, setDownloading] = React.useState(false);

  async function handleExport() {
    setDownloading(true);
    try {
      const response = await fetch(url);
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
      toast.success("Export downloaded");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not build the export"
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      variant="outline"
      className={cn("bg-card", className)}
      size={size}
      onClick={handleExport}
      disabled={downloading}
    >
      {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
      {downloading ? "Preparing…" : label}
    </Button>
  );
}
