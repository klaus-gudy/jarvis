"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { PhotoCropDialog } from "@/components/documents/photo-crop-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IMAGE_FILE_EXTENSIONS, IMAGE_FILE_LABEL, IMAGE_FILE_TYPES } from "@/lib/document-options";
import { initials } from "@/lib/user-display";

/**
 * A member's avatar — their photo if one is on file, initials otherwise —
 * with a small "add" badge that opens the picker, crops to a circle, and
 * uploads. Read-only entry point into the same `FileAsset` machinery every
 * other document goes through, aimed permanently at the `PROFILE_PHOTO` type.
 *
 * **There is no type to choose.** `PROFILE_PHOTO` is seeded system-wide (see
 * the 2026-08-25 migration) specifically so this component never has to ask —
 * `assetTypeId` is a prop resolved server-side, not a decision made here.
 *
 * **Uploading replaces, it doesn't add.** `PROFILE_PHOTO` disallows multiple —
 * one photo is *the* photo — so a second upload without deleting the first
 * would 409. This component deletes the existing one first rather than
 * surfacing that as an error: nobody choosing a new profile photo is trying to
 * keep the old one around. The trade-off, accepted deliberately: if the
 * upload that follows fails, the member is briefly back to initials rather
 * than back to the old photo, and has to retry.
 */
export function ProfilePhotoAvatar({
  membershipId,
  name,
  photoId,
  assetTypeId,
  className = "size-12",
}: {
  /**
   * Null when there's nothing to attach a photo to — someone viewing their
   * own `/profile` without an organization has no `Membership`, since a
   * profile photo hangs off the same row `FileAsset` scopes everything else
   * to. The avatar still renders, just without the edit badge.
   */
  membershipId: string | null;
  name: string;
  photoId: string | null;
  /** The resolved id of the seeded `PROFILE_PHOTO` type. Editing is disabled without one — should never happen, but a missing seed is not a reason to crash the page. */
  assetTypeId: string | null;
  /** Sizes the avatar itself; the add badge is fixed, being only used at one size today. */
  className?: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [picked, setPicked] = React.useState<File | null>(null);
  const [pending, setPending] = React.useState(false);

  // Editing needs both a subject to attach to and a type to file under.
  const editable = membershipId !== null && assetTypeId !== null;

  function handlePick(file: File) {
    if (!(file.type in IMAGE_FILE_TYPES)) {
      toast.error(`Upload a ${IMAGE_FILE_LABEL} image`);
      return;
    }
    if (file.size === 0) {
      toast.error("That file is empty");
      return;
    }
    setPicked(file);
  }

  async function handleCropped(blob: Blob) {
    if (!membershipId || !assetTypeId) return;
    setPending(true);

    // Delete before upload, not after: `PROFILE_PHOTO` allows only one, so an
    // upload with the old row still present would 409.
    if (photoId) {
      await fetch(`/api/documents/${photoId}`, { method: "DELETE" }).catch(() => {
        // Falls through to the upload attempt regardless — a delete that
        // failed because the row was already gone (a stale prop) should not
        // block a fresh photo from going up.
      });
    }

    const body = new FormData();
    body.append("file", new File([blob], "profile-photo.jpg", { type: "image/jpeg" }));
    body.append("assetTypeId", assetTypeId);
    body.append("subjectType", "MEMBERSHIP");
    body.append("subjectId", membershipId);

    const response = await fetch("/api/documents", { method: "POST", body });
    setPending(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Could not save that photo");
      return;
    }

    setPicked(null);
    toast.success("Profile photo updated");
    router.refresh();
  }

  return (
    <>
      <div className="relative inline-flex shrink-0">
        <Avatar className={className}>
          {photoId && <AvatarImage src={`/api/documents/${photoId}`} alt={name} />}
          <AvatarFallback className="text-sm">{initials(name)}</AvatarFallback>
        </Avatar>

        {editable && (
          <>
            <button
              type="button"
              aria-label={photoId ? "Change profile photo" : "Add a profile photo"}
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className="absolute right-0 bottom-0 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-50"
            >
              <PlusIcon className="size-3" />
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_FILE_EXTENSIONS}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handlePick(file);
                // Cleared so picking the same file again still fires `change`.
                event.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {/* Keyed by file identity, not a boolean: a second pick before the first
          is saved should start the crop over rather than reuse stale state. */}
      {picked && (
        <PhotoCropDialog
          key={`${picked.name}:${picked.size}:${picked.lastModified}`}
          file={picked}
          onCancel={() => setPicked(null)}
          onCropped={handleCropped}
          pending={pending}
        />
      )}
    </>
  );
}
