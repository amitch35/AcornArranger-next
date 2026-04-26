/**
 * Payload shapes for the Acorn Arranger scheduler sidecar.
 *
 * Mirrors the Pydantic models in `acornarranger-scheduler/src/types.py`.
 * Pure types and pure transforms only - no I/O. The API route owns the
 * Supabase and fetch calls that produce/consume these.
 */

import type { PlanBuildOptions } from "@/src/features/plans/schemas";

// -----------------------------------------------------------------------------
// Problem payload (mirrors public.get_build_problem_payload output)
// -----------------------------------------------------------------------------

export type OfficeLocation = { lat: number; lon: number };

export type ProblemInputs = {
  available_staff: number[];
  services: number[];
  omissions: number[];
  cleaning_window: number;
  max_hours: number;
  target_staff_count: number | null;
  office_location: OfficeLocation;
};

export type ProblemAppointment = {
  appointment_id: number;
  property_id: number;
  property_name: string | null;
  service: number | null;
  app_status_id: number | null;
  app_status: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  next_arrival_time: string | null;
  effective_next_arrival: string | null;
  turn_around: boolean | null;
  cancelled_date: string | null;
  estimated_cleaning_mins: number | null;
  address_id: number | null;
  lat: number;
  lon: number;
};

export type ProblemTravelTime = {
  src_address_id: number;
  dest_address_id: number;
  travel_time_minutes: number;
};

export type ProblemStaff = {
  user_id: number;
  name: string | null;
  role_id: number | null;
  role_title: string | null;
  can_clean: boolean;
  can_lead_team: boolean;
  priority: number | null;
};

export type Problem = {
  plan_date: string;
  generated_at: string | null;
  inputs: ProblemInputs;
  appointments: ProblemAppointment[];
  travel_times: ProblemTravelTime[];
  staff: ProblemStaff[];
};

// -----------------------------------------------------------------------------
// Affinity payloads (mirror RPC row shapes)
// -----------------------------------------------------------------------------

export type PropertyAffinityRow = {
  staff_id: number;
  property_id: number;
  score: number;
};

export type PairingAffinityRow = {
  staff_a_id: number;
  staff_b_id: number;
  score: number;
};

// -----------------------------------------------------------------------------
// Sidecar request / response envelope
// -----------------------------------------------------------------------------

export type SolverOptions = {
  time_limit_sec?: number;
  property_affinity_weight_minutes?: number;
  chemistry_weight?: number;
  num_teams?: number | null;
  target_team_size?: number | null;
};

export type SolveRequest = {
  problem: Problem;
  property_affinity: PropertyAffinityRow[];
  pairing_affinity: PairingAffinityRow[];
  solver_opts?: SolverOptions;
};

export type SolvedAppointment = { appointment_id: number; ord: number };

export type SolvedTeam = {
  team: number;
  lead_id: number | null;
  staff_ids: number[];
  appointment_ids: number[];
  appointments: SolvedAppointment[];
  travel_minutes: number;
  service_minutes: number;
};

export type SolvePlan = {
  plan_date: string;
  teams: SolvedTeam[];
  solved_at?: string;
};

export type SolveDiagnostics = {
  plan_date: string;
  num_stops: number;
  num_teams_requested: number;
  num_teams_used: number;
  dropped: number[];
  total_travel_minutes: number;
  objective: number | null;
  solver_status: string;
  midnight_stops_scrubbed: number[];
  notes: string[];
};

export type SolveResponse = {
  plan: SolvePlan;
  diagnostics: SolveDiagnostics;
};

// -----------------------------------------------------------------------------
// commit_schedule_plan input shape
// -----------------------------------------------------------------------------

export type CommitTeam = {
  team: number;
  staff_ids: number[];
  appointment_ids?: number[];
  appointments?: SolvedAppointment[];
};

export type CommitSchedulePlanInput = {
  teams: CommitTeam[];
};

export type CommitSchedulePlanResult = {
  plan_date: string;
  plan_ids: number[];
};

// -----------------------------------------------------------------------------
// Pure transforms
// -----------------------------------------------------------------------------

/**
 * Build the sidecar's SolveRequest body from the three Supabase RPC responses
 * plus the user-provided build options. Keeping this pure lets the API route
 * stay thin and lets tests exercise the shape without network dependencies.
 */
export function buildSolveRequest(args: {
  problem: Problem;
  propertyAffinity: PropertyAffinityRow[];
  pairingAffinity: PairingAffinityRow[];
  solverOpts?: SolverOptions;
}): SolveRequest {
  return {
    problem: args.problem,
    property_affinity: args.propertyAffinity,
    pairing_affinity: args.pairingAffinity,
    solver_opts: args.solverOpts,
  };
}

/**
 * Convert a solved SolvePlan into the shape `commit_schedule_plan` expects.
 * The sidecar decides whether to drop solver-empty teams (default) or keep
 * them when an explicit team-shape override was supplied. We trust that
 * decision and only defensively drop teams with no staff at all - those would
 * be a real bug because Stage A always seats at least one staffer per team.
 */
export function toCommitInput(plan: SolvePlan): CommitSchedulePlanInput {
  return {
    teams: plan.teams
      .filter((t) => t.staff_ids.length > 0)
      .map((t) => ({
        team: t.team,
        staff_ids: t.staff_ids,
        appointments: t.appointments,
      })),
  };
}

/**
 * Extract the SolverOptions subset from PlanBuildOptions. The lookback-day
 * fields drive the affinity RPCs in the route, not the sidecar, so they are
 * intentionally not forwarded here. Team-shape overrides (`num_teams`,
 * `target_team_size`) and any future tuning knobs (`affinity_weight_minutes`,
 * `chemistry_weight`) are passed through; unset values fall back to the
 * sidecar's pydantic defaults.
 */
export function solverOptsFromBuildOptions(
  options: PlanBuildOptions
): SolverOptions | undefined {
  const opts: SolverOptions = {};
  if (typeof options.num_teams === "number" && options.num_teams > 0) {
    opts.num_teams = options.num_teams;
  }
  if (
    typeof options.target_team_size === "number" &&
    options.target_team_size > 0
  ) {
    opts.target_team_size = options.target_team_size;
  }
  return Object.keys(opts).length > 0 ? opts : undefined;
}
