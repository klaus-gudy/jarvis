import type {
  AttachmentKind,
  AttachmentOwnerType,
  AttachmentView,
} from "@/lib/attachment-types";

/**
 * The named documents each kind of record is expected to hold. A slot exists
 * whether or not anything has been uploaded into it — that is the point: a
 * tenant's NIDA is a thing the org needs *before* it has been collected, so
 * "NIDA card — not uploaded" is more useful than an empty box.
 *
 * Code constants rather than a table, matching `lib/unit-options.ts` and
 * `lib/payment-options.ts`. There is no lookup data to seed, and nothing here
 * varies per organization yet. If it ever needs to — one landlord requiring a
 * business licence another doesn't — this becomes a model with the same shape
 * and the slot key stays the join.
 *
 * Client-safe: no Prisma, no AWS SDK. Same rule as `lib/attachment-types.ts`.
 */
export type AttachmentSlot = {
  /** Stable identifier, stored on the row. Never rename one in place — the
   * label is what's for reading, and existing files point at this. */
  key: string;
  label: string;
  /** Shown under the label on an empty slot, so it says what belongs here
   * rather than only that something is missing. */
  description: string;
  /** Restricts the file picker where a slot only makes sense as one kind. Null
   * accepts either — a NIDA arrives as often as a phone photo as a scan. */
  kind: AttachmentKind | null;
  /** Whether the slot naturally holds a set. Advisory: it changes the button
   * from "Replace" to "Add", it does not stop a second file existing. */
  multiple: boolean;
};

export const ATTACHMENT_SLOTS: Record<AttachmentOwnerType, AttachmentSlot[]> = {
  lease: [
    {
      key: "contract",
      label: "Signed contract",
      description: "The lease agreement signed by both parties",
      kind: null,
      multiple: false,
    },
    {
      key: "addendum",
      label: "Addenda",
      description: "Variations agreed after signing",
      kind: null,
      multiple: true,
    },
    {
      key: "handover",
      label: "Handover checklist",
      description: "Condition of the unit at move-in or move-out",
      kind: null,
      multiple: true,
    },
  ],
  property: [
    {
      key: "photos",
      label: "Photos",
      description: "Exterior and common areas",
      kind: "IMAGE",
      multiple: true,
    },
    {
      key: "title-deed",
      label: "Title deed",
      description: "Proof of ownership for the building",
      kind: null,
      multiple: false,
    },
    {
      key: "floor-plan",
      label: "Floor plans",
      description: "Layout drawings, one per floor or block",
      kind: null,
      multiple: true,
    },
  ],
  unit: [
    {
      key: "photos",
      label: "Photos",
      description: "Rooms and fittings as currently let",
      kind: "IMAGE",
      multiple: true,
    },
    {
      key: "condition-report",
      label: "Condition report",
      description: "Inventory and state of repair",
      kind: null,
      multiple: true,
    },
  ],
  membership: [
    {
      key: "nida",
      label: "NIDA card",
      description: "National ID — scan or photo of both sides",
      kind: null,
      multiple: false,
    },
    {
      key: "passport-photo",
      label: "Passport photo",
      description: "Head and shoulders, for the tenant record",
      kind: "IMAGE",
      multiple: false,
    },
    {
      key: "employment-letter",
      label: "Proof of income",
      description: "Employment letter, payslip or business licence",
      kind: null,
      multiple: true,
    },
  ],
  payment: [
    {
      key: "receipt",
      label: "Receipt",
      description: "Bank slip or mobile money confirmation",
      kind: null,
      multiple: false,
    },
  ],
};

/** The slot, or null when the key isn't one this owner type defines. Null is
 * the rejection signal on the way in — a client naming an unknown slot must
 * fail rather than have it stored and render as nothing. */
export function findSlot(ownerType: AttachmentOwnerType, slotKey: string) {
  return ATTACHMENT_SLOTS[ownerType].find((slot) => slot.key === slotKey) ?? null;
}

/**
 * What to call a file. The per-file title wins where one was given, then the
 * slot's label, and the filename is the last resort — so a row always has a
 * name even if every optional field is empty.
 */
export function attachmentDisplayName(
  ownerType: AttachmentOwnerType,
  attachment: Pick<AttachmentView, "slotKey" | "title" | "fileName">
) {
  if (attachment.title) return attachment.title;
  if (attachment.slotKey) {
    const slot = findSlot(ownerType, attachment.slotKey);
    if (slot) return slot.label;
  }
  return attachment.fileName;
}
