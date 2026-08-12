import { z } from "zod";

import {
  ACCEPTED_CONTENT_TYPES,
  ATTACHMENT_OWNER_TYPES,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/attachment-types";

/** The owner is named by the client, so it is validated as a closed union
 * before anything looks it up — an unknown owner type must 400, not fall
 * through to a query that quietly matches nothing. */
const ownerSchema = z.object({
  ownerType: z.enum(ATTACHMENT_OWNER_TYPES),
  ownerId: z.string().min(1),
});

/**
 * A file is filed either under one of its owner type's named slots or under a
 * title of its own. Requiring one or the other is what stops a row arriving
 * with nothing to call it but a filename — the whole reason the columns exist.
 *
 * `slotKey` is only checked for *shape* here; whether the key is one this owner
 * type actually defines is checked in `lib/attachments.ts`, where the owner
 * type and the slot list are both in hand.
 */
const labelledSchema = ownerSchema
  .extend({
    slotKey: z.string().min(1).max(60).nullish(),
    title: z.string().trim().min(1).max(120).nullish(),
  })
  .refine((value) => value.slotKey || value.title, {
    message: "Give the file a title, or file it under a document type",
    path: ["title"],
  });

/**
 * Asking for somewhere to upload to. The size is the browser's claim and is
 * only used to fail fast — the figure that gets recorded is read back off the
 * object afterwards.
 */
export const presignAttachmentSchema = labelledSchema.safeExtend({
  fileName: z.string().trim().min(1, "File name is required").max(255),
  contentType: z
    .string()
    .refine(
      (value) => value.toLowerCase() in ACCEPTED_CONTENT_TYPES,
      "That file type isn't supported"
    ),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_ATTACHMENT_BYTES, "That file is too large"),
});

export type PresignAttachmentInput = z.infer<typeof presignAttachmentSchema>;

/**
 * Recording an upload that has landed. The key must be one this server issued;
 * `registerAttachment` checks it sits under the caller's own org prefix and
 * that an object is actually there, so a forged key names nothing.
 */
export const registerAttachmentSchema = labelledSchema.safeExtend({
  key: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
});

export type RegisterAttachmentInput = z.infer<typeof registerAttachmentSchema>;
