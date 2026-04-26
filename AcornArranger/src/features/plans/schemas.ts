/**
 * Plan-related schemas for Schedule Builder
 * Aligned with legacy PlanBuildOptions and schedule_plans structure
 */

/**
 * Which scheduler engine a Build request targets.
 * - `vrptw`: the new OR-Tools sidecar path (staged via get_build_problem_payload,
 *   biased by Tier 2 affinity, committed via commit_schedule_plan).
 * - `legacy`: the original `build_schedule_plan` Postgres RPC, preserved as a
 *   one-click fallback during rollout.
 */
export type PlanBuildEngine = "vrptw" | "legacy";

export type PlanBuildOptions = {
  available_staff: number[];
  services: number[];
  omissions: number[];
  routing_type: 1 | 2 | 3 | 4 | 5;
  cleaning_window: number;
  max_hours: number;
  target_staff_count?: number;
  /** Engine toggle. Defaults to `vrptw`. Ignored by the legacy RPC path. */
  engine: PlanBuildEngine;
  /**
   * Window (days) used by `get_staff_property_affinity` to compute the
   * routing-stage Tier 2 soft cost. Wider windows surface more stable
   * staff<->property relationships; narrower windows react faster to
   * recent preference changes. Default 180.
   */
  property_affinity_lookback_days: number;
  /**
   * Window (days) used by `get_staff_pairing_affinity` to compute the
   * team-formation Tier 2 soft cost. Shorter default than property affinity
   * because staff turnover makes older pairings stale quickly. Default 90.
   */
  pairing_affinity_lookback_days: number;
  /**
   * Optional explicit number of teams. When set, the sidecar's team-formation
   * heuristic uses this value verbatim (capped only by total cleaner count)
   * and will promote senior housekeepers to ad-hoc leads if more teams are
   * requested than there are `can_lead_team` staff. Use this to handle days
   * where leads-in-training are working but their `can_lead_team` flag has
   * not been flipped yet. Leaving this unset auto-derives the team count
   * (work-minutes / cleaning_window, capped by available leads) for parity
   * with the legacy RPC.
   */
  num_teams?: number;
  /**
   * Optional soft target for staff-per-team. Used as the team-formation
   * sizing knob when `num_teams` is unset: the sidecar derives
   * `num_teams = ceil(available_cleaners / target_team_size)` and bypasses
   * the lead cap, again promoting ad-hoc leads if needed. When both fields
   * are set, `num_teams` wins.
   */
  target_team_size?: number;
};

export const PLAN_BUILD_DEFAULTS: PlanBuildOptions = {
  available_staff: [],
  services: [21942, 23044],
  omissions: [],
  routing_type: 1,
  cleaning_window: 6.0,
  max_hours: 6.5,
  engine: "vrptw",
  property_affinity_lookback_days: 180,
  pairing_affinity_lookback_days: 90,
};

export const ENGINE_LABELS: Record<PlanBuildEngine, string> = {
  vrptw: "Sidecar (new)",
  legacy: "Legacy RPC",
};

export const AFFINITY_LOOKBACK_BOUNDS = {
  property: { min: 30, max: 730 },
  pairing: { min: 30, max: 365 },
} as const;

export const TEAM_SHAPE_BOUNDS = {
  num_teams: { min: 1, max: 30 },
  target_team_size: { min: 1, max: 12 },
} as const;

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
  /** ISO timestamp when the shift starts (Homebase `start_at`). */
  start_at?: string;
  /** ISO timestamp when the shift ends (Homebase `end_at`). */
  end_at?: string;
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
