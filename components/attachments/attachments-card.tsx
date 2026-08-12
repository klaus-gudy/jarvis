"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FileTextIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AttachmentPreviewDialog,
  type Preview,
} from "@/components/attachments/attachment-preview-dialog";
import { AttachmentUploadDialog } from "@/components/attachments/attachment-upload-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ATTACHMENT_SLOTS,
  attachmentDisplayName,
  type AttachmentSlot,
} from "@/lib/attachment-slots";
import {
  formatBytes,
  previewModeFor,
  type AttachmentOwnerType,
  type AttachmentView,
} from "@/lib/attachment-types";
import { formatDate } from "@/lib/format";

/** What the upload dialog is currently being opened for. */
type UploadTarget = { slotKey?: string; replaceId?: string };

/**
 * Files attached to one record, organised by the document types that record is
 * expected to hold. Every slot is rendered whether or not anything has been
 * uploaded into it — a tenant's missing NIDA is information, and an empty card
 * saying "no files" hides it.
 *
 * Generic over the owner, because every surface needs the same affordances and
 * a copy per surface is how they drift.
 */
export function AttachmentsCard({
  ownerType,
  ownerId,
  attachments,
  title = "Documents",
}: {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  attachments: AttachmentView[];
  title?: string;
}) {
  const router = useRouter();
  const [uploadTarget, setUploadTarget] = React.useState<UploadTarget | null>(
    null
  );
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [deleting, setDeleting] = React.useState<AttachmentView | null>(null);
  const [pending, setPending] = React.useState(false);

  const slots = ATTACHMENT_SLOTS[ownerType];

  // Everything filed under no slot, or under a slot this owner type no longer
  // defines — grouped so a file can never become unreachable by a config edit.
  const extras = attachments.filter(
    (attachment) =>
      !attachment.slotKey || !slots.some((slot) => slot.key === attachment.slotKey)
  );

  /**
   * Text is fetched here rather than inside the dialog: reading it in an effect
   * would mean set-state-in-effect, which this codebase lints against, and the
   * click is a perfectly good place to do the work.
   */
  async function openPreview(attachment: AttachmentView) {
    if (previewModeFor(attachment) !== "text") {
      setPreview({ attachment });
      return;
    }

    try {
      const response = await fetch(`/api/attachments/${attachment.id}`);
      setPreview({
        attachment,
        text: response.ok ? await response.text() : null,
      });
    } catch {
      setPreview({ attachment, text: null });
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const response = await fetch(`/api/attachments/${deleting.id}`, {
      method: "DELETE",
    });

    setPending(false);
    if (response.ok) {
      setDeleting(null);
      toast.success("File removed");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    toast.error(data?.error ?? "Could not remove this file");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setUploadTarget({})}>
          <PlusIcon />
          Add file
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {slots.map((slot) => (
          <SlotSection
            key={slot.key}
            slot={slot}
            ownerType={ownerType}
            files={attachments.filter((a) => a.slotKey === slot.key)}
            onUpload={setUploadTarget}
            onPreview={openPreview}
            onDelete={setDeleting}
          />
        ))}

        {extras.length > 0 && (
          <SlotSection
            slot={{
              key: "__extras__",
              label: "Other documents",
              description: "Filed under a title rather than a document type",
              kind: null,
              multiple: true,
            }}
            ownerType={ownerType}
            files={extras}
            onUpload={setUploadTarget}
            onPreview={openPreview}
            onDelete={setDeleting}
            hideUploadButton
          />
        )}
      </CardContent>

      {uploadTarget && (
        <AttachmentUploadDialog
          ownerType={ownerType}
          ownerId={ownerId}
          open
          onOpenChange={(next) => !next && setUploadTarget(null)}
          defaultSlotKey={uploadTarget.slotKey}
          replaceId={uploadTarget.replaceId}
        />
      )}

      <AttachmentPreviewDialog
        preview={preview}
        ownerType={ownerType}
        onOpenChange={(open) => !open && setPreview(null)}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this file?</DialogTitle>
            <DialogDescription>
              {deleting?.fileName} will be deleted from storage. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Removing…" : "Remove file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** One document type: its heading, and either the files filed under it or the
 * fact that none have been. */
function SlotSection({
  slot,
  ownerType,
  files,
  onUpload,
  onPreview,
  onDelete,
  hideUploadButton = false,
}: {
  slot: AttachmentSlot;
  ownerType: AttachmentOwnerType;
  files: AttachmentView[];
  onUpload: (target: UploadTarget) => void;
  onPreview: (attachment: AttachmentView) => void;
  onDelete: (attachment: AttachmentView) => void;
  hideUploadButton?: boolean;
}) {
  // A slot that holds one file offers Replace, not Add — and the replacement
  // carries the id to remove once it has landed.
  const single = !slot.multiple && files.length > 0;

  return (
    <section className="border-b px-6 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-medium">{slot.label}</h4>
          <p className="text-xs text-muted-foreground">{slot.description}</p>
        </div>
        {!hideUploadButton && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-muted-foreground"
            onClick={() =>
              onUpload({
                slotKey: slot.key,
                replaceId: single ? files[0].id : undefined,
              })
            }
          >
            <UploadIcon />
            {single ? "Replace" : files.length > 0 ? "Add" : "Upload"}
          </Button>
        )}
      </div>

      {files.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground italic">Not uploaded</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
            >
              <AttachmentThumbnail attachment={file} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {attachmentDisplayName(ownerType, file)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {file.fileName} · {formatBytes(file.sizeBytes)} ·{" "}
                  {formatDate(new Date(file.createdAt))}
                  {file.uploadedByName ? ` · ${file.uploadedByName}` : ""}
                </p>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground"
                aria-label={`Preview ${file.fileName}`}
                onClick={() => onPreview(file)}
              >
                <EyeIcon />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground"
                nativeButton={false}
                render={
                  <a
                    href={`/api/attachments/${file.id}?download=1`}
                    aria-label={`Download ${file.fileName}`}
                  />
                }
              >
                <DownloadIcon />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${file.fileName}`}
                onClick={() => onDelete(file)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Images get a real thumbnail — a wall of identical file icons tells you
 * nothing about which photo is which. It loads through the app's own route, so
 * the bucket stays private and the org check runs on every request.
 */
function AttachmentThumbnail({ attachment }: { attachment: AttachmentView }) {
  if (attachment.kind === "IMAGE") {
    return (
      // next/image would have the optimizer fetch this server-side, where it
      // has no session cookie and would get a 401 — the route redirects to a
      // presigned URL that only the browser's own request can follow.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/attachments/${attachment.id}`}
        alt=""
        className="size-9 shrink-0 rounded-md border object-cover"
      />
    );
  }

  const Icon = attachment.contentType === "application/pdf" ? FileTextIcon : FileIcon;
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
      <Icon className="size-4" />
    </div>
  );
}
