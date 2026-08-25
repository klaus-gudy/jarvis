"use client";

import * as React from "react";
import { DownloadIcon, FileQuestionIcon, Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFileSize, type DocumentView } from "@/lib/document-options";

/**
 * Reads a document without leaving the member you were looking at.
 *
 * The source is the same `GET /api/documents/[id]` the download link uses — it
 * answers with `Content-Disposition: inline`, so the browser renders it in
 * place. No blob URL and nothing held in memory: the session cookie rides
 * along on a same-origin request, and closing the dialog unmounts the frame,
 * which is what stops a PDF viewer carrying on in the background.
 */
export function DocumentViewerDialog({
  document,
  onClose,
}: {
  document: DocumentView | null;
  onClose: () => void;
}) {
  /**
   * Which document has finished rendering, rather than a boolean — reopening
   * the dialog on a *different* file would otherwise inherit the last one's
   * "loaded" and skip the spinner.
   */
  const [loadedId, setLoadedId] = React.useState<string | null>(null);
  const loaded = loadedId !== null && loadedId === document?.id;

  const isImage = document?.fileType.startsWith("image/") ?? false;
  const isPdf = document?.fileType === "application/pdf";
  const source = document ? `/api/documents/${document.id}` : null;

  return (
    <Dialog
      open={document !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {/* Tall and wide: a page of a scanned lease is unreadable in a dialog
          sized for a form. The height is *definite* rather than a max, so the
          preview pane below gets a real height to divide — `max-h-full` on the
          image resolves against nothing in an auto-height flex column, and the
          picture spills past the frame. */}
      <DialogContent className="flex h-[85svh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <span className="truncate">{document?.fileName}</span>
            {document && (
              <Badge variant="outline" className="shrink-0">
                {document.assetType.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
          {/* Keyed on the id so switching documents remounts rather than
              leaving the previous file on screen while the next one loads. */}
          {source && !loaded && (isImage || isPdf) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {source && isPdf && (
            <iframe
              key={source}
              src={source}
              title={document?.fileName}
              className="size-full"
              onLoad={() => setLoadedId(document?.id ?? null)}
            />
          )}

          {source && isImage && (
            <div className="flex size-full items-center justify-center p-4">
              {/* Not `next/image`: the source is an authenticated API route
                  serving arbitrary user uploads, so there is nothing for the
                  optimizer to pre-measure or cache. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={source}
                src={source}
                alt={document?.fileName ?? ""}
                className="max-h-full max-w-full object-contain"
                onLoad={() => setLoadedId(document?.id ?? null)}
              />
            </div>
          )}

          {source && !isPdf && !isImage && (
            <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileQuestionIcon className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This file type can&apos;t be previewed here. Download it to open
                it in another app.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="hidden text-sm text-muted-foreground sm:block">
            {document ? formatFileSize(document.sizeBytes) : null}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={source ? `${source}?download` : undefined} />}
            >
              <DownloadIcon />
              Download
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
