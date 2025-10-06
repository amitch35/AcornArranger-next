import { z } from "zod";

// Shared constraints
const POSITIVE_INT = z
  .number()
  .int()
  .min(1, { message: "ID must be a positive integer" })
  .max(2147483647, { message: "ID must be <= 2147483647" });

export const IdArraySchema = z.array(POSITIVE_INT).default([]);

// Dates are ISO 8601 strings; normalization to UTC is handled by the codec.
export const IsoDateString = z.string().datetime().optional();

export const BaseFilterSchema = z
  .object({
    q: z.string().optional().default(""),
    page: z.number().int().min(1).optional().default(1),
    pageSize: z.number().int().min(1).optional().default(25),
    sort: z.string().optional().default(""),
    dateFrom: IsoDateString,
    dateTo: IsoDateString,
  })
  .strict();

export type BaseFilters = z.infer<typeof BaseFilterSchema>;

// Entity filter schemas. We intentionally include common ID arrays for cross-entity filtering.
export const AppointmentFiltersSchema = BaseFilterSchema.extend({
  statusIds: IdArraySchema,
  serviceIds: IdArraySchema,
  staffIds: IdArraySchema,
  propertyIds: IdArraySchema,
});

export const PropertyFiltersSchema = BaseFilterSchema.extend({
  statusIds: IdArraySchema,
  serviceIds: IdArraySchema,
  staffIds: IdArraySchema,
  propertyIds: IdArraySchema,
});

export const StaffFiltersSchema = BaseFilterSchema.extend({
  statusIds: IdArraySchema,
  serviceIds: IdArraySchema,
  staffIds: IdArraySchema,
  propertyIds: IdArraySchema,
});

export type AppointmentFilters = z.infer<typeof AppointmentFiltersSchema>;
export type PropertyFilters = z.infer<typeof PropertyFiltersSchema>;
export type StaffFilters = z.infer<typeof StaffFiltersSchema>;


