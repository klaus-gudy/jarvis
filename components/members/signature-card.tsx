"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PenLineIcon, SignatureIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/members/signature-pad";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A member's signature, as printed on their contracts.
 *
 * Everyone in the organization sees it; only the member themself gets the
 * buttons — the API refuses anyone else with a 403, and hiding the buttons is
 * just so nobody is offered something that can't work.
 */
export function SignatureCard({
  membershipId,
  name,
  signatureKey,
  isSelf,
}: {
  membershipId: string;
  name: string;
  signatureKey: string | null;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  // The response is `no-store`, but the <img> URL itself must change after a
  // replace or the browser keeps painting the old one. The key's file name is
  // a fresh uuid per signature, so it makes a natural version.
  const version = signatureKey?.split("/").at(-1);
  const src = version
    ? `/api/members/${membershipId}/signature?v=${encodeURIComponent(version)}`
    : null;

  async function remove() {
    setRemoving(true);
    const response = await fetch(`/api/members/${membershipId}/signature`, {
      method: "DELETE",
    }).catch(() => null);
    setRemoving(false);
    if (!response?.ok) {
      toast.error("Couldn't remove your signature");
      return;
    }
    toast.success("Signature removed");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <SignatureIcon className="size-4 text-muted-foreground" aria-hidden />
          Signature
        </CardTitle>
        {isSelf && (
          <CardAction className="row-span-1 -my-1 flex gap-1">
            {src && (
              <Button
                variant="ghost"
                size="sm"
                onClick={remove}
                disabled={removing}
                aria-label="Remove signature"
              >
                <Trash2Icon />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <PenLineIcon />
              {src ? "Replace" : "Add signature"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {src ? (
          // White in both themes: it's dark ink meant for paper.
          <div className="flex h-28 items-center justify-center rounded-xl bg-white p-3 ring-1 ring-foreground/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- an
                authenticated, uncacheable API image; next/image can't proxy it */}
            <img
              src={src}
              alt={`${name}'s signature`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isSelf
              ? "You haven't added a signature yet. It's used on contracts that ask for one."
              : `No signature on file. Only ${name} can add their own signature.`}
          </p>
        )}
      </CardContent>

      {isSelf && (
        // Remounted per open so the pad starts blank each time.
        <Dialog key={String(open)} open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <SignatureForm
              membershipId={membershipId}
              onClose={() => setOpen(false)}
              onSaved={() => {
                setOpen(false);
                toast.success("Signature saved");
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function SignatureForm({
  membershipId,
  onClose,
  onSaved,
}: {
  membershipId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pad = React.useRef<SignaturePadHandle>(null);
  const [hasInk, setHasInk] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function save() {
    const blob = await pad.current?.toBlob();
    if (!blob) return;
    setPending(true);

    const form = new FormData();
    form.set("file", new File([blob], "signature.png", { type: "image/png" }));
    const response = await fetch(`/api/members/${membershipId}/signature`, {
      method: "PUT",
      body: form,
    }).catch(() => null);

    if (response?.ok) {
      onSaved();
      return;
    }
    const data = await response?.json().catch(() => null);
    toast.error(data?.error ?? "Couldn't save your signature");
    setPending(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Your signature</DialogTitle>
        <DialogDescription>
          Draw it with your finger, a stylus or the mouse.
        </DialogDescription>
      </DialogHeader>

      <SignaturePad ref={pad} onInkChange={setHasInk} />

      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => pad.current?.clear()}
          disabled={!hasInk || pending}
        >
          Clear
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!hasInk || pending}>
            {pending ? "Saving…" : "Save signature"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
