"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ATTACHMENT_SLOTS, findSlot } from "@/lib/attachment-slots";
import {
  ATTACHMENT_ACCEPT,
  formatBytes,
  kindForContentType,
  MAX_ATTACHMENT_BYTES,
  resolveContentType,
  type AttachmentOwnerType,
} from "@/lib/attachment-types";

/** The value the Select carries for "none of the listed types". Not a slot key,
 * so it is never sent — `slotKey` goes up as null and the title carries the
 * whole label. */
const OTHER = "__other__";

/**
 * Adding a file. Document type comes first because it is the thing that
 * matters: a scan sitting in a record under no heading is the state this whole
 * feature exists to avoid, so a file is always filed as *something* — one of
 * the owner's named slots, or a title the uploader writes.
 */
export function AttachmentUploadDialog({
  ownerType,
  ownerId,
  open,
  onOpenChange,
  defaultSlotKey,
  replaceId,
}: {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects the type when opened from a slot's own button. */
  defaultSlotKey?: string;
  /** A single-file slot being refilled: removed only after the new file is
   * safely registered, so the record is never briefly without one. */
  replaceId?: string;
}) {
  const router = useRouter();
  const [slotValue, setSlotValue] = React.useState(defaultSlotKey ?? OTHER);
  const [title, setTitle] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const slot = slotValue === OTHER ? null : findSlot(ownerType, slotValue);
  const slots = ATTACHMENT_SLOTS[ownerType];
  // A slot that only makes sense as images narrows the picker to them.
  const accept =
    slot?.kind === "IMAGE" ? "image/jpeg,image/png,image/webp" : ATTACHMENT_ACCEPT;
  const multiple = slot?.multiple ?? false;

  async function uploadOne(file: File, fileTitle: string | null) {
    const contentType = resolveContentType(file.name, file.type);

    if (!kindForContentType(contentType)) {
      throw new Error(`${file.name} isn't a supported file type`);
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}`
      );
    }

    const body = {
      ownerType,
      ownerId,
      slotKey: slot?.key ?? null,
      title: fileTitle,
    };

    const presigned = await fetch("/api/attachments/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      }),
    });
    if (!presigned.ok) {
      const data = await presigned.json().catch(() => null);
      throw new Error(data?.error ?? "Could not start the upload");
    }
    const { url, key } = await presigned.json();

    await putWithProgress(url, file, contentType, setProgress);

    const registered = await fetch("/api/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, key, fileName: file.name }),
    });
    if (!registered.ok) {
      const data = await registered.json().catch(() => null);
      throw new Error(data?.error ?? "Could not save that file");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (files.length === 0) {
      setError("Choose a file to upload");
      return;
    }
    // The one case a title is load-bearing: nothing else would name the file.
    if (!slot && title.trim().length === 0) {
      setError("Give this document a title, or pick a document type");
      return;
    }

    // A title names one file. With several chosen it would have to be shared or
    // numbered, and each file's own name is the more useful label.
    const perFileTitle = files.length === 1 ? title.trim() || null : null;

    setProgress(0);
    let uploaded = 0;
    for (const file of files) {
      try {
        await uploadOne(file, perFileTitle);
        uploaded += 1;
      } catch (uploadError) {
        toast.error(
          uploadError instanceof Error
            ? uploadError.message
            : "Could not upload that file"
        );
      }
    }
    setProgress(null);

    if (uploaded === 0) return;

    if (replaceId) {
      // Deliberately after the new file is registered, and its failure is not
      // fatal — an extra old file is a smaller problem than none at all.
      await fetch(`/api/attachments/${replaceId}`, { method: "DELETE" });
    }

    onOpenChange(false);
    toast.success(uploaded === 1 ? "File uploaded" : `${uploaded} files uploaded`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form key={String(open)} onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{replaceId ? "Replace file" : "Add file"}</DialogTitle>
            <DialogDescription>
              Up to {formatBytes(MAX_ATTACHMENT_BYTES)} — PDF, Word, Excel, text
              or images.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="attachment-slot" required>
                Document type
              </FieldLabel>
              <Select
                value={slotValue}
                onValueChange={(next) => next && setSlotValue(next)}
              >
                <SelectTrigger id="attachment-slot" className="w-full">
                  <SelectValue>
                    {(selected: string) =>
                      selected === OTHER
                        ? "Other document"
                        : (findSlot(ownerType, selected)?.label ?? selected)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {slots.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Other document</SelectItem>
                </SelectContent>
              </Select>
              {slot && (
                <p className="text-xs text-muted-foreground">
                  {slot.description}
                </p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="attachment-title" required={!slot}>
                Title
              </FieldLabel>
              <Input
                id="attachment-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={files.length > 1}
                placeholder={
                  files.length > 1
                    ? "Each file will use its own name"
                    : (slot?.label ?? "Name this document")
                }
                maxLength={120}
              />
              {slot && files.length <= 1 && (
                <p className="text-xs text-muted-foreground">
                  Optional — defaults to &ldquo;{slot.label}&rdquo;.
                </p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="attachment-file" required>
                File
              </FieldLabel>
              <input
                id="attachment-file"
                type="file"
                accept={accept}
                multiple={multiple}
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
                className="w-full cursor-pointer rounded-md border border-input bg-transparent text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-l-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
              />
              {files.length === 1 && (
                <p className="text-xs text-muted-foreground">
                  {formatBytes(files[0].size)}
                </p>
              )}
              {files.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {files.length} files selected
                </p>
              )}
            </Field>

            {progress !== null && (
              <div className="space-y-1.5">
                <Progress value={progress} />
                <p className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {progress}%
                </p>
              </div>
            )}

            {error && <FieldError>{error}</FieldError>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={progress !== null}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={progress !== null}>
              {progress !== null ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * `fetch` can't report upload progress, and a 10 MB scan over a phone
 * connection with no feedback reads as a hung dialog — so the PUT is the one
 * request here that goes through XHR.
 */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    // Must match what the URL was signed with, or the bucket answers 403.
    request.setRequestHeader("Content-Type", contentType);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${request.status})`));
    request.onerror = () =>
      reject(new Error("Upload failed — check your connection"));

    request.send(file);
  });
}
