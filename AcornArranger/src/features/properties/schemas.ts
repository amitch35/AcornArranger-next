import { z } from "zod";

/**
 * Property-related Zod schemas aligned with actual database schema
 * 
 * Schema verification (via Supabase MCP):
 * - rc_properties.properties_id (bigint) is the primary key
 * - rc_properties.estimated_cleaning_mins (smallint nullable) - user-entered estimate
 * - rc_properties.double_unit (int8[] nullable) - array of related properties_id values
 * - rc_properties.status_id (smallint FK) -> property_status_key.status_id
 * - rc_properties.address (bigint FK) -> rc_addresses.id
 */

// ============================================================================
// Address Schema
// ============================================================================

/**
 * Address schema from rc_addresses table
 */
export const AddressSchema = z.object({
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  state_name: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
});

export type Address = z.infer<typeof AddressSchema>;

// ============================================================================
// Property Status Schema
// ============================================================================

/**
 * Status schema from property_status_key table
 */
export const PropertyStatusSchema = z.object({
  status_id: z.number().int().positive(),
  status: z.string().nullable().optional(),
});

export type PropertyStatus = z.infer<typeof PropertyStatusSchema>;

// ============================================================================
// Property Row Schema (for list/detail display)
// ============================================================================

/**
 * Property row schema representing rc_properties with joined relations
 * Used for list and detail views (read-only)
 */
export const PropertyRowSchema = z.object({
  properties_id: z.number().int().positive(),
  property_name: z.string().min(1),
  estimated_cleaning_mins: z.number().int().nonnegative().max(1440).nullable().optional(),
  double_unit: z.array(z.number().int().positive()).nullable().optional(),
  address: AddressSchema.nullable().optional(),
  status: PropertyStatusSchema.nullable().optional(),
});

export type PropertyRow = z.infer<typeof PropertyRowSchema>;

// ============================================================================
// Property Query Schema (for filtering/sorting)
// ============================================================================

/**
 * Query parameters for property list filtering
 * Follows Task 13 camelCase conventions
 */
export const PropertyQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
  city: z.string().optional(),
  cleaningTimeMin: z.number().int().nonnegative().optional(),
  cleaningTimeMax: z.number().int().nonnegative().optional(),
  statusIds: z.array(z.number().int().positive()).optional(),
  sort: z.string().optional(),
});

export type PropertyQuery = z.infer<typeof PropertyQuerySchema>;

// ============================================================================
// Property Update Payload Schema (for settings edit)
// ============================================================================

/**
 * Payload for updating property settings (estimated_cleaning_mins and double_unit)
 * Only these fields are editable; core fields remain read-only
 */
export const PropertyUpdatePayloadSchema = z.object({
  estimated_cleaning_mins: z
    .number()
    .int()
    .min(0, "Cleaning time must be at least 0 minutes")
    .max(1440, "Cleaning time cannot exceed 24 hours (1440 minutes)")
    .nullable()
    .optional(),
  double_unit: z
    .array(z.number().int().positive())
    .max(20, "Cannot link more than 20 properties")
    .nullable()
    .optional()
    .transform((arr) => {
      // Dedupe array
      if (!arr || arr.length === 0) return arr;
      return Array.from(new Set(arr));
    }),
});

export type PropertyUpdatePayload = z.infer<typeof PropertyUpdatePayloadSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format minutes as human-readable duration (e.g., "1h 30m")
 * 
 * @param minutes - Total minutes
 * @returns Formatted string like "1h 30m" or "45m"
 * 
 * @example
 * formatMinutes(90) // "1h 30m"
 * formatMinutes(45) // "45m"
 * formatMinutes(120) // "2h"
 */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "0m";
  
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Convert HH:MM string to total minutes
 * Supports both "H:MM" and "HH:MM" formats
 * 
 * @param hhmm - Time string in HH:MM format
 * @returns Total minutes, or null if invalid
 * 
 * @example
 * hmToMinutes("1:30") // 90
 * hmToMinutes("01:30") // 90
 * hmToMinutes("24:00") // 1440
 * hmToMinutes("invalid") // null
 */
export function hmToMinutes(hhmm: string): number | null {
  const trimmed = hhmm.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  
  if (!match) return null;
  
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (m < 0 || m >= 60) return null;
  if (h < 0) return null;
  
  return h * 60 + m;
}

/**
 * Deduplicate array of property IDs
 * 
 * @param ids - Array of property IDs
 * @returns Deduplicated array preserving order
 */
export function dedupeIds(ids: number[]): number[] {
  return Array.from(new Set(ids));
}

/**
 * Clamp minutes to valid range or return null
 * 
 * @param minutes - Minutes value to clamp
 * @param min - Minimum value (default 0)
 * @param max - Maximum value (default 1440)
 * @returns Clamped value or null if input is null/undefined
 */
export function clampMinutes(
  minutes: number | null | undefined,
  min: number = 0,
  max: number = 1440
): number | null {
  if (minutes === null || minutes === undefined) return null;
  if (!Number.isFinite(minutes)) return null;
  
  return Math.min(max, Math.max(min, Math.floor(minutes)));
}

/**
 * Remove self-reference from double_unit array
 * Used to prevent a property from being its own dependency
 * 
 * @param ids - Array of property IDs
 * @param selfId - The property's own ID to exclude
 * @returns Filtered array without self-reference
 */
export function removeSelfReference(ids: number[], selfId: number): number[] {
  return ids.filter((id) => id !== selfId);
}

/**
 * Helper to format property display name
 * Falls back to ID if name is not available
 */
export function formatPropertyName(property: PropertyRow): string {
  return property.property_name || `Property ${property.properties_id}`;
}
