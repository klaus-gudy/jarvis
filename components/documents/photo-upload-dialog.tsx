"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  ImagePlusIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
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
import { AssetTypeSelect } from "@/components/documents/asset-type-select";
import { Field, FieldLabel } from "@/components/ui/field";
import type { AssetTypeView } from "@/lib/asset-types";
import {
  formatFileSize,
  IMAGE_FILE_EXTENSIONS,
  IMAGE_FILE_LABEL,
  IMAGE_FILE_TYPES,
  MAX_FILE_BYTES,
} from "@/lib/document-options";
import type { FileAssetSubject } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

type Picked = {
  /** Stable per pick, so removing one doesn't renumber the rest. */
  key: string;
  file: File;
  /** Object URL for the thumbnail; revoked when the dialog unmounts. */
  preview: string;
  status: "pending" | "uploading" | "done" | "failed";
  message: string | null;
};

/**
 * Photos, several at a time. Separate from `DocumentUploadDialog` rather than a
 * flag on it, because almost nothing about the interaction survives the change:
 * there is no type to choose (the caller fixes it), the input is `multiple`,
 * what you review before sending is a grid of thumbnails rather than one file
 * name, and the result is per-file — some can succeed while others fail.
 *
 * Uploads go one at a time against the same `POST /api/documents` everything
 * else uses. Sequential rather than parallel: ten phone photos at up to 10 MB
 * each would otherwise open ten concurrent requests that each buffer their body
 * in a route handler, and the visible cost — a row settling at a time — is the
 * same progress indicator the bulk import already trained people to read.
 */
