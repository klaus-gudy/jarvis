"use client";

import * as React from "react";

type Point = { x: number; y: number };

export type SignaturePadHandle = {
  clear: () => void;
  /** The drawing trimmed to its ink, as a transparent PNG; null when empty. */
  toBlob: () => Promise<Blob | null>;
};

/** Printed on paper, so the ink is dark in both themes and the pad is white. */
const INK = "#111827";
const LINE_WIDTH = 2.5;
/** Export at 2× the drawn size so the contract PDF prints it crisply. */
const EXPORT_SCALE = 2;
const EXPORT_PADDING = 8;
/** Keeps a signature drawn across a wide desktop pad a sensible size. */
const MAX_EXPORT_WIDTH = 1200;

/**
 * A pad to draw a signature on with a finger, stylus or mouse. Hand-built on
 * a canvas like `PhotoCropDialog`, no library.
 *
 * Strokes are kept as points (CSS pixels) rather than only as pixels, which
 * buys two things: a resize — rotating a phone — redraws them instead of
 * wiping the canvas, and the export can re-render just the inked area at a
 * higher resolution rather than cropping a screen-resolution bitmap.
 *
 * The canvas is sized in a ref callback with a ResizeObserver (the pattern
 * `LoadMoreSentinel` uses), and strokes live in a ref, so drawing never
 * re-renders React; only "is there any ink" is state, for the Save button.
 */
export function SignaturePad({
  ref,
  onInkChange,
}: {
  ref: React.Ref<SignaturePadHandle>;
  onInkChange: (hasInk: boolean) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const strokes = React.useRef<Point[][]>([]);
  const drawing = React.useRef(false);
  const [hasInk, setHasInk] = React.useState(false);

  const setInk = React.useCallback(
    (value: boolean) => {
      setHasInk(value);
      onInkChange(value);
    },
    [onInkChange]
  );

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes.current) paintStroke(context, stroke);
  }, []);

  const attach = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      if (!canvas) return;
      const observer = new ResizeObserver(() => {
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(canvas.clientWidth * ratio);
        canvas.height = Math.round(canvas.clientHeight * ratio);
        redraw();
      });
      observer.observe(canvas);
      return () => observer.disconnect();
    },
    [redraw]
  );

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    strokes.current.push([pointFrom(event)]);
    redraw();
    if (!hasInk) setInk(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const stroke = strokes.current.at(-1);
    if (!stroke) return;
    // Coalesced events keep a fast stroke smooth on high-rate pens.
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const rect = event.currentTarget.getBoundingClientRect();
    for (const each of events) {
      stroke.push({ x: each.clientX - rect.left, y: each.clientY - rect.top });
    }
    redraw();
  }

  function handlePointerUp() {
    drawing.current = false;
  }

  React.useImperativeHandle(
    ref,
    () => ({
      clear() {
        strokes.current = [];
        redraw();
        setInk(false);
      },
      toBlob() {
        return exportStrokes(strokes.current);
      },
    }),
    [redraw, setInk]
  );

  return (
    <div className="relative overflow-hidden rounded-xl bg-white ring-1 ring-foreground/15">
      <canvas
        ref={attach}
        className="block h-48 w-full cursor-crosshair touch-none sm:h-52"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Signature pad: draw your signature"
        role="img"
      />
      {/* The signing line and hint are HTML, not ink, so they never end up
          in the exported image. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-neutral-300"
      />
      {!hasInk && (
        <p
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs text-neutral-400"
        >
          Sign above the line
        </p>
      )}
    </div>
  );
}

function paintStroke(context: CanvasRenderingContext2D, stroke: Point[]) {
  context.strokeStyle = INK;
  context.fillStyle = INK;
  context.lineWidth = LINE_WIDTH;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (stroke.length === 1) {
    // A tap is a dot — the tittle of an "i".
    context.beginPath();
    context.arc(stroke[0].x, stroke[0].y, LINE_WIDTH / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }

  // Quadratic curves through the midpoints: smooth without lagging the pen.
  context.beginPath();
  context.moveTo(stroke[0].x, stroke[0].y);
  for (let i = 1; i < stroke.length - 1; i++) {
    const mid = {
      x: (stroke[i].x + stroke[i + 1].x) / 2,
      y: (stroke[i].y + stroke[i + 1].y) / 2,
    };
    context.quadraticCurveTo(stroke[i].x, stroke[i].y, mid.x, mid.y);
  }
  const last = stroke[stroke.length - 1];
  context.lineTo(last.x, last.y);
  context.stroke();
}

/** Re-renders only the inked area, transparent, at `EXPORT_SCALE`. */
function exportStrokes(strokes: Point[][]): Promise<Blob | null> {
  const points = strokes.flat();
  if (points.length === 0) return Promise.resolve(null);

  const pad = EXPORT_PADDING + LINE_WIDTH;
  const minX = Math.min(...points.map((p) => p.x)) - pad;
  const minY = Math.min(...points.map((p) => p.y)) - pad;
  const maxX = Math.max(...points.map((p) => p.x)) + pad;
  const maxY = Math.max(...points.map((p) => p.y)) + pad;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(EXPORT_SCALE, MAX_EXPORT_WIDTH / width);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
  for (const stroke of strokes) paintStroke(context, stroke);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
