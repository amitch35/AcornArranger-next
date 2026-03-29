import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";

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

      const { data, error, status } = await supabase.rpc("plan_create_new", {
        target_plan_date: planDate,
      });

      if (error) {
        return NextResponse.json(
          { code: "ADD_ERROR", message: error.message, details: error.details },
          { status: 400 }
        );
      }

      return NextResponse.json(data ?? {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { code: "ADD_ERROR", message },
        { status: 500 }
      );
    }
  },
  { minRole: "authorized_user" }
);
