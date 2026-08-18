import { z } from "zod";

import { PAYMENT_ACCOUNT_TYPES } from "@/lib/payment-account-options";

/**
 * Account name is the only optional field. nullish, not optional: the
 * transform emits null, so accepting only string|undefined would leave the
 * schema unable to re-parse its own output — see the 2026-08-08 decision entry.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const paymentAccountSchema = z.object({
  type: z.enum(PAYMENT_ACCOUNT_TYPES),
  provider: z.string().trim().min(1, "Provider is required").max(60),
  /**
   * Free text rather than a number: a Lipa till and a bank account are both
   * digit strings whose leading zeros matter, and some banks use separators.
   */
  accountNumber: z
    .string()
    .trim()
    .min(1, "Number is required")
    .max(40)
    .regex(/^[0-9 -]+$/, "Use digits only"),
  accountName: optionalText(80),
  isDefault: z.boolean().optional().default(false),
});

export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;
