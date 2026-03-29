/**
 * Plan-related schemas for Schedule Builder
 * Aligned with legacy PlanBuildOptions and schedule_plans structure
 */

export type PlanBuildOptions = {
  available_staff: number[];
  services: number[];
  omissions: number[];
  routing_type: 1 | 2 | 3 | 4 | 5;
  cleaning_window: number;
  max_hours: number;
  target_staff_count?: number;
};

export const PLAN_BUILD_DEFAULTS: PlanBuildOptions = {
  available_staff: [],
  services: [21942, 23044],
  omissions: [],
  routing_type: 1,
  cleaning_window: 6.0,
  max_hours: 6.5,
};

export const ROUTING_TYPE_LABELS: Record<number, string> = {
  1: "Farthest to Office (Recommended)",
  2: "Farthest to Anywhere",
  3: "Office to Farthest",
  4: "Office to Anywhere",
  5: "Start and end Anywhere",
};

export type PlanStaffMember = {
  user_id: number;
  staff_info: { user_id: number; name: string | null };
};

export type PlanAppointment = {
  appointment_id: number;
  sent_to_rc: string | null;
  appointment_info: {
    appointment_id: number;
    arrival_time: string | null;
    service_time: string | null;
    next_arrival_time: string | null;
    turn_around: boolean | null;
    cancelled_date: string | null;
    property_info: { properties_id: number; property_name: string | null };
    service: { service_id: number; service_name: string };
    status: { status_id: number; status: string };
  };
};

export type Plan = {
  plan_id: number;
  plan_date: string;
  team: number;
  appointments: PlanAppointment[];
  staff: PlanStaffMember[];
};

export type ErrorResponse = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

/**
 * A plan is considered sent (immutable) if any of its appointments have
 * been pushed to ResortCleaning (sent_to_rc is not null).
 * Mirrors the legacy check: plan.appointments[0].sent_to_rc !== null
 */
export function isPlanSent(plan: Plan): boolean {
  return plan.appointments.some((a) => a.sent_to_rc !== null);
}

/**
 * Raw Homebase shift record as returned by the Homebase API.
 * Only the fields used by AcornArranger are typed here.
 */
export type HomebaseShift = {
  user_id: number;
  first_name: string;
  last_name: string;
  role: string;
};

/**
 * One entry in the array returned by the `get_staff_shifts` Supabase RPC.
 * Each entry corresponds to one Homebase shift for the requested date range.
 *
 * - matched: true when the Homebase user_id was found in rc_staff.hb_user_id
 * - user_id / name: the matched rc_staff values (null when unmatched)
 * - shift: the raw Homebase payload
 */
export type StaffShift = {
  matched: boolean;
  user_id: number | null;
  name: string | null;
  shift: HomebaseShift;
};
