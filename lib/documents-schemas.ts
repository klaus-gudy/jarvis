import { z } from "zod";

import { DOCUMENT_SUBJECTS, SUBJECT_FOR_ASSET_TYPE } from "@/lib/document-options";
import { FileAssetType } from "@/lib/generated/prisma/enums";

/**
 * The non-file half of an upload. The file itself is checked in the route,
 * where its size and MIME type are available; this covers what comes alongside
 * it in the multipart body.
 *
 * `z.enum(FileAssetType)` reads the generated Prisma enum rather than
 * re-listing seventeen strings, so a value added to the schema cannot be
 * missing from the validator.
 */
export const uploadDocumentSchema = z
  .object({
    assetType: z.enum(FileAssetType),
    subjectType: z.enum(DOCUMENT_SUBJECTS),
    /**
     * nullish, not optional: the transform emits null for an organization-level
     * upload, so accepting only string|undefined would leave the schema unable
     * to re-parse its own output. See the decision log entry for 2026-08-08.
     */
    subjectId: z
      .string()
      .trim()
      .max(40)
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .superRefine((value, ctx) => {
    // OTHER is the deliberate escape hatch and may be filed anywhere; every
    // other type has exactly one home, so that a NIDA cannot land on a
    // property and a title deed cannot land on an invoice.
    const expected = SUBJECT_FOR_ASSET_TYPE[value.assetType];
    if (value.assetType !== "OTHER" && value.subjectType !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["assetType"],
        message: `That document type belongs to a ${expected}, not a ${value.subjectType}`,
      });
    }

    // The organization is identified by the session, never by the request —
    // so it is the one subject that must not carry an id.
    if (value.subjectType === "organization") {
      if (value.subjectId !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["subjectId"],
          message: "An organization-level document takes no subject id",
        });
      }
      return;
    }

    if (value.subjectId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["subjectId"],
        message: `Which ${value.subjectType} is this document about?`,
      });
    }
  });

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
