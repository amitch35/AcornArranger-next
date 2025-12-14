import { z } from "zod";

/**
 * Staff-related Zod schemas aligned with actual database schema
 * 
 * Schema verification (via Supabase MCP):
 * - rc_staff.user_id (bigint) is the primary key
 * - rc_staff.role (bigint FK) -> roles.id
 * - rc_staff.status_id (smallint FK) -> staff_status_key.status_id
 * - roles table: id, title, priority, can_lead_team, can_clean
 * - staff_status_key: status_id (1=Active, 2=Inactive, 3=Unverified)
 */

// ============================================================================
// Role Schema
// ============================================================================

/**
 * Role schema from roles table
 * Represents job titles with capabilities and scheduling priority
 */
export const RoleSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.number().int().default(500),
  can_lead_team: z.boolean().default(false),
  can_clean: z.boolean().default(false),
});

export type Role = z.infer<typeof RoleSchema>;

// ============================================================================
// Status Schema
// ============================================================================

/**
 * Status schema from staff_status_key table
 * Maps status_id to human-readable status labels
 */
export const StatusSchema = z.object({
  status_id: z.number().int().positive(),
  status: z.enum(["Active", "Inactive", "Unverified"]),
});

export type Status = z.infer<typeof StatusSchema>;

// ============================================================================
// Staff Schema
// ============================================================================

/**
 * Staff schema representing rc_staff table with joined relations
 * 
 * Note: user_id (not 'id') is the primary key
 * All fields except user_id are nullable/optional as they may not be populated
 */
export const StaffSchema = z.object({
  user_id: z.number().int().positive(),
  name: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  role: RoleSchema.nullable().optional(),
  status: StatusSchema.nullable().optional(),
  hb_user_id: z.number().int().positive().nullable().optional(),
});

export type Staff = z.infer<typeof StaffSchema>;

// ============================================================================
// API Response Schemas
// ============================================================================

/**
 * Staff list response with pagination
 */
export const StaffListResponseSchema = z.object({
  items: z.array(StaffSchema),
  total: z.number().int().nonnegative(),
});

export type StaffListResponse = z.infer<typeof StaffListResponseSchema>;

/**
 * Staff detail response with computed capabilities
 */
export const StaffDetailResponseSchema = StaffSchema.extend({
  capabilities: z.array(z.string()).optional(),
});

export type StaffDetailResponse = z.infer<typeof StaffDetailResponseSchema>;

// ============================================================================
// Utility Schemas
// ============================================================================

/**
 * Capability strings derived from role flags
 */
export const CapabilitySchema = z.enum(["can_clean", "can_lead_team"]);

export type Capability = z.infer<typeof CapabilitySchema>;

/**
 * Helper to derive capabilities array from role
 */
export function deriveCapabilities(role: Role | null | undefined): string[] {
  if (!role) return [];
  
  const capabilities: string[] = [];
  if (role.can_clean) capabilities.push("can_clean");
  if (role.can_lead_team) capabilities.push("can_lead_team");
  
  return capabilities;
}

/**
 * Helper to check if staff has a specific capability
 */
export function hasCapability(
  staff: Staff | StaffDetailResponse,
  capability: Capability
): boolean {
  if (!staff.role) return false;
  
  switch (capability) {
    case "can_clean":
      return staff.role.can_clean;
    case "can_lead_team":
      return staff.role.can_lead_team;
    default:
      return false;
  }
}

/**
 * Helper to format staff display name
 * Falls back to parts or user_id if name is not available
 */
export function formatStaffName(staff: Staff): string {
  if (staff.name) return staff.name;
  if (staff.first_name && staff.last_name) {
    return `${staff.first_name} ${staff.last_name}`;
  }
  if (staff.first_name) return staff.first_name;
  return `Staff ${staff.user_id}`;
}
