"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  MoreVerticalIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AssetTypeView } from "@/lib/asset-types";
import type { DocumentView } from "@/lib/document-options";
import { formatDate } from "@/lib/format";
import type { FileAssetSubject } from "@/lib/generated/prisma/enums";

function DocumentIcon({ fileType }: { fileType: string }) {
  if (fileType.startsWith("image/")) {
    return <ImageIcon className="size-4 shrink-0 text-muted-foreground" />;
  }
  if (fileType === "application/pdf") {
    return <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />;
  }
  return <FileIcon className="size-4 shrink-0 text-muted-foreground" />;
}

/**
 * The documents held against one subject — a member's NIDA, a property's title
 * deed, later a lease's signed agreement. One component for all of them, since
 * a document list differs only in which types it offers and which record it
 * hangs off: two tables that drift apart is exactly what a second copy buys.
 *
 * **Every type this subject can hold gets a row, uploaded or not.** A type
 * with nothing on file yet shows "Not uploaded" where the file name would go,
 * has no View/Download/Delete — there is no object behind it to act on — and
 * offers a single Upload button instead, preselected to that type. This turns
 * the table into the checklist it was implicitly always describing: for a
 * property, seeing "Title deed" and "Permit" listed *before* either exists
 * tells someone what this organization expects on file, not just what happens
 * to be there. A type that already allows several (a lease's amendments, a
 * property's permits) only gets the placeholder while it has zero — one
 * upload is enough to stop prompting, the general toolbar button still
 * reaches a second.
 *
 * No card header. Every caller already sits under a heading that says
 * "Documents" — a tab, or a section title — and repeating the word only pushes
 * the first row further down.
 */
