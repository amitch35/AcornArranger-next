import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";

/**
 * Send plans to ResortCleaning (Task 7 integration).
 * Placeholder for now - full implementation in Task 7.
 */
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

      const supabase = await createClient();

      const { data, error, status } = await supabase.rpc(
        "schedule_send_rc_schedule_plans",
        { schedule_date: planDate }
      );

      if (error) {
        return NextResponse.json(
          {
            code: "SEND_ERROR",
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
        { code: "SEND_ERROR", message },
        { status: 500 }
      );
    }
  },
  { minRole: "authorized_user" }
);
