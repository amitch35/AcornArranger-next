import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";

const selectPlans = `
  plan_id:id,
  plan_date,
  team,
  appointments:plan_appointments (
    appointment_id,
    sent_to_rc,
    appointment_info:rc_appointments (
      appointment_id,
      arrival_time,
      service_time:departure_time,
      next_arrival_time,
      turn_around,
      cancelled_date,
      property_info:rc_properties (
        properties_id,
        property_name
      ),
      service:service_key (
        service_id,
        service_name:name
      ),
      status:appointment_status_key (
        status_id,
        status
      )
    )
  ),
  staff:plan_staff (
    user_id:staff_id,
    staff_info:rc_staff (
      user_id,
      name
    )
  )
`;

export const GET = withMinRole(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const fromPlanDate = searchParams.get("from_plan_date");
      const toPlanDate = searchParams.get("to_plan_date");
      const perPage = Number(searchParams.get("per_page") || 50);
      const page = Number(searchParams.get("page") || 0);
      const offset = perPage * page;

      const supabase = await createClient();

      let query = supabase
        .from("schedule_plans")
        .select(selectPlans, { count: "exact" })
        .eq("valid", true)
        .filter("plan_appointments.valid", "eq", true)
        .filter("plan_staff.valid", "eq", true);

      if (fromPlanDate && !toPlanDate) {
        query = query
          .gte("plan_date", fromPlanDate)
          .lte("plan_date", fromPlanDate);
      } else if (fromPlanDate) {
        query = query.gte("plan_date", fromPlanDate);
      }
      if (toPlanDate) {
        query = query.lte("plan_date", toPlanDate);
      }

      query = query
        .range(offset, offset + perPage - 1)
        .order("plan_date", { ascending: false })
        .order("team", { ascending: true })
        .order("ord", { referencedTable: "plan_appointments", ascending: true });

      const { data, error, status, count } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status });
      }

      return NextResponse.json(data ?? [], {
        status: 200,
        headers: {
          "Content-Range": `plans ${offset}-${offset + (data?.length ?? 0) - 1}/${count ?? 0}`,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { minRole: "authorized_user" }
);
