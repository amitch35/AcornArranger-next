import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";
import type { PlanBuildOptions } from "@/src/features/plans/schemas";

const OFFICE_LOCATION_DEFAULT =
  "0101000020E6100000D2DB44D213E95DC01D12088552AC4240";

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
      const available_staff = body.available_staff ?? [];
      const services = body.services ?? [21942, 23044];
      const omissions =
        body.omissions && body.omissions.length > 0 ? body.omissions : [];
      const routing_type = body.routing_type ?? 1;
      const cleaning_window = body.cleaning_window ?? 6.0;
      const max_hours = body.max_hours ?? 6.5;
      const target_staff_count = body.target_staff_count ?? null;

      const supabase = await createClient();

      const { data, error, status } = await supabase.rpc("build_schedule_plan", {
        date_to_schedule: planDate,
        available_staff,
        office_location: OFFICE_LOCATION_DEFAULT,
        services,
        omissions,
        routing_type,
        cleaning_window,
        max_hours,
        target_staff_count,
      });

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

      return NextResponse.json(data ?? {});
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
