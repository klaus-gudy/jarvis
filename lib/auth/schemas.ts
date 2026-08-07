import { z } from "zod";

import { tzPhoneSchema } from "@/lib/phone";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email")),
  // Mandatory: every member must have a phone number on record.
  phone: tzPhoneSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
  organizationName: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(100),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone"),
  password: z.string().min(1, "Enter your password"),
  /** When false the session cookie lasts only until the browser closes. */
  remember: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
