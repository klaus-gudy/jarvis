"use client";

import { DownloadIcon, FileQuestionIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { attachmentDisplayName } from "@/lib/attachment-slots";
import {
  formatBytes,
  previewModeFor,
  type AttachmentOwnerType,
  type AttachmentView,
} from "@/lib/attachment-types";
import { formatDate } from "@/lib/format";

/** What the card hands over: the file, plus its text if it is one of the
 * formats read as text — fetched by the opener, so this component needs no
 * effect and the codebase's ban on set-state-in-effect stands. */
export type Preview = {
  attachment: AttachmentView;
  /** Only set for text/plain and text/csv. `null` means the fetch failed. */
  text?: string | null;
};

/**
 * Shows a file without leaving the page. Images and PDFs render natively —
 * PDFs in an iframe, which works because `GET /api/attachments/[id]` redirects
 * to a presigned URL served `Content-Disposition: inline`. Text and CSV are
 * printed as text.
 *
 * Word and Excel get an honest dead end rather than a viewer: no browser
 * renders them, and the ways to fake it either ship a megabyte of parser or
 * hand the file to a third-party viewer service — which for tenants' ID
 * documents means posting them to someone else's server.
 */
export function AttachmentPreviewDialog({
  preview,
  ownerType,
  onOpenChange,
}: {
  preview: Preview | null;
  ownerType: AttachmentOwnerType;
  onOpenChange: (open: boolean) => void;
}) {
  const attachment = preview?.attachment;

  return (
    <Dialog open={preview !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {attachment && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">
                {attachmentDisplayName(ownerType, attachment)}
              </DialogTitle>
              <DialogDescription className="truncate">
                {attachment.fileName} · {formatBytes(attachment.sizeBytes)} ·{" "}
                {formatDate(new Date(attachment.createdAt))}
              </DialogDescription>
            </DialogHeader>

            <PreviewBody preview={preview} />

            <DialogFooter showCloseButton>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={`/api/attachments/${attachment.id}?download=1`} />
                }
              >
                <DownloadIcon />
                Download
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ preview }: { preview: Preview | null }) {
  if (!preview) return null;
  const { attachment, text } = preview;
  const source = `/api/attachments/${attachment.id}`;

  switch (previewModeFor(attachment)) {
    case "image":
      return (
        <div className="flex max-h-[65vh] items-center justify-center overflow-auto rounded-lg border bg-muted/40 p-2">
          {/* Same reason as the thumbnail: next/image would have the optimizer
              fetch this server-side without a session cookie and get a 401. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source}
            alt={attachment.fileName}
            className="max-h-[62vh] w-auto object-contain"
          />
        </div>
      );

    case "pdf":
      return (
        <iframe
          src={source}
          title={attachment.fileName}
          className="h-[65vh] w-full rounded-lg border bg-muted/40"
        />
      );

    case "text":
      return (
        <pre className="max-h-[65vh] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs whitespace-pre-wrap">
          {text ?? "This file could not be read."}
        </pre>
      );

    case "none":
      return (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-lg bg-background text-muted-foreground">
            <FileQuestionIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              This file type can&rsquo;t be previewed here
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Word and Excel documents open in the app that made them. Download
              it to read it.
            </p>
          </div>
        </div>
      );
  }
}
