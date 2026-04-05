import { z } from "zod";

/**
 * Partial update body for PUT /api/roles/:id
 * Rejects unknown keys (e.g. title/description must not be sent from client).
 */
export const RoleUpdatePayloadSchema = z
  .object({
    priority: z
      .number()
      .int()
      .min(-2147483648, { message: "priority out of range" })
      .max(2147483647, { message: "priority out of range" }),
    can_lead_team: z.boolean(),
    can_clean: z.boolean(),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one of priority, can_lead_team, can_clean is required",
  });

export type RoleUpdatePayload = z.infer<typeof RoleUpdatePayloadSchema>;
