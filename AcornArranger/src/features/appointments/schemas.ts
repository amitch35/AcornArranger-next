import { z } from "zod";

/**
 * Appointment-related Zod schemas aligned with actual database schema
 *
 * Schema verification (via Supabase types):
 * - rc_appointments.id (bigint) is the PK
 * - rc_appointments.appointment_id (bigint nullable) — legacy ID
 * - rc_appointments.app_status_id (smallint FK) → appointment_status_key.status_id
 * - rc_appointments.property (bigint FK) → rc_properties.properties_id
 * - rc_appointments.service (bigint FK) → service_key.service_id
 * - rc_appointments.departure_time (timestamptz nullable) — "Service Time" start (guest departs, cleaners begin)
 * - rc_appointments.arrival_time (timestamptz nullable) — "Service Time" end
 * - rc_appointments.next_arrival_time (timestamptz nullable) — next guest check-in deadline
 * - rc_appointments.turn_around (boolean nullable) — T/A indicator
 * - rc_appointments.cancelled_date (timestamptz nullable)
 * - Staff via appointments_staff join (appointment_id → rc_appointments.appointment_id; staff_id → rc_staff.user_id)
 */

// ============================================================================
// Status Schema (from appointment_status_key table)
// ============================================================================

export const AppointmentStatusSchema = z.object({
  status_id: z.number().int(),
  status: z.string().nullable(),
});

export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

// ============================================================================
// Property Info Schema (joined from rc_properties)
// ============================================================================

export const AppointmentPropertyInfoSchema = z.object({
  properties_id: z.number().int(),
  property_name: z.string(),
});

export type AppointmentPropertyInfo = z.infer<typeof AppointmentPropertyInfoSchema>;

// ============================================================================
// Staff Member Schema (joined via appointments_staff → rc_staff)
// ============================================================================

export const AppointmentStaffMemberSchema = z.object({
  user_id: z.number().int(),
  name: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
});

export type AppointmentStaffMember = z.infer<typeof AppointmentStaffMemberSchema>;

// ============================================================================
// Service Info Schema (joined from service_key)
// ============================================================================

export const AppointmentServiceInfoSchema = z.object({
  service_id: z.number().int(),
  name: z.string().nullable(),
});

export type AppointmentServiceInfo = z.infer<typeof AppointmentServiceInfoSchema>;

// ============================================================================
// Appointment Row Schema (list view — with joined relations)
// ============================================================================

/**
 * Full appointment row returned by /api/appointments list endpoint.
 * All joins are nullable to handle missing/legacy data gracefully.
 */
export const AppointmentRowSchema = z.object({
  id: z.number().int(),
  appointment_id: z.number().int().nullable(),
  departure_time: z.string().nullable(),
  arrival_time: z.string().nullable(),
  next_arrival_time: z.string().nullable(),
  turn_around: z.boolean().nullable(),
  cancelled_date: z.string().nullable(),
  created_at: z.string(),
  status: AppointmentStatusSchema.nullable().optional(),
  property_info: AppointmentPropertyInfoSchema.nullable().optional(),
  service_info: AppointmentServiceInfoSchema.nullable().optional(),
  staff: z.array(AppointmentStaffMemberSchema).default([]),
});

export type AppointmentRow = z.infer<typeof AppointmentRowSchema>;

// ============================================================================
// API Response Schemas
// ============================================================================

export const AppointmentListResponseSchema = z.object({
  items: z.array(AppointmentRowSchema),
  total: z.number().int().nonnegative(),
});

export type AppointmentListResponse = z.infer<typeof AppointmentListResponseSchema>;

export const AppointmentDetailResponseSchema = AppointmentRowSchema;

export type AppointmentDetailResponse = z.infer<typeof AppointmentDetailResponseSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a staff member's display name.
 * Falls back to first/last name parts, then user_id.
 */
export function formatAppointmentStaffName(staff: AppointmentStaffMember): string {
  if (staff.name) return staff.name;
  const parts = [staff.first_name, staff.last_name].filter(Boolean).join(" ");
  return parts || `Staff ${staff.user_id}`;
}

/**
 * Get the primary staff display for a list of staff members.
 * Returns the first staff name and a count of additional members.
 */
export function formatStaffSummary(staff: AppointmentStaffMember[]): {
  primary: string;
  additionalCount: number;
} {
  if (!staff.length) return { primary: "Unassigned", additionalCount: 0 };
  return {
    primary: formatAppointmentStaffName(staff[0]),
    additionalCount: Math.max(0, staff.length - 1),
  };
}

/**
 * Map a status_id to a Badge variant (mirrors Staff page approach).
 * Variant mapping is based on common status patterns:
 * - Active/Confirmed states → "default"
 * - Completed/Done states → "secondary"
 * - Cancelled/Error states → "destructive"
 * - Other/Unknown → "outline"
 */
export function getStatusBadgeVariant(
  statusLabel: string | null | undefined
): "default" | "secondary" | "destructive" | "outline" {
  if (!statusLabel) return "outline";
  const lower = statusLabel.toLowerCase();

  if (lower.includes("confirm") || lower.includes("active") || lower.includes("scheduled")) {
    return "default";
  }
  if (lower.includes("complete") || lower.includes("done") || lower.includes("finish")) {
    return "secondary";
  }
  if (lower.includes("cancel")) {
    return "destructive";
  }
  return "outline";
}

/**
 * Format a datetime for display (date + time) - matches legacy format.
 * Shows: MM/DD/YYYY, HH:MM AM/PM
 * 
 * Special case: If time is exactly midnight (00:00:00), only show the date
 * since this likely indicates missing/placeholder time data.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    
    // Check if time is exactly midnight (00:00:00)
    // This likely means the time is not actually set/known
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    
    if (hours === 0 && minutes === 0 && seconds === 0) {
      // Show date only for midnight times
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    
    // Show full date + time for all other times
    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

/**
 * Check if a datetime is within the next N hours from now.
 */
export function isWithinHours(iso: string | null | undefined, hours: number): boolean {
  if (!iso) return false;
  try {
    const target = new Date(iso).getTime();
    const now = Date.now();
    const diff = target - now;
    return diff > 0 && diff <= hours * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
