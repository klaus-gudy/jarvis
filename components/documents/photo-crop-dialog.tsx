"use client";

import * as React from "react";
import { Loader2Icon, ZoomInIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** The visible circular crop area, in CSS pixels. */
const FRAME_SIZE = 240;
/** The exported square, in pixels — enough to look sharp at any avatar size this app uses. */
const OUTPUT_SIZE = 512;
const MAX_ZOOM = 3;

type Offset = { x: number; y: number };

/**
 * Pick where a photo sits behind a circular frame, then export exactly that
 * square. No cropping library: the whole interaction is drag-to-pan plus a
 * zoom slider, which is the entire feature, so a canvas and two event
 * handlers cover it without a dependency.
 *
 * The frame is square, not clipped to a circle: the same image renders twice,
 * stacked. The back copy fills the whole square, blurred and dimmed, so the
 * part that's about to be cropped away stays visible as context instead of
 * vanishing — useful the moment a face or a logo sits near the edge and
 * disappearing content would be the only clue it needs to move. The front
 * copy is the same pixels, sharp, clipped to a circle by an `overflow-hidden`
 * wrapper sized to the frame. Both move together because both read the same
 * `offset`/`scale` state; only one carries the `onLoad` that measures the
 * image and only one is read back into the canvas at export, since they are
 * pixel-identical.
 *
 * The *export* is a plain square, though: the avatar's own `rounded-full`
 * clips it on display, and storing an already-round image would bake
 * transparency into a JPEG for no reason.
 *
 * `file` is required, not nullable — the caller only renders this component
 * once a file has been picked, keyed so a second pick remounts rather than
 * resetting state through an effect. That is also what makes the object URL's
 * lifetime trivial: it belongs to this instance and is revoked on unmount.
 */
export function PhotoCropDialog({
  file,
  onCancel,
  onCropped,
  pending = false,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  pending?: boolean;
}) {
  const imgRef = React.useRef<HTMLImageElement>(null);

  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    // Creating the object URL is inherently a side effect — it acquires a
    // resource that must be revoked — so it cannot happen during render, and
    // the resulting URL has to reach state somehow. Same shape as the
    // suppression in components/ui/carousel.tsx: unavoidable, not an oversight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url);
    return () => URL.revokeObjectURL(url);
    // `file` is stable for this component's lifetime — the caller remounts on
    // a new pick — so this runs exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragOrigin = React.useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const baseScale = natural ? Math.max(FRAME_SIZE / natural.w, FRAME_SIZE / natural.h) : 1;
  const scale = baseScale * zoom;
  const displayW = natural ? natural.w * scale : FRAME_SIZE;
  const displayH = natural ? natural.h * scale : FRAME_SIZE;

  /** Keeps the image covering the frame — the left/top edge can't pass 0, the right/bottom can't fall short of FRAME_SIZE. */
  function clamp(pos: Offset, w: number, h: number): Offset {
    return {
      x: Math.min(0, Math.max(FRAME_SIZE - w, pos.x)),
      y: Math.min(0, Math.max(FRAME_SIZE - h, pos.y)),
    };
  }

  function handleImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    const base = Math.max(FRAME_SIZE / w, FRAME_SIZE / h);
    setOffset({ x: (FRAME_SIZE - w * base) / 2, y: (FRAME_SIZE - h * base) / 2 });
  }

  function handlePointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    dragOrigin.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!dragOrigin.current) return;
    const dx = event.clientX - dragOrigin.current.startX;
    const dy = event.clientY - dragOrigin.current.startY;
    setOffset(
      clamp(
        { x: dragOrigin.current.originX + dx, y: dragOrigin.current.originY + dy },
        displayW,
        displayH
      )
    );
  }

  function handlePointerUp() {
    dragOrigin.current = null;
    setDragging(false);
  }

  /**
   * Re-anchors on the point currently at the frame's centre, so dragging the
   * slider zooms toward what you're looking at rather than sliding the image
   * toward a corner.
   */
  function handleZoomChange(nextZoom: number) {
    if (!natural) {
      setZoom(nextZoom);
      return;
    }
    const prevScale = scale;
    const nextScale = baseScale * nextZoom;
    const centerImgX = (FRAME_SIZE / 2 - offset.x) / prevScale;
    const centerImgY = (FRAME_SIZE / 2 - offset.y) / prevScale;
    const nextOffset = {
      x: FRAME_SIZE / 2 - centerImgX * nextScale,
      y: FRAME_SIZE / 2 - centerImgY * nextScale,
    };
    setZoom(nextZoom);
    setOffset(clamp(nextOffset, natural.w * nextScale, natural.h * nextScale));
  }

  function handleSave() {
    const img = imgRef.current;
    if (!img || !natural) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Everything on screen is in frame-space (0..FRAME_SIZE); multiplying by
    // this ratio maps it into the output canvas without changing anything
    // about how the crop was framed.
    const ratio = OUTPUT_SIZE / FRAME_SIZE;
    ctx.drawImage(
      img,
      offset.x * ratio,
      offset.y * ratio,
      displayW * ratio,
      displayH * ratio
    );

    canvas.toBlob((blob) => blob && onCropped(blob), "image/jpeg", 0.92);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Position the photo</DialogTitle>
          <DialogDescription>
            Drag to reposition, and use the slider to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="relative touch-none overflow-hidden rounded-lg bg-muted select-none"
            style={{
              width: FRAME_SIZE,
              height: FRAME_SIZE,
              cursor: dragging ? "grabbing" : "grab",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {src && (
              <>
                {/* What gets cropped away — same pixels, blurred and dimmed
                    rather than hidden, so it reads as "will be removed"
                    instead of just disappearing. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  aria-hidden
                  className="absolute max-w-none scale-110 blur-md brightness-[0.45]"
                  style={{ left: offset.x, top: offset.y, width: displayW, height: displayH }}
                />

                {/* What gets kept — the same image again, sharp, clipped to
                    the circle the export actually uses. */}
                <div className="absolute inset-0 overflow-hidden rounded-full ring-2 ring-background/70">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={src}
                    alt=""
                    draggable={false}
                    onLoad={handleImageLoad}
                    className="absolute max-w-none"
                    style={{ left: offset.x, top: offset.y, width: displayW, height: displayH }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex w-full items-center gap-2">
            <ZoomInIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(event) => handleZoomChange(Number(event.target.value))}
              disabled={!natural || pending}
              className="h-1.5 w-full accent-primary disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!natural || pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {pending ? "Saving…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
