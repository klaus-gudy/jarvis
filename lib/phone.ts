import { z } from "zod";

/**
 * Tanzanian numbers arrive in four common shapes — 0712345678, 0712 345 678,
 * +255712345678, 255712345678 — but only one is stored: the 10-digit local
 * form starting with 0. This is the single place that shape is decided, so
 * every schema that takes a phone number normalizes the same way.
 */
export function normalizeTzPhone(raw: string): string | null {
  const digits = raw.trim().replace(/[\s-]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith("0")) {
    return digits.length === 10 ? digits : null;
  }

  // Country-code form: 255 + 9-digit subscriber number.
  if (digits.startsWith("255") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  return null;
}

const INVALID_PHONE_MESSAGE = "Enter a valid phone number";

/** Required phone field: trims, accepts any of the four input shapes, stores the canonical local form. */
export const tzPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeTzPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: INVALID_PHONE_MESSAGE });
      return z.NEVER;
    }
    return normalized;
  });

/** Optional variant: blank input normalizes to null instead of failing validation. */
export const optionalTzPhoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizeTzPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: INVALID_PHONE_MESSAGE });
      return z.NEVER;
    }
    return normalized;
  });
