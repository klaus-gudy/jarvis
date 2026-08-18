/**
 * Options and labels for payment accounts.
 *
 * Dependency-free on purpose: the dialog and the table are client components
 * and need these at runtime, so importing them from `lib/payment-accounts.ts`
 * would drag Prisma (and its `dns` require) into the browser bundle. Same
 * split, same reason, as `lib/search-types.ts` and `lib/auth/constants.ts`.
 */

export const PAYMENT_ACCOUNT_TYPES = ["MOBILE_MONEY", "BANK", "LIPA"] as const;

export type PaymentAccountTypeValue = (typeof PAYMENT_ACCOUNT_TYPES)[number];

export const PAYMENT_ACCOUNT_TYPE_LABEL: Record<
  PaymentAccountTypeValue,
  string
> = {
  MOBILE_MONEY: "Mobile money",
  BANK: "Bank account",
  LIPA: "Bank/Service Lipa number",
};

/**
 * The number column means something different per type, and a tenant copying
 * it needs to know which. Doubles as the field label in the dialog.
 */
export const PAYMENT_ACCOUNT_NUMBER_LABEL: Record<
  PaymentAccountTypeValue,
  string
> = {
  MOBILE_MONEY: "Mobile number",
  BANK: "Account number",
  LIPA: "Lipa number",
};

/**
 * Suggestions, not a closed list — `provider` is stored as free text so a bank
 * or wallet missing here can still be entered. Kept in the order a Tanzanian
 * landlord is most likely to reach for.
 */
export const PAYMENT_ACCOUNT_PROVIDERS: Record<
  PaymentAccountTypeValue,
  readonly string[]
> = {
  MOBILE_MONEY: [
    "M-Pesa",
    "Mixx by Yas",
    "Airtel Money",
    "HaloPesa",
    "Azam Pesa",
    "T-Pesa",
  ],
  BANK: ["CRDB", "NMB", "NBC", "KCB", "Exim", "Absa", "Stanbic", "Equity"],
  LIPA: ["M-Pesa Lipa", "Mixx by Yas Lipa", "Airtel Money Lipa", "KCB Lipa"],
};
