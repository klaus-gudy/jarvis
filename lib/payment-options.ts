/**
 * How rent actually gets paid here. A plain constant list, like
 * `lib/unit-options.ts` — `Payment.method` is a nullable `String` in the
 * schema, so this constrains the form without constraining the column.
 */
export const PAYMENT_METHOD_OPTIONS = [
  "Cash",
  "M-Pesa",
  "Tigo Pesa",
  "Airtel Money",
  "Halopesa",
  "Bank transfer",
  "Cheque",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number];
