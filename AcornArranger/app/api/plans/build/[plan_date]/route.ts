import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";
import type { PlanBuildOptions } from "@/src/features/plans/schemas";
import { SchedulerError, solveWithSidecar } from "@/lib/scheduler/client";
import {
  buildSolveRequest,
  solverOptsFromBuildOptions,
  toCommitInput,
  type CommitSchedulePlanResult,
  type PairingAffinityRow,
  type Problem,
  type PropertyAffinityRow,
} from "@/lib/scheduler/problem";

const OFFICE_LOCATION_DEFAULT =
  "0101000020E6100000D2DB44D213E95DC01D12088552AC4240";

type SupabaseRpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string; details?: string; hint?: string } | null;
    status: number;
  }>;
};

async function runLegacyEngine(
  supabase: SupabaseRpcClient,
  planDate: string,
  options: Required<Pick<
    PlanBuildOptions,
    "available_staff" | "services" | "omissions" | "routing_type" | "cleaning_window" | "max_hours"
  >> & { target_staff_count: number | null }
) {
  return supabase.rpc("build_schedule_plan", {
    date_to_schedule: planDate,
    available_staff: options.available_staff,
    office_location: OFFICE_LOCATION_DEFAULT,
    services: options.services,
    omissions: options.omissions,
    routing_type: options.routing_type,
    cleaning_window: options.cleaning_window,
    max_hours: options.max_hours,
    target_staff_count: options.target_staff_count,
  });
}

async function runVrptwEngine(
  supabase: SupabaseRpcClient,
  planDate: string,
  body: Partial<PlanBuildOptions>,
  options: Required<Pick<
    PlanBuildOptions,
    "available_staff" | "services" | "omissions" | "cleaning_window" | "max_hours"
  >> & { target_staff_count: number | null }
) {
  const propertyLookback =
    body.property_affinity_lookback_days ?? 180;
  const pairingLookback =
    body.pairing_affinity_lookback_days ?? 90;

  // 1. Stage the problem in SQL (includes double-unit window tightening).
  const payloadRes = await supabase.rpc("get_build_problem_payload", {
    p_plan_date: planDate,
    p_available_staff: options.available_staff,
    p_services: options.services,
    p_omissions: options.omissions,
    p_cleaning_window: options.cleaning_window,
    p_max_hours: options.max_hours,
    p_target_staff_count: options.target_staff_count,
    p_office_location: OFFICE_LOCATION_DEFAULT,
  });
  if (payloadRes.error) {
    return NextResponse.json(
      {
        code: "BUILD_ERROR",
        message: `get_build_problem_payload failed: ${payloadRes.error.message}`,
        details: payloadRes.error.details,
        hint: payloadRes.error.hint,
      },
      { status: 400 }
    );
  }
  // get_build_problem_payload now raises PT400 itself for empty appointments,
  // empty staff, or null inputs (with message/detail/hint). The branch above
  // already relays those. The remaining null-data check is a defensive backstop
  // in case PostgREST surfaces an empty body without an error for some reason.
  const problem = payloadRes.data as Problem | null;
  if (!problem) {
    return NextResponse.json(
      { code: "BUILD_ERROR", message: "Problem payload was empty" },
      { status: 400 }
    );
  }

  // 2. Fetch both Tier 2 signals in parallel.
  const [propAff, pairAff] = await Promise.all([
    supabase.rpc("get_staff_property_affinity", {
      p_lookback_days: propertyLookback,
    }),
    supabase.rpc("get_staff_pairing_affinity", {
      p_lookback_days: pairingLookback,
    }),
  ]);
  if (propAff.error) {
    return NextResponse.json(
      {
        code: "BUILD_ERROR",
        message: `get_staff_property_affinity failed: ${propAff.error.message}`,
      },
      { status: 400 }
    );
  }
  if (pairAff.error) {
    return NextResponse.json(
      {
        code: "BUILD_ERROR",
        message: `get_staff_pairing_affinity failed: ${pairAff.error.message}`,
      },
      { status: 400 }
    );
  }

  // 3. Hand off to the sidecar.
  const solveRequest = buildSolveRequest({
    problem,
    propertyAffinity: (propAff.data as PropertyAffinityRow[] | null) ?? [],
    pairingAffinity: (pairAff.data as PairingAffinityRow[] | null) ?? [],
    solverOpts: solverOptsFromBuildOptions(body as PlanBuildOptions),
  });

  let solve;
  try {
    solve = await solveWithSidecar(solveRequest);
  } catch (err) {
    if (err instanceof SchedulerError) {
      const status =
        err.code === "SCHEDULER_UNAVAILABLE" || err.code === "SCHEDULER_TIMEOUT"
          ? 503
          : 502;
      return NextResponse.json(
        {
          code: err.code,
          message: err.message,
          details: err.details,
          hint: "Toggle the engine to Legacy RPC in Build Options as a fallback.",
        },
        { status }
      );
    }
    throw err;
  }

  // 4. Commit the solved plan atomically.
  const commitRes = await supabase.rpc("commit_schedule_plan", {
    p_plan_date: planDate,
    p_plan: toCommitInput(solve.plan),
  });
  if (commitRes.error) {
    return NextResponse.json(
      {
        code: "COMMIT_FAILED",
        message: `commit_schedule_plan failed: ${commitRes.error.message}`,
        details: commitRes.error.details,
        hint: commitRes.error.hint,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    engine: "vrptw",
    plan_date: planDate,
    plan_ids: (commitRes.data as CommitSchedulePlanResult | null)?.plan_ids ?? [],
    diagnostics: solve.diagnostics,
  });
}

export const POST = withMinRole(
  async (
    req: NextRequest,
    context: { params?: { plan_date: string } }
  ) => {
    try {
      const planDate = context.params?.plan_date;

      if (!planDate) {
        return NextResponse.json(
          { error: "plan_date is required" },
          { status: 400 }
        );
      }

      const body = (await req.json()) as Partial<PlanBuildOptions>;
      const engine = body.engine ?? "vrptw";
      const options = {
        available_staff: body.available_staff ?? [],
        services: body.services ?? [21942, 23044],
        omissions:
          body.omissions && body.omissions.length > 0 ? body.omissions : [],
        routing_type: body.routing_type ?? 1,
        cleaning_window: body.cleaning_window ?? 6.0,
        max_hours: body.max_hours ?? 6.5,
        target_staff_count: body.target_staff_count ?? null,
      };

      const supabase = (await createClient()) as unknown as SupabaseRpcClient;

      if (engine === "legacy") {
        const { data, error } = await runLegacyEngine(supabase, planDate, options);
        if (error) {
          return NextResponse.json(
            {
              code: "BUILD_ERROR",
              message: error.message,
              details: error.details,
              hint: error.hint,
            },
            { status: 400 }
          );
        }
        return NextResponse.json({ engine: "legacy", data: data ?? {} });
      }

      return await runVrptwEngine(supabase, planDate, body, options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { code: "BUILD_ERROR", message: message },
        { status: 500 }
      );
    }
  },
  { minRole: "authorized_user" }
);
