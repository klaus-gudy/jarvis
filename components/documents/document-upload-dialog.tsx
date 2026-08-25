"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, FileTextIcon, UploadIcon, XIcon } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  acceptedTypesFor,
  allowsMultiple,
  ASSET_TYPE_LABELS,
  formatFileSize,
  labelForAcceptedTypes,
  MAX_FILE_BYTES,
  type DocumentSubject,
} from "@/lib/document-options";
import type { FileAssetType } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * Pick a file, say what it is, send it. Generic over the subject so the same
 * dialog serves a lease or a property later — only `subjectType`, `subjectId`
 * and the offered `assetTypes` change.
 *
 * The size and type checks here are a courtesy: they save a round trip and
 * give an answer the instant the file is chosen. `POST /api/documents` runs
 * the same two checks on what actually arrives, which is where they count.
 */
export function DocumentUploadDialog({
  open,
  onOpenChange,
  subjectType,
  subjectId,
  assetTypes,
  /** Types already on file for this subject — offered but greyed, not omitted, same as a disabled `RowAction`. */
  existingTypes = [],
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectType: DocumentSubject;
  subjectId: string | null;
  assetTypes: FileAssetType[];
  existingTypes?: FileAssetType[];
  title: string;
  description?: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // A type that doesn't allow multiples and is already on file can't be
  // uploaded again — disabled in the list rather than dropped, so the option
  // stays in its usual place and the reason ("On file") is visible right there
  // instead of a rejection after the fact.
  const takenTypes = React.useMemo(
    () => new Set(existingTypes.filter((type) => !allowsMultiple(type))),
    [existingTypes]
  );

  const [file, setFile] = React.useState<File | null>(null);
  const [assetType, setAssetType] = React.useState<FileAssetType>(
    assetTypes.find((type) => !takenTypes.has(type)) ?? assetTypes[0]
  );

  // Photo types take images only, everything else takes PDFs too — so the
  // accepted table follows the dropdown rather than being fixed for the dialog.
  const accepted = acceptedTypesFor(assetType);
  const acceptedLabel = labelForAcceptedTypes(accepted);
  const acceptAttribute = Object.values(accepted)
    .map((type) => type.extension)
    .join(",");

  // Switching the type after picking the file can invalidate it — derived
  // rather than cleared in an effect, which this codebase lints against.
  const typeMismatch = file !== null && !(file.type in accepted);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  function chooseFile(candidate: File) {
    setError(null);

    if (!(candidate.type in accepted)) {
      setError(`That is not a supported file. Upload a ${acceptedLabel}.`);
      setFile(null);
      return;
    }
    if (candidate.size === 0) {
      setError("That file is empty.");
      setFile(null);
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setError(
        `That file is ${formatFileSize(candidate.size)} — the limit is ${formatFileSize(MAX_FILE_BYTES)}.`
      );
      setFile(null);
      return;
    }

    setFile(candidate);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    setPending(true);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("assetType", assetType);
    body.append("subjectType", subjectType);
    if (subjectId) body.append("subjectId", subjectId);

    const response = await fetch("/api/documents", { method: "POST", body });
    setPending(false);

    if (response.ok) {
      onOpenChange(false);
      toast.success(`${ASSET_TYPE_LABELS[assetType]} uploaded`);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    // Field errors from the schema are all about the pairing of type and
    // subject, which the UI never lets you get wrong — so they read as a form
    // error rather than being hung off an input.
    const issue = data?.issues
      ? Object.values(data.issues as Record<string, string[]>)[0]?.[0]
      : null;
    const message = issue ?? data?.error ?? "Could not upload that file";
    setError(message);
    toast.error(message);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-upload would leave the request finishing into nothing.
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="document-type" required>
                Document type
              </FieldLabel>
              <Select
                value={assetType}
                onValueChange={(next) => next && setAssetType(next as FileAssetType)}
              >
                <SelectTrigger id="document-type" className="w-full">
                  <SelectValue>
                    {(selected: FileAssetType) => ASSET_TYPE_LABELS[selected]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assetTypes.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      disabled={takenTypes.has(type)}
                    >
                      {ASSET_TYPE_LABELS[type]}
                      {takenTypes.has(type) && (
                        <span className="text-muted-foreground"> · On file</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {file ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove file"
                  disabled={pending}
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  <XIcon />
                </Button>
              </div>
            ) : (
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
                  const dropped = event.dataTransfer.files[0];
                  if (dropped) chooseFile(dropped);
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50 hover:bg-muted/40"
                )}
              >
                <UploadIcon className="size-6 text-muted-foreground" />
                <span className="font-medium">Drop the file here</span>
                <span className="text-xs text-muted-foreground">
                  or click to browse — {acceptedLabel}, up to{" "}
                  {formatFileSize(MAX_FILE_BYTES)}
                </span>
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={acceptAttribute}
              className="hidden"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (chosen) chooseFile(chosen);
              }}
            />

            {(error ?? (typeMismatch ? `A ${ASSET_TYPE_LABELS[assetType].toLowerCase()} must be a ${acceptedLabel} file — choose another.` : null)) && (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
                {error ??
                  `A ${ASSET_TYPE_LABELS[assetType].toLowerCase()} must be a ${acceptedLabel} file — choose another.`}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !file || typeMismatch}>
              {pending ? "Uploading…" : "Upload document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
