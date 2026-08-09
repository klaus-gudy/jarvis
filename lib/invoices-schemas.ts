import { z } from "zod";

/**
 * Empty strings arrive from untouched form inputs and mean "not provided".
 * Nullish (not just optional) so the schema stays idempotent, matching the
 * rule the rest of the codebase follows for any transform that can emit null.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const recordPaymentSchema = z.object({
  amount: z
    .number({ error: "Amount is required" })
    .int("Amount must be a whole number")
    .positive("Amount must be greater than 0"),
  paidAt: z.coerce.date({ error: "Date is required" }),
  method: optionalText(40),
  notes: optionalText(200),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