export function PhotoUploadDialog({
  open,
  onOpenChange,
  subjectType,
  subjectId,
  assetTypes: initialAssetTypes,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectType: FileAssetSubject;
  subjectId: string;
  /** Photo types for this subject. The first is the default — for a property that is the seeded "Photo". */
  assetTypes: AssetTypeView[];
  title: string;
  description?: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Held locally so a type added from inside the dropdown is usable at once.
  const [assetTypes, setAssetTypes] = React.useState(initialAssetTypes);
  const [assetTypeId, setAssetTypeId] = React.useState(
    initialAssetTypes[0]?.id ?? ""
  );

  const [picked, setPicked] = React.useState<Picked[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  /** So closing after a partial success still refreshes the list behind. */
  const uploadedAny = React.useRef(false);

  // Object URLs are leaked memory until revoked, and the dialog is remounted
  // per open, so unmount is exactly the right moment.
  React.useEffect(() => {
    return () => {
      for (const item of picked) URL.revokeObjectURL(item.preview);
    };
    // Intentionally on unmount only — `picked` is read through the closure at
    // teardown, and re-running this per change would revoke live previews.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(files: FileList | File[]) {
    const rejected: string[] = [];
    const accepted: Picked[] = [];

    for (const file of Array.from(files)) {
      if (!(file.type in IMAGE_FILE_TYPES)) {
        rejected.push(`${file.name} is not a ${IMAGE_FILE_LABEL} image`);
        continue;
      }
      if (file.size === 0) {
        rejected.push(`${file.name} is empty`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(
          `${file.name} is ${formatFileSize(file.size)} — the limit is ${formatFileSize(MAX_FILE_BYTES)}`
        );
        continue;
      }
      accepted.push({
        key: `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`,
        file,
        preview: URL.createObjectURL(file),
        status: "pending",
        message: null,
      });
    }

    // Every rejection named, not just the first: picking twenty photos and
    // being told only that "a file was rejected" means checking twenty files.
    setError(rejected.length > 0 ? rejected.join(" · ") : null);
    if (accepted.length > 0) setPicked((current) => [...current, ...accepted]);
  }

  function remove(key: string) {
    setPicked((current) => {
      const going = current.find((item) => item.key === key);
      if (going) URL.revokeObjectURL(going.preview);
      return current.filter((item) => item.key !== key);
    });
  }

  async function handleUpload() {
    const queue = picked.filter((item) => item.status !== "done");
    if (queue.length === 0) return;

    setPending(true);
    setError(null);

    // Counted locally rather than read back off the rows: `setPicked` is
    // asynchronous, so the state would still be one render behind when the
    // loop ends and the summary would be wrong by exactly the last photo.
    let succeeded = 0;
    let rejected = 0;

    for (const item of queue) {
      setPicked((current) =>
        current.map((row) =>
          row.key === item.key ? { ...row, status: "uploading", message: null } : row
        )
      );

      const body = new FormData();
      body.append("file", item.file);
      body.append("assetTypeId", assetTypeId);
      body.append("subjectType", subjectType);
      body.append("subjectId", subjectId);

      const response = await fetch("/api/documents", { method: "POST", body });

      if (response.ok) {
        uploadedAny.current = true;
        succeeded += 1;
        setPicked((current) =>
          current.map((row) =>
            row.key === item.key ? { ...row, status: "done", message: null } : row
          )
        );
        continue;
      }

      rejected += 1;

      const data = await response.json().catch(() => null);
      const issue = data?.issues
        ? Object.values(data.issues as Record<string, string[]>)[0]?.[0]
        : null;
      setPicked((current) =>
        current.map((row) =>
          row.key === item.key
            ? {
                ...row,
                status: "failed",
                message: issue ?? data?.error ?? "Upload failed",
              }
            : row
        )
      );
    }

    setPending(false);

    // One summary, the same shape `ImportDialog` reports a bulk run with — the
    // per-photo badges say which, this says whether it worked.
    if (rejected === 0) {
      toast.success(`${succeeded} photo${succeeded === 1 ? "" : "s"} uploaded`);
    } else if (succeeded === 0) {
      toast.error(
        `Could not upload ${rejected === 1 ? "that photo" : `any of those ${rejected} photos`}`
      );
    } else {
      toast.warning(`${succeeded} uploaded, ${rejected} failed`);
    }
  }

  // Derived from the rows rather than tracked alongside them, so the summary
  // can't disagree with the grid it is summarising.
  const done = picked.filter((item) => item.status === "done").length;
  const failed = picked.filter((item) => item.status === "failed").length;
  const remaining = picked.length - done;
  const finished = picked.length > 0 && remaining === 0;

  function close() {
    if (uploadedAny.current) router.refresh();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-upload would orphan the loop's state updates.
        if (!next && pending) return;
        if (!next) close();
      }}
    >
      <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
          {/* Always rendered, even with a single option. It looks like a
              control that does nothing until you open it — but the "Add a
              type…" affordance lives inside, and hiding the picker on the
              common case (one seeded "Photo" type) would mean the only place
              to add a photo type is a screen that has two of them already. */}
          <Field>
              <FieldLabel htmlFor="photo-type" required>
                Photo type
              </FieldLabel>
              <AssetTypeSelect
                id="photo-type"
                assetTypes={assetTypes}
                value={assetTypeId}
                onValueChange={setAssetTypeId}
                subject={subjectType}
                isPhoto
                disabled={pending}
                onCreated={(created) => {
                  setAssetTypes((current) => [...current, created]);
                  setAssetTypeId(created.id);
                  router.refresh();
                }}
              />
          </Field>

          {picked.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (event.dataTransfer.files.length > 0) {
                  addFiles(event.dataTransfer.files);
                }
              }}
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-12 text-center transition-colors",
                dragging
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50 hover:bg-muted/40"
              )}
            >
              <ImagePlusIcon className="size-6 text-muted-foreground" />
              <span className="font-medium">Drop photos here</span>
              <span className="text-xs text-muted-foreground">
                or click to browse — pick as many as you like, {IMAGE_FILE_LABEL},
                up to {formatFileSize(MAX_FILE_BYTES)} each
              </span>
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {picked.length} photo{picked.length === 1 ? "" : "s"} selected
                </p>
                <div className="flex items-center gap-2">
                  {(done > 0 || failed > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {done} uploaded
                      {failed > 0 ? ` · ${failed} failed` : ""}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => inputRef.current?.click()}
                  >
                    <ImagePlusIcon />
                    Add more
                  </Button>
                </div>
              </div>

              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {picked.map((item) => (
                  <li
                    key={item.key}
                    className="group/photo relative overflow-hidden rounded-lg border bg-muted/40"
                  >
                    <div className="aspect-4/3 w-full">
                      {/* Not `next/image`: the source is a local object URL
                          with no intrinsic size known ahead of render, and
                          nothing for the optimizer to fetch or cache. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className={cn(
                          "size-full object-cover transition-opacity",
                          item.status === "uploading" && "opacity-50",
                          item.status === "done" && "opacity-60"
                        )}
                      />
                    </div>

                    {item.status === "pending" && !pending && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        aria-label={`Remove ${item.file.name}`}
                        className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover/photo:opacity-100 focus-visible:opacity-100"
                        onClick={() => remove(item.key)}
                      >
                        <XIcon />
                      </Button>
                    )}

                    {item.status !== "pending" && (
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-background/90 p-1">
                        {item.status === "uploading" && (
                          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
                        )}
                        {item.status === "done" && (
                          <CircleCheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        {item.status === "failed" && (
                          <CircleXIcon className="size-3.5 text-destructive" />
                        )}
                      </span>
                    )}

                    <div className="space-y-0.5 px-2 py-1.5">
                      <p className="truncate text-xs font-medium">
                        {item.file.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.message ?? formatFileSize(item.file.size)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={IMAGE_FILE_EXTENSIONS}
            className="hidden"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              // Cleared so picking the same file again still fires `change`.
              event.target.value = "";
            }}
          />

          {error && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={pending}
          >
            {finished ? "Done" : "Cancel"}
          </Button>
          {!finished && (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={pending || remaining === 0}
            >
              {pending ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Uploading…
                </>
              ) : (
                `Upload ${remaining} photo${remaining === 1 ? "" : "s"}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
