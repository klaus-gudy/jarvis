"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, ImagePlusIcon, MaximizeIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { PhotoUploadDialog } from "@/components/documents/photo-upload-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AssetTypeView } from "@/lib/asset-types";
import type { DocumentView } from "@/lib/document-options";
import type { FileAssetSubject } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * Photos for one subject, as a carousel with a thumbnail strip.
 *
 * A carousel rather than a grid because these are looked *at*, one at a time —
 * a wall of thumbnails is a file manager, which is what the documents table
 * already is. Each slide is the same `GET /api/documents/[id]` everything else
 * reads through, so the bucket stays private and the browser's own cache does
 * the work of not re-fetching a photo you scroll back to.
 */
export function PhotoGallery({
  subjectType,
  subjectId,
  assetTypes,
  photos,
  title,
  emptyMessage,
}: {
  subjectType: FileAssetSubject;
  subjectId: string;
  /** Photo types for this subject; the first is the default the picker opens on. */
  assetTypes: AssetTypeView[];
  photos: DocumentView[];
  title: string;
  emptyMessage: string;
}) {
  const router = useRouter();
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<DocumentView | null>(null);
  const [deleting, setDeleting] = React.useState<DocumentView | null>(null);
  const [pending, setPending] = React.useState(false);

  /**
   * Embla is imperative and outside React's world, so subscribing is the only
   * way to know which slide is showing. Nothing is set synchronously here —
   * `current` starts at 0 and so does the carousel, so the initial values
   * already agree and the handler covers every change after that, including
   * the re-init after a photo is deleted.
   */
  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const response = await fetch(`/api/documents/${deleting.id}`, {
      method: "DELETE",
    });
    setPending(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Could not delete the photo");
      return;
    }

    setDeleting(null);
    toast.success("Photo deleted");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {photos.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              {photos.length}
            </span>
          )}
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <ImagePlusIcon />
          Add photos
        </Button>
      </div>

      <Card>
        <CardContent className={photos.length > 0 ? "p-3" : undefined}>
          {photos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ImageIcon className="size-5" />
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Carousel setApi={setApi} opts={{ loop: photos.length > 1 }}>
                <CarouselContent>
                  {photos.map((photo) => (
                    <CarouselItem key={photo.id}>
                      <div className="relative overflow-hidden rounded-lg bg-muted">
                        {/* Not `next/image`: the source is an authenticated API
                            route serving arbitrary user uploads, so there is
                            nothing for the optimizer to pre-measure or cache. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/documents/${photo.id}`}
                          alt={photo.fileName}
                          // 16:9 with a ceiling: on a wide screen the ratio
                          // alone gives a slide over 500px tall, which pushes
                          // the counter, thumbnails and the documents table
                          // below the fold. `object-contain` letterboxes a
                          // photo that doesn't match rather than cropping it.
                          className="aspect-16/9 max-h-[26rem] w-full object-contain"
                        />

                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            aria-label={`View ${photo.fileName} full size`}
                            onClick={() => setViewing(photo)}
                          >
                            <MaximizeIcon />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            aria-label={`Delete ${photo.fileName}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleting(photo)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>

                {/* One photo needs no arrows — they would only ever be
                    disabled, which reads as something being broken. */}
                {photos.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </>
                )}
              </Carousel>

              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs text-muted-foreground">
                  {photos[current]?.fileName}
                </p>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {current + 1} / {photos.length}
                </p>
              </div>

              {photos.length > 1 && (
                <ul className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((photo, index) => (
                    <li key={photo.id} className="shrink-0">
                      <button
                        type="button"
                        aria-label={`Show ${photo.fileName}`}
                        aria-current={index === current}
                        onClick={() => api?.scrollTo(index)}
                        className={cn(
                          "block size-16 overflow-hidden rounded-md border-2 transition-colors",
                          index === current
                            ? "border-primary"
                            : "border-transparent hover:border-border"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/documents/${photo.id}`}
                          alt=""
                          className="size-full object-cover"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentViewerDialog
        document={viewing}
        onClose={() => setViewing(null)}
      />

      <PhotoUploadDialog
        key={String(uploadOpen)}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        subjectType={subjectType}
        subjectId={subjectId}
        assetTypes={assetTypes}
        title="Add photos"
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this photo?</DialogTitle>
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
              {pending ? "Deleting…" : "Delete photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
