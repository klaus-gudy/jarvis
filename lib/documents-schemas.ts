import { z } from "zod";

import { FileAssetSubject } from "@/lib/generated/prisma/enums";

/**
 * The non-file half of an upload. The file itself is checked in the route,
 * where its size and MIME type are available; this covers what comes alongside
 * it in the multipart body.
 *
 * The type/subject pairing is no longer checked here — it used to be a
 * `superRefine` against a static map, and a type's subject now lives on the
 * `FileAssetType` row. `createDocument` resolves the row and compares, which is
 * the only place that *can* since it is the only place that has it.
 */
export const uploadDocumentSchema = z
  .object({
    assetTypeId: z.string().trim().min(1, "Choose a document type").max(40),
    subjectType: z.enum(FileAssetSubject),
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
    // The organization is identified by the session, never by the request —
    // so it is the one subject that must not carry an id.
    if (value.subjectType === "ORGANIZATION") {
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
        message: `Which ${value.subjectType.toLowerCase()} is this document about?`,
      });
    }
  });

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

/**
 * Adding a document type. **The group is not in here.** It is taken from the
 * surface the request came from — a route parameter the client fills in from
 * context — so the person adding "Inspection report" from a lease never has to
 * know the word "subject", let alone pick one.
 */
export const createAssetTypeSchema = z.object({
  label: z.string().trim().min(1, "Give the type a name").max(60),
  subject: z.enum(FileAssetSubject),
  isPhoto: z.boolean().default(false),
});

export type CreateAssetTypeInput = z.infer<typeof createAssetTypeSchema>;
