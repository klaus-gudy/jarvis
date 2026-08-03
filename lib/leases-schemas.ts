import { z } from "zod";

export const createLeaseSchema = z
  .object({
    unitId: z.string().trim().min(1, "Select a unit"),
    membershipId: z.string().trim().min(1, "Select a tenant"),
    startDate: z.coerce.date({ error: "Start date is required" }),
    endDate: z.coerce.date().optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "End date cannot be before the start date",
    path: ["endDate"],
  });

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
