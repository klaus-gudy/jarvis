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
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_FILE_LABEL,
  ACCEPTED_FILE_TYPES,
  ASSET_TYPE_LABELS,
  formatFileSize,
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
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectType: DocumentSubject;
  subjectId: string | null;
  assetTypes: FileAssetType[];
  title: string;
  description: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [assetType, setAssetType] = React.useState<FileAssetType>(assetTypes[0]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  function chooseFile(candidate: File) {
    setError(null);

    if (!(candidate.type in ACCEPTED_FILE_TYPES)) {
      setError(`That is not a supported file. Upload a ${ACCEPTED_FILE_LABEL}.`);
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
            <DialogDescription>{description}</DialogDescription>
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
                    <SelectItem key={type} value={type}>
                      {ASSET_TYPE_LABELS[type]}
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
                  or click to browse — {ACCEPTED_FILE_LABEL}, up to{" "}
                  {formatFileSize(MAX_FILE_BYTES)}
                </span>
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILE_EXTENSIONS}
              className="hidden"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (chosen) chooseFile(chosen);
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
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !file}>
              {pending ? "Uploading…" : "Upload document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