export function DocumentsPanel({
  subjectType,
  subjectId,
  documents,
  assetTypes,
  emptyMessage,
  uploadLabel = "Upload document",
  allowUpload = true,
}: {
  subjectType: FileAssetSubject;
  subjectId: string | null;
  documents: DocumentView[];
  assetTypes: AssetTypeView[];
  emptyMessage: string;
  uploadLabel?: string;
  /**
   * False for a list nobody uploads into — the lease Contract tab, whose one
   * document is produced by the worker. Hides the toolbar button *and* the
   * "Not uploaded" checklist rows, which would otherwise invite exactly the
   * upload this list does not accept.
   */
  allowUpload?: boolean;
}) {
  const router = useRouter();
  // `useIsMobile` reports desktop on the server, so the first client render
  // matches the server markup and only then swaps — no hydration mismatch.
  const isMobile = useIsMobile();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  // Which type the dialog should open pre-selected to — set when a row's own
  // Upload button was clicked, null for the general toolbar button. Folded
  // into the dialog's remount key below, since two placeholder rows opened in
  // succession would otherwise share the same `String(uploadOpen)` key and
  // React would reuse the first instance's state instead of reinitialising.
  const [presetTypeId, setPresetTypeId] = React.useState<string | null>(null);
  const [viewing, setViewing] = React.useState<DocumentView | null>(null);
  const [deleting, setDeleting] = React.useState<DocumentView | null>(null);
  // The document whose actions sheet is open — mobile's stand-in for the row
  // of icon buttons, which is unreachable at 28px a side on a phone.
  const [actionsFor, setActionsFor] = React.useState<DocumentView | null>(null);
  const [pending, setPending] = React.useState(false);

  function openUpload(typeId: string | null) {
    setPresetTypeId(typeId);
    setUploadOpen(true);
  }

  // Every offered type with nothing on file yet — the checklist half of the
  // table. Order follows `assetTypes` itself (system types first, then this
  // organization's own alphabetically), so it reads the same as the dropdown.
  const uploadedTypeIds = new Set(documents.map((document) => document.assetType.id));
  const missingTypes = allowUpload
    ? assetTypes.filter((type) => !uploadedTypeIds.has(type.id))
    : [];
  const isEmpty = documents.length + missingTypes.length === 0;

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const response = await fetch(`/api/documents/${deleting.id}`, {
      method: "DELETE",
    });
    setPending(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Could not delete the document");
      return;
    }

    setDeleting(null);
    toast.success("Document deleted");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {allowUpload && (
        <div className="flex justify-end">
          <Button onClick={() => openUpload(null)}>
            <PlusIcon />
            {uploadLabel}
          </Button>
        </div>
      )}

      {/*
        The desktop table has five columns and a strip of three icon buttons;
        below 768px it either scrolls sideways or crushes to nothing, so the
        same rows become cards — the shape every other list in the app
        (`DataTable`'s `renderCard`) already takes on a phone. The actions move
        into a bottom sheet for the same reason they do there.
      */}
      {isEmpty ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <ul className="space-y-2.5">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-start gap-1 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10"
            >
              {/* The whole card body opens the viewer, not a 16px file name —
                  the desktop row's tap target scaled to the medium. */}
              <button
                type="button"
                onClick={() => setViewing(document)}
                className="min-w-0 flex-1 space-y-1.5 text-left outline-none"
              >
                <div className="flex items-center gap-2">
                  <DocumentIcon fileType={document.fileType} />
                  <span className="truncate text-sm font-medium">
                    {document.fileName}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant="outline" className="font-normal">
                    {document.assetType.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(new Date(document.createdAt))}
                    {document.uploadedByName
                      ? ` · ${document.uploadedByName}`
                      : ""}
                  </span>
                </div>
              </button>

              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0"
                aria-label={`Actions for ${document.fileName}`}
                onClick={() => setActionsFor(document)}
              >
                <MoreVerticalIcon />
              </Button>
            </li>
          ))}

          {missingTypes.map((type) => (
            <li
              key={type.id}
              className="flex items-center gap-3 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileIcon className="size-4 shrink-0" />
                  <span className="truncate text-sm italic">Not uploaded</span>
                </div>
                <Badge variant="outline" className="font-normal">
                  {type.label}
                </Badge>
              </div>

              {/* Stays a visible button rather than folding into the sheet:
                  it is the row's only action, and burying one action behind a
                  menu costs a tap for nothing. */}
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => openUpload(type.id)}
              >
                <UploadIcon />
                Upload
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        // `py-0`: the Card's own vertical padding otherwise floats the table
        // in a 16px band of dead space above the header row and below the
        // last one — the table already carries its own row height, and
        // nothing else shares this card. `overflow-hidden rounded-xl` on
        // `Card` still clips the table's corners, so it reads as rounded
        // regardless of the padding removed.
        <Card className="py-0">
          <CardContent className="px-0">
            {/* No scroll wrapper here: `Table` already renders its own
                `data-slot="table-container"` with `overflow-x-auto`, and
                nesting a second one just creates a scroller that never
                scrolls. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date added</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="font-medium">
                      {/* The name opens the viewer too — a row you can only
                          act on from a 28px icon at the far right reads as
                          inert. */}
                      <button
                        type="button"
                        onClick={() => setViewing(document)}
                        className="flex max-w-[22rem] items-center gap-2 text-left hover:underline"
                      >
                        <DocumentIcon fileType={document.fileType} />
                        <span className="truncate">{document.fileName}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {document.assetType.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(new Date(document.createdAt))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {document.uploadedByName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`View ${document.fileName}`}
                          onClick={() => setViewing(document)}
                        >
                          <EyeIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Download ${document.fileName}`}
                          nativeButton={false}
                          render={
                            <a
                              href={`/api/documents/${document.id}?download`}
                              // The route sets Content-Disposition: attachment,
                              // so this needs no `download` attribute — and must
                              // not have one, since it is a cross-route link.
                            />
                          }
                        >
                          <DownloadIcon />
                        </Button>
                        {/* Always red, not just on hover — matches the delete
                            action on every other table in the app (e.g.
                            PaymentAccountsCard): danger reads from the icon at
                            rest, not as a hover surprise. */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${document.fileName}`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleting(document)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {missingTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">
                      <span className="flex max-w-[22rem] items-center gap-2 text-muted-foreground">
                        <FileIcon className="size-4 shrink-0" />
                        <span className="italic">Not uploaded</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {type.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {/* The one action that makes sense here: there is no
                            object behind this row yet, so View, Download and
                            Delete are all omitted rather than shown disabled —
                            a greyed-out icon still implies a document to act
                            on. */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openUpload(type.id)}
                        >
                          <UploadIcon />
                          Upload
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DocumentViewerDialog
        document={viewing}
        onClose={() => setViewing(null)}
      />

      {/*
        Mobile's replacement for the desktop row's three icon buttons. Same
        three actions in the same order, at a size a thumb can hit — and the
        bottom sheet is the shape `DataTable` already uses for row actions on
        a phone, so this reads the same as every other list in the app.
      */}
      <Sheet
        open={actionsFor !== null}
        onOpenChange={(open) => {
          if (!open) setActionsFor(null);
        }}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle className="truncate">{actionsFor?.fileName}</SheetTitle>
            <SheetDescription className="sr-only">
              Choose an action for this document.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4 pb-6">
            <Button
              variant="ghost"
              className="h-11 justify-start gap-3 px-3 text-sm"
              onClick={() => {
                // Closed first: the viewer is a dialog, and two layered
                // overlays trap focus in the wrong one.
                const document = actionsFor;
                setActionsFor(null);
                setViewing(document);
              }}
            >
              <EyeIcon />
              View
            </Button>

            <Button
              variant="ghost"
              className="h-11 justify-start gap-3 px-3 text-sm"
              nativeButton={false}
              render={
                <a
                  href={
                    actionsFor
                      ? `/api/documents/${actionsFor.id}?download`
                      : undefined
                  }
                />
              }
              onClick={() => setActionsFor(null)}
            >
              <DownloadIcon />
              Download
            </Button>

            <Button
              variant="ghost"
              className="h-11 justify-start gap-3 px-3 text-sm text-destructive hover:text-destructive"
              onClick={() => {
                const document = actionsFor;
                setActionsFor(null);
                setDeleting(document);
              }}
            >
              <Trash2Icon />
              Delete
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <DocumentUploadDialog
        key={`${uploadOpen}:${presetTypeId ?? ""}`}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        subjectType={subjectType}
        subjectId={subjectId}
        assetTypes={assetTypes}
        existingTypeIds={documents.map((document) => document.assetType.id)}
        initialAssetTypeId={presetTypeId}
        title={uploadLabel}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              {deleting?.fileName} will be removed from the file store. This
              cannot be undone.
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
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
